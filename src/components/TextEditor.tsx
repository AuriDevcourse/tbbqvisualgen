"use client";

import { ColorPicker } from "@/components/ColorPicker";
import { GeometryFields } from "@/components/GeometryFields";
import { CANVAS_FONT_OPTIONS, FONTS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { TextElement } from "@/types/template";

// Curated font-size scale from 18px (smallest readable) up to 150px (the
// largest preset). The user can pick one of these via the dropdown OR type
// any number in the adjacent input for a custom size.
const FONT_SIZE_PRESETS = [18, 24, 32, 42, 56, 72, 88, 108, 128, 150];

interface TextEditorProps {
  text: TextElement;
  onChange: (patch: Partial<TextElement>) => void;
  /** Canvas pixel size, so the numeric fields can read in export pixels. */
  canvasSize: { width: number; height: number };
}

/**
 * Every property of one text layer.
 *
 * Lifted verbatim out of `StepText`, where it was ~215 lines of JSX rendered
 * INSIDE the row it belonged to. That inline expansion measured 833px inside a
 * 566px column, so editing a layer buried the list you were navigating
 * (PROGRESS.md handoff 36, item 4). It lives in its own pane now, and being a
 * component is what let it move.
 */
export function TextEditor({ text, onChange, canvasSize }: TextEditorProps) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-col gap-1">
        <label className="text-[9px] uppercase tracking-wider text-white/65">Content</label>
        <textarea
          value={text.content}
          onChange={(e) => onChange({ content: e.target.value })}
          rows={2}
          placeholder="Enter text..."
          className="bg-white/5 border border-white/10 rounded-md px-2 py-1.5 text-xs text-white placeholder:text-white/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B00]/70 focus:border-[#FF6B00]/40 resize-none"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-[9px] uppercase tracking-wider text-white/65">Size</label>
        <div className="flex items-center gap-1.5">
          <select
            value={FONT_SIZE_PRESETS.includes(text.fontSize) ? text.fontSize : ""}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (!Number.isNaN(v) && v > 0) onChange({ fontSize: v });
            }}
            aria-label="Font size preset"
            className="flex-1 bg-white/5 border border-white/10 rounded-md px-2 py-1 text-xs text-white/85 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B00]/70 focus:border-[#FF6B00]/40"
          >
            <option value="" disabled className="bg-[#15110e]">Custom · {text.fontSize}px</option>
            {FONT_SIZE_PRESETS.map((px) => (
              <option key={px} value={px} className="bg-[#15110e]">
                {px}px
              </option>
            ))}
          </select>
          <input
            type="number"
            min={1}
            max={500}
            value={text.fontSize}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (!Number.isNaN(v) && v > 0) onChange({ fontSize: v });
            }}
            aria-label="Font size (custom)"
            className="w-16 bg-white/5 border border-white/10 rounded-md px-2 py-1 text-xs text-white text-right focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B00]/70 focus:border-[#FF6B00]/40 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
          <span className="text-[10px] font-mono text-white/65">px</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <label className="text-[9px] uppercase tracking-wider text-white/65 w-12 shrink-0">Color</label>
        <ColorPicker
          color={text.color}
          defaultColor="#FFFFFF"
          onChange={(c) => onChange({ color: c })}
          ariaLabel="Text color"
          allowClear
        />
      </div>

      <div className="flex items-center gap-3">
        <label className="text-[9px] uppercase tracking-wider text-white/65 w-12 shrink-0">Font</label>
        <div className="flex gap-1 flex-1">
          {CANVAS_FONT_OPTIONS.map((f) => (
            <button
              key={f.value}
              onClick={() => onChange({ font: f.value })}
              style={{ fontFamily: FONTS[f.value] }}
              className={cn(
                "flex-1 py-1 rounded text-[11px] font-medium transition-colors",
                (text.font ?? "onest") === f.value
                  ? "bg-[#FF0028] text-white"
                  : "bg-white/5 border border-white/10 text-white/60 hover:bg-white/10",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <label className="text-[9px] uppercase tracking-wider text-white/65 w-12 shrink-0">Weight</label>
        <div className="flex gap-1 flex-1">
          {[400, 600, 800].map((w) => (
            <button
              key={w}
              onClick={() => onChange({ weight: w })}
              className={cn(
                "flex-1 py-1 rounded text-[10px] font-medium transition-colors",
                (text.weight ?? 700) === w
                  ? "bg-[#FF0028] text-white"
                  : "bg-white/5 border border-white/10 text-white/60 hover:bg-white/10",
              )}
              style={{ fontWeight: w }}
            >
              {w === 400 ? "Regular" : w === 600 ? "Semibold" : "Bold"}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <label className="text-[9px] uppercase tracking-wider text-white/65 w-12 shrink-0">Align</label>
        <div className="flex gap-1 flex-1">
          {(["left", "center", "right"] as const).map((a) => (
            <button
              key={a}
              onClick={() => onChange({ align: a })}
              className={cn(
                "flex-1 py-1 rounded text-[10px] font-medium transition-colors capitalize",
                (text.align ?? "center") === a
                  ? "bg-[#FF0028] text-white"
                  : "bg-white/5 border border-white/10 text-white/60 hover:bg-white/10",
              )}
            >
              {a}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <label className="text-[9px] uppercase tracking-wider text-white/65 w-12 shrink-0">Style</label>
        <div className="flex gap-1.5">
          <button
            onClick={() => onChange({ uppercase: !text.uppercase })}
            title="Uppercase"
            className={cn(
              "px-2 py-1 rounded text-[10px] font-medium transition-colors",
              text.uppercase
                ? "bg-[#FF0028]/20 text-[#FF6B00] border border-[#FF0028]/30"
                : "bg-white/5 border border-white/10 text-white/60 hover:bg-white/10",
            )}
          >
            AA
          </button>
          <button
            onClick={() => onChange({ italic: !text.italic })}
            title="Italic"
            className={cn(
              "px-2 py-1 rounded text-[10px] font-medium italic transition-colors",
              text.italic
                ? "bg-[#FF0028]/20 text-[#FF6B00] border border-[#FF0028]/30"
                : "bg-white/5 border border-white/10 text-white/60 hover:bg-white/10",
            )}
          >
            I
          </button>
          <button
            onClick={() => onChange({ gradient: !text.gradient })}
            className={cn(
              "px-2 py-1 rounded text-[10px] font-medium transition-colors",
              text.gradient
                ? "bg-[#FF0028]/20 text-[#FF6B00] border border-[#FF0028]/30"
                : "bg-white/5 border border-white/10 text-white/60 hover:bg-white/10",
            )}
          >
            Gradient
          </button>
        </div>
      </div>

      {/* Rotation + opacity + blur — line-height is now fixed at
       *  1.0 globally (see DynamicTemplate) so the bbox hugs the
       *  glyphs as tightly as possible. No user control. */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-2 pt-1 border-t border-white/5">
        <SliderRow
          label="Rotate"
          value={text.rotation ?? 0}
          min={-180} max={180} step={1}
          snap={[-180, -135, -90, -45, 0, 45, 90, 135, 180]}
          format={(v) => `${Math.round(v)}°`}
          onChange={(v) => onChange({ rotation: v })}
        />
        <SliderRow
          label="Opacity"
          value={text.opacity ?? 1}
          min={0} max={1} step={0.01}
          format={(v) => `${Math.round(v * 100)}%`}
          onChange={(v) => onChange({ opacity: v })}
        />
        <SliderRow
          label="Blur"
          value={text.blur ?? 0}
          min={0} max={0.05} step={0.001}
          format={(v) => `${Math.round(v * 1000)}`}
          onChange={(v) => onChange({ blur: v })}
        />
      </div>

      <div className="pt-1 border-t border-white/5 flex flex-col gap-1.5">
        {/* A text has no width or height of its own — it is a
            position plus a font size — so only X and Y. */}
        <GeometryFields
          value={{ x: text.position.x, y: text.position.y }}
          canvasWidth={canvasSize.width}
          canvasHeight={canvasSize.height}
          showSize={false}
          onChange={(patch) => onChange({
            position: {
              x: patch.x ?? text.position.x,
              y: patch.y ?? text.position.y,
            },
          })}
        />
        <button
          onClick={() => onChange({ position: { x: 0.5, y: 0.5 } })}
          className="self-start text-[10px] text-white/65 hover:text-white/80 transition-colors underline"
        >
          centre on canvas
        </button>
      </div>
      <p className="text-[10px] text-white/60">Drag the text on the canvas to reposition.</p>
    </div>
  );
}

// Reusable labeled slider row, matches the StepElements one.
interface SliderRowProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
  /** Values the slider magnetically snaps to when dragged near them. */
  snap?: number[];
  /** How close (in value units) to a snap point before it grabs. Default 3. */
  snapWithin?: number;
}

function SliderRow({ label, value, min, max, step, format, onChange, snap, snapWithin = 3 }: SliderRowProps) {
  const applySnap = (v: number) => {
    if (!snap) return v;
    let best = v;
    let bestDist = snapWithin;
    for (const s of snap) {
      const d = Math.abs(v - s);
      if (d <= bestDist) {
        best = s;
        bestDist = d;
      }
    }
    return best;
  };
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <label className="text-[9px] uppercase tracking-wider text-white/65">{label}</label>
        <span className="text-[10px] font-mono text-white/60">{format(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(applySnap(Number(e.target.value)))}
        className="w-full accent-[#FF6B00]"
      />
    </div>
  );
}
