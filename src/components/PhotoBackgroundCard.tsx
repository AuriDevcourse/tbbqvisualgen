"use client";

import { ImagePlus, RefreshCw, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { CanvasImage } from "@/components/ImagePlacer";
import { PHOTO_ACCEPT, makePhotoBackground, readImageFile } from "@/lib/photoBackground";

interface PhotoBackgroundCardProps {
  /** The current photo background, or null when the canvas uses a gradient. */
  image: CanvasImage | null;
  onPick: (image: CanvasImage) => void;
  onUpdate: (id: string, patch: Partial<CanvasImage>) => void;
  onRemove: (id: string) => void;
}

/**
 * Upload a summit photo as the canvas background: full-bleed, under the text.
 * Lives at the top of the Canvas step's Background section because "put my
 * own photo behind the text" is a background choice, not a photo-placement
 * one — burying it in the Photos tab is what made people ask whether the app
 * could do it at all.
 */
export function PhotoBackgroundCard({ image, onPick, onUpdate, onRemove }: PhotoBackgroundCardProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // No useCallback: the React Compiler is enabled on this project, so manual
  // memoization here is dead weight.
  const handleFiles = async (fileList: FileList | File[]) => {
    const file = Array.from(fileList)[0];
    if (!file) return;
    try {
      const loaded = await readImageFile(file);
      const next = makePhotoBackground(loaded);
      // Replacing keeps the existing id so the layer keeps its place in the
      // stack and its scrim setting survives the swap.
      if (image) onUpdate(image.id, { ...next, id: image.id });
      else onPick(next);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not use that image");
    }
  };

  const openPicker = () => inputRef.current?.click();

  const dropHandlers = {
    onDragOver: (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); },
    onDragLeave: () => setIsDragging(false),
    onDrop: (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); void handleFiles(e.dataTransfer.files); },
  };

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={inputRef}
        type="file"
        accept={PHOTO_ACCEPT}
        onChange={(e) => {
          if (e.target.files) void handleFiles(e.target.files);
          if (inputRef.current) inputRef.current.value = "";
        }}
        className="hidden"
      />

      {!image ? (
        <button
          type="button"
          onClick={openPicker}
          {...dropHandlers}
          className={cn(
            "flex items-center gap-3 w-full p-3 rounded-xl border-2 border-dashed text-left transition-all duration-200 outline-none",
            "focus-visible:ring-2 focus-visible:ring-[#FF6B00]/70",
            isDragging ? "border-[#FF6B00] bg-[#FF6B00]/10" : "border-white/20 bg-white/5 hover:border-white/40",
          )}
        >
          <span className="grid place-items-center size-9 shrink-0 rounded-lg bg-[#FF6B00]/15 border border-[#FF6B00]/30">
            <ImagePlus className="w-4 h-4 text-[#FF6B00]" strokeWidth={1.75} />
          </span>
          <span className="flex flex-col gap-0.5">
            <span className="text-[12px] font-medium text-white/90">Use your own photo</span>
            <span className="text-[10px] text-white/60">
              Stage shot, winner, crowd. Fills the canvas, text sits on top.
            </span>
          </span>
        </button>
      ) : (
        <div
          {...dropHandlers}
          className={cn(
            "flex flex-col gap-2.5 p-2.5 rounded-xl border transition-colors",
            isDragging ? "border-[#FF6B00] bg-[#FF6B00]/10" : "border-[#FF6B00]/40 bg-[#FF6B00]/[0.07]",
          )}
        >
          <div className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element -- dataURL from a local upload, never a remote asset */}
            <img
              src={image.src}
              alt=""
              className="size-11 shrink-0 rounded-lg object-cover border border-white/15"
              draggable={false}
            />
            <div className="flex flex-col gap-0.5 min-w-0 flex-1">
              <span className="text-[11px] font-medium text-white/90">Photo background</span>
              <span className="text-[10px] text-white/60 truncate">
                {image.naturalWidth && image.naturalHeight
                  ? `${image.naturalWidth} × ${image.naturalHeight}px`
                  : "Fills the canvas"}
              </span>
            </div>
            <button
              type="button"
              onClick={openPicker}
              aria-label="Replace photo background"
              title="Replace photo"
              className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" strokeWidth={1.75} />
            </button>
            <button
              type="button"
              onClick={() => onRemove(image.id)}
              aria-label="Remove photo background"
              title="Remove photo, go back to the gradient"
              className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" strokeWidth={1.75} />
            </button>
          </div>

          {/* Darken — the one control that decides whether white text over a
              bright stage photo is readable, so it belongs right here. */}
          <div className="flex items-center gap-2.5">
            <label htmlFor="photo-bg-scrim" className="text-[10px] text-white/65 uppercase tracking-wider shrink-0">
              Darken
            </label>
            <input
              id="photo-bg-scrim"
              type="range"
              min={0}
              max={0.9}
              step={0.05}
              value={image.scrimBottom ?? 0}
              onChange={(e) => onUpdate(image.id, { scrimBottom: Number(e.target.value) || undefined })}
              className="flex-1 accent-[#FF6B00] h-1"
            />
            <span className="text-[10px] text-white/65 w-8 text-right tabular-nums">
              {Math.round((image.scrimBottom ?? 0) * 100)}%
            </span>
          </div>

          <p className="text-[10px] text-white/55">
            Double-click the photo on the canvas to pan or zoom it.
          </p>
        </div>
      )}
    </div>
  );
}
