import { describe, it, expect } from "vitest";
import { PARTNER_SETS } from "./partnerSets";
import logoLibrary from "./logoLibrary.json";

/**
 * A set names library FILES, and this repo renames logo files regularly (round
 * 50 alone renamed three, round 51 another). A rename would turn a fill button
 * into a silent partial fill — the fetch fails, that logo is dropped, and the
 * wall comes back a logo short of the partner page. This is the guard.
 */
describe("partner sets", () => {
  const bySrc = new Set((logoLibrary as { src: string }[]).map((l) => l.src));

  it("has at least the Life Science and Investor sets", () => {
    expect(PARTNER_SETS.map((s) => s.id)).toEqual(expect.arrayContaining(["life-science", "investor"]));
  });

  for (const set of PARTNER_SETS) {
    describe(set.name, () => {
      it("every entry points at a file the logo library still ships", () => {
        const missing = set.logos.filter((p) => !bySrc.has(p.src));
        expect(missing.map((p) => `${p.label} → ${p.src}`)).toEqual([]);
      });

      it("lists no logo twice", () => {
        expect(new Set(set.logos.map((p) => p.src)).size).toBe(set.logos.length);
      });

      it("fits the wall's cell limit, so one click can never be truncated", () => {
        expect(set.logos.length).toBeLessThanOrEqual(30);
      });

      it("has a headline and a lead tier that fits the set", () => {
        expect(set.headline.trim()).not.toBe("");
        expect(set.featuredCount).toBeGreaterThanOrEqual(0);
        expect(set.featuredCount).toBeLessThanOrEqual(set.logos.length);
      });
    });
  }
});
