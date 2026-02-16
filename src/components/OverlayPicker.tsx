"use client";

import { cn } from "@/lib/utils";
import { X } from "lucide-react";

interface OverlayPickerProps {
  color: string | undefined;
  opacity: number;
  blend: string;
  onColorChange: (color: string | undefined) => void;
  onOpacityChange: (opacity: number) => void;
  onBlendChange: (blend: string) => void;
}

const BLEND_MODES = [
  { value: "multiply", label: "Multiply" },
  { value: "overlay", label: "Overlay" },
  { value: "screen", label: "Screen" },
  { value: "color", label: "Color" },
  { value: "soft-light", label: "Soft Light" },
  { value: "hard-light", label: "Hard Light" },
];

export function OverlayPicker({
  color,
  opacity,
  blend,
  onColorChange,
  onOpacityChange,
  onBlendChange,
}: OverlayPickerProps) {
  const isActive = !!color && opacity > 0;

  return (
    <div className="flex flex-col gap-2.5">
      {/* Color picker row */}
      <div className="flex items-center gap-2">
        {/* Remove overlay */}
        <button
          onClick={() => onColorChange(undefined)}
          title="No overlay"
          className={cn(
            "w-8 h-8 rounded-md border-2 transition-all duration-200 flex items-center justify-center shrink-0",
            !isActive
              ? "border-[#FF0028] shadow-[0_0_8px_rgba(255,0,40,0.3)]"
              : "border-white/10 hover:border-white/30 opacity-60 hover:opacity-100"
          )}
        >
          <X className="w-3.5 h-3.5 text-white/50" />
        </button>

        {/* Native color wheel */}
        <label
          className={cn(
            "w-8 h-8 rounded-md border-2 transition-all duration-200 shrink-0 cursor-pointer overflow-hidden relative",
            isActive
              ? "border-[#FF0028] shadow-[0_0_8px_rgba(255,0,40,0.3)]"
              : "border-white/10 hover:border-white/30"
          )}
          style={{ backgroundColor: color || "#FF0028" }}
        >
          <input
            type="color"
            value={color || "#FF0028"}
            onChange={(e) => {
              onColorChange(e.target.value);
              if (opacity === 0) onOpacityChange(0.4);
            }}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
        </label>

        {/* Current color hex */}
        {color && (
          <span className="text-[10px] text-white/40 font-mono">{color.toUpperCase()}</span>
        )}
      </div>

      {/* Blend mode + opacity — only when color is active */}
      {color && (
        <>
          {/* Blend mode pills */}
          <div className="flex gap-1 flex-wrap">
            {BLEND_MODES.map((mode) => (
              <button
                key={mode.value}
                onClick={() => onBlendChange(mode.value)}
                className={cn(
                  "px-2 py-1 rounded text-[10px] font-medium transition-colors",
                  blend === mode.value
                    ? "bg-white/15 text-white border border-white/20"
                    : "bg-white/5 text-white/40 border border-transparent hover:bg-white/10 hover:text-white/60"
                )}
              >
                {mode.label}
              </button>
            ))}
          </div>

          {/* Opacity slider */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-white/40 w-12 shrink-0">Opacity</span>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(opacity * 100)}
              onChange={(e) => onOpacityChange(Number(e.target.value) / 100)}
              className="flex-1 h-1 appearance-none bg-white/10 rounded-full outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:cursor-pointer"
            />
            <span className="text-[10px] text-white/40 w-8 text-right">{Math.round(opacity * 100)}%</span>
          </div>
        </>
      )}
    </div>
  );
}
