import { describe, expect, it } from "vitest";
import { normaliseAngle, pointerAngle, rotationFromDrag } from "@/lib/rotate";

describe("pointerAngle", () => {
  it("is 0 to the right, 90 below, 180 to the left", () => {
    expect(pointerAngle(0, 0, 10, 0)).toBe(0);
    expect(pointerAngle(0, 0, 0, 10)).toBe(90);
    expect(Math.abs(pointerAngle(0, 0, -10, 0))).toBe(180);
  });
});

describe("normaliseAngle", () => {
  it("folds into -180..180", () => {
    expect(normaliseAngle(190)).toBe(-170);
    expect(normaliseAngle(-190)).toBe(170);
    expect(normaliseAngle(45)).toBe(45);
    expect(normaliseAngle(720)).toBe(0);
  });
});

describe("rotationFromDrag", () => {
  it("applies the CHANGE in pointer angle, not its absolute value", () => {
    // Grabbed at -150 (a top-left corner), swung 30 degrees clockwise.
    const r = rotationFromDrag({
      startRotation: 0,
      startPointerAngle: -150,
      currentPointerAngle: -120,
      snap: false,
    });
    expect(r).toBe(30);
  });

  it("adds to the rotation the shape already had", () => {
    const r = rotationFromDrag({
      startRotation: 45,
      startPointerAngle: 0,
      currentPointerAngle: 20,
      snap: false,
    });
    expect(r).toBe(65);
  });

  /** The bug this function exists to prevent: atan2 wraps at ±180, so a drag
   *  across that seam looked like a ~350 degree turn the wrong way. */
  it("takes the short way round when the pointer crosses the ±180 seam", () => {
    const r = rotationFromDrag({
      startRotation: 0,
      startPointerAngle: 175,
      currentPointerAngle: -175,
      snap: false,
    });
    expect(r).toBe(10);
  });

  it("takes the short way round in the other direction too", () => {
    const r = rotationFromDrag({
      startRotation: 0,
      startPointerAngle: -175,
      currentPointerAngle: 175,
      snap: false,
    });
    expect(r).toBe(-10);
  });

  it("snaps the RESULT to 15 degree steps with Shift", () => {
    expect(rotationFromDrag({ startRotation: 0, startPointerAngle: 0, currentPointerAngle: 22, snap: true })).toBe(15);
    expect(rotationFromDrag({ startRotation: 0, startPointerAngle: 0, currentPointerAngle: 38, snap: true })).toBe(45);
    // Snapping the RESULT, not the delta: an already-odd rotation lands on a
    // clean angle rather than staying odd.
    expect(rotationFromDrag({ startRotation: 7, startPointerAngle: 0, currentPointerAngle: 1, snap: true })).toBe(15);
  });

  it("keeps the stored value inside -180..180", () => {
    const r = rotationFromDrag({
      startRotation: 170,
      startPointerAngle: 0,
      currentPointerAngle: 30,
      snap: false,
    });
    expect(r).toBe(-160);
  });
});
