"use client";

import { Plus, Eye, EyeOff, Type } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { TextEditor } from "@/components/TextEditor";
import { ACTION_BTN, ACTION_BTN_IDLE, ACTION_BTN_ACTIVE, CONTENT_LABEL_CHARS, ROW_BASE, ROW_HOVER, rowSelectedStyle } from "@/lib/panelRow";
import { newTextElement } from "@/types/template";
import type { DesignConfig, TextElement } from "@/types/template";

interface StepTextProps {
  design: DesignConfig;
  setDesign: (next: DesignConfig | ((prev: DesignConfig) => DesignConfig)) => void;
  /** When set, auto-expand and scroll to this text's row so the user can
   *  edit the layer they just clicked on the canvas. */
  focusedId?: string | null;
  /** Canvas pixel size, so the numeric fields can read in export pixels. */
  canvasSize?: { width: number; height: number };
  /**
   * Select this text on the canvas. Wired to the editor's `selectTextOnly`.
   *
   * Clicking a row used to ONLY expand it, so you could be editing a layer
   * with nothing selected on canvas — and it was the reason this panel needed
   * its own Delete button. Selecting on click means the Delete key already
   * removes the row's layer, the way it does in the Layers panel, and the
   * handles appear on the thing you are about to edit.
   */
  onSelectText?: (textId: string) => void;
}

export function StepText({ design, setDesign, focusedId, canvasSize = { width: 1920, height: 1080 }, onSelectText }: StepTextProps) {
  /**
   * Which layer the properties pane below is showing, or null.
   *
   * This started as a `Set` of inline-expanded rows (heights stacked to ~4000px),
   * became a single id when item 3 made it an accordion, and is now simply the
   * subject of a separate pane — so there is nothing to "expand" at all.
   */
  const [editingId, setEditingId] = useState<string | null>(null);
  /** Which row the pointer is over — its actions are revealed for that row
   *  only. State rather than `group-hover:` because an `opacity-0` button
   *  still occupies its box, and the point is to give the label its width
   *  back. See PROGRESS.md handoff 29. */
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Expand the focused row whenever the canvas single-selection changes.
  useEffect(() => {
    if (!focusedId) return;
    setEditingId(focusedId);
  }, [focusedId]);

  // …then scroll to it, in a SEPARATE pass once the expanded card has laid out.
  // Expanding and scrolling in one effect measured the row while it was still
  // collapsed, so on a board with nine layers the fields the user came for
  // landed below the fold and it was guesswork which layer was selected.
  // `block: "start"` rather than "nearest" for the same reason: "nearest" does
  // nothing at all once any sliver of a tall card is already on screen.
  const focusedIsEditing = focusedId ? editingId === focusedId : false;
  useEffect(() => {
    if (!focusedId || !focusedIsEditing) return;
    const el = rowRefs.current.get(focusedId);
    if (!el) return;
    const raf = requestAnimationFrame(() => el.scrollIntoView({ block: "start", behavior: "smooth" }));
    return () => cancelAnimationFrame(raf);
  }, [focusedId, focusedIsEditing]);

  const addText = () => {
    const next = newTextElement("YOUR TEXT");
    setDesign((d) => ({ ...d, texts: [...d.texts, next] }));
    setEditingId(next.id);
  };

  const updateText = (id: string, patch: Partial<TextElement>) => {
    setDesign((d) => ({
      ...d,
      texts: d.texts.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    }));
  };

  const selected = design.texts.find((t) => t.id === editingId) ?? null;

  return (
    // Three parts: a fixed header, the list, and the properties pane. The list
    // is capped and scrolls; properties take the rest and scroll separately, so
    // editing a layer can no longer bury the list you were navigating.
    <div className="flex flex-col min-h-0 flex-1 gap-3">
      {/* `justify-end`, not `justify-between`: the `Text (n)` label that used
          to sit on the left is gone — the TEXT tab above says it and now
          carries the count. Unlike Images and Elements this row does NOT
          disappear, because Add text lives in it, so no height is recovered
          here. Only the duplication goes. */}
      <div className="flex items-center justify-end shrink-0">
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
        <div className="text-[11px] text-white/65 px-3 py-4 text-center border border-dashed border-white/10 rounded-lg">
          No text on canvas. Click <span className="text-[#FF6B00]">Add text</span> to create your first layer.
        </div>
      )}

      {/* The list and the properties pane SHARE what is left of the column as
          flex children, properties weighted heavier because their content is
          longer. Both were `shrink-0` with fixed caps at first, which left
          properties whatever remained — 80px in the Elements panel. */}
      <div className="flex flex-col flex-1 min-h-0 overflow-y-auto -mx-1 px-1">
        {design.texts.map((text) => {
          const isFocused = focusedId === text.id;
          return (
            <div
              key={text.id}
              ref={(node) => {
                if (node) rowRefs.current.set(text.id, node);
                else rowRefs.current.delete(text.id);
              }}
              onMouseEnter={() => setHoveredId(text.id)}
              onMouseLeave={() => setHoveredId((cur) => (cur === text.id ? null : cur))}
            >
              {/* Nothing wraps the row any more — no card, and no hairline for
                  an "expanded" state, because rows no longer expand. The row IS
                  the row, exactly as in the Layers panel. */}
              <div
                onClick={() => { onSelectText?.(text.id); setEditingId(text.id); }}
                className={cn(ROW_BASE, "px-1.5 cursor-pointer", !isFocused && ROW_HOVER)}
                style={isFocused ? rowSelectedStyle() : undefined}
              >
                {/* Matches the Layers panel's row icon. With the chevron gone
                    this was the row's only leading element, and a bare label
                    read as loose text rather than as a list row. */}
                <Type className="w-3.5 h-3.5 shrink-0 text-white/60" />
                <span
                  className={cn(
                    "flex-1 text-[11px] truncate",
                    text.hidden ? "text-white/65 line-through" : "text-white/85",
                  )}
                  title={text.name?.trim() || text.content.trim() || "Empty text"}
                >
                  {/* A layer named in the Layers panel has to read the same
                      here. Two lists disagreeing about what a layer is called
                      is worse than neither list naming it. */}
                  {text.name?.trim() || text.content.trim().slice(0, CONTENT_LABEL_CHARS) || "Empty text"}
                </span>
                {/* Revealed on hover, and kept visible while hidden so a
                    hidden layer is findable without sweeping the list. */}
                {(hoveredId === text.id || text.hidden) && (
                  <button
                    onClick={(e) => { e.stopPropagation(); updateText(text.id, { hidden: !text.hidden }); }}
                    aria-label={text.hidden ? "Show layer" : "Hide layer"}
                    aria-pressed={text.hidden}
                    className={cn(ACTION_BTN, text.hidden ? ACTION_BTN_ACTIVE : ACTION_BTN_IDLE)}
                  >
                    {text.hidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                )}
                {/* Delete is gone from the row. Clicking a row now selects the
                    layer on canvas, so the editor's existing Delete/Backspace
                    handler removes it — the same trade the Layers panel made,
                    which took 17 always-armed 16px Delete buttons out of a
                    list you click to select things in. */}
              </div>

            </div>
          );
        })}
      </div>

      {/* ---- Properties for the selected layer ---- */}
      <div className="flex flex-col min-h-0 flex-[1.6] border-t border-white/10 pt-3">
        {selected ? (
          <>
            <div className="flex items-center gap-1.5 shrink-0 pb-2">
              <span className="text-[10px] font-medium text-white/65 uppercase tracking-[0.18em] shrink-0">Editing</span>
              <span className="flex-1 truncate text-[11px] text-white/85" title={selected.name?.trim() || selected.content.trim()}>
                {selected.name?.trim() || selected.content.trim().slice(0, CONTENT_LABEL_CHARS) || "Empty text"}
              </span>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto -mx-1 px-1">
              <TextEditor
                text={selected}
                onChange={(patch) => updateText(selected.id, patch)}
                canvasSize={canvasSize}
              />
            </div>
          </>
        ) : (
          design.texts.length > 0 && (
            <p className="text-[11px] text-white/45 pt-1">Pick a layer above to edit it.</p>
          )
        )}
      </div>
    </div>
  );
}
