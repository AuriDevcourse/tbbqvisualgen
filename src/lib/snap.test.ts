import { describe, expect, it } from "vitest";
import { cleanGuides, snapValue } from "@/lib/snap";

describe("cleanGuides", () => {
  it("passes real positions through untouched", () => {
    expect(cleanGuides({ x: 0.5, y: 0 })).toEqual({ x: 0.5, y: 0 });
  });

  it("keeps null as null", () => {
    expect(cleanGuides({ x: null, y: null })).toEqual({ x: null, y: null });
  });

  /** The one that matters: NaN !== NaN, so an unnormalised NaN guide makes the
   *  caller's equality check report a change on every single mousemove. */
  it("turns NaN into null, so the equality check can collapse it", () => {
    const a = cleanGuides({ x: NaN, y: 0.25 });
    const b = cleanGuides({ x: NaN, y: 0.25 });
    expect(a).toEqual({ x: null, y: 0.25 });
    expect(a.x === b.x && a.y === b.y).toBe(true);
  });

  it("turns Infinity into null", () => {
    expect(cleanGuides({ x: Infinity, y: -Infinity })).toEqual({ x: null, y: null });
  });
});

describe("snapValue", () => {
  const targets = [0, 0.5, 1];

  it("snaps a nearby edge onto the target and reports the guide", () => {
    const r = snapValue(0.503, targets);
    expect(r.value).toBe(0.5);
    expect(r.guide).toBe(0.5);
  });

  it("leaves a far edge alone and reports no guide", () => {
    const r = snapValue(0.3, targets);
    expect(r.value).toBe(0.3);
    expect(r.guide).toBeNull();
  });

  it("picks the CLOSEST target when two are in range", () => {
    // 0.497 is inside the threshold of 0.5 only; add a decoy just outside it.
    const r = snapValue(0.497, [0.5, 0.49]);
    expect(r.value).toBe(0.5);
  });

  it("is a no-op with no targets", () => {
    const r = snapValue(0.42, []);
    expect(r.value).toBe(0.42);
    expect(r.guide).toBeNull();
  });
});
