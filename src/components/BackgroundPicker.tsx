"use client";

import { cn } from "@/lib/utils";
import { BACKGROUND_OPTIONS } from "@/types/template";
import { BackgroundThumbnail } from "@/components/CanvasBackground";

interface BackgroundPickerProps {
  value: string;
  onChange: (value: string) => void;
}

export function BackgroundPicker({ value, onChange }: BackgroundPickerProps) {
  return (
    <div className="grid grid-cols-5 gap-1.5">
      {BACKGROUND_OPTIONS.map((bg) => (
        <button
          key={bg.id}
          onClick={() => onChange(bg.id)}
          title={bg.label}
          aria-label={`Background: ${bg.label}`}
          aria-pressed={value === bg.id}
          className={cn(
            "aspect-square w-full rounded-lg overflow-hidden border-2 transition-all duration-200 relative",
            value === bg.id
              ? "border-[#FF0028] shadow-[0_0_10px_rgba(255,0,40,0.3)] scale-105"
              : "border-white/10 hover:border-white/30 opacity-70 hover:opacity-100",
          )}
        >
          <BackgroundThumbnail id={bg.id} />
        </button>
      ))}
    </div>
  );
}
