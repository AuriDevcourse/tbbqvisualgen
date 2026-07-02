"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { X, Check, RotateCcw } from "lucide-react";

interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface CropDialogProps {
  src: string;
  /** Current crop in 0–1 fractions, or undefined for "no crop". */
  initial?: CropRect;
  /** Aspect ratio (w/h) the crop should be locked to — comes from the on-canvas bbox so
   *  the cropped output never visibly distorts. */
  aspect?: number;
  onSave: (crop: CropRect | undefined) => void;
  onCancel: () => void;
}

type DragMode = "move" | "nw" | "ne" | "sw" | "se" | "n" | "s" | "e" | "w" | null;

const MIN_CROP = 0.05; // never let crop shrink below 5% of the image
const HANDLE = 14; // px

export function CropDialog({ src, initial, onSave, onCancel }: CropDialogProps) {
  // crop stored in 0–1 fractions of the source image (natural).
  const [crop, setCrop] = useState<CropRect>(initial ?? { x: 0, y: 0, width: 1, height: 1 });
  const [drag, setDrag] = useState<DragMode>(null);
  const imageRef = useRef<HTMLDivElement>(null);
  const startRef = useRef<{ mx: number; my: number; rect: CropRect }>({ mx: 0, my: 0, rect: { x: 0, y: 0, width: 1, height: 1 } });

  // Esc cancels
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
      if (e.key === "Enter") onSave(crop);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [crop, onCancel, onSave]);

  const startDrag = useCallback((mode: DragMode, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDrag(mode);
    startRef.current = { mx: e.clientX, my: e.clientY, rect: { ...crop } };
  }, [crop]);

  useEffect(() => {
    if (!drag) return;
    const onMove = (e: MouseEvent) => {
      const box = imageRef.current?.getBoundingClientRect();
      if (!box) return;
      const dx = (e.clientX - startRef.current.mx) / box.width;
      const dy = (e.clientY - startRef.current.my) / box.height;
      const s = startRef.current.rect;
      let next: CropRect = { ...s };
      if (drag === "move") {
        next.x = Math.max(0, Math.min(1 - s.width, s.x + dx));
        next.y = Math.max(0, Math.min(1 - s.height, s.y + dy));
      } else {
        let l = s.x, t = s.y, r = s.x + s.width, b = s.y + s.height;
        if (drag.includes("w")) l = Math.max(0, Math.min(r - MIN_CROP, s.x + dx));
        if (drag.includes("e")) r = Math.max(l + MIN_CROP, Math.min(1, s.x + s.width + dx));
        if (drag.includes("n")) t = Math.max(0, Math.min(b - MIN_CROP, s.y + dy));
        if (drag.includes("s")) b = Math.max(t + MIN_CROP, Math.min(1, s.y + s.height + dy));
        next = { x: l, y: t, width: r - l, height: b - t };
      }
      setCrop(next);
    };
    const onUp = () => setDrag(null);
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, [drag]);

  // Crop rect in % for visual positioning over the image
  const rectStyle: React.CSSProperties = {
    position: "absolute",
    left: `${crop.x * 100}%`,
    top: `${crop.y * 100}%`,
    width: `${crop.width * 100}%`,
    height: `${crop.height * 100}%`,
    boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.65)",
    border: "2px solid #FF6B00",
    cursor: drag === "move" ? "grabbing" : "move",
  };

  // Corner + edge handles. Edge handles let the user adjust a single axis,
  // which is the most common crop operation ("just trim the top").
  const corners: { key: DragMode; cursor: string; pos: { left?: number; right?: number; top?: number; bottom?: number } }[] = [
    { key: "nw", cursor: "nwse-resize", pos: { left: -HANDLE / 2, top: -HANDLE / 2 } },
    { key: "ne", cursor: "nesw-resize", pos: { right: -HANDLE / 2, top: -HANDLE / 2 } },
    { key: "sw", cursor: "nesw-resize", pos: { left: -HANDLE / 2, bottom: -HANDLE / 2 } },
    { key: "se", cursor: "nwse-resize", pos: { right: -HANDLE / 2, bottom: -HANDLE / 2 } },
  ];
  const edges: { key: DragMode; cursor: string; style: React.CSSProperties }[] = [
    { key: "n", cursor: "ns-resize", style: { left: "50%", top: -HANDLE / 2, transform: "translateX(-50%)" } },
    { key: "s", cursor: "ns-resize", style: { left: "50%", bottom: -HANDLE / 2, transform: "translateX(-50%)" } },
    { key: "w", cursor: "ew-resize", style: { top: "50%", left: -HANDLE / 2, transform: "translateY(-50%)" } },
    { key: "e", cursor: "ew-resize", style: { top: "50%", right: -HANDLE / 2, transform: "translateY(-50%)" } },
  ];

  const isFullCrop = crop.x === 0 && crop.y === 0 && crop.width === 1 && crop.height === 1;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Crop image"
      onMouseDown={(e) => {
        // Only treat clicks on the backdrop itself as dismiss intents.
        if (e.target !== e.currentTarget) return;
        const dirty = JSON.stringify(crop) !== JSON.stringify(initial ?? { x: 0, y: 0, width: 1, height: 1 });
        if (dirty && !window.confirm("Discard crop changes?")) return;
        onCancel();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-6"
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className="bg-[#15110e]/95 border border-[#FF6B00]/30 rounded-2xl p-5 max-w-[min(640px,90vw)] w-full shadow-2xl"
      >
        <div className="flex items-center justify-between mb-4">
          <span className="text-[10px] font-medium text-[#FF6B00] uppercase tracking-[0.18em]">Crop image</span>
          <button
            onClick={onCancel}
            aria-label="Cancel"
            title="Cancel (Esc)"
            className="p-1 rounded text-white/50 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="relative w-full bg-black/40 rounded-lg overflow-hidden flex items-center justify-center select-none" style={{ aspectRatio: "1 / 1", maxHeight: "60vh" }}>
          <div ref={imageRef} className="relative max-w-full max-h-full">
            <img
              src={src}
              alt="Image to crop"
              draggable={false}
              className="block max-w-full max-h-[58vh] pointer-events-none"
              style={{ userSelect: "none" }}
            />
            <div style={rectStyle} onMouseDown={(e) => startDrag("move", e)}>
              {corners.map((h) => (
                <div
                  key={h.key}
                  onMouseDown={(e) => startDrag(h.key, e)}
                  style={{
                    position: "absolute",
                    ...h.pos,
                    width: HANDLE,
                    height: HANDLE,
                    background: "#FF0028",
                    border: "2px solid white",
                    borderRadius: 3,
                    cursor: h.cursor,
                  }}
                />
              ))}
              {edges.map((e) => (
                <div
                  key={e.key}
                  onMouseDown={(ev) => startDrag(e.key, ev)}
                  style={{
                    position: "absolute",
                    ...e.style,
                    width: e.key === "n" || e.key === "s" ? HANDLE * 1.6 : HANDLE,
                    height: e.key === "n" || e.key === "s" ? HANDLE : HANDLE * 1.6,
                    background: "rgba(255, 0, 40, 0.85)",
                    border: "2px solid white",
                    borderRadius: 3,
                    cursor: e.cursor,
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between mt-4 text-[10px] font-mono text-white/65">
          <span>X {(crop.x * 100).toFixed(0)}% · Y {(crop.y * 100).toFixed(0)}%</span>
          <span>{(crop.width * 100).toFixed(0)}% × {(crop.height * 100).toFixed(0)}%</span>
        </div>

        <div className="flex items-center gap-2 mt-4">
          <button
            onClick={() => setCrop({ x: 0, y: 0, width: 1, height: 1 })}
            disabled={isFullCrop}
            aria-label="Reset crop"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs font-medium text-white/70 hover:bg-white/10 hover:text-white transition-colors disabled:opacity-30"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset
          </button>
          <div className="flex-1" />
          <button
            onClick={onCancel}
            aria-label="Cancel"
            className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs font-medium text-white/70 hover:bg-white/10 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(isFullCrop ? undefined : crop)}
            aria-label="Save crop"
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-r from-[#FF6B00] to-[#FF0028] hover:from-[#FF7A1A] hover:to-[#E00224] text-white text-xs font-semibold tracking-wide transition-all shadow-[0_4px_18px_-6px_rgba(255,0,40,0.6)]"
          >
            <Check className="w-3.5 h-3.5" />
            Save crop
          </button>
        </div>

        <p className="text-[10px] text-white/60 mt-3 text-center">Drag the rectangle to move it · drag the corners to resize · Enter saves · Esc cancels</p>
      </div>
    </div>
  );
}
