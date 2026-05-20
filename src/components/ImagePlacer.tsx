"use client";

import { Upload, X, Crop as CropIcon } from "lucide-react";
import { useCallback, useEffect, useState, useRef } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { CropDialog } from "./CropDialog";
import { ColorPicker } from "./ColorPicker";

export interface CanvasImage {
  id: string;     // unique identifier
  src: string;
  x: number;      // 0–1 fraction (center of image on canvas)
  y: number;      // 0–1 fraction (center of image on canvas)
  width: number;  // fraction of canvas width (0.05 – 0.95)
  height: number; // fraction of canvas height (0.05 – 0.95)
  /** Border radius as percentage of the smaller dimension. 0 = sharp, 50 = circle. */
  cornerRadius?: number;
  /** Legacy field — superseded by `cornerRadius`. Kept so old sessionStorage entries still render. */
  shape?: "circle" | "rounded";
  border: boolean;
  /** Solid border color. When unset (and `border` is true) the default
   *  TechBBQ gold→orange→red gradient is used. */
  borderColor?: string;
  /** Border thickness in fractional canvas-width units (e.g. 0.004 ≈ 6px on
   *  a 1500px canvas). Defaults to ~0.003 when border is on. */
  borderWidth?: number;
  /** Optional crop region in 0–1 fractions of the natural source image. */
  crop?: { x: number; y: number; width: number; height: number };
  /** When true the image can't be selected via marquee or dragged. */
  locked?: boolean;
  /** Shared group identifier — clicking any member selects the whole group. */
  groupId?: string;
  /** Source image natural pixel dimensions — captured at upload time and
   *  used by the inline crop editor to keep aspect ratio correct when the
   *  user has resized the frame after cropping. Optional for backwards
   *  compatibility with older saved sessions. */
  naturalWidth?: number;
  naturalHeight?: number;
  /** How the image fills its bbox. Default "cover" (crop to fill). "contain"
   *  fits the whole image inside without cropping — needed for partner /
   *  sponsor logos where the aspect ratio is arbitrary. */
  fit?: "cover" | "contain";
  /** Optional solid color fill BEHIND the image. Shows in letterbox areas
   *  when the image is contain-fit (so transparent logos sit on a clear
   *  card). Independent of `border` (which is the stroke around the bbox). */
  backdropColor?: string;
  /** Inner padding between the bbox edge and the image, in fractional
   *  canvas-width units (e.g. 0.02 ≈ 30px on a 1500-canvas). The backdrop
   *  fill and border still occupy the full bbox — only the image shrinks
   *  inward. Useful for logo cards where the logo needs breathing room. */
  padding?: number;
  /** Backdrop blur radius in fractional canvas-width units. Applies a
   *  `backdrop-filter: blur(Xpx)` to the area covered by the box, so the
   *  canvas content BEHIND the image appears blurred (frosted-glass
   *  effect). The border stays sharp because it's a sibling element, not
   *  a child of the blurred surface. */
  backdropBlur?: number;
  /** Overall opacity of the whole image box (image + backdrop + border).
   *  Range 0–1, default 1 (fully opaque). */
  opacity?: number;
}

interface ImagePlacerProps {
  images: CanvasImage[];
  selectedId: string | null;
  onAdd: (image: CanvasImage) => void;
  onUpdate: (id: string, patch: Partial<CanvasImage>) => void;
  onRemove: (id: string) => void;
  onSelect: (id: string | null) => void;
}

export function ImagePlacer({ images, selectedId, onAdd, onUpdate, onRemove, onSelect }: ImagePlacerProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [cropDialogFor, setCropDialogFor] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // When canvas-side single-selection picks an image, scroll its card into
  // view so the user can immediately reach its controls.
  useEffect(() => {
    if (!selectedId) return;
    const el = cardRefs.current.get(selectedId);
    if (el) el.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedId]);

  const selectedImage = images.find((img) => img.id === selectedId) ?? null;

  // Each batch upload offsets new images so they don't pile on top of each
  // other. The offset comes from the count at the moment of upload + a
  // staggered index inside this batch.
  const addOneFile = useCallback(
    (file: File, baseIndex: number) => {
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`"${file.name}" is too large — max 10MB`);
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        const img = new Image();
        img.onload = () => {
          const aspect = img.naturalWidth / img.naturalHeight;
          let w = 0.35;
          let h = 0.35;
          if (aspect > 1) {
            h = w / aspect;
          } else {
            w = h * aspect;
          }
          // Stagger position so multiple uploads don't fully overlap.
          const offset = baseIndex * 0.05;
          onAdd({
            id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            src: dataUrl,
            x: Math.min(0.95, 0.5 + offset),
            y: Math.min(0.95, 0.5 + offset),
            width: Math.round(w * 100) / 100,
            height: Math.round(h * 100) / 100,
            cornerRadius: 8,
            border: false,
            naturalWidth: img.naturalWidth,
            naturalHeight: img.naturalHeight,
          });
        };
        img.src = dataUrl;
      };
      reader.readAsDataURL(file);
    },
    [onAdd]
  );

  const MAX_IMAGES = 10;

  // Add many files at once, capped at MAX_IMAGES total on the canvas.
  const handleFiles = useCallback(
    (fileList: FileList | File[]) => {
      const files = Array.from(fileList).filter((f) => f.type.startsWith("image/"));
      if (files.length === 0) return;
      const remaining = MAX_IMAGES - images.length;
      if (remaining <= 0) {
        toast.error(`Limit reached — max ${MAX_IMAGES} images on canvas`);
        return;
      }
      const accepted = files.slice(0, remaining);
      if (files.length > remaining) {
        toast.warning(`Only ${remaining} added — ${MAX_IMAGES} image limit reached`);
      }
      accepted.forEach((f, i) => addOneFile(f, images.length + i));
    },
    [addOneFile, images.length],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) handleFiles(e.target.files);
      if (inputRef.current) inputRef.current.value = "";
    },
    [handleFiles]
  );

  const update = (patch: Partial<CanvasImage>) => {
    if (selectedImage) onUpdate(selectedImage.id, patch);
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Image list */}
      {images.map((img) => (
        <div
          key={img.id}
          ref={(node) => {
            if (node) cardRefs.current.set(img.id, node);
            else cardRefs.current.delete(img.id);
          }}
          onClick={() => onSelect(img.id === selectedId ? null : img.id)}
          className={cn(
            "flex items-center gap-3 p-1.5 rounded-lg cursor-pointer transition-all duration-150",
            img.id === selectedId
              ? "bg-[#FF0028]/10 ring-1 ring-[#FF0028]/30"
              : "hover:bg-white/5"
          )}
        >
          <img
            src={img.src}
            alt="Canvas image"
            style={{
              borderRadius: `${img.cornerRadius ?? (img.shape === "circle" ? 50 : 12)}%`,
            }}
            className="w-10 h-10 object-cover shrink-0"
          />
          <div className="flex-1 min-w-0">
            <span className="text-xs text-white/50">
              {img.id === selectedId ? "Selected" : "Click to edit"}
            </span>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove(img.id);
            }}
            className="p-1 rounded-lg hover:bg-white/10 transition-colors shrink-0"
          >
            <X className="w-3.5 h-3.5 text-white/50" />
          </button>
        </div>
      ))}

      {/* Upload zone — hidden when the 10-image cap is reached */}
      {images.length < MAX_IMAGES && (
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={cn(
            "flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 border-dashed cursor-pointer transition-all duration-200",
            isDragging
              ? "border-[#FF0028] bg-[#FF0028]/10"
              : "border-white/20 hover:border-white/40 bg-white/5"
          )}
        >
          <Upload className="w-4 h-4 text-white/50" />
          <span className="text-xs text-white/50">
            {images.length === 0 ? "Drop images or click to upload" : "Add another image"}
          </span>
          <span className="text-[10px] text-white/30">
            PNG, JPG, WebP — max 10MB each · {images.length}/{MAX_IMAGES}
          </span>
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            multiple
            onChange={handleChange}
            className="hidden"
            disabled={images.length >= MAX_IMAGES}
          />
        </div>
      )}

      {/* Controls for selected image */}
      {selectedImage && (() => {
        const currentRadius = selectedImage.cornerRadius ?? (selectedImage.shape === "circle" ? 50 : 4);
        return (<>
          {/* Width slider */}
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-white/40 uppercase tracking-wider w-10 shrink-0">W</span>
            <input
              type="range"
              min={5}
              max={95}
              value={Math.round(selectedImage.width * 100)}
              onChange={(e) => update({ width: parseInt(e.target.value) / 100 })}
              className="flex-1 accent-[#FF0028] h-1"
            />
            <span className="text-[10px] text-white/40 w-8 text-right">{Math.round(selectedImage.width * 100)}%</span>
          </div>

          {/* Height slider */}
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-white/40 uppercase tracking-wider w-10 shrink-0">H</span>
            <input
              type="range"
              min={5}
              max={95}
              value={Math.round(selectedImage.height * 100)}
              onChange={(e) => update({ height: parseInt(e.target.value) / 100 })}
              className="flex-1 accent-[#FF0028] h-1"
            />
            <span className="text-[10px] text-white/40 w-8 text-right">{Math.round(selectedImage.height * 100)}%</span>
          </div>

          {/* Corner radius slider — 0 = sharp, 50 = circle */}
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-white/40 uppercase tracking-wider w-10 shrink-0">Radius</span>
            <input
              type="range"
              min={0}
              max={50}
              step={1}
              value={currentRadius}
              onChange={(e) => update({ cornerRadius: Number(e.target.value), shape: undefined })}
              aria-label="Corner radius"
              className="flex-1 accent-[#FF0028] h-1"
            />
            <span className="text-[10px] text-white/40 w-8 text-right">{currentRadius}%</span>
          </div>

          {/* Fit mode — Fill (cover, crops to fill) vs Fit (contain, no crop).
           *  Critical for partner / sponsor logos which have arbitrary aspect
           *  ratios; "Fit" shows the whole logo with letterboxing instead
           *  of zooming in to fill the bbox. */}
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-white/40 uppercase tracking-wider w-10 shrink-0">Fit</span>
            <div className="flex flex-1 gap-1">
              {([
                { value: "cover", label: "Fill", title: "Crop to fill the slot (best for headshots)" },
                { value: "contain", label: "Fit", title: "Show whole image, no crop (best for logos)" },
              ] as const).map((opt) => {
                const current = selectedImage.fit ?? "cover";
                const active = current === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => update({ fit: opt.value })}
                    title={opt.title}
                    className={cn(
                      "flex-1 py-1 rounded text-[10px] font-medium transition-colors",
                      active
                        ? "bg-[#FF0028] text-white"
                        : "bg-white/5 border border-white/10 text-white/60 hover:bg-white/10",
                    )}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Backdrop — solid color fill behind the image. Shows in the
           *  letterbox areas when Fit is "contain" (useful for logos with
           *  transparent backgrounds that need a visible card). Pick a color
           *  to enable; clear to remove. */}
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-white/40 uppercase tracking-wider w-10 shrink-0">Box</span>
            <ColorPicker
              color={selectedImage.backdropColor}
              defaultColor="#FFFFFF"
              onChange={(c) => update({ backdropColor: c })}
              ariaLabel="Backdrop color behind image"
              allowClear
            />
            <span className="text-[10px] text-white/40">
              {selectedImage.backdropColor ? "On" : "Off"}
            </span>
          </div>

          {/* Padding — shrinks the image inward from the bbox edges. The
           *  backdrop and border still occupy the full bbox; only the image
           *  shrinks. Stored as a fraction of canvas width. */}
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-white/40 uppercase tracking-wider w-10 shrink-0">Padding</span>
            <input
              type="range"
              min={0}
              max={0.1}
              step={0.005}
              value={selectedImage.padding ?? 0}
              onChange={(e) => update({ padding: Number(e.target.value) || undefined })}
              aria-label="Padding inside image box"
              className="flex-1 accent-[#FF0028] h-1"
            />
            <span className="text-[10px] text-white/40 w-10 text-right">
              {Math.round((selectedImage.padding ?? 0) * 1500)}px
            </span>
          </div>

          {/* Backdrop blur — frosted-glass effect on the canvas content
           *  BEHIND this image. Needs the box to be ABOVE that content in
           *  layer order; needs a semi-transparent backdrop color (or no
           *  backdrop) to be visible. */}
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-white/40 uppercase tracking-wider w-10 shrink-0">Blur</span>
            <input
              type="range"
              min={0}
              max={0.05}
              step={0.001}
              value={selectedImage.backdropBlur ?? 0}
              onChange={(e) => update({ backdropBlur: Number(e.target.value) || undefined })}
              aria-label="Backdrop blur (frosted glass behind image)"
              className="flex-1 accent-[#FF0028] h-1"
            />
            <span className="text-[10px] text-white/40 w-10 text-right">
              {Math.round((selectedImage.backdropBlur ?? 0) * 1500)}px
            </span>
          </div>

          {/* Opacity — fades the whole image box (image + backdrop +
           *  border together). Useful for layering on busy backgrounds. */}
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-white/40 uppercase tracking-wider w-10 shrink-0">Opacity</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={selectedImage.opacity ?? 1}
              onChange={(e) => update({ opacity: Number(e.target.value) })}
              aria-label="Image box opacity"
              className="flex-1 accent-[#FF0028] h-1"
            />
            <span className="text-[10px] text-white/40 w-10 text-right">
              {Math.round((selectedImage.opacity ?? 1) * 100)}%
            </span>
          </div>

          {/* Border toggle */}
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-white/40 uppercase tracking-wider w-10 shrink-0">Border</span>
            <button
              onClick={() => update({ border: !selectedImage.border })}
              aria-label="Toggle border"
              className={cn(
                "relative w-10 h-5 rounded-full transition-colors shrink-0",
                selectedImage.border ? "bg-[#FF6B00]" : "bg-white/10",
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all",
                  selectedImage.border ? "left-[22px]" : "left-0.5",
                )}
              />
            </button>
          </div>

          {/* Border color + stroke width — single line, controls grouped */}
          {selectedImage.border && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-white/40 uppercase tracking-wider w-10 shrink-0">Color</span>
              <ColorPicker
                color={selectedImage.borderColor}
                defaultColor="#FFFFFF"
                onChange={(c) => update({ borderColor: c })}
                ariaLabel="Border color"
                allowClear
              />
              <span className="text-[10px] text-white/40 uppercase tracking-wider">Stroke</span>
              <input
                key={selectedImage.id}
                type="number"
                min={0}
                max={60}
                step={1}
                defaultValue={Math.round((selectedImage.borderWidth ?? 0.003) * 1500)}
                onFocus={(e) => e.target.select()}
                onChange={(e) => {
                  const raw = e.target.value;
                  if (raw === "") return; // allow empty while typing — only push valid values
                  const px = Number(raw);
                  if (!Number.isNaN(px) && px >= 0) update({ borderWidth: px / 1500 });
                }}
                aria-label="Border stroke width in pixels"
                className="w-12 bg-white/5 border border-white/10 rounded-md px-1.5 py-1 text-xs text-white text-right focus:outline-none focus:border-[#FF6B00]/40 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <span className="text-[10px] text-white/40">px</span>
            </div>
          )}

          {/* Crop */}
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-white/40 uppercase tracking-wider w-10 shrink-0">Crop</span>
            <button
              onClick={() => setCropDialogFor(selectedImage.id)}
              aria-label="Open crop dialog"
              className={cn(
                "flex items-center gap-1.5 px-2.5 h-7 rounded-md border-2 transition-all duration-200 text-[10px] font-medium",
                selectedImage.crop
                  ? "border-[#FF0028] shadow-[0_0_6px_rgba(255,0,40,0.3)] text-white/90 bg-[#FF0028]/10"
                  : "border-white/10 hover:border-white/30 text-white/60 hover:text-white/90"
              )}
            >
              <CropIcon className="w-3 h-3" />
              {selectedImage.crop ? "Cropped — edit" : "Crop image"}
            </button>
            {selectedImage.crop && (
              <button
                onClick={() => update({ crop: undefined })}
                aria-label="Clear crop"
                title="Clear crop (back to full image)"
                className="p-1 rounded text-white/40 hover:text-white/80 hover:bg-white/10 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </>);
      })()}

      {cropDialogFor && (() => {
        const target = images.find((img) => img.id === cropDialogFor);
        if (!target) return null;
        return (
          <CropDialog
            src={target.src}
            initial={target.crop}
            onSave={(crop) => {
              onUpdate(target.id, { crop });
              setCropDialogFor(null);
            }}
            onCancel={() => setCropDialogFor(null)}
          />
        );
      })()}
    </div>
  );
}
