import { describe, it, expect } from "vitest";
import { PARTNER_SETS, COMMUNITY_PARTNERS, COMMUNITY_PAGES, COMMUNITY_PER_WALL } from "./partnerSets";
import { THANKS_MAX_LOGOS } from "../lib/simpleLayout";
import logoLibrary from "./logoLibrary.json";
import { readFileSync } from "node:fs";
import { join } from "node:path";

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

  /**
   * The community roster is paged across three walls, and the per-set checks
   * above only see one page at a time. These cover the roster as a whole.
   */
  describe("community roster", () => {
    const byTone = new Map((logoLibrary as { src: string; tone: string }[]).map((l) => [l.src, l.tone]));

    it("pages the whole roster, in order, with nothing dropped", () => {
      expect(COMMUNITY_PAGES.flat()).toEqual(COMMUNITY_PARTNERS);
    });

    it("keeps the page size in step with the wall's real cell limit", () => {
      expect(COMMUNITY_PER_WALL).toBe(THANKS_MAX_LOGOS);
    });

    it("lists no partner twice ACROSS pages", () => {
      const srcs = COMMUNITY_PARTNERS.map((p) => p.src);
      const dupes = srcs.filter((s, i) => srcs.indexOf(s) !== i);
      expect(dupes).toEqual([]);
      const labels = COMMUNITY_PARTNERS.map((p) => p.label.toLowerCase());
      expect(labels.filter((l, i) => labels.indexOf(l) !== i)).toEqual([]);
    });

    it("uses only light artwork — a dark logo is invisible on this canvas", () => {
      const dark = COMMUNITY_PARTNERS.filter((p) => byTone.get(p.src) !== "light");
      expect(dark.map((p) => `${p.label} → ${p.src} [${byTone.get(p.src)}]`)).toEqual([]);
    });

    /**
     * "Always use the white logo" — the rule that caught AIESEC, which shipped
     * as its blue-and-white PNG on the first wall. `tone: light` is not enough
     * to catch that: a mostly-white logo with a blue mark still measures light.
     * This reads the SVG source and rejects any SATURATED fill, which lets the
     * near-white greys real brand files use (#E2E2E2, #f1f2f8) through while
     * failing an actual colour.
     */
    it("points at white artwork, not a coloured cut", () => {
      const CHANNEL_SPREAD = 24; // how far r/g/b may diverge before it is a colour
      const offenders: string[] = [];
      for (const p of COMMUNITY_PARTNERS) {
        const file = join(process.cwd(), "public/logos", decodeURIComponent(p.src.replace("/logos/", "")));
        if (!file.toLowerCase().endsWith(".svg")) continue;
        const svg = readFileSync(file, "utf8");
        for (const [, hex] of svg.matchAll(/(?:fill|stroke|stop-color)\s*[:=]\s*["']?(#[0-9a-fA-F]{6})/g)) {
          const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
          if (Math.max(r, g, b) - Math.min(r, g, b) > CHANNEL_SPREAD) {
            offenders.push(`${p.label} → ${hex}`);
            break;
          }
        }
      }
      expect(offenders).toEqual([]);
    });
  });
});
