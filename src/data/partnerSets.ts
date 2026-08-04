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
