"use client";

import { useEffect, useRef, useState } from "react";
import { Square, Circle, Minus, Star, Eye, EyeOff, ChevronDown, ChevronRight, Link2, Unlink, ImagePlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { ACTION_BTN, ACTION_BTN_IDLE, ACTION_BTN_ACTIVE, ROW_BASE, ROW_HOVER, rowSelectedStyle } from "@/lib/panelRow";
import { GeometryFields } from "@/components/GeometryFields";
import { ColorPicker } from "@/components/ColorPicker";
import { newShapeElement, newImagePlaceholder } from "@/types/template";
import type { DesignConfig, ShapeElement, ShapeType, ShapeBorderRadii } from "@/types/template";

interface StepElementsProps {
  design: DesignConfig;
  setDesign: (next: DesignConfig | ((prev: DesignConfig) => DesignConfig)) => void;
  selectedShapeId: string | null;
  onSelectShape: (id: string | null) => void;
  /** Canvas pixel size, so the numeric fields can read in export pixels. */
  canvasSize?: { width: number; height: number };
}

const SHAPE_BUTTONS: { type: ShapeType; label: string; Icon: typeof Square }[] = [
  { type: "rectangle", label: "Rectangle", Icon: Square },
  { type: "circle", label: "Circle", Icon: Circle },
  { type: "line", label: "Line", Icon: Minus },
  { type: "star", label: "Star", Icon: Star },
];

export function StepElements({ design, setDesign, selectedShapeId, onSelectShape, canvasSize = { width: 1920, height: 1080 } }: StepElementsProps) {
  /** Which shape the properties pane below is showing, or null. See the note
   *  in StepText — rows no longer expand, so there is nothing to "expand". */
  const [editingId, setEditingId] = useState<string | null>(null);
  /** Which row the pointer is over — see the note in StepText. */
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const shapes = design.shapes ?? [];
  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Auto-expand the row matching the canvas single-selection.
  useEffect(() => {
    if (!selectedShapeId) return;
    setEditingId(selectedShapeId);
  }, [selectedShapeId]);

  // Scroll in a second pass, after the expanded card has laid out — see the
  // same split in StepText for why one effect got the wrong position.
  const focusedIsEditing = selectedShapeId ? editingId === selectedShapeId : false;
  useEffect(() => {
    if (!selectedShapeId || !focusedIsEditing) return;
    const el = rowRefs.current.get(selectedShapeId);
    if (!el) return;
    const raf = requestAnimationFrame(() => el.scrollIntoView({ block: "start", behavior: "smooth" }));
    return () => cancelAnimationFrame(raf);
  }, [selectedShapeId, focusedIsEditing]);

  const addShape = (type: ShapeType) => {
    const next = newShapeElement(type);
    setDesign((d) => ({ ...d, shapes: [...(d.shapes ?? []), next] }));
    setEditingId(next.id);
    onSelectShape(next.id);
  };

  const addPhotoSlot = () => {
    const next = newImagePlaceholder();
    setDesign((d) => ({ ...d, shapes: [...(d.shapes ?? []), next] }));
    setEditingId(next.id);
    onSelectShape(next.id);
  };

  const updateShape = (id: string, patch: Partial<ShapeElement>) => {
    setDesign((d) => ({
      ...d,
      shapes: (d.shapes ?? []).map((s) => (s.id === id ? { ...s, ...patch } : s)),
    }));
  };

  const editing = (design.shapes ?? []).find((sh) => sh.id === editingId) ?? null;

  return (
    // Adders and the list on top, properties below — the same split as the Text
    // panel, so the two behave alike.
    <div className="flex flex-col min-h-0 flex-1 gap-4">
      {/* Add photo slot — emphasized as a primary action because it's the
       *  fastest way to lay out speaker/headshot frames before uploading. */}
      {/* The adders keep their natural height and never scroll: they are the
          primary action of this panel. Only the LIST is capped. Putting them
          inside the list's budget squeezed "SHAPES (5)" down to one visible
          row. */}
      <div className="flex flex-col gap-4 shrink-0">
      <section className="flex flex-col gap-2">
        <span className="text-[10px] font-medium text-white/65 uppercase tracking-[0.18em]">Add photo slot</span>
        <button
          onClick={addPhotoSlot}
          className="flex items-center justify-center gap-2 py-2.5 rounded-md bg-gradient-to-r from-[#FF6B00]/15 to-[#FF0028]/15 border border-[#FF6B00]/40 text-white/90 text-[11px] font-semibold hover:from-[#FF6B00]/25 hover:to-[#FF0028]/25 hover:border-[#FF6B00]/70 transition-all"
        >
          <ImagePlus className="w-4 h-4 text-[#FF6B00]" />
          Add photo slot
        </button>
        <p className="text-[10px] text-white/60">
          Drops a placeholder rectangle. Click it on canvas to upload a photo into that slot.
        </p>
      </section>

      {/* Add shape buttons */}
      <section className="flex flex-col gap-2 pt-3 border-t border-white/5">
        <span className="text-[10px] font-medium text-white/65 uppercase tracking-[0.18em]">Add shape</span>
        <div className="grid grid-cols-4 gap-1.5">
          {SHAPE_BUTTONS.map(({ type, label, Icon }) => (
            <button
              key={type}
              onClick={() => addShape(type)}
              aria-label={`Add ${label}`}
              title={label}
              className="flex flex-col items-center justify-center gap-1 py-2 rounded-md bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 hover:text-white/90 hover:border-[#FF6B00]/40 transition-colors"
            >
              <Icon className="w-4 h-4" />
              <span className="text-[9px] uppercase tracking-wider">{label}</span>
            </button>
          ))}
        </div>
      </section>

      </div>

      {/* Shape layers list — its own scroller, so the adders above and the
          properties below cannot starve it. */}
      <section className="flex flex-col gap-2 flex-1 min-h-0 pt-3 border-t border-white/5">
        {/* The `Shapes (n)` heading is gone — the ELEMENTS tab above carries
            the count now. This row held nothing else, so the whole row and its
            gap go with it. */}
        {shapes.length === 0 && (
          <div className="text-[11px] text-white/65 px-3 py-4 text-center border border-dashed border-white/10 rounded-lg">
            No shapes yet. Click one of the buttons above to add.
          </div>
        )}

        <div className="flex flex-col overflow-y-auto -mx-1 px-1">
          {shapes.map((s) => {
            const isSel = selectedShapeId === s.id;
            const isPlaceholder = !!s.imagePlaceholder;
            const ShapeIcon = isPlaceholder
              ? ImagePlus
              : SHAPE_BUTTONS.find((b) => b.type === s.type)?.Icon ?? Square;
            // A shape named in the Layers panel has to read the same here. This
            // is the THIRD list of layers in the editor (Layers panel, Text
            // step, Elements step) — a rename that only lands in one of them is
            // worse than no rename at all.
            const rowLabel = s.name?.trim()
              ? s.name.trim()
              : isPlaceholder
                ? `Photo slot · ${s.imagePlaceholder?.label ?? "PHOTO"}`
                : `${s.type[0].toUpperCase() + s.type.slice(1)} · ${s.id.slice(-4)}`;
            return (
              <div
                key={s.id}
                ref={(node) => {
                  if (node) rowRefs.current.set(s.id, node);
                  else rowRefs.current.delete(s.id);
                }}
                onMouseEnter={() => setHoveredId(s.id)}
                onMouseLeave={() => setHoveredId((cur) => (cur === s.id ? null : cur))}
              >
                <div
                  className={cn(ROW_BASE, "px-1.5 cursor-pointer", !isSel && ROW_HOVER)}
                  style={isSel ? rowSelectedStyle() : undefined}
                  onClick={() => {
                    onSelectShape(s.id);
                    setEditingId(s.id);
                  }}
                >
                  <ShapeIcon className={cn("w-3.5 h-3.5 shrink-0", isPlaceholder ? "text-[#FF6B00]" : "text-white/60")} />
                  <span
                    className={cn("flex-1 text-[11px] truncate", s.hidden ? "text-white/65 line-through" : "text-white/85")}
                    title={rowLabel}
                  >
                    {rowLabel}
                  </span>
                  {(hoveredId === s.id || s.hidden) && (
                    <button
                      onClick={(e) => { e.stopPropagation(); updateShape(s.id, { hidden: !s.hidden }); }}
                      aria-label={s.hidden ? "Show shape" : "Hide shape"}
                      aria-pressed={s.hidden}
                      className={cn(ACTION_BTN, s.hidden ? ACTION_BTN_ACTIVE : ACTION_BTN_IDLE)}
                    >
                      {s.hidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  )}
                  {/* Delete is gone from the row: clicking it already selects
                      the shape on canvas, so the Delete key removes it. */}
                </div>

              </div>
            );
          })}
        </div>
      </section>

      {/* ---- Properties for the selected shape ---- */}
      <div className="flex flex-col min-h-0 flex-[1.6] border-t border-white/10 pt-3">
        {editing ? (
          <>
            <div className="flex items-center gap-1.5 shrink-0 pb-2">
              <span className="text-[10px] font-medium text-white/65 uppercase tracking-[0.18em] shrink-0">Editing</span>
              <span className="flex-1 truncate text-[11px] text-white/85">
                {editing.name?.trim()
                  || (editing.imagePlaceholder
                        ? `Photo slot · ${editing.imagePlaceholder.label ?? "PHOTO"}`
                        : `${editing.type[0].toUpperCase() + editing.type.slice(1)} · ${editing.id.slice(-4)}`)}
              </span>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto -mx-1 px-1">
              <ShapeEditor
                shape={editing}
                canvasSize={canvasSize}
                onChange={(patch) => updateShape(editing.id, patch)}
              />
            </div>
          </>
        ) : (
          (design.shapes ?? []).length > 0 && (
            <p className="text-[11px] text-white/45 pt-1">Pick a shape above to edit it.</p>
          )
        )}
      </div>
    </div>
  );
}

// ── Per-shape editor (fill, color, stroke, effects, per-shape extras) ──────

interface ShapeEditorProps {
  shape: ShapeElement;
  onChange: (patch: Partial<ShapeElement>) => void;
}

function ShapeEditor({ shape, onChange, canvasSize }: ShapeEditorProps & { canvasSize: { width: number; height: number } }) {
  const isLine = shape.type === "line";
  const isPlaceholder = !!shape.imagePlaceholder;
  const [showMore, setShowMore] = useState(false);

  return (
    <div className="flex flex-col gap-2.5">
      {/* Placeholder label — visible only for image-upload slots. */}
      {isPlaceholder && (
        <div className="flex items-center gap-3">
          <label className="text-[9px] uppercase tracking-wider text-white/65 w-12 shrink-0">Label</label>
          <input
            type="text"
            value={shape.imagePlaceholder?.label ?? ""}
            onChange={(e) => onChange({ imagePlaceholder: { label: e.target.value } })}
            placeholder="PHOTO"
            maxLength={32}
            className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-[11px] text-white placeholder:text-white/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B00]/70 focus:border-[#FF6B00]/40"
          />
        </div>
      )}

      {/* Fill / Outline tabs — Line is always solid colored. */}
      {!isLine && (
        <div className="flex items-center gap-3">
          <label className="text-[9px] uppercase tracking-wider text-white/65 w-12 shrink-0">Mode</label>
          <div className="flex gap-1 flex-1">
            {(["fill", "outline"] as const).map((m) => (
              <button
                key={m}
                onClick={() => onChange({ fillType: m })}
                className={cn(
                  "flex-1 py-1 rounded text-[10px] font-medium transition-colors capitalize",
                  shape.fillType === m
                    ? "bg-[#FF0028] text-white"
                    : "bg-white/5 border border-white/10 text-white/60 hover:bg-white/10",
                )}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Color type — solid vs gradient (gradient skipped on outline-only for simplicity) */}
      <div className="flex items-center gap-3">
        <label className="text-[9px] uppercase tracking-wider text-white/65 w-12 shrink-0">Color</label>
        <div className="flex gap-1 flex-1">
          {(["solid", "gradient"] as const).map((c) => (
            <button
              key={c}
              onClick={() => onChange({ colorType: c })}
              disabled={c === "gradient" && shape.fillType === "outline"}
              className={cn(
                "flex-1 py-1 rounded text-[10px] font-medium transition-colors capitalize",
                shape.colorType === c && !(c === "gradient" && shape.fillType === "outline")
                  ? "bg-[#FF0028] text-white"
                  : "bg-white/5 border border-white/10 text-white/60 hover:bg-white/10",
                c === "gradient" && shape.fillType === "outline" ? "opacity-40 cursor-not-allowed" : "",
              )}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <label className="text-[9px] uppercase tracking-wider text-white/65 w-12 shrink-0">
          {shape.colorType === "gradient" && shape.fillType !== "outline" ? "From" : "Fill"}
        </label>
        <ColorPicker
          color={shape.color1}
          defaultColor="#FFFFFF"
          onChange={(c) => onChange({ color1: c })}
          ariaLabel="Shape primary color"
        />
      </div>

      {shape.colorType === "gradient" && shape.fillType !== "outline" && (
        <div className="flex items-center gap-3">
          <label className="text-[9px] uppercase tracking-wider text-white/65 w-12 shrink-0">To</label>
          <ColorPicker
            color={shape.color2}
            defaultColor="#FF6B00"
            onChange={(c) => onChange({ color2: c })}
            ariaLabel="Shape secondary color"
          />
        </div>
      )}

      {/* Stroke width — visible on outline or line */}
      {(shape.fillType === "outline" || isLine) && (
        <SliderRow
          label={isLine ? "Thickness" : "Stroke"}
          value={shape.strokeWidth}
          min={0.001}
          max={0.05}
          step={0.001}
          format={(v) => `${Math.round(v * 1000)}`}
          onChange={(v) => onChange({ strokeWidth: v })}
        />
      )}

      {/* Rectangle radius — a defining property, kept visible. */}
      {shape.type === "rectangle" && <RectRadiusEditor shape={shape} onChange={onChange} />}

      {/* More options — effects + shape-specific extras, hidden by default so
       *  the common controls (mode, color, stroke, radius) stay uncluttered. */}
      <button
        onClick={() => setShowMore((v) => !v)}
        className="flex items-center gap-1.5 text-[9px] uppercase tracking-wider text-white/65 hover:text-white/70 transition-colors pt-0.5"
      >
        {showMore ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        More options
      </button>

      {showMore && (
        <div className="flex flex-col gap-2.5">
          <SliderRow
            label="Opacity"
            value={shape.opacity}
            min={0}
            max={1}
            step={0.01}
            format={(v) => `${Math.round(v * 100)}%`}
            onChange={(v) => onChange({ opacity: v })}
          />
          <SliderRow
            label="Blur"
            value={shape.blur}
            min={0}
            max={0.05}
            step={0.001}
            format={(v) => `${Math.round(v * 1000)}`}
            onChange={(v) => onChange({ blur: v })}
          />
          <SliderRow
            label="Rotate"
            value={shape.rotation}
            min={-180}
            max={180}
            step={1}
            format={(v) => `${Math.round(v)}°`}
            onChange={(v) => onChange({ rotation: v })}
          />
          {shape.type === "star" && (
            <>
              <SliderRow
                label="Spikes"
                value={shape.spikes ?? 5}
                min={3}
                max={12}
                step={1}
                format={(v) => `${v}`}
                onChange={(v) => onChange({ spikes: Math.round(v) })}
              />
              <SliderRow
                label="Inner"
                value={shape.innerRadius ?? 0.5}
                min={0.1}
                max={0.9}
                step={0.01}
                format={(v) => `${Math.round(v * 100)}%`}
                onChange={(v) => onChange({ innerRadius: v })}
              />
            </>
          )}
        </div>
      )}

      <div className="pt-1 border-t border-white/5">
        <GeometryFields
          value={{ x: shape.x, y: shape.y, width: shape.width, height: shape.height }}
          canvasWidth={canvasSize.width}
          canvasHeight={canvasSize.height}
          onChange={(patch) => onChange(patch)}
        />
      </div>
    </div>
  );
}

// ── Per-corner radius editor for rectangles ────────────────────────────────

function RectRadiusEditor({ shape, onChange }: { shape: ShapeElement; onChange: (patch: Partial<ShapeElement>) => void }) {
  const br = shape.borderRadius;
  const linked = typeof br === "number" || br === undefined;
  const radii: ShapeBorderRadii = (typeof br === "object" && br !== null)
    ? br
    : { tl: typeof br === "number" ? br : 0, tr: typeof br === "number" ? br : 0, br: typeof br === "number" ? br : 0, bl: typeof br === "number" ? br : 0 };

  const toggle = () => {
    if (linked) {
      const v = typeof br === "number" ? br : 0;
      onChange({ borderRadius: { tl: v, tr: v, br: v, bl: v } });
    } else {
      onChange({ borderRadius: radii.tl });
    }
  };

  return (
    <div className="flex flex-col gap-2 pt-1 border-t border-white/5">
      <div className="flex items-center justify-between">
        <label className="text-[9px] uppercase tracking-wider text-white/65">Radius</label>
        <button
          onClick={toggle}
          aria-label={linked ? "Unlink corners" : "Link corners"}
          title={linked ? "Unlink corners" : "Link corners"}
          className="p-1 rounded text-white/50 hover:text-white hover:bg-white/10 transition-colors"
        >
          {linked ? <Link2 className="w-3 h-3" /> : <Unlink className="w-3 h-3" />}
        </button>
      </div>
      {linked ? (
        <SliderRow
          label="All"
          value={typeof br === "number" ? br : 0}
          min={0}
          max={0.5}
          step={0.005}
          format={(v) => `${Math.round(v * 100)}%`}
          onChange={(v) => onChange({ borderRadius: v })}
        />
      ) : (
        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
          {(["tl", "tr", "bl", "br"] as const).map((corner) => (
            <SliderRow
              key={corner}
              label={corner.toUpperCase()}
              value={radii[corner]}
              min={0}
              max={0.5}
              step={0.005}
              format={(v) => `${Math.round(v * 100)}%`}
              onChange={(v) => onChange({ borderRadius: { ...radii, [corner]: v } })}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Reusable labeled slider row ─────────────────────────────────────────────

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
        <label className="text-[9px] uppercase tracking-wider text-white/65">{label}</label>
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
