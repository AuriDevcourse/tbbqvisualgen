import { describe, it, expect } from "vitest";
import { LIFE_SCIENCE_PARTNERS } from "./lifeSciencePartners";
import logoLibrary from "./logoLibrary.json";

/**
 * The Life Science set names library FILES, and this repo renames logo files
 * regularly (round 50 alone renamed three). A rename would turn the fill button
 * into a silent partial fill — the fetch fails, that logo is skipped, and the
 * wall comes back one logo short of the partner sheet. This is the guard.
 */
describe("Life Science partner set", () => {
  const bySrc = new Set((logoLibrary as { src: string }[]).map((l) => l.src));

  it("every entry points at a file the logo library still ships", () => {
    const missing = LIFE_SCIENCE_PARTNERS.filter((p) => !bySrc.has(p.src));
    expect(missing.map((p) => `${p.label} → ${p.src}`)).toEqual([]);
  });

  it("lists no logo twice", () => {
    expect(new Set(LIFE_SCIENCE_PARTNERS.map((p) => p.src)).size).toBe(LIFE_SCIENCE_PARTNERS.length);
  });

  it("fits the wall's cell limit, so one click can never be truncated", () => {
    expect(LIFE_SCIENCE_PARTNERS.length).toBeLessThanOrEqual(30);
  });
});
