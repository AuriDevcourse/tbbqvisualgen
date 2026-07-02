"use client";

import { useState, useEffect } from "react";
import { Square, Smartphone, Ruler, Presentation } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PlatformFormat } from "@/types/template";

interface FormatPickerProps {
  value: PlatformFormat;
  onChange: (value: PlatformFormat) => void;
  customWidth: number;
  customHeight: number;
  onCustomSizeChange: (width: number, height: number) => void;
}

// The three ways we share: LinkedIn takes 16:9 or 1:1, Stories are 9:16.
// Ordered to match that mental model; Custom is the escape hatch.
const formats = [
  { id: "presentation" as const, label: "16:9", sublabel: "Full HD · 1920×1080", icon: Presentation },
  { id: "square" as const, label: "1:1", sublabel: "Square · 1500×1500", icon: Square },
  { id: "story" as const, label: "9:16", sublabel: "Story · 1080×1920", icon: Smartphone },
  { id: "custom" as const, label: "Custom", sublabel: "", icon: Ruler },
];

export function FormatPicker({ value, onChange, customWidth, customHeight, onCustomSizeChange }: FormatPickerProps) {
  const [widthInput, setWidthInput] = useState(String(customWidth));
  const [heightInput, setHeightInput] = useState(String(customHeight));

  // Keep local input state in sync if parent updates (e.g. on reset)
  useEffect(() => { setWidthInput(String(customWidth)); }, [customWidth]);
  useEffect(() => { setHeightInput(String(customHeight)); }, [customHeight]);

  const applyCustomSize = () => {
    const w = Math.max(100, Math.min(4096, parseInt(widthInput) || 1080));
    const h = Math.max(100, Math.min(4096, parseInt(heightInput) || 1080));
    setWidthInput(String(w));
    setHeightInput(String(h));
    onCustomSizeChange(w, h);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5">
        {formats.map((f) => (
          <button
            key={f.id}
            onClick={() => onChange(f.id)}
            aria-label={`Set format to ${f.label}${f.sublabel ? ` ${f.sublabel}` : ""}`}
            aria-pressed={value === f.id}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-all duration-200",
              value === f.id
                ? "bg-[#FF0028] text-white"
                : "bg-white/5 border border-white/10 text-white/70 hover:bg-white/10"
            )}
          >
            <f.icon className="w-3.5 h-3.5" />
            <span className="font-medium">{f.label}</span>
            {f.sublabel && <span className="opacity-70">{f.sublabel}</span>}
          </button>
        ))}
      </div>

      {value === "custom" && (
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={widthInput}
            onChange={(e) => setWidthInput(e.target.value)}
            onBlur={applyCustomSize}
            onKeyDown={(e) => e.key === "Enter" && applyCustomSize()}
            placeholder="Width"
            min={100}
            max={4096}
            aria-label="Custom width in pixels"
            className="w-20 px-2 py-1.5 rounded-md bg-white/5 border border-white/10 text-white text-xs text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B00]/70 focus:border-[#FF0028]/50"
          />
          <span className="text-white/60 text-xs">×</span>
          <input
            type="number"
            value={heightInput}
            onChange={(e) => setHeightInput(e.target.value)}
            onBlur={applyCustomSize}
            onKeyDown={(e) => e.key === "Enter" && applyCustomSize()}
            placeholder="Height"
            min={100}
            max={4096}
            aria-label="Custom height in pixels"
            className="w-20 px-2 py-1.5 rounded-md bg-white/5 border border-white/10 text-white text-xs text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B00]/70 focus:border-[#FF0028]/50"
          />
          <span className="text-white/65 text-xs">px</span>
          <span className="text-[10px] text-white/60 ml-auto">Press Enter to apply</span>
        </div>
      )}
    </div>
  );
}
