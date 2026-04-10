"use client";

import { useState } from "react";
import { Monitor, Square, Smartphone, Facebook, Twitter, Ruler, Linkedin, Presentation } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PlatformFormat } from "@/types/template";

interface FormatPickerProps {
  value: PlatformFormat;
  onChange: (value: PlatformFormat) => void;
  customWidth: number;
  customHeight: number;
  onCustomSizeChange: (width: number, height: number) => void;
}

const formats = [
  { id: "instagram" as const, label: "Instagram", sublabel: "1080×1080", icon: Square },
  { id: "story" as const, label: "Story", sublabel: "1080×1920", icon: Smartphone },
  { id: "linkedin" as const, label: "LinkedIn", sublabel: "1200×627", icon: Linkedin },
  { id: "facebook" as const, label: "Facebook", sublabel: "1200×630", icon: Facebook },
  { id: "twitter" as const, label: "Twitter/X", sublabel: "1600×900", icon: Twitter },
  { id: "presentation" as const, label: "Presentation", sublabel: "1920×1080", icon: Presentation },
  { id: "custom" as const, label: "Custom", sublabel: "", icon: Ruler },
];

export function FormatPicker({ value, onChange, customWidth, customHeight, onCustomSizeChange }: FormatPickerProps) {
  const [widthInput, setWidthInput] = useState(String(customWidth));
  const [heightInput, setHeightInput] = useState(String(customHeight));

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
            className="w-20 px-2 py-1.5 rounded-md bg-white/5 border border-white/10 text-white text-xs text-center focus:outline-none focus:border-[#FF0028]/50"
          />
          <span className="text-white/30 text-xs">×</span>
          <input
            type="number"
            value={heightInput}
            onChange={(e) => setHeightInput(e.target.value)}
            onBlur={applyCustomSize}
            onKeyDown={(e) => e.key === "Enter" && applyCustomSize()}
            placeholder="Height"
            min={100}
            max={4096}
            className="w-20 px-2 py-1.5 rounded-md bg-white/5 border border-white/10 text-white text-xs text-center focus:outline-none focus:border-[#FF0028]/50"
          />
          <span className="text-white/40 text-xs">px</span>
        </div>
      )}
    </div>
  );
}
