"use client";

import { useEffect, useRef, useState } from "react";

/**
 * X / Y / W / H as typeable numbers, in EXPORT PIXELS.
 *
 * WHY PIXELS AND NOT PERCENT: the document stores fractions of the canvas,
 * which is right for a model that has to survive a format switch, but nobody
 * thinks in 0.13020833. The ruler reads in canvas pixels and the export is in
 * canvas pixels, so these fields use the same unit — what you type is what
 * lands in the file, and it matches what the ruler above the canvas says.
 *
 * WHY A DRAFT STRING RATHER THAN A CONTROLLED NUMBER: a number input clamped
 * on every keystroke fights you. Clearing "96" to type "120" would snap back
 * to the minimum the moment the field was empty, and typing "1" on the way to
 * "12" would jump the element across the canvas. The field holds raw text
 * while focused and commits on blur or Enter; Escape abandons the edit. The
 * same reason the MP4 length field in the editor header keeps a draft.
 */

export interface GeometryValue {
  /** Centre position and size, all as 0–1 fractions of the canvas. */
  x: number;
  y: number;
  width?: number;
  height?: number;
}

interface GeometryFieldsProps {
  value: GeometryValue;
  /** Canvas pixel size, so fractions can be shown as export pixels. */
  canvasWidth: number;
  canvasHeight: number;
  /** Patch back in FRACTIONS. Only the changed key is sent. */
  onChange: (patch: Partial<GeometryValue>) => void;
  /** Hide W/H for elements that have no size of their own (text). */
  showSize?: boolean;
}

interface FieldProps {
  label: string;
  /** Value in canvas px. */
  px: number;
  /** Called with the new value in canvas px. */
  onCommit: (px: number) => void;
  min: number;
  max: number;
}

function NumField({ label, px, onCommit, min, max }: FieldProps) {
  const rounded = Math.round(px);
  const [draft, setDraft] = useState(String(rounded));
  const [focused, setFocused] = useState(false);
  // Escape has to blur to give the canvas its keyboard back, but blur commits.
  // setDraft is async, so the commit would read the ABANDONED text and apply
  // it — pressing Escape after typing 999 set the width to 999. This flag
  // makes the blur that Escape causes skip the commit.
  const abandonRef = useRef(false);

  // Follow the document while not being typed into — dragging on canvas has to
  // move these numbers — but never yank the text out from under the cursor.
  //
  // Adjusted during render rather than in an effect. Dragging on canvas fires
  // this on every pointer move, and an effect made each one a second render
  // pass: the field committed the OLD number, then immediately re-rendered with
  // the new one. React re-runs this component before painting when state is set
  // while rendering, so the stale frame never reaches the DOM.
  //
  // `lastRounded` stays deliberately stale while focused, so blurring after the
  // document moved underneath still syncs — which is what the old [rounded,
  // focused] dependency array did.
  const [lastRounded, setLastRounded] = useState(rounded);
  if (!focused && rounded !== lastRounded) {
    setLastRounded(rounded);
    setDraft(String(rounded));
  }

  const commit = () => {
    const n = Number(draft);
    if (draft.trim() === "" || Number.isNaN(n)) {
      setDraft(String(rounded));   // unparseable: put the real value back
      return;
    }
    onCommit(Math.max(min, Math.min(max, n)));
  };

  return (
    <label className="flex items-center gap-1 min-w-0">
      <span className="text-[9px] uppercase tracking-wider text-white/50 w-3 shrink-0">{label}</span>
      <input
        type="text"
        inputMode="numeric"
        value={draft}
        aria-label={`${label} in pixels`}
        onFocus={(e) => { setFocused(true); e.target.select(); }}
        onBlur={() => {
          setFocused(false);
          if (abandonRef.current) {
            abandonRef.current = false;
            setDraft(String(rounded));
            return;
          }
          commit();
        }}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); commit(); (e.currentTarget as HTMLInputElement).blur(); }
          else if (e.key === "Escape") {
            e.preventDefault();
            abandonRef.current = true;
            setDraft(String(rounded));
            (e.currentTarget as HTMLInputElement).blur();
          }
          // Arrow keys nudge the FIELD, and must not also nudge the canvas
          // selection — the editor's global handler skips inputs, but stopping
          // here keeps that true regardless of what it does later.
          else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault();
            const step = e.shiftKey ? 10 : 1;
            const n = Number(draft);
            if (!Number.isNaN(n)) {
              const next = Math.max(min, Math.min(max, n + (e.key === "ArrowUp" ? step : -step)));
              setDraft(String(next));
              onCommit(next);
            }
          }
        }}
        className="w-full min-w-0 bg-white/5 border border-white/10 rounded px-1.5 py-1 text-[10px] text-white text-right tabular-nums focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B00]/70 focus:border-[#FF6B00]/40"
      />
    </label>
  );
}

export function GeometryFields({ value, canvasWidth, canvasHeight, onChange, showSize = true }: GeometryFieldsProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[9px] uppercase tracking-wider text-white/65">Position &amp; size · px</span>
      <div className="grid grid-cols-2 gap-1.5">
        <NumField
          label="X"
          px={value.x * canvasWidth}
          min={-canvasWidth}
          max={canvasWidth * 2}
          onCommit={(px) => onChange({ x: px / canvasWidth })}
        />
        <NumField
          label="Y"
          px={value.y * canvasHeight}
          min={-canvasHeight}
          max={canvasHeight * 2}
          onCommit={(px) => onChange({ y: px / canvasHeight })}
        />
        {showSize && value.width !== undefined && (
          <NumField
            label="W"
            px={value.width * canvasWidth}
            min={1}
            max={canvasWidth * 2}
            onCommit={(px) => onChange({ width: px / canvasWidth })}
          />
        )}
        {showSize && value.height !== undefined && (
          <NumField
            label="H"
            px={value.height * canvasHeight}
            min={1}
            max={canvasHeight * 2}
            onCommit={(px) => onChange({ height: px / canvasHeight })}
          />
        )}
      </div>
      {/* X and Y are the element's CENTRE, which is how the document stores
          them. Saying so beats a user discovering it by typing 0. */}
      <span className="text-[9px] text-white/40">X and Y are the centre point</span>
    </div>
  );
}
