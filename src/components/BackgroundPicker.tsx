"use client";

import { cn } from "@/lib/utils";
import { BACKGROUND_OPTIONS } from "@/types/template";
import { LiquidMetal } from "@paper-design/shaders-react";
import { LIQUID_METAL_CONFIGS } from "@/components/LiquidMetalBg";

interface BackgroundPickerProps {
  value: string;
  onChange: (value: string) => void;
}

export function BackgroundPicker({ value, onChange }: BackgroundPickerProps) {
  return (
    <div className="grid grid-cols-6 gap-1.5">
      {BACKGROUND_OPTIONS.map((bg) => {
        const config = LIQUID_METAL_CONFIGS[bg.id];
        return (
          <button
            key={bg.id}
            onClick={() => onChange(bg.id)}
            title={bg.label}
            className={cn(
              "aspect-square w-full rounded-lg overflow-hidden border-2 transition-all duration-200 relative",
              value === bg.id
                ? "border-[#FF0028] shadow-[0_0_10px_rgba(255,0,40,0.3)] scale-105"
                : "border-white/10 hover:border-white/30 opacity-60 hover:opacity-100"
            )}
          >
            {config ? (
              <LiquidMetal
                colorBack={config.colorBack}
                colorTint={config.colorTint}
                shape={config.shape}
                scale={config.scale}
                speed={0}
                frame={config.frame}
                repetition={config.repetition}
                softness={config.softness}
                distortion={config.distortion}
                contour={config.contour}
                angle={config.angle}
                shiftRed={config.shiftRed}
                shiftBlue={config.shiftBlue}
                fit="cover"
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
                minPixelRatio={1}
                maxPixelCount={56 * 56}
              />
            ) : (
              <div className="w-full h-full bg-neutral-800" />
            )}
          </button>
        );
      })}
    </div>
  );
}
