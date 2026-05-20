"use client";

import { Plus, Trash2, Eye, EyeOff, ChevronDown, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { ColorPicker } from "@/components/ColorPicker";
import { newTextElement } from "@/types/template";
import type { DesignConfig, TextElement } from "@/types/template";
import { CANVAS_FONT_OPTIONS, FONTS } from "@/lib/constants";

// Curated font-size scale from 18px (smallest readable) up to 150px (the
// largest preset). The user can pick one of these via the dropdown OR type
// any number in the adjacent input for a custom size.
const FONT_SIZE_PRESETS = [18, 24, 32, 42, 56, 72, 88, 108, 128, 150];

interface StepTextProps {
  design: DesignConfig;
  setDesign: (next: DesignConfig | ((prev: DesignConfig) => DesignConfig)) => void;
  /** When set, auto-expand and scroll to this text's row so the user can
   *  edit the layer they just clicked on the canvas. */
  focusedId?: string | null;
}

export function StepText({ design, setDesign, focusedId }: StepTextProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Expand + scroll the focused row whenever the canvas single-selection changes.
  useEffect(() => {
    if (!focusedId) return;
    setExpandedIds((prev) => {
      if (prev.has(focusedId)) return prev;
      const next = new Set(prev);
      next.add(focusedId);
      return next;
    });
    const el = rowRefs.current.get(focusedId);
    if (el) el.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [focusedId]);

  const addText = () => {
    const next = newTextElement("YOUR TEXT");
    setDesign((d) => ({ ...d, texts: [...d.texts, next] }));
    setExpandedIds((prev) => new Set(prev).add(next.id));
  };

  const updateText = (id: string, patch: Partial<TextElement>) => {
    setDesign((d) => ({
      ...d,
      texts: d.texts.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    }));
  };

  const removeText = (id: string) => {
    setDesign((d) => ({ ...d, texts: d.texts.filter((t) => t.id !== id) }));
  };

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-medium text-white/40 uppercase tracking-[0.18em]">
          ▪ Text layers ({design.texts.length})
        </span>
        <button
          onClick={addText}
          aria-label="Add text layer"
          className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#FF6B00]/10 border border-[#FF6B00]/30 text-[10px] font-medium text-[#FF6B00] hover:bg-[#FF6B00]/20 transition-colors"
        >
          <Plus className="w-3 h-3" />
          Add text
        </button>
      </div>

      {design.texts.length === 0 && (
        <div className="text-[11px] text-white/40 px-3 py-4 text-center border border-dashed border-white/10 rounded-lg">
          No text on canvas. Click <span className="text-[#FF6B00]">Add text</span> to create your first layer.
        </div>
      )}

      <div className="flex flex-col gap-2">
        {design.texts.map((text) => {
          const expanded = expandedIds.has(text.id);
          const isFocused = focusedId === text.id;
          return (
            <div
              key={text.id}
              ref={(node) => {
                if (node) rowRefs.current.set(text.id, node);
                else rowRefs.current.delete(text.id);
              }}
              className={cn(
                "rounded-lg border bg-white/5 transition-colors",
                isFocused ? "border-[#FF0028]/50 ring-1 ring-[#FF0028]/20" : expanded ? "border-[#FF6B00]/30" : "border-white/10",
              )}
            >
              {/* Row header */}
              <div className="flex items-center gap-1.5 px-2 py-1.5">
                <button
                  onClick={() => toggleExpand(text.id)}
                  aria-label={expanded ? "Collapse" : "Expand"}
                  className="p-0.5 rounded text-white/50 hover:text-white hover:bg-white/10 transition-colors"
                >
                  {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                </button>
                <span
                  onClick={() => toggleExpand(text.id)}
                  className={cn(
                    "flex-1 text-[11px] truncate cursor-pointer",
                    text.hidden ? "text-white/40 line-through" : "text-white/85",
                  )}
                >
                  {text.content.trim().slice(0, 32) || "Empty text"}
                </span>
                <button
                  onClick={() => updateText(text.id, { hidden: !text.hidden })}
                  aria-label={text.hidden ? "Show layer" : "Hide layer"}
                  className="p-0.5 rounded text-white/50 hover:text-white hover:bg-white/10 transition-colors"
                >
                  {text.hidden ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                </button>
                <button
                  onClick={() => removeText(text.id)}
                  aria-label="Delete layer"
                  className="p-0.5 rounded text-white/40 hover:text-[#FF0028] hover:bg-[#FF0028]/10 transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>

              {/* Expanded controls */}
              {expanded && (
                <div className="flex flex-col gap-2.5 px-3 pb-3 pt-1 border-t border-white/5">
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] uppercase tracking-wider text-white/40">Content</label>
                    <textarea
                      value={text.content}
                      onChange={(e) => updateText(text.id, { content: e.target.value })}
                      rows={2}
                      placeholder="Enter text..."
                      className="bg-white/5 border border-white/10 rounded-md px-2 py-1.5 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-[#FF6B00]/40 resize-none"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] uppercase tracking-wider text-white/40">Size</label>
                    <div className="flex items-center gap-1.5">
                      <select
                        value={FONT_SIZE_PRESETS.includes(text.fontSize) ? text.fontSize : ""}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          if (!Number.isNaN(v) && v > 0) updateText(text.id, { fontSize: v });
                        }}
                        aria-label="Font size preset"
                        className="flex-1 bg-white/5 border border-white/10 rounded-md px-2 py-1 text-xs text-white/85 focus:outline-none focus:border-[#FF6B00]/40"
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
                          if (!Number.isNaN(v) && v > 0) updateText(text.id, { fontSize: v });
                        }}
                        aria-label="Font size (custom)"
                        className="w-16 bg-white/5 border border-white/10 rounded-md px-2 py-1 text-xs text-white text-right focus:outline-none focus:border-[#FF6B00]/40 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      />
                      <span className="text-[10px] font-mono text-white/40">px</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <label className="text-[9px] uppercase tracking-wider text-white/40 w-12 shrink-0">Color</label>
                    <ColorPicker
                      color={text.color}
                      defaultColor="#FFFFFF"
                      onChange={(c) => updateText(text.id, { color: c })}
                      ariaLabel="Text color"
                      allowClear
                    />
                  </div>

                  <div className="flex items-center gap-3">
                    <label className="text-[9px] uppercase tracking-wider text-white/40 w-12 shrink-0">Font</label>
                    <div className="flex gap-1 flex-1">
                      {CANVAS_FONT_OPTIONS.map((f) => (
                        <button
                          key={f.value}
                          onClick={() => updateText(text.id, { font: f.value })}
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
                    <label className="text-[9px] uppercase tracking-wider text-white/40 w-12 shrink-0">Weight</label>
                    <div className="flex gap-1 flex-1">
                      {[400, 600, 800].map((w) => (
                        <button
                          key={w}
                          onClick={() => updateText(text.id, { weight: w })}
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
                    <label className="text-[9px] uppercase tracking-wider text-white/40 w-12 shrink-0">Align</label>
                    <div className="flex gap-1 flex-1">
                      {(["left", "center", "right"] as const).map((a) => (
                        <button
                          key={a}
                          onClick={() => updateText(text.id, { align: a })}
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
                    <label className="text-[9px] uppercase tracking-wider text-white/40 w-12 shrink-0">Style</label>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => updateText(text.id, { uppercase: !text.uppercase })}
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
                        onClick={() => updateText(text.id, { italic: !text.italic })}
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
                        onClick={() => updateText(text.id, { gradient: !text.gradient })}
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
                      format={(v) => `${Math.round(v)}°`}
                      onChange={(v) => updateText(text.id, { rotation: v })}
                    />
                    <SliderRow
                      label="Opacity"
                      value={text.opacity ?? 1}
                      min={0} max={1} step={0.01}
                      format={(v) => `${Math.round(v * 100)}%`}
                      onChange={(v) => updateText(text.id, { opacity: v })}
                    />
                    <SliderRow
                      label="Blur"
                      value={text.blur ?? 0}
                      min={0} max={0.05} step={0.001}
                      format={(v) => `${Math.round(v * 1000)}`}
                      onChange={(v) => updateText(text.id, { blur: v })}
                    />
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-white/5">
                    <span className="text-[9px] uppercase tracking-wider text-white/40">Position</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-white/40">
                        {Math.round(text.position.x * 100)}% · {Math.round(text.position.y * 100)}%
                      </span>
                      <button
                        onClick={() => updateText(text.id, { position: { x: 0.5, y: 0.5 } })}
                        className="text-[10px] text-white/40 hover:text-white/80 transition-colors underline"
                      >
                        center
                      </button>
                    </div>
                  </div>
                  <p className="text-[10px] text-white/30">Drag the text on the canvas to reposition.</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
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
}

function SliderRow({ label, value, min, max, step, format, onChange }: SliderRowProps) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <label className="text-[9px] uppercase tracking-wider text-white/40">{label}</label>
        <span className="text-[10px] font-mono text-white/60">{format(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[#FF6B00]"
      />
    </div>
  );
}
