import { describe, it, expect } from "vitest";
import { PARTNER_SETS, PARTNER_PROJECTS, projectLogoCount, COMMUNITY_PARTNERS, COMMUNITY_PAGES, COMMUNITY_PER_WALL, LS_DT_EXHIBITORS, LS_DT_PITCH_FINALISTS, LS_DT_PARTICIPANTS, ALL_PARTNER_TIERS, ALL_PARTNER_WALLS, ALL_PARTNERS_FLAT, ALL_PARTNERS_TIER_BANDS, TIER_PER_WALL } from "./partnerSets";
import { THANKS_MAX_LOGOS, THANKS_TIERED_MAX_LOGOS } from "../lib/simpleLayout";
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
        // Was a literal 30. Reading the real constant is the point of the test:
        // the cap moved to 48 for the Life Science x Deep Tech walls, and a
        // literal would have had to be edited in step with it every time.
        //
        // A TIERED set is capped higher on purpose (the All Partners one-image
        // wall carries the whole list, drawn tier by tier): its cap is the one
        // the builder applies to it, not the flat wall's.
        expect(set.logos.length).toBeLessThanOrEqual(set.tiers?.length ? THANKS_TIERED_MAX_LOGOS : THANKS_MAX_LOGOS);
      });

      it("has a headline and a lead tier that fits the set", () => {
        expect(set.headline.trim()).not.toBe("");
        expect(set.featuredCount).toBeGreaterThanOrEqual(0);
        expect(set.featuredCount).toBeLessThanOrEqual(set.logos.length);
      });
    });
  }

  /**
   * The sidebar renders PROJECTS, not PARTNER_SETS. A set that nobody filed
   * under a project is therefore invisible in the app while still passing every
   * check above — the failure mode is a silent one, so it gets its own guard.
   */
  describe("project folders", () => {
    const filed = PARTNER_PROJECTS.flatMap((p) => p.sets.map((s) => s.id));

    it("files every set under exactly one project", () => {
      expect([...filed].sort()).toEqual([...PARTNER_SETS.map((s) => s.id)].sort());
    });

    it("gives every project a name, a note and at least one set", () => {
      for (const p of PARTNER_PROJECTS) {
        expect(p.name.trim()).not.toBe("");
        expect(p.note.trim()).not.toBe("");
        expect(p.sets.length).toBeGreaterThan(0);
      }
    });

    /** Life Science x Deep Tech holds Exhibiting inside Participating, so a sum
     *  of set lengths would over-count. The header shows unique logos. */
    it("counts a project's logos once, not once per set that lists them", () => {
      const lsdt = PARTNER_PROJECTS.find((p) => p.id === "life-science-deep-tech")!;
      const summed = lsdt.sets.reduce((n, s) => n + s.logos.length, 0);
      expect(projectLogoCount(lsdt)).toBeLessThan(summed);
      expect(projectLogoCount(lsdt)).toBe(new Set(lsdt.sets.flatMap((s) => s.logos.map((l) => l.src))).size);
    });
  });

  /**
   * ALL PARTNERS 2026 — the generated roster. Nothing here is hand-written, so
   * these are the checks that catch a bad SYNC rather than a bad edit: the two
   * scripts resolved every partner to a library file, and the questions worth
   * asking are whether that artwork can go on a dark wall at all, and whether the
   * per-tier walls and the one-image wall still describe the same roster.
   */
  describe("All Partners roster", () => {
    const byTone = new Map((logoLibrary as { src: string; tone: string }[]).map((l) => [l.src, l.tone]));

    it("has every tier, highest value first", () => {
      expect(ALL_PARTNER_TIERS.map((t) => t.tier)).toEqual([
        "Prime", "Main", "Conqueror", "Pioneer", "Core", "Challenger", "Community",
        "Investor", "Tailored", "International", "Academic", "Other",
      ]);
      // The money ladder is the first seven; the rest are separate deals.
      expect(ALL_PARTNER_TIERS.filter((t) => t.ladder).map((t) => t.tier))
        .toEqual(["Prime", "Main", "Conqueror", "Pioneer", "Core", "Challenger", "Community"]);
    });

    it("uses only white knockout artwork — the sync is supposed to guarantee it", () => {
      const dark = ALL_PARTNER_TIERS.flatMap((t) => t.logos).filter((l) => byTone.get(l.src) !== "light");
      expect(dark.map((l) => `${l.label} → ${l.src} [${byTone.get(l.src)}]`)).toEqual([]);
    });

    /** Same rule the community wall carries: a mostly-white logo with one
     *  coloured mark still measures light, so the SVG source is read. */
    it("points at white artwork, not a coloured cut", () => {
      const CHANNEL_SPREAD = 24;
      const offenders: string[] = [];
      for (const l of ALL_PARTNERS_FLAT) {
        const file = join(process.cwd(), "public/logos", decodeURIComponent(l.src.replace("/logos/", "")));
        if (!file.toLowerCase().endsWith(".svg")) continue;
        const svg = readFileSync(file, "utf8");
        for (const [, hex] of svg.matchAll(/(?:fill|stroke|stop-color)\s*[:=]\s*["']?(#[0-9a-fA-F]{6})/g)) {
          const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
          if (Math.max(r, g, b) - Math.min(r, g, b) > CHANNEL_SPREAD) { offenders.push(`${l.label} → ${hex}`); break; }
        }
      }
      expect(offenders).toEqual([]);
    });

    it("pages a tier that outgrows one wall, dropping nobody", () => {
      for (const t of ALL_PARTNER_TIERS) {
        const walls = ALL_PARTNER_WALLS.filter((w) => w.tier === t.tier);
        expect(walls.flatMap((w) => w.logos)).toEqual(t.logos);
        for (const w of walls) expect(w.logos.length).toBeLessThanOrEqual(TIER_PER_WALL);
      }
    });

    it("keeps a partner listed twice off the one-image wall twice", () => {
      const srcs = ALL_PARTNERS_FLAT.map((l) => l.src);
      expect(srcs.filter((x, i) => srcs.indexOf(x) !== i)).toEqual([]);
      // The per-tier walls DO keep both listings — a partner can hold two deals —
      // so the flat wall is the shorter of the two.
      const listed = ALL_PARTNER_TIERS.reduce((n, t) => n + t.logos.length, 0);
      expect(ALL_PARTNERS_FLAT.length).toBeLessThanOrEqual(listed);
    });

    it("bands the one-image wall to exactly its logos", () => {
      expect(ALL_PARTNERS_TIER_BANDS.reduce((n, b) => n + b.count, 0)).toBe(ALL_PARTNERS_FLAT.length);
      for (const b of ALL_PARTNERS_TIER_BANDS) {
        expect(b.cols).toBeGreaterThan(0);
        expect(b.cols).toBeLessThanOrEqual(b.count);
      }
    });

    /** The whole point of the ladder: a higher tier drawn in FEWER columns has
     *  bigger cells, so its column count must never grow back down the list. */
    it("never draws a higher money tier smaller than a lower one", () => {
      const ladder = new Set(ALL_PARTNER_TIERS.filter((t) => t.ladder).map((t) => t.tier));
      const cols = ALL_PARTNERS_TIER_BANDS.filter((b) => ladder.has(b.label)).map((b) => b.cols);
      expect(cols).toEqual([...cols].sort((a, b) => a - b));
    });

    it("files the one-image wall and every per-tier wall under the project", () => {
      const project = PARTNER_PROJECTS.find((p) => p.id === "all-partners")!;
      expect(project.sets.map((s) => s.id)).toEqual(["all-partners-one", ...ALL_PARTNER_WALLS.map((w) => w.id)]);
      expect(project.sets.find((s) => s.id === "all-partners-one")!.tiers?.length).toBe(ALL_PARTNERS_TIER_BANDS.length);
    });
  });

  /**
   * The community roster is paged across three walls, and the per-set checks
   * above only see one page at a time. These cover the roster as a whole.
   */
  describe("community roster", () => {
    const byTone = new Map((logoLibrary as { src: string; tone: string }[]).map((l) => [l.src, l.tone]));

    it("pages the whole roster, in order, with nothing dropped", () => {
      expect(COMMUNITY_PAGES.flat()).toEqual(COMMUNITY_PARTNERS);
    });

    /**
     * This used to assert equality with `THANKS_MAX_LOGOS`, back when the cap
     * WAS 30 and "one page = a full wall" was the same statement as "a page
     * cannot overflow". Raising the cap to 48 split those two ideas apart.
     *
     * The community pages stay at 30 by choice, not by the cap: 30 is a 5×6
     * grid at a size these logos read at, and the three posts are already out
     * in the world at that split. Widening them to 48 would re-cut which
     * partner appears on which post — the boundary has moved once already
     * (HighBridge, 2026-08-10) and it undermines "who did we already thank".
     * So the invariant worth keeping is only that a page still FITS.
     */
    it("keeps the page size within the wall's real cell limit", () => {
      expect(COMMUNITY_PER_WALL).toBeLessThanOrEqual(THANKS_MAX_LOGOS);
      expect(COMMUNITY_PER_WALL).toBe(30);
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

  /**
   * The Life Science x Deep Tech walls are built from an Airtable roster rather
   * than a page anyone can eyeball, so the checks that matter are the ones a
   * human would not catch by looking: that the two rosters agree with each
   * other, and that every file is genuinely white knockout artwork.
   */
  describe("Life Science x Deep Tech rosters", () => {
    const byTone = new Map((logoLibrary as { src: string; tone: string }[]).map((l) => [l.src, l.tone]));

    it("puts the whole exhibitor list on the participating wall", () => {
      const participating = new Set(LS_DT_PARTICIPANTS.map((p) => p.src));
      const dropped = LS_DT_EXHIBITORS.filter((e) => !participating.has(e.src));
      expect(dropped.map((e) => e.label)).toEqual([]);
    });

    it("puts every finalist on the participating wall exactly once", () => {
      const counts = new Map<string, number>();
      for (const p of LS_DT_PARTICIPANTS) counts.set(p.src, (counts.get(p.src) ?? 0) + 1);
      const missing = LS_DT_PITCH_FINALISTS.filter((f) => !counts.has(f.src));
      expect(missing.map((f) => f.label)).toEqual([]);
      expect([...counts.entries()].filter(([, n]) => n > 1)).toEqual([]);
    });

    // Was pinned at "the four companies"; the exhibitor re-sync on 2026-08-13
    // took the overlap to 6 and this failed on a correct change. The count is
    // whatever Airtable says this week, so assert the ARITHMETIC instead — that
    // participating is exactly the union — and only that some overlap exists,
    // which is what makes the dedupe worth having.
    it("de-duplicates the companies that both exhibit and pitch", () => {
      const overlap = LS_DT_PITCH_FINALISTS.filter((f) => LS_DT_EXHIBITORS.some((e) => e.src === f.src));
      expect(overlap.length).toBeGreaterThan(0);
      expect(LS_DT_PARTICIPANTS.length).toBe(LS_DT_EXHIBITORS.length + LS_DT_PITCH_FINALISTS.length - overlap.length);
    });

    for (const [name, roster] of [["exhibitors", LS_DT_EXHIBITORS], ["finalists", LS_DT_PITCH_FINALISTS]] as const) {
      it(`${name}: every logo is light artwork on this dark canvas`, () => {
        const dark = roster.filter((p) => byTone.get(p.src) !== "light");
        expect(dark.map((p) => `${p.label} → ${p.src} [${byTone.get(p.src)}]`)).toEqual([]);
      });

      it(`${name}: every logo is a white cut, not a coloured one`, () => {
        const CHANNEL_SPREAD = 24;
        // Walther Therapeutics' own white cut carries one pale lavender
        // (#b9b7dc) beside its near-white (#fcfbfb). It is not the AIESEC
        // failure this check exists to catch — that was a saturated blue mark
        // that disappeared into the canvas. This one is light enough to read on
        // the dark wall, and it is the only white file the company supplies.
        // Named explicitly so the guard still fails on the next real offender.
        const ALLOWED = new Set(["Walther Therapeutics"]);
        const offenders: string[] = [];
        for (const p of roster) {
          if (ALLOWED.has(p.label)) continue;
          const file = join(process.cwd(), "public/logos", decodeURIComponent(p.src.replace("/logos/", "")));
          if (!file.toLowerCase().endsWith(".svg")) continue;
          const svg = readFileSync(file, "utf8");
          for (const [, hex] of svg.matchAll(/(?:fill|stroke|stop-color)\s*[:=]\s*["']?(#[0-9a-fA-F]{6})/g)) {
            const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
            if (Math.max(r, g, b) - Math.min(r, g, b) > CHANNEL_SPREAD) { offenders.push(`${p.label} → ${hex}`); break; }
          }
        }
        expect(offenders).toEqual([]);
      });
    }
  });
});
