"use client";

import { SELECTION_COLOR, SELECTION_STROKE_PX } from "@/lib/selectionStyle";

/**
 * The one corner handle used by every canvas overlay.
 *
 * WHY THIS IS SHARED: the image, shape and logo overlays each grew their own
 * handle, at 24, 14 and 12 canvas px, in three different colours. Nothing made
 * them agree, so the same gesture felt different depending on what you had
 * selected.
 *
 * WHY THE SIZES DIVIDE BY `scale`: the overlays live INSIDE the preview's
 * `transform: scale()` wrapper, so a size written in canvas units shrinks with
 * the canvas. At the 30% zoom a 1920-wide board needs to fit an ordinary
 * screen, a 14 px handle rendered 4.2 px — a target you have to aim at. Dividing
 * by the scale pins the handle to a constant SIZE ON SCREEN at any zoom, which
 * is the only thing that matters: a grab target is about the pointer and the
 * display, not about the document. The snap guide lines in the same tree
 * already do exactly this.
 *
 * WHY WHITE WITH AN ACCENT BORDER: a solid handle in the brand orange vanishes
 * against orange artwork, and this app's canvases are frequently orange. A
 * white body with a cool-blue edge stays visible on any background — the reason
 * Figma, Sketch and Illustrator all draw handles that way. The colour comes
 * from `selectionStyle` so the handle and the outline can never drift apart.
 *
 * WHY THE HIT AREA IS BIGGER THAN THE SQUARE: Figma's handle looks ~8 px but
 * catches the pointer well outside that. The visible square is a target you
 * aim for; the invisible box is what forgives you missing.
 */

/** Visible square, in SCREEN px, at any zoom. */
export const HANDLE_VISUAL_PX = 8;
/** Invisible pointer target, in SCREEN px. Comfortably larger than the square. */
export const HANDLE_HIT_PX = 20;

interface ResizeHandleProps {
  /** Handle centre, in canvas px (the overlays' own coordinate space). */
  cx: number;
  cy: number;
  cursor: string;
  /** Preview scale — canvas px to screen px. 1 when the canvas is unscaled. */
  scale: number;
  onMouseDown: (e: React.MouseEvent) => void;
}

export function ResizeHandle({ cx, cy, cursor, scale, onMouseDown }: ResizeHandleProps) {
  // Guard a zero/NaN scale: it would blow the handle up to infinity and cover
  // the canvas. Falling back to 1 renders it small rather than catastrophic.
  const s = Number.isFinite(scale) && scale > 0 ? scale : 1;
  const hit = HANDLE_HIT_PX / s;
  const visual = HANDLE_VISUAL_PX / s;
  return (
    <div
      onMouseDown={onMouseDown}
      style={{
        position: "absolute",
        left: cx - hit / 2,
        top: cy - hit / 2,
        width: hit,
        height: hit,
        cursor,
        pointerEvents: "auto",
        zIndex: 11,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: visual,
          height: visual,
          background: "#FFFFFF",
          border: `${SELECTION_STROKE_PX / s}px solid ${SELECTION_COLOR}`,
          borderRadius: 2 / s,
          boxShadow: `0 ${1 / s}px ${2 / s}px rgba(0,0,0,0.35)`,
          // The wrapper owns the pointer, so the square never splits the
          // hit area into "on the square" and "near the square".
          pointerEvents: "none",
        }}
      />
    </div>
  );
}
