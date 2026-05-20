"use client";

import { Sparkles } from "lucide-react";
import { FormatPicker } from "@/components/FormatPicker";
import { BackgroundPicker } from "@/components/BackgroundPicker";
import { OverlayPicker } from "@/components/OverlayPicker";
import type { DesignConfig, PlatformFormat } from "@/types/template";
import { PRESETS, type Preset } from "@/data/presets";
// PRESETS kept as default fallback when host doesn't pass an explicit list.

const FORMAT_BADGES: Record<PlatformFormat, string> = {
  square: "1:1",
  presentation: "16:9",
  story: "9:16",
  custom: "Custom",
};

interface StepCanvasProps {
  format: PlatformFormat;
  setFormat: (next: PlatformFormat) => void;
  customSize: { width: number; height: number };
  setCustomSize: (next: { width: number; height: number }) => void;
  design: DesignConfig;
  setDesign: (next: DesignConfig) => void;
  onLoadPreset?: (preset: Preset) => void;
  /** Filtered preset list (e.g. with hidden built-ins removed). Defaults
   *  to all presets when not provided. */
  presets?: Preset[];
  /** Resolve a preset's currently-displayed name (factors in user renames). */
  presetDisplayName?: (preset: Preset) => string;
  /** Formats this preset has user-saved (localStorage) variants for. Used
   *  to render the green dot on chips that the user customized. */
  presetCustomVariants?: (preset: Preset) => Set<PlatformFormat>;
}

function presetFormats(preset: Preset): PlatformFormat[] {
  const set = new Set<PlatformFormat>([preset.format]);
  if (preset.variants) {
    for (const key of Object.keys(preset.variants) as PlatformFormat[]) {
      set.add(key);
    }
  }
  return Array.from(set);
}

// The three "real" formats we surface as chips on each preset card. "custom"
// is intentionally omitted — presets can't have a "custom" variant since
// dimensions are user-defined.
const VARIANT_FORMATS: PlatformFormat[] = ["presentation", "square", "story"];

export function StepCanvas({
  format, setFormat, customSize, setCustomSize, design, setDesign, onLoadPreset,
  presets, presetDisplayName, presetCustomVariants,
}: StepCanvasProps) {
  const presetList = presets ?? PRESETS;
  return (
    <div className="flex flex-col gap-5">
      {onLoadPreset && presetList.length > 0 && (() => {
        // Group presets by their `group` field. Maintain insertion order
        // so the first preset of each group anchors the group's position
        // in the picker. Presets with no group fall into "Other".
        const groups = new Map<string, Preset[]>();
        for (const p of presetList) {
          const key = p.group ?? "Other";
          const arr = groups.get(key);
          if (arr) arr.push(p);
          else groups.set(key, [p]);
        }
        return (
          <section className="flex flex-col gap-3">
            <span className="text-[10px] font-medium text-white/40 uppercase tracking-[0.18em]">
              ▪ Start from preset
            </span>
            {Array.from(groups.entries()).map(([groupLabel, items]) => (
              <div key={groupLabel} className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-semibold text-white/55 uppercase tracking-[0.14em]">
                    {groupLabel}
                  </span>
                  <span className="text-[9px] text-white/30">{items.length}</span>
                  <div className="flex-1 h-px bg-white/5" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {items.map((p) => {
                    const builtIns = new Set(presetFormats(p));
                    const customs = presetCustomVariants ? presetCustomVariants(p) : new Set<PlatformFormat>();
                    const hasCurrent = builtIns.has(format) || customs.has(format);
                    return (
                      <button
                        key={p.id}
                        onClick={() => onLoadPreset(p)}
                        className="group flex flex-col gap-1.5 p-3 rounded-lg bg-white/5 border border-white/10 hover:border-[#FF6B00]/50 hover:bg-white/[0.07] transition-all text-left"
                      >
                        <div className="flex items-center justify-between gap-1.5">
                          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-white/90 min-w-0">
                            <Sparkles className="w-3 h-3 text-[#FF6B00] shrink-0" />
                            <span className="truncate">{presetDisplayName ? presetDisplayName(p) : p.name}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            {VARIANT_FORMATS.map((f) => {
                              const hasCustom = customs.has(f);
                              const hasBuiltIn = builtIns.has(f);
                              const exists = hasCustom || hasBuiltIn;
                              const isCurrent = f === format;
                              return (
                                <span
                                  key={f}
                                  title={[
                                    isCurrent ? "Current canvas format" : null,
                                    hasCustom ? "Your saved variant" : hasBuiltIn ? "Ships with preset" : "Not yet defined for this format",
                                  ].filter(Boolean).join(" · ")}
                                  className={`relative text-[8.5px] font-mono px-1 py-px rounded border ${
                                    isCurrent
                                      ? "border-[#FF6B00]/70 bg-[#FF6B00]/15 text-[#FF8A1F]"
                                      : exists
                                        ? "border-white/15 bg-white/5 text-white/65"
                                        : "border-white/10 bg-transparent text-white/30"
                                  }`}
                                >
                                  {FORMAT_BADGES[f]}
                                  {hasCustom && (
                                    <span className="absolute -top-1 -right-1 w-1.5 h-1.5 rounded-full bg-emerald-400 ring-1 ring-emerald-900/40" />
                                  )}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                        <p className="text-[10px] text-white/50 leading-tight">{p.description}</p>
                        {!hasCurrent && (
                          <p className="text-[9px] text-amber-400/80 leading-tight">
                            No {FORMAT_BADGES[format]} variant yet — will load default and may need adjustment.
                          </p>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            <p className="text-[10px] text-white/30">
              Loads a layout you can customize. Click any image slot to upload a photo.
            </p>
          </section>
        );
      })()}

      <section className="flex flex-col gap-2">
        <span className="text-[10px] font-medium text-white/40 uppercase tracking-[0.18em]">▪ Format</span>
        <FormatPicker
          value={format}
          onChange={setFormat}
          customWidth={customSize.width}
          customHeight={customSize.height}
          onCustomSizeChange={(w, h) => setCustomSize({ width: w, height: h })}
        />
      </section>

      <section className="flex flex-col gap-2">
        <span className="text-[10px] font-medium text-white/40 uppercase tracking-[0.18em]">▪ Background</span>
        <BackgroundPicker
          value={design.backgroundId}
          onChange={(id) => setDesign({ ...design, backgroundId: id })}
        />
        <p className="text-[10px] text-white/30">Pause/resume the animation above the canvas.</p>
      </section>

      <section className="flex flex-col gap-2 pt-3 border-t border-white/5">
        <span className="text-[10px] font-medium text-white/40 uppercase tracking-[0.18em]">▪ Color overlay</span>
        <OverlayPicker
          color={design.overlayColor}
          opacity={design.overlayOpacity ?? 0}
          blend={design.overlayBlend || "multiply"}
          onColorChange={(c) => setDesign({ ...design, overlayColor: c })}
          onOpacityChange={(o) => setDesign({ ...design, overlayOpacity: o })}
          onBlendChange={(b) => setDesign({ ...design, overlayBlend: b })}
        />
        <p className="text-[10px] text-white/30">Tints the whole canvas with a color + blend mode.</p>
      </section>
    </div>
  );
}
