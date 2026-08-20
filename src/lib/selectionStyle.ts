/**
 * One source of truth for selection chrome — the outline and handles that say
 * "this is selected".
 *
 * WHY IT IS BLUE AND NOT THE BRAND ORANGE: selection chrome has to be
 * distinguishable from the artwork, and these canvases are orange. An orange
 * outline on an orange gradient is invisible exactly when you need it, and it
 * also reads as part of the design rather than as a tool. Every serious editor
 * uses a cool accent for this — Illustrator and Figma both use blue — reserving
 * warm colours for content. The snap guides stay orange on purpose: they are a
 * different signal (a momentary alignment hint, not a persistent state) and
 * keeping them distinct means a guide is never mistaken for an edge.
 *
 * WHY 1px AND SOLID: the outline is a hairline that says where the bounds are,
 * not a border that competes with them. It was 2px and, for multi-selection,
 * dashed — heavy enough to hide a thin shape underneath it and to read as part
 * of the artwork. Illustrator draws one thin solid line and distinguishes
 * multi-selection by which handles appear, which is what this does too.
 *
 * Sizes are in SCREEN px and must be divided by the preview scale at the point
 * of use, so the chrome stays constant while the canvas zooms.
 */

/** Selection outline and handle border. */
export const SELECTION_COLOR = "#2C7BE5";
/** Hairline weight, in screen px. */
export const SELECTION_STROKE_PX = 1;
/** Slightly heavier for a text caret's active outline, so editing reads as a
 *  stronger state than merely being selected. */
export const EDITING_STROKE_PX = 2;

/** `outline` shorthand for a selected element, at a given preview scale. */
export function selectionOutline(scale: number, weightPx = SELECTION_STROKE_PX): string {
  const s = Number.isFinite(scale) && scale > 0 ? scale : 1;
  return `${weightPx / s}px solid ${SELECTION_COLOR}`;
}
