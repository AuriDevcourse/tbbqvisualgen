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
