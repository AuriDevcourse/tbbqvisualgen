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

// TechBBQ logo color options. Swatches mirror the three logo PNGs.
const LOGO_STYLES: { id: NonNullable<DesignConfig["logoStyle"]>; label: string; swatch: React.CSSProperties }[] = [
  { id: "white", label: "White", swatch: { background: "#f2f2f2" } },
  { id: "red", label: "Red", swatch: { background: "#ce0f2e" } },
  { id: "gradient", label: "Gradient", swatch: { background: "linear-gradient(120deg, #fa7000 0%, #ff2600 45%, #ce0f2e 100%)" } },
];

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
            <span className="text-[10px] font-medium text-white/65 uppercase tracking-[0.18em]">
              Start from a template
            </span>
            {Array.from(groups.entries()).map(([groupLabel, items]) => (
              <div key={groupLabel} className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-semibold text-white/55 uppercase tracking-[0.14em]">
                    {groupLabel}
                  </span>
                  <span className="text-[9px] text-white/60">{items.length}</span>
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
                                    hasCustom ? "Your saved variant" : hasBuiltIn ? "Ships with template" : "Not yet defined for this format",
                                  ].filter(Boolean).join(" · ")}
                                  className={`relative text-[8.5px] font-mono px-1 py-px rounded border ${
                                    isCurrent
                                      ? "border-[#FF6B00]/70 bg-[#FF6B00]/15 text-[#FF8A1F]"
                                      : exists
                                        ? "border-white/15 bg-white/5 text-white/65"
                                        : "border-white/10 bg-transparent text-white/60"
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
            <p className="text-[10px] text-white/60">
              Loads a layout you can customize. Click any image slot to upload a photo.
            </p>
          </section>
        );
      })()}

      <section className="flex flex-col gap-2">
        <span className="text-[10px] font-medium text-white/65 uppercase tracking-[0.18em]">Format</span>
        <FormatPicker
          value={format}
          onChange={setFormat}
          customWidth={customSize.width}
          customHeight={customSize.height}
          onCustomSizeChange={(w, h) => setCustomSize({ width: w, height: h })}
        />
      </section>

      <section className="flex flex-col gap-2">
        <span className="text-[10px] font-medium text-white/65 uppercase tracking-[0.18em]">Background</span>
        <BackgroundPicker
          value={design.backgroundId}
          onChange={(id) => setDesign({ ...design, backgroundId: id })}
        />
        <p className="text-[10px] text-white/60">Pause/resume the animation above the canvas.</p>
      </section>

      <section className="flex flex-col gap-2 pt-3 border-t border-white/5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-medium text-white/65 uppercase tracking-[0.18em]">TechBBQ logo</span>
          <label className="flex items-center gap-1.5 text-[10px] text-white/50 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={design.showLogo ?? false}
              onChange={(e) => setDesign({ ...design, showLogo: e.target.checked })}
              className="accent-[#FF6B00]"
            />
            Show
          </label>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {LOGO_STYLES.map(({ id, label, swatch }) => {
            const active = (design.logoStyle ?? "white") === id;
            return (
              <button
                key={id}
                onClick={() => setDesign({ ...design, showLogo: true, logoStyle: id })}
                aria-pressed={active}
                title={`${label} logo`}
                className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border transition-all ${
                  active
                    ? "border-[#FF6B00] bg-[#FF6B00]/10"
                    : "border-white/10 bg-white/5 hover:border-white/25"
                }`}
              >
                <span className="w-4 h-4 rounded-full border border-white/20 shrink-0" style={swatch} />
                <span className="text-[11px] font-medium text-white/85">{label}</span>
              </button>
            );
          })}
        </div>
        <p className="text-[10px] text-white/60">Click the logo on the canvas to move or resize it.</p>
      </section>

      <section className="flex flex-col gap-2 pt-3 border-t border-white/5">
        <span className="text-[10px] font-medium text-white/65 uppercase tracking-[0.18em]">Color overlay</span>
        <OverlayPicker
          color={design.overlayColor}
          opacity={design.overlayOpacity ?? 0}
          blend={design.overlayBlend || "multiply"}
          onColorChange={(c) => setDesign({ ...design, overlayColor: c })}
          onOpacityChange={(o) => setDesign({ ...design, overlayOpacity: o })}
          onBlendChange={(b) => setDesign({ ...design, overlayBlend: b })}
        />
        <p className="text-[10px] text-white/60">Tints the whole canvas with a color + blend mode.</p>
      </section>
    </div>
  );
}
