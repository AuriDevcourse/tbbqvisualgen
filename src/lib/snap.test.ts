import { describe, expect, it } from "vitest";
import { cleanGuides } from "@/lib/snap";

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
