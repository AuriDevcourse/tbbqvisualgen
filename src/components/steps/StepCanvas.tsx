"use client";

import { FormatPicker } from "@/components/FormatPicker";
import { BackgroundPicker } from "@/components/BackgroundPicker";
import { OverlayPicker } from "@/components/OverlayPicker";
import { PhotoBackgroundCard } from "@/components/PhotoBackgroundCard";
import type { CanvasImage } from "@/components/ImagePlacer";
import { AccentThumbnail } from "@/components/CanvasAccents";
import { ACCENT_OPTIONS, applyAccent } from "@/lib/accents";
import { FORMAT_DIMENSIONS, type DesignConfig, type PlatformFormat } from "@/types/template";

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
  /** The full-bleed uploaded photo acting as the background, if any. */
  photoBackground: CanvasImage | null;
  addPhotoBackground: (image: CanvasImage) => void;
  updateCanvasImage: (id: string, patch: Partial<CanvasImage>) => void;
  removeCanvasImage: (id: string) => void;
}

// The template picker lives in the empty-canvas gallery (single start funnel).
// This tab is the canvas *setup*: format, background, logo, overlay.
export function StepCanvas({
  format, setFormat, customSize, setCustomSize, design, setDesign,
  photoBackground, addPhotoBackground, updateCanvasImage, removeCanvasImage,
}: StepCanvasProps) {
  // The accent circles are sized off the canvas, so switching them needs the
  // real dimensions — same rule the editor uses for its own `dims`.
  const accentDims = format === "custom" ? customSize : (FORMAT_DIMENSIONS[format] ?? FORMAT_DIMENSIONS.square);
  return (
    <div className="flex flex-col gap-5">
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

        <PhotoBackgroundCard
          image={photoBackground}
          onPick={addPhotoBackground}
          onUpdate={updateCanvasImage}
          onRemove={removeCanvasImage}
        />

        {/* The gradient still renders underneath an uploaded photo, so say so
            rather than letting the picker look broken. */}
        <div className="flex items-center gap-2 pt-1">
          <span className="h-px flex-1 bg-white/10" />
          <span className="text-[9px] uppercase tracking-[0.18em] text-white/40">
            {photoBackground ? "Behind the photo" : "Or pick a gradient"}
          </span>
          <span className="h-px flex-1 bg-white/10" />
        </div>

        <div className={photoBackground ? "opacity-50 transition-opacity" : "transition-opacity"}>
          <BackgroundPicker
            value={design.backgroundId}
            onChange={(id) => setDesign({ ...design, backgroundId: id })}
          />
        </div>
        <p className="text-[10px] text-white/60">
          {photoBackground
            ? "Your photo covers this. Remove the photo to see it again."
            : "Pause/resume the animation above the canvas."}
        </p>
      </section>

      {/* Investor accents — same choice as in Quick Templates, so fine-tuning
          a design doesn't mean losing the ability to change it. */}
      <section className="flex flex-col gap-2">
        <span className="text-[10px] font-medium text-white/65 uppercase tracking-[0.18em]">Investor accents</span>
        <div className="flex gap-1.5">
          {[{ id: undefined, label: "None" }, ...ACCENT_OPTIONS].map((opt) => {
            const active = (design.accentId ?? undefined) === opt.id;
            return (
              <button
                key={opt.id ?? "none"}
                onClick={() => setDesign(applyAccent(design, opt.id, accentDims.width, accentDims.height))}
                aria-pressed={active}
                title={opt.id ? `${opt.label} — circle accents in opposite corners` : "No circle accents"}
                className={`flex-1 flex flex-col items-center gap-1 px-1.5 py-1.5 rounded-lg border text-[10px] leading-tight transition-all ${
                  active ? "border-[#FF6B00] bg-[#FF6B00]/10 text-white" : "border-white/10 bg-white/5 text-white/70 hover:border-white/25"
                }`}
              >
                <span className="w-full aspect-square max-w-9 rounded overflow-hidden border border-white/10">
                  {opt.id ? <AccentThumbnail id={opt.id} /> : <span className="block w-full h-full bg-[#15110E]" />}
                </span>
                <span className="font-medium text-center">{opt.label}</span>
              </button>
            );
          })}
        </div>
        <p className="text-[10px] text-white/60">Renders behind every layer, in opposite corners.</p>
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
