"use client";

import { Upload, X, Circle, Square } from "lucide-react";
import { useCallback, useState, useRef } from "react";
import { cn } from "@/lib/utils";

export interface CanvasImage {
  id: string;     // unique identifier
  src: string;
  x: number;      // 0–1 fraction (center of image on canvas)
  y: number;      // 0–1 fraction (center of image on canvas)
  width: number;  // fraction of canvas width (0.05 – 0.95)
  height: number; // fraction of canvas height (0.05 – 0.95)
  shape: "circle" | "rounded";
  border: boolean;
}

interface ImagePlacerProps {
  images: CanvasImage[];
  selectedId: string | null;
  onAdd: (image: CanvasImage) => void;
  onUpdate: (id: string, patch: Partial<CanvasImage>) => void;
  onRemove: (id: string) => void;
  onSelect: (id: string | null) => void;
}

const POSITION_PRESETS = [
  { label: "top-left", x: 0.2, y: 0.18 },
  { label: "top-center", x: 0.5, y: 0.18 },
  { label: "top-right", x: 0.8, y: 0.18 },
  { label: "center-left", x: 0.2, y: 0.5 },
  { label: "center", x: 0.5, y: 0.5 },
  { label: "center-right", x: 0.8, y: 0.5 },
  { label: "bottom-left", x: 0.2, y: 0.82 },
  { label: "bottom-center", x: 0.5, y: 0.82 },
  { label: "bottom-right", x: 0.8, y: 0.82 },
];

export function ImagePlacer({ images, selectedId, onAdd, onUpdate, onRemove, onSelect }: ImagePlacerProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedImage = images.find((img) => img.id === selectedId) ?? null;

  const handleFile = useCallback(
    (file: File) => {
      if (file.size > 10 * 1024 * 1024) {
        alert("File too large. Max 10MB.");
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
          onAdd({
            id: `img-${Date.now()}`,
            src: dataUrl,
            x: 0.8,
            y: 0.5,
            width: Math.round(w * 100) / 100,
            height: Math.round(h * 100) / 100,
            shape: "rounded",
            border: true,
          });
        };
        img.src = dataUrl;
      };
      reader.readAsDataURL(file);
    },
    [onAdd]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith("image/")) {
        handleFile(file);
      }
    },
    [handleFile]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
      if (inputRef.current) inputRef.current.value = "";
    },
    [handleFile]
  );

  const update = (patch: Partial<CanvasImage>) => {
    if (selectedImage) onUpdate(selectedImage.id, patch);
  };

  // Find closest preset to highlight
  const activePreset = selectedImage
    ? POSITION_PRESETS.find((p) => Math.hypot(p.x - selectedImage.x, p.y - selectedImage.y) < 0.06)?.label ?? null
    : null;

  return (
    <div className="flex flex-col gap-3">
      {/* Image list */}
      {images.map((img) => (
        <div
          key={img.id}
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
            className={cn(
              "w-10 h-10 object-cover shrink-0",
              img.shape === "circle" ? "rounded-full" : "rounded-lg"
            )}
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

      {/* Upload zone — show when under 4 images */}
      {images.length < 4 && (
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
            {images.length === 0 ? "Drop image or click to upload" : "Add another image"}
          </span>
          <span className="text-[10px] text-white/30">PNG, JPG, WebP — max 10MB ({images.length}/4)</span>
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleChange}
            className="hidden"
          />
        </div>
      )}

      {/* Controls for selected image */}
      {selectedImage && (
        <>
          {/* Quick position grid 3x3 */}
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-white/40 uppercase tracking-wider w-10 shrink-0">Pos</span>
            <div className="grid grid-cols-3 grid-rows-3 gap-[3px]">
              {POSITION_PRESETS.map((pos) => (
                <button
                  key={pos.label}
                  onClick={() => update({ x: pos.x, y: pos.y })}
                  title={pos.label}
                  className={cn(
                    "w-[22px] h-[14px] rounded-[3px] transition-all duration-200",
                    activePreset === pos.label
                      ? "bg-[#FF0028] shadow-[0_0_6px_rgba(255,0,40,0.4)]"
                      : "bg-white/10 hover:bg-white/20"
                  )}
                />
              ))}
            </div>
          </div>

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

          {/* Shape + border toggles */}
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-white/40 uppercase tracking-wider w-10 shrink-0">Style</span>
            <div className="flex gap-1.5">
              <button
                onClick={() => update({ shape: "circle" })}
                title="Ellipse"
                className={cn(
                  "w-7 h-7 rounded-md border-2 transition-all duration-200 flex items-center justify-center",
                  selectedImage.shape === "circle"
                    ? "border-[#FF0028] shadow-[0_0_6px_rgba(255,0,40,0.3)]"
                    : "border-white/10 hover:border-white/30 opacity-60 hover:opacity-100"
                )}
              >
                <Circle className="w-3.5 h-3.5 text-white/70" />
              </button>
              <button
                onClick={() => update({ shape: "rounded" })}
                title="Rounded rectangle"
                className={cn(
                  "w-7 h-7 rounded-md border-2 transition-all duration-200 flex items-center justify-center",
                  selectedImage.shape === "rounded"
                    ? "border-[#FF0028] shadow-[0_0_6px_rgba(255,0,40,0.3)]"
                    : "border-white/10 hover:border-white/30 opacity-60 hover:opacity-100"
                )}
              >
                <Square className="w-3.5 h-3.5 text-white/70" />
              </button>

              <div className="w-px bg-white/10 mx-1" />

              <button
                onClick={() => update({ border: !selectedImage.border })}
                className={cn(
                  "px-2.5 h-7 rounded-md border-2 transition-all duration-200 text-[10px] font-medium",
                  selectedImage.border
                    ? "border-[#FF0028] shadow-[0_0_6px_rgba(255,0,40,0.3)] text-white/90"
                    : "border-white/10 hover:border-white/30 text-white/50 hover:text-white/70"
                )}
              >
                Border
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
