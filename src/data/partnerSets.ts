/**
 * The Life Science track's partner logos, as one ready-made set for the
 * thank-you wall — so nobody has to search the library 20 times to rebuild the
 * same post.
 *
 * **This is exactly the 25 on the official Partners page, in its order**
 * (top-left to bottom-right) — checked against it logo by logo on 2026-08-04.
 * Anything not on that page stays out, even when the library has it: the 2025
 * thank-you post also carried **Amazing Hall** and **biotope by VIB**, and both
 * were dropped from this set for that reason. Both files are still in the
 * library, one search away, if a particular post should thank them.
 *
 * `src` points at a file committed under `public/logos`; the fill button turns
 * each into a data URL (the same shape an upload produces) before it goes into
 * a design, so a later rename can't break a saved wall.
 *
 * Every entry was rendered on a dark sheet and checked against the page before
 * being listed — three library files carry a name nobody would search for, and
 * the `label` is what the artwork actually says:
 *   `Beta Heath.svg`  → BETA.HEALTH (the file name is a typo)
 *   `Tuvsud.svg`      → TÜV SÜD
 *   `The Kitchen.svg` → KITCHEN, Aarhus University
 *
 * One deliberate lockup difference: the page shows **Medicon Valley Alliance**
 * as a plain thin wordmark, and this set uses the bars-plus-stacked-text lockup
 * (what the 2025 wall used) — the only one in the library, and the one that
 * still reads at grid size.
 *
 * Complete as of 2026-08-04: the last six came straight from Auri (Ruff & Co as
 * a PNG, the rest white SVGs). Four of those shipped with the mark floating in
 * a much larger canvas — a square 100×100 box around a wide wordmark, in
 * BioInnovation Institute's case only 17% artwork — so their viewBoxes were
 * tightened to the artwork. A contain-fit cell can't tell padding from the
 * logo, so an untightened file renders a third the size of its neighbours.
 *
 * Three logos were refreshed the same day, also from Auri. `CPHLABS.svg` and
 * `Symbion.svg` were replaced IN PLACE (old brand / thinner cut of the same
 * wordmark, originals parked in `Temp/logos-removed/replaced-2026-08-04/`), so
 * every other reference to them picks up the new artwork too. Novo Nordisk
 * Foundation's new file is a DIFFERENT lockup — circle mark plus a horizontal
 * wordmark — and this set points at that one, because it is what the 2026
 * partner sheet uses. The library already HELD that lockup, filed as
 * `NN Foundation White.svg`, which no search for "novo" could ever return: the
 * duplicate check caught it, and the file was renamed to
 * `Novo Nordisk Foundation Horizontal.svg` rather than adding a second copy.
 */
export interface PartnerSetEntry {
  /** What the artwork says — used for the button's title, not rendered. */
  label: string;
  /** Library file under /public/logos. */
  src: string;
}

/** A ready-made wall: the logos, plus the headline and tier split that go with
 *  them. One button per set in the Thank you sidebar. */
export interface PartnerSet {
  id: string;
  /** Button text — "Life Science", "Investor". */
  name: string;
  /** Applied to the headline field when the set is filled in. */
  headline: string;
  /** How many of the leading logos are the bigger tier. 0 = one flat grid. */
  featuredCount: number;
  logos: PartnerSetEntry[];
}

export const LIFE_SCIENCE_PARTNERS: PartnerSetEntry[] = [
  { label: "Life Science Invest", src: "/logos/Life%20Science%20Invest.svg" },
  { label: "BioMedical Design", src: "/logos/BioMedical%20Design.svg" },
  { label: "BETA.HEALTH", src: "/logos/Beta%20Heath.svg" },
  { label: "Health Tech Hub Copenhagen", src: "/logos/Health%20Tech%20Hub%20Copenhagen%20White.svg" },
  { label: "KITCHEN, Aarhus University", src: "/logos/The%20Kitchen.svg" },
  { label: "INCUBA", src: "/logos/INCUBA.svg" },
  { label: "TÜV SÜD", src: "/logos/Tuvsud.svg" },
  { label: "Ideon Science Park", src: "/logos/Ideon%20Science%20Park.svg" },
  { label: "Nebius", src: "/logos/Nebius.svg" },
  { label: "Sweden Bio", src: "/logos/Sweden%20Bio.svg" },
  { label: "Symbion", src: "/logos/Symbion.svg" },
  { label: "CPH.LABS", src: "/logos/CPHLABS.svg" },
  { label: "Novo Nordisk Foundation", src: "/logos/Novo%20Nordisk%20Foundation%20Horizontal.svg" },
  { label: "BioInnovation Institute", src: "/logos/BioInnovation%20Institute.svg" },
  { label: "Medicon Valley Alliance", src: "/logos/Medicon%20Valley%20Alliance.svg" },
  { label: "Danish Life Science Cluster", src: "/logos/Danish%20Life%20Science%20Cluster%20White.svg" },
  { label: "University of Copenhagen", src: "/logos/University%20of%20Copenhagen.svg" },
  { label: "DTU Science Park", src: "/logos/DTU%20Science%20Park.svg" },
  { label: "Ruff & Co Business Innovation", src: "/logos/Ruff%20%26%20Co%20Business%20Innovation.png" },
  { label: "Alliance for Biosolutions", src: "/logos/Alliance%20for%20Biosolutions.svg" },
  { label: "LithuaniaBIO", src: "/logos/Lithuania%20Bio.svg" },
  { label: "InnovX", src: "/logos/Innovx.svg" },
  { label: "Medicon Village", src: "/logos/Medicon%20Village.svg" },
  { label: "imec", src: "/logos/Imec%20White.svg" },
  { label: "Norway Health Tech", src: "/logos/Norway%20Health%20Tech.svg" },
];

/**
 * The investor partners, from the Our Investor Partners page — which splits
 * them into MAIN and SUPPORT partners. That split is the whole reason the wall
 * has a lead tier: the first four render bigger, the rest fill the grid below.
 * The page's tier CHIPS are not reproduced; the thank-you wall says it with
 * size, as the 2025 originals do.
 *
 * Order: the four main partners, then the support partners in page order.
 *
 * Two names took a search to find, so do not re-hunt them:
 *   `Worldfund White.svg`       → WORLD FUND ("world fund" with a space misses)
 *   `Forsikring Og Pension.svg` → the F&P monogram, rendered and confirmed
 *
 * NOT here, because the library has no usable white artwork (2026-08-04):
 *   **Novo Nordisk** — the bull mark plus "novo nordisk". The library only has
 *     Novo Nordisk FOUNDATION variants, which is a different organisation.
 *   **Mazanti-Andersen** — nothing at all.
 *   **Ada Ventures** — `Ada Ventures.png` is DARK artwork, invisible on this
 *     canvas, and a PNG can't be recoloured in-app (the tint is SVG-only).
 * Marketing has to supply white SVGs for those three; until then the set is 17
 * of 20 and the fill leaves no gap (the grid sizes itself to what loaded).
 */
export const INVESTOR_PARTNERS: PartnerSetEntry[] = [
  // ── Main partners ──
  { label: "Innovation District Copenhagen", src: "/logos/Innovation%20District%20Copenhagen%20White.png" },
  { label: "EIFO", src: "/logos/EIFO.svg" },
  { label: "wezeo", src: "/logos/Wezeo.svg" },
  { label: "HSBC Innovation Banking", src: "/logos/HSBC%20Innovation%20Banking.png" },
  // ── Support partners ──
  { label: "embankment", src: "/logos/Embankment.svg" },
  { label: "Heartcore", src: "/logos/Heartcore.svg" },
  { label: "World Fund", src: "/logos/Worldfund%20White.svg" },
  { label: "Florent Venture Partners", src: "/logos/Florent%20Venture%20Partners.svg" },
  { label: "Rockstart", src: "/logos/Rockstart.svg" },
  { label: "NordicNinja", src: "/logos/NordicNinja.svg" },
  { label: "dealroom.co", src: "/logos/Dealroom.svg" },
  { label: "FBV", src: "/logos/FBV.svg" },
  { label: "PSV", src: "/logos/PSV.svg" },
  { label: "Mountside Ventures", src: "/logos/Mountside%20Ventures.svg" },
  { label: "European Investment Fund", src: "/logos/European%20Investment%20Fund%20(EIF).svg" },
  { label: "Aktive Ejere", src: "/logos/Aktive%20Ejere.svg" },
  { label: "F&P (Forsikring & Pension)", src: "/logos/Forsikring%20Og%20Pension.svg" },
];

/** Every ready-made wall, in sidebar order. */
export const PARTNER_SETS: PartnerSet[] = [
  {
    id: "life-science",
    name: "Life Science",
    // One line, no Enter: the builder wraps it to the width its cap allows, so
    // a long headline lands at the same size as a short one. A typed break wins.
    headline: "Thank you to our partners",
    featuredCount: 0,
    logos: LIFE_SCIENCE_PARTNERS,
  },
  {
    id: "investor",
    name: "Investor",
    headline: "Thank you to our investor partners",
    // The four main partners lead; the support partners fill the grid below.
    featuredCount: 4,
    logos: INVESTOR_PARTNERS,
  },
];
