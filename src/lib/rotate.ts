/**
 * Rotation-by-drag maths, kept out of the overlay so it can be tested without
 * a browser.
 *
 * The gesture is: grab a ring around a corner, swing the pointer about the
 * shape's centre. What gets applied is the CHANGE in pointer angle since the
 * grab, added to the rotation the shape already had — not the pointer's
 * absolute angle, which would snap the shape's corner to the pointer the
 * instant you touched it.
 */

/** Shift-drag steps, matching Figma and Illustrator. */
export const ROTATE_SNAP_DEGREES = 15;

/** Signed angle from a centre to a point, in degrees, -180..180. */
export function pointerAngle(cx: number, cy: number, px: number, py: number): number {
  return (Math.atan2(py - cy, px - cx) * 180) / Math.PI;
}

/** Fold any angle into -180..180, so the stored value and the panel agree. */
export function normaliseAngle(deg: number): number {
  return (((deg + 180) % 360) + 360) % 360 - 180;
}

export interface RotationDragInput {
  /** The shape's rotation when the drag began. */
  startRotation: number;
  /** Pointer angle at the moment of the grab. */
  startPointerAngle: number;
  /** Pointer angle now. */
  currentPointerAngle: number;
  /** Shift held: snap to ROTATE_SNAP_DEGREES. */
  snap: boolean;
}

/**
 * The rotation to store for the current pointer position.
 *
 * The delta is UNWRAPPED first. `pointerAngle` returns -180..180, so a drag
 * crossing that seam reports about ±350 instead of ±10 and the shape spins the
 * long way round. A pointer cannot really travel more than half a circle
 * between two frames, so the shorter interpretation is always the right one.
 */
export function rotationFromDrag({
  startRotation,
  startPointerAngle,
  currentPointerAngle,
  snap,
}: RotationDragInput): number {
  let delta = currentPointerAngle - startPointerAngle;
  if (delta > 180) delta -= 360;
  else if (delta < -180) delta += 360;

  let next = startRotation + delta;
  // Snap the RESULT, not the delta: the user is aiming the shape at 45°, not
  // aiming for a 45° turn.
  if (snap) next = Math.round(next / ROTATE_SNAP_DEGREES) * ROTATE_SNAP_DEGREES;
  return Math.round(normaliseAngle(next) * 10) / 10;
}

/**
 * The rotate cursor: a circular arrow, as Illustrator and Figma use.
 *
 * WHY A CUSTOM CURSOR AND NOT `grab`: the corner rings used `grab`, which is
 * the same cursor as "move this thing" — it promised the wrong gesture at the
 * exact moment the user needed to know rotation was available. There is no
 * standard CSS cursor for rotation, so it has to be drawn.
 *
 * WHY WHITE WITH A DARK HALO: a cursor is drawn over the artwork, so it cannot
 * pick one colour and hope. The dark outline keeps the white body readable on a
 * light canvas and the white body keeps it readable on a dark one — the same
 * reason OS cursors are built that way, and the same reason the resize handles
 * are white with a coloured edge.
 *
 * The hotspot is the icon's centre rather than a corner: the pointer is
 * conceptually swinging around a pivot, so centring it keeps the ring under the
 * point it rotates about.
 */
const ROTATE_ARC = "M 9.00 6.07 A 8 8 0 1 1 5.12 11.61";
const ROTATE_HEAD = "M 3.44 3.44 L 9.74 4.94 L 4.94 9.74 Z";
const ROTATE_SVG = [
  '<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 26 26">',
  `<g fill="none" stroke="#101010" stroke-width="6" stroke-linecap="round"><path d="${ROTATE_ARC}"/></g>`,
  `<path d="${ROTATE_HEAD}" fill="#101010" stroke="#101010" stroke-width="3.4" stroke-linejoin="round"/>`,
  `<g fill="none" stroke="#FFFFFF" stroke-width="2.6" stroke-linecap="round"><path d="${ROTATE_ARC}"/></g>`,
  `<path d="${ROTATE_HEAD}" fill="#FFFFFF"/>`,
  "</svg>",
].join("");

/** Ready-to-use CSS `cursor` value. Falls back to `grab` where a custom cursor
 *  is refused (some Linux/remote-desktop setups drop them silently). */
export const ROTATE_CURSOR =
  `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(ROTATE_SVG)}") 13 13, grab`;
