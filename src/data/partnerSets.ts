/**
 * The Life Science track's partner logos, as one ready-made set for the
 * thank-you wall — so nobody has to search the library 20 times to rebuild the
 * same post.
 *
 * **This is the official Partners page order** (top-left to bottom-right) —
 * checked against it logo by logo on 2026-08-04, when it was 25.
 *
 * **Re-verified 2026-08-13: still 25, same companies, same order, no edit.**
 *
 * **2026-08-20: 25 → 24. CPH.LABS is no longer a Life Science partner and was
 * removed on Auri's word, not from a page re-read, so the rest of this set is
 * still only verified to 2026-08-13.** `CPH Labs.svg` stays in the library in
 * case the partnership returns.
 * Done properly this time, so it does not need re-doing by eye: the wall on
 * techbbq.dk/life-science is 24 INLINE `<svg>` elements plus one `<img>` (Ruff &
 * Co, position 19). Inline SVG is why a text scrape of the page under-reports it
 * and why matching on image filenames finds almost nothing. Read it in the
 * browser as `document.querySelectorAll("svg, img")` filtered to the wall's
 * y-range and take each logo's identity from its PARENT LINK's href, which is
 * unambiguous where the artwork is not.
 *
 * NVIDIA is on that page but is deliberately NOT here: it sits in a separate
 * "IN PARTNERSHIP WITH" credit above the wall, beside Nebius, for one partner
 * session. That is a session credit, not a track partner. Nebius is in the wall
 * on its own account. The library has no NVIDIA file yet either — it is one of
 * the 9 staged-not-imported Airtable logos in PROGRESS.md handoff 11.
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
 * Three logos were refreshed the same day, also from Auri. `CPH Labs.svg` (then
 * still filed as `CPHLABS.svg`, renamed 2026-08-11) and
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
  /** Tier bands for a wall that draws its logos tier by tier, each band at its
   *  own size. Set only on the All Partners one-image wall; when present it
   *  replaces the lead/rest split and raises the cell cap (see
   *  `THANKS_TIERED_MAX_LOGOS`). */
  tiers?: { label: string; count: number; cols: number }[];
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
 * **The page has 25 as of 2026-08-12** — 4 main and 21 support, checked against
 * a screenshot of it. It had 20 on 2026-08-04, so treat any count in this
 * comment as a date-stamped observation and not a constant: five support
 * partners were added in between (Spintop, Antler, redalpine, Shift4Good, Rukam
 * Capital). 25 fits one wall, the cap being 48.
 *
 * **This set is COMPLETE at 25 as of 2026-08-12** — the first time it has been.
 * It went 17 → 22 → 25 in one session, so if a later count disagrees, the page
 * changed, not this file.
 *
 * Eight were added on 2026-08-12. Every one is `#fff` and every one reported
 * "artwork fills 100%" to `tighten-logo-viewbox.mjs --check`, so none needed a
 * viewBox fix — unusual for a batch this size, and worth re-checking rather than
 * assuming for the next one.
 *
 * From files Auri supplied by hand:
 *   **Antler** → `Antler White.svg`, out of the techbbq-2026 WordPress uploads.
 *     The library's older `Antler Invest.svg` is the RED cut (#ED4746) and stays
 *     where it is; do not repoint this line at it, and do not lean on the in-app
 *     tint to rescue it.
 *   **Ada Ventures** → `Ada Ventures White.svg`, which finally supersedes the
 *     dark `Ada Ventures.png` that could not be recoloured (the tint is
 *     SVG-only). The dark PNG stays in the library for light canvases.
 *
 * From the `Logo` attachments on Partner Deliverables 2026
 * (`tblTecOBecLQCNIeD` / `viw7FVbsTb9IRaWF0`), pulled with the read-only token
 * in `GITHUB/airtable/.env.local`:
 *   **Shift4Good** → `Shift4Good.svg`. Filed in Airtable as company
 *     "Shift 4 Good" with the file named `Shiftforgood.svg` — three spellings of
 *     one partner, which is why a name search has to be loose.
 *   **Rukam Capital** → `Rukam Capital.svg` (Airtable company "Rukam").
 *   **Mazanti-Andersen** → `Mazanti-Andersen.svg`. Its record also carries two
 *     PNGs, one of them orange; the SVG is the white one.
 *
 * All three sit at **Challenger** tier in Airtable, not an investor field — that
 * table is the deliverables tracker for every partner, so it is a source of
 * FILES here, not of who belongs on this wall. The investor page decides that.
 * Note also that Spintop, Antler and redalpine have no record in that table at
 * all, so a regenerate from Airtable would not rebuild this list.
 *
 * The last three, all from Auri on 2026-08-12, which closed the set:
 *   **redalpine** → `Redalpine.svg`. Nothing in Airtable, nothing in the library
 *     before this; the file came from his Side Events folder.
 *   **Spintop Ventures** → `Spintop Ventures.svg` **REPLACED IN PLACE**. The old
 *     file was the same artwork padded inside a square 100×100 viewBox its wide
 *     lockup filled only 95×34% of, which a contain-fit cell renders at a third
 *     of its neighbours' size. The new file is the tight horizontal cut, so every
 *     other reference to that name picks up the fix too. Original parked in
 *     `.logos-trash/replaced-2026-08-12/`.
 *   **Novo Nordisk Foundation** → `Novo Nordisk Foundation Horizontal.svg`, which
 *     the library ALREADY held and the Life Science set already uses. Auri
 *     supplied `Novo Nordisk Foundation New.svg`; it renders pixel-identical to
 *     that file, so this set points at the existing one rather than committing a
 *     second copy under a third name. Worth knowing that the investor page's
 *     artwork at this slot reads as Novo Nordisk the COMPANY (the bull mark);
 *     Auri confirmed the Foundation lockup is what belongs on the wall, so the
 *     page and the wall differ here on purpose.
 *
 * Order is the PAGE's order: the four main partners, then support partners
 * top-left to bottom-right. Keep it that way if the page gains another — insert
 * at its page position rather than appending, so the wall keeps matching the
 * page anyone might compare it to.
 */
export const INVESTOR_PARTNERS: PartnerSetEntry[] = [
  // ── Main partners ──
  { label: "Innovation District Copenhagen", src: "/logos/Innovation%20District%20Copenhagen%20White.png" },
  { label: "EIFO", src: "/logos/EIFO.svg" },
  { label: "wezeo", src: "/logos/Wezeo.svg" },
  { label: "HSBC Innovation Banking", src: "/logos/HSBC%20Innovation%20Banking.png" },
  // ── Support partners ──
  { label: "Spintop Ventures", src: "/logos/Spintop%20Ventures.svg" },
  { label: "Antler", src: "/logos/Antler%20White.svg" },
  { label: "redalpine", src: "/logos/Redalpine.svg" },
  { label: "Shift4Good", src: "/logos/Shift4Good.svg" },
  { label: "Rukam Capital", src: "/logos/Rukam%20Capital.svg" },
  { label: "embankment", src: "/logos/Embankment.svg" },
  { label: "Heartcore", src: "/logos/Heartcore.svg" },
  // The page's 8th support slot. Auri confirmed on 2026-08-12 that the FOUNDATION
  // lockup is the right artwork here, so this points at the file the Life Science
  // set already uses rather than adding a second copy of it.
  { label: "Novo Nordisk Foundation", src: "/logos/Novo%20Nordisk%20Foundation%20Horizontal.svg" },
  { label: "World Fund", src: "/logos/Worldfund%20White.svg" },
  { label: "Florent Venture Partners", src: "/logos/Florent%20Venture%20Partners.svg" },
  { label: "Rockstart", src: "/logos/Rockstart.svg" },
  { label: "NordicNinja", src: "/logos/NordicNinja.svg" },
  { label: "dealroom.co", src: "/logos/Dealroom.svg" },
  { label: "FBV", src: "/logos/FBV.svg" },
  { label: "PSV", src: "/logos/PSV.svg" },
  { label: "Ada Ventures", src: "/logos/Ada%20Ventures%20White.svg" },
  { label: "Mountside Ventures", src: "/logos/Mountside%20Ventures.svg" },
  { label: "European Investment Fund", src: "/logos/European%20Investment%20Fund%20(EIF).svg" },
  { label: "Aktive Ejere", src: "/logos/Aktive%20Ejere.svg" },
  { label: "F&P (Forsikring & Pension)", src: "/logos/Forsikring%20Og%20Pension.svg" },
  { label: "Mazanti-Andersen", src: "/logos/Mazanti-Andersen.svg" },
];

/**
 * The 2026 COMMUNITY partners — every record in the Airtable "Partner
 * Deliverables 2026" view (`tblTecOBecLQCNIeD` / `viw7FVbsTb9IRaWF0`) whose
 * Partnership Tier reads **Community**, pulled 2026-08-10.
 *
 * 89 records came back; this is 85. Four were dropped, none by oversight:
 *   **HighBridge Law Firm** is filed at Community tier in Airtable but is NOT a
 *     community partner — it has an exception (Auri, 2026-08-10). Removed by
 *     hand, so a regenerate from Airtable would bring it back: check this line
 *     before trusting a rebuilt list.
 *   **Business Helsinki** is the same partner twice — it and "AISTART Incubator
 *     - Business Helsinki" carry the identical white-AIStart file, so listing
 *     both would put one logo on the wall twice.
 *   **Fututo Perfecto Innovation** is a misspelled duplicate of Futuro Perfecto
 *     (here as Horizon Deep Tech Summit, the event it runs). No white asset, and
 *     its `Put on web` box is unticked.
 *   **Product Therapy** has no logo attachment at all.
 * ESA BIC Denmark IS included despite an unticked `Put on web` — that flag
 * governs the website grid, not a thank-you post. Drop it here if marketing
 * disagrees.
 *
 * 71 of the 85 were already in the library; the other 14 came from the Airtable
 * attachments on 2026-08-10 and are committed under `public/logos`. All 85
 * measure LIGHT in the manifest — a dark logo is invisible on this canvas. Where
 * the library holds both cuts this set points at the white one on purpose (imec,
 * Mesh, NORNORM, PropTech Denmark, Sustainary, Terkko, CSE, IDA, Odense
 * Robotics, Humble AI, EIT Urban Mobility, Health Tech Hub, START Paris,
 * Spaces/Regus, Venture Café Warsaw). Terkko is the trap: three files share that
 * name and only `Terkko Health Hub.svg` is light.
 *
 * **Always the white cut.** Every entry was checked against its Airtable white
 * asset on 2026-08-10 by reading the SVG source, not by trusting `tone: light`
 * — a mostly-white logo with a coloured mark still measures light, which is how
 * AIESEC shipped as its blue-and-white PNG on the first wall. Two were repointed:
 *   AIESEC        `Aiesec.png` (blue)          → `Aiesec White.svg`
 *   Talent Garden `Talent Garden.svg` (#f17b68) → `Talent Garden White.svg`
 * The remaining 83 already pointed at the same file marketing uploaded. Six use
 * a near-white grey rather than pure #FFF (Gothenburg Tech Week, Medicon Valley
 * Alliance, PWN Copenhagen, SKYtek, TechSavvy, Teknologisk Institut) — that IS
 * the official artwork, so they stay. The "points at white artwork" test allows
 * greys and fails a saturated colour.
 *
 * One entry is still PNG, not SVG: `Clarmacapital.png`. It is white artwork so
 * it renders fine; it just can't be recoloured in-app if the canvas goes light.
 * Three partners have no white asset anywhere (Copenhagen Institute for Futures
 * Studies, EU:CO, Sustainary) and use near-white library files.
 *
 * `label` is what the ARTWORK says, not the legal name on the record — the wall
 * shows logos, and "INNOVX BUSINESS ACCELERATOR S.R.L." helps nobody find the
 * InnovX mark. The renames worth knowing:
 *   "DI"                       → Dansk Industri
 *   "Clean"                    → CLEAN, the file is `Clean Cluster.svg`
 *   "MADE"                     → the file is `Futuremanufacturers.svg`
 *   "Shine"                    → IVN Powered by Shine
 *   "Medicon Valleyh Alliance" → Medicon Valley Alliance (typo in Airtable)
 *
 * Alphabetical, because a community tier has no hierarchy — every page below
 * runs `featuredCount: 0`.
 */
export const COMMUNITY_PARTNERS: PartnerSetEntry[] = [
  { label: "AceON Accelerator", src: "/logos/Aceon.svg" },
  { label: "advores", src: "/logos/Advores.svg" },
  { label: "AIESEC in Denmark", src: "/logos/Aiesec%20White.svg" },
  { label: "AIStart Incubator, Business Helsinki", src: "/logos/AIStart%20Incubator.svg" },
  { label: "Amela", src: "/logos/Amela.svg" },
  { label: "ArcticStartup", src: "/logos/ArcticStartup%20Mark.svg" },
  { label: "AUXXO Female Catalyst Fund", src: "/logos/AUXXO%20Female%20Catalyst%20Fund.svg" },
  { label: "BETA.HEALTH", src: "/logos/Beta%20Heath.svg" },
  { label: "BioMedical Design", src: "/logos/BioMedical%20Design.svg" },
  { label: "Brighteye Ventures", src: "/logos/Brighteye%20Ventures.svg" },
  { label: "BPoC", src: "/logos/BPOC.svg" },
  { label: "Business Turku", src: "/logos/Businessturku.svg" },
  { label: "Clarma Capital", src: "/logos/Clarmacapital.png" },
  { label: "CLEAN", src: "/logos/Clean%20Cluster.svg" },
  { label: "Copenhagen Climate Week", src: "/logos/Copenhagen%20Climate%20Week.svg" },
  { label: "Copenhagen Fintech", src: "/logos/Copenhagen%20Fintech.svg" },
  { label: "Copenhagen Institute for Futures Studies", src: "/logos/Copenhagen%20Institute%20for%20Futures%20Studies.svg" },
  { label: "Copenhagen School of Entrepreneurship", src: "/logos/CBS%20CSE%20White.svg" },
  { label: "Creative Girls Club", src: "/logos/Creative%20Girls%20Club.svg" },
  { label: "Crescita Partners", src: "/logos/Crescita%20Partners.svg" },
  { label: "Danish Startup Group", src: "/logos/Danish%20Startup%20Group.svg" },
  { label: "Daya Ventures", src: "/logos/Daya%20Ventures.svg" },
  { label: "dealroom.co", src: "/logos/Dealroom.svg" },
  { label: "Dansk Industri", src: "/logos/Dansk%20Industri.svg" },
  { label: "DTU Science Park", src: "/logos/DTU%20Science%20Park.svg" },
  { label: "EIT Urban Mobility", src: "/logos/EIT%20Urban%20Mobility%20White.svg" },
  { label: "Embassy of India", src: "/logos/Embassy%20of%20India.svg" },
  { label: "EU:CO", src: "/logos/EUCO.svg" },
  { label: "European Investment Fund", src: "/logos/European%20Investment%20Fund%20(EIF).svg" },
  { label: "ESA BIC Denmark", src: "/logos/ESA%20Business%20Incubation%20Centre%20Denmark.svg" },
  { label: "Femtech Studios", src: "/logos/Femtechstudios.svg" },
  { label: "Horizon Deep Tech Summit", src: "/logos/Horizon%20Deep%20Tech%20Summit.svg" },
  { label: "Gothenburg Tech Week", src: "/logos/Gothenburg%20Tech%20Week.svg" },
  { label: "Health Tech Hub Copenhagen", src: "/logos/Health%20Tech%20Hub%20Copenhagen%20White.svg" },
  { label: "Humble AI", src: "/logos/Humble%20AI%20White.svg" },
  { label: "IDA", src: "/logos/IDA%20White.svg" },
  { label: "Ignite Sweden", src: "/logos/Ignite%20Powered%20by%20SISP.svg" },
  { label: "imec", src: "/logos/Imec%20White.svg" },
  { label: "INCUBA", src: "/logos/INCUBA.svg" },
  { label: "Indian Danish Chamber of Commerce", src: "/logos/Indian%20Danish%20Chamber%20of%20Commerce.svg" },
  { label: "IVCA", src: "/logos/IVCA.svg" },
  { label: "InnovX", src: "/logos/Innovx.svg" },
  { label: "IWG", src: "/logos/IWG%20International%20Workplace%20Group.svg" },
  { label: "KLAK Icelandic Startups", src: "/logos/KLAK%20Icelandic%20Startups.svg" },
  { label: "Kveikja", src: "/logos/Kveikja.svg" },
  { label: "LithuaniaBIO", src: "/logos/Lithuania%20Bio.svg" },
  { label: "MADE", src: "/logos/Futuremanufacturers.svg" },
  { label: "Medicon Valley Alliance", src: "/logos/Medicon%20Valley%20Alliance.svg" },
  { label: "Medicon Village", src: "/logos/Medicon%20Village.svg" },
  { label: "Mesh", src: "/logos/Mesh%20Matrikel1%20White.svg" },
  { label: "Nordic Music Tech", src: "/logos/Nordic%20Music%20Tech.svg" },
  { label: "Nordic Women's Health Hub", src: "/logos/Nordic%20Women's%20Health%20Hub.svg" },
  { label: "NORNORM", src: "/logos/Nornorm%20White.svg" },
  { label: "Norway Health Tech", src: "/logos/Norway%20Health%20Tech.svg" },
  { label: "Nova Talent", src: "/logos/Nova%20Talent.svg" },
  { label: "NTNU Discovery", src: "/logos/NTNU.svg" },
  { label: "Odense Robotics", src: "/logos/Odense%20Robotics%20White.svg" },
  { label: "PropTech Denmark", src: "/logos/PropTech%20Denmark%20White.svg" },
  { label: "PWN Copenhagen", src: "/logos/PWN%20Copenhagen.svg" },
  { label: "Royal Danish Academy", src: "/logos/Royal%20Danish%20Academy.svg" },
  { label: "SDU Startup Station", src: "/logos/SDU%20Startup%20Station.svg" },
  { label: "Shine", src: "/logos/IVN%20Powered%20by%20Shine.svg" },
  { label: "SISP", src: "/logos/Swedish%20Incubators%20and%20Science%20Parks.svg" },
  { label: "SKYtek", src: "/logos/SKYtek.svg" },
  { label: "Space Denmark", src: "/logos/Space%20Denmark.svg" },
  { label: "Spaces / Regus", src: "/logos/Spaces%20Regus%20White.svg" },
  { label: "Sri Sathya Sai Institute of Higher Learning", src: "/logos/Sri%20Sathya.svg" },
  { label: "START Paris", src: "/logos/START%20Paris%20White.svg" },
  { label: "Sustainary", src: "/logos/Sustainary%20White.svg" },
  { label: "Talent Garden", src: "/logos/Talent%20Garden%20White.svg" },
  { label: "Tech Arena", src: "/logos/Tech%20Arena%20Sweden.svg" },
  { label: "TechSavvy", src: "/logos/Techsavvy.svg" },
  { label: "TechStation", src: "/logos/Techstation.svg" },
  { label: "Teknologisk Institut", src: "/logos/Teknologisk%20Institut.svg" },
  { label: "Terkko Health Hub", src: "/logos/Terkko%20Health%20Hub.svg" },
  { label: "KITCHEN, Aarhus University", src: "/logos/The%20Kitchen.svg" },
  { label: "The Residency Vienna", src: "/logos/The%20Residency%20Vienna.svg" },
  { label: "THINGS", src: "/logos/Things.svg" },
  { label: "TiE Bangalore", src: "/logos/Tie%20Bangalore.svg" },
  { label: "TÜV SÜD", src: "/logos/Tuvsud.svg" },
  { label: "Venture Café Warsaw", src: "/logos/Venture%20Cafe%20Warsaw%20Horiz%20White.svg" },
  { label: "Voice AI Space", src: "/logos/Voice%20AI%20Space.svg" },
  { label: "Women in Data Science, AI and ML", src: "/logos/Women%20in%20Data%20Science.svg" },
  { label: "Young AI Leaders Linz", src: "/logos/Young%20AI%20Leaders%20Community%20Linz%20Hub.svg" },
  { label: "ZOKU Copenhagen", src: "/logos/Zoku.svg" },
];

/**
 * The wall holds 30 cells (`THANKS_MAX_LOGOS`), so 85 community partners is
 * three posts: 30 / 30 / 25, sliced in the alphabetical order above. The number
 * is duplicated rather than imported because this file is data-only — the test
 * asserts the two stay in step.
 */
export const COMMUNITY_PER_WALL = 30;

/** The community roster split into wall-sized pages. */
export const COMMUNITY_PAGES: PartnerSetEntry[][] = Array.from(
  { length: Math.ceil(COMMUNITY_PARTNERS.length / COMMUNITY_PER_WALL) },
  (_, i) => COMMUNITY_PARTNERS.slice(i * COMMUNITY_PER_WALL, (i + 1) * COMMUNITY_PER_WALL),
);

/**
 * The startups exhibiting in the Life Science x Deep Tech area, 2026.
 *
 * **Source changed on 2026-08-13.** This used to be a hand-filtered read of the
 * **Life Science Project** table in Airtable (`appgXNjXJqpk9Ebxd` /
 * `tblvukXfmR7KTFymG`). It is now taken from the connector feed that the live
 * page eats, **`https://airtable-woad.vercel.app/api/ls-startups`**
 * (`GITHUB/airtable`, `lib/lsstartups.ts`, view `viwC65YEXxl8iDPzN`), because
 * that feed IS what techbbq.dk shows. Two lists that are supposed to be the same
 * roster should not be filtered in two places.
 *
 * Its gate is the same one this file worked out the hard way and should not be
 * re-litigated: `status = "Confirmed startup"`, a MULTI-select. `Confirmation =
 * Selected` is a shortlisting flag, not attendance — it stays "Selected" for
 * companies still being contacted and for ones that declined.
 *
 * **Re-sync with `npm run logos:ls-feed`** (`scripts/sync-ls-feed.mjs`), which
 * reads this array out of this file, diffs it against the feed and downloads
 * anything new to `.logos-feed/` without writing to the library. It reports
 * three things, and the third is the one a name diff misses: who arrived, who
 * fell off, and whose ARTWORK changed under an unchanged name (silhouette
 * compare, same 0.12 threshold `logos:import` uses). The feed is public and
 * needs no key.
 *
 * The roster moved a LOT between 2026-08-10 (31 here, from 43 confirmed) and
 * 2026-08-13 (37): 17 companies fell off and 23 arrived. So treat any count in
 * this comment as a date-stamped observation, and expect churn right up to the
 * summit rather than assuming a stale list is still right.
 *
 * **Re-synced 2026-08-14: 37 → 44. Seven arrived, nothing fell off, and no held
 * logo's artwork changed.** New, all imported from the feed as white-ink SVG
 * filling 100% of their viewBox (so none needed `logos:tighten`): Ally, Ambr
 * Institute, AMMISORB, Armenta Bioscience, Ironic Biotech, LumenAR, Oceanswell
 * Energy. `AMMISORB` is a white CARD with the artwork knocked out of it, the
 * same shape as AUSCORA below.
 *
 * Dropped on 2026-08-13, files kept in the library in case they come back:
 * Completion, Drylabz, Hemispherian, Hydram Research, Lucero, Mimbly, NeoCare
 * Nordic, Nordiq Products, Nyctea, PERPLANT, Sea Growth, Sveppa, Sylvia Health,
 * Uman Sense, UVision, Visibuilt, Yngvi Bio.
 *
 * **Re-synced 2026-08-20 against the connector feed: 44 → 45. One arrived,
 * nothing fell off, and no held logo's artwork changed.** New: Catalyst
 * Reactivate, imported from the feed as a white-ink SVG already filling 100% of
 * its viewBox. AUSCORA reports `compare failed: blank` in the sync report every
 * run — that is the white-card artwork below defeating the silhouette probe, not
 * a change.
 *
 * **Re-synced again later the same day: 45 → 46. One arrived, nothing fell off.**
 * New: **BIOMIC**, also a white-ink SVG filling its viewBox. Not to be confused
 * with **Biomimica**, which is a different company already on the wall — they
 * sit next to each other alphabetically, so check the artwork and not just the
 * first six letters before "fixing" either one.
 *
 * **This set is the FULL 46 — nothing is held back for missing artwork**, which
 * is new. The feed carries each company's logo attachment, so every company that
 * had no library file was imported straight from it (43 of the 44 are white-ink
 * SVG; Ai2Ai is the one PNG). Two arrived padded and were run through
 * `npm run logos:tighten` (Anorit Medical, TrialMe).
 *
 * Three names do not match their artwork, so do not "fix" them back:
 *   `Hydratico.svg`             → Airtable calls it "H+H LABS PSA (project
 *                                 Hydratico)"; the artwork says hydratico
 *   `DiaDesign Technologie.svg` → library filename is missing its final "s"
 *   `Ai2Ai.png`                 → the only raster in this set
 *
 * `AUSCORA` and `AMMISORB` are white CARDS with the artwork knocked out of them,
 * not white ink on transparent, so they render as white plates among 42
 * knockouts. That is the artwork the companies supplied; AUSCORA was flagged to
 * Auri 2026-08-13 and AMMISORB 2026-08-14, both unchanged here.
 *
 * Labels drop the legal suffix — no thank-you wall says "ApS".
 */
export const LS_DT_EXHIBITORS: PartnerSetEntry[] = [
  { label: "3Sonic", src: "/logos/Life%20Science%20Pitch%20Finalists%202026/3sonic.svg" },
  { label: "ABH Optics", src: "/logos/ABH%20Optics.svg" },
  { label: "Ai2Ai", src: "/logos/Ai2Ai.png" },
  { label: "Ally", src: "/logos/Ally.svg" },
  { label: "Ambr Institute", src: "/logos/Ambr%20Institute.svg" },
  { label: "AMMISORB", src: "/logos/AMMISORB.svg" },
  { label: "Anorit Medical", src: "/logos/Anorit%20Medical.svg" },
  { label: "Armenta Bioscience", src: "/logos/Armenta%20Bioscience.svg" },
  { label: "AUSCORA", src: "/logos/AUSCORA.svg" },
  { label: "AVENTIX", src: "/logos/AVENTIX.svg" },
  { label: "Bioelectrix", src: "/logos/Life%20Science%20Pitch%20Finalists%202026/Bioelectrix.svg" },
  { label: "BIOMIC", src: "/logos/BIOMIC.svg" },
  { label: "Biomimica", src: "/logos/Biomimica.svg" },
  { label: "Blue2", src: "/logos/Blue2%20White.svg" },
  { label: "Catalyst Reactivate", src: "/logos/Catalyst%20Reactivate.svg" },
  { label: "CYTO365", src: "/logos/CYTO365.svg" },
  { label: "Dalea", src: "/logos/Dalea.svg" },
  { label: "DiaDesign Technologies", src: "/logos/DiaDesign%20Technologie.svg" },
  { label: "DPella", src: "/logos/DPella.svg" },
  { label: "Enduro Genetics", src: "/logos/Enduro%20Genetics.svg" },
  { label: "GreenCow Biosolutions", src: "/logos/Life%20Science%20Pitch%20Finalists%202026/greenCow%20BioSolutions.svg" },
  { label: "Hydratico", src: "/logos/Hydratico.svg" },
  { label: "Immunordic", src: "/logos/Life%20Science%20Pitch%20Finalists%202026/Immunordic.svg" },
  { label: "Insulinus", src: "/logos/Insulinus.svg" },
  { label: "Ironic Biotech", src: "/logos/Ironic%20Biotech.svg" },
  { label: "LignoSolve", src: "/logos/LignoSolve.svg" },
  { label: "Lizard Photonics", src: "/logos/Lizard%20Photonics.svg" },
  { label: "LumenAR", src: "/logos/LumenAR.svg" },
  { label: "MagCath", src: "/logos/MagCath%20White.svg" },
  { label: "Magnolia Quantum Sensing", src: "/logos/Deep%20Tech%20Pitch%20Finalists%202026/Magnolia%20Quantum%20Sensing.svg" },
  { label: "Oceanswell Energy", src: "/logos/Oceanswell%20Energy.svg" },
  { label: "Ownwell", src: "/logos/Ownwell%20White.svg" },
  { label: "Paindrainer", src: "/logos/Paindrainer%20White.svg" },
  { label: "Previto", src: "/logos/Previto%20White.svg" },
  { label: "QVersion", src: "/logos/QVersion.svg" },
  { label: "Rebound", src: "/logos/Rebound.svg" },
  { label: "Redoxa Therapeutics", src: "/logos/Redoxa%20Therapeutics.svg" },
  { label: "Rekovy", src: "/logos/Rekovy.svg" },
  { label: "Rilemo", src: "/logos/Deep%20Tech%20Pitch%20Finalists%202026/Rilemo.svg" },
  { label: "SmartSens", src: "/logos/SmartSens%20White.svg" },
  { label: "Sorbus Biomedical", src: "/logos/Sorbus%20Biomedical%20White.svg" },
  { label: "TrialMe", src: "/logos/TrialMe.svg" },
  { label: "Vetbac", src: "/logos/Vetbac%20White.svg" },
  { label: "Walther Therapeutics", src: "/logos/Walther%20Therapeutics%20White.svg" },
  { label: "Wren Bioscience", src: "/logos/Wren%20Bioscience.svg" },
  { label: "Yoke Bio", src: "/logos/Yoke%20Bio%20White.svg" },
];

/**
 * The 16 pitch competition finalists — 8 from the Life Science Pitch
 * Competition, 8 from the Deep Tech Pitch Competition, now held as TWO arrays
 * with a fill button each (see `LS_PITCH_FINALISTS` / `DT_PITCH_FINALISTS`
 * below). They were one combined set until 2026-08-20. Auri supplied all 16 as
 * white SVGs on 2026-08-10; they live in their own two folders under
 * `public/logos` so the pitch cohort stays findable as a group (a folder name
 * is a search tag, so typing "finalists" returns exactly these).
 *
 * Every one was checked with `npm run logos:tighten -- --check`: all 16 report
 * their artwork filling 100% of the viewBox, so none of them will render a
 * fraction of its neighbours' size the way the padded partner files did.
 *
 * Six of these companies ALSO exhibit, so the participating wall below
 * de-duplicates rather than showing them twice.
 *
 * **Re-checked against both announcement pages on 2026-08-14: ONE change.** The
 * Deep Tech page now lists **insellar** where this set had **Epidetect Labs**;
 * Life Science's 8 are untouched. Auri asked for exactly this check, so treat
 * the two pages as the authority on the cohort and re-read them rather than
 * trusting a count. `Epidetect Labs.svg` stays in the library in case it comes
 * back.
 *
 * The two pages block `curl` (a WAF answers "455 Security Incident Detected"),
 * so read them in a browser. Each logo is an INLINE `<svg>` inside a link, and
 * the link's href is the only unambiguous identity — the artwork often does not
 * spell the company the way Airtable does. Those pages shorten four names, so
 * match on the COMPANY, not the string: `Oasi` is Oasicare, `Analgesia.ai` is
 * AnalgesiaAI, `Magnolia` is Magnolia Quantum Sensing, `N23` is N23 health.
 * Labels here stay as the artwork reads, which is why insellar is lowercase.
 *
 * `Insellar.svg` was rebuilt from that page's inline SVG (its four paths and the
 * `.st0/.st1` style block, white ink with the final A at 80% opacity) because the
 * company has no website — the page links its LinkedIn. Rendered and checked
 * against the page before being listed.
 *
 * This list got its own fill button on 2026-08-14. Until then it existed only to
 * feed the participating wall, so a roster that was correct for months had never
 * actually been rendered on its own. On 2026-08-20 that one button became two,
 * one per competition.
 */
/** The 8 Life Science Pitch Competition finalists. */
export const LS_PITCH_FINALISTS: PartnerSetEntry[] = [
  { label: "3sonic", src: "/logos/Life%20Science%20Pitch%20Finalists%202026/3sonic.svg" },
  { label: "AnalgesiaAI", src: "/logos/Life%20Science%20Pitch%20Finalists%202026/AnalgesiaAI.svg" },
  { label: "Bioelectrix", src: "/logos/Life%20Science%20Pitch%20Finalists%202026/Bioelectrix.svg" },
  { label: "Crossingbio", src: "/logos/Life%20Science%20Pitch%20Finalists%202026/Crossingbio.svg" },
  { label: "greenCow BioSolutions", src: "/logos/Life%20Science%20Pitch%20Finalists%202026/greenCow%20BioSolutions.svg" },
  { label: "Immunordic", src: "/logos/Life%20Science%20Pitch%20Finalists%202026/Immunordic.svg" },
  { label: "Monix", src: "/logos/Life%20Science%20Pitch%20Finalists%202026/Monix.svg" },
  { label: "Oasicare", src: "/logos/Life%20Science%20Pitch%20Finalists%202026/Oasicare.svg" },
];

/** The 8 Deep Tech Pitch Competition finalists. */
export const DT_PITCH_FINALISTS: PartnerSetEntry[] = [
  { label: "AnyoLabs", src: "/logos/Deep%20Tech%20Pitch%20Finalists%202026/AnyoLabs.svg" },
  { label: "DigeHealth", src: "/logos/Deep%20Tech%20Pitch%20Finalists%202026/DigeHealth.svg" },
  { label: "insellar", src: "/logos/Deep%20Tech%20Pitch%20Finalists%202026/Insellar.svg" },
  { label: "Magnolia Quantum Sensing", src: "/logos/Deep%20Tech%20Pitch%20Finalists%202026/Magnolia%20Quantum%20Sensing.svg" },
  { label: "N23 health", src: "/logos/Deep%20Tech%20Pitch%20Finalists%202026/N23%20health.svg" },
  { label: "Rilemo", src: "/logos/Deep%20Tech%20Pitch%20Finalists%202026/Rilemo.svg" },
  { label: "Scientek", src: "/logos/Deep%20Tech%20Pitch%20Finalists%202026/Scientek.svg" },
  { label: "Videm", src: "/logos/Deep%20Tech%20Pitch%20Finalists%202026/Videm.svg" },
];

/**
 * Both cohorts as one list. DERIVED, not hand-kept — the two competitions are
 * the source of truth now, so a finalist can never be in the combined wall and
 * missing from its own competition's.
 *
 * Kept because the participating wall below de-duplicates against it. There is
 * no fill button for it any more: the walls that go out are per-competition.
 */
export const LS_DT_PITCH_FINALISTS: PartnerSetEntry[] = [
  ...LS_PITCH_FINALISTS,
  ...DT_PITCH_FINALISTS,
];

/**
 * "Thank you for participating" — the exhibitors and the pitch finalists on one
 * wall, which is what was asked for over splitting them across two slides.
 *
 * De-duplicated **by `src`**, not by label: six companies appear in both lists
 * and they are not spelled the same in both (`GreenCow Biosolutions` vs
 * `greenCow BioSolutions`, `3Sonic` vs `3sonic`). Both lists already point at
 * the same FILE for those, so the path is the reliable identity — matching on
 * label would double-print half of them. 44 + 16 - 6 = 54 as of 2026-08-14.
 *
 * The overlap grew from 4 to 6 when the exhibitor roster was re-synced that day
 * (3Sonic and Bioelectrix are now exhibiting as well as pitching), which is
 * exactly the case the src-based dedupe exists for.
 */
export const LS_DT_PARTICIPANTS: PartnerSetEntry[] = [
  ...LS_DT_EXHIBITORS,
  ...LS_DT_PITCH_FINALISTS.filter((f) => !LS_DT_EXHIBITORS.some((e) => e.src === f.src)),
];

/**
 * ALL PARTNERS 2026
 *
 * The whole website partner list — every row of Airtable's `Marketing Project
 * Overview` view "Partner Deliverables 2026" that is flagged `Put on web`,
 * which is the same list techbbq.dk's partner page is built from. Unlike every
 * other set in this file, this one is GENERATED (`npm run logos:tiers -- --write`
 * then `npm run logos:tiers:gen`): 211 partners is past the point where a hand
 * edit per partner is honest work, and the roster changes weekly until the
 * summit.
 *
 * What the two scripts do that a plain download cannot:
 *   - resolve each partner to a library file by NAME first, then by ARTWORK
 *     (silhouette, 0.12), so a partner already filed under another name — TÜV
 *     SÜD as `Tuvsud`, Medicon Valley Alliance under Airtable's "Valleyh" typo —
 *     reuses the file we hold instead of importing a second copy. 74 of the 211
 *     resolved that way.
 *   - prefer WHITE KNOCKOUT artwork. Partners supply their brand files, and a
 *     coloured or dark logo is invisible on this canvas. A vector with no white
 *     cut in the library is rewritten to white ink on import (the on-disk twin
 *     of src/lib/svgTint.ts) and lands beside the coloured original rather than
 *     replacing it — hence the `… White` / `… Knockout` filenames.
 *   - refuse the artwork it cannot fix: a raster-only logo, an `.eps`, or a
 *     sheet export with an opaque background rectangle. Those three land in
 *     `ALL_PARTNERS_UNRESOLVED` instead of quietly missing from a wall.
 *
 * Tier order is MONEY order, high to low, confirmed by Auri on 2026-08-17:
 * Prime, Main, Conqueror, Pioneer, Core, Challenger, Community. The five groups
 * after those are separate deals rather than rungs on that ladder — Investor,
 * Tailored, International, Academic, and `Other` for the rows with no
 * `Partnership Type 2026` at all (Danske Bank, Deloitte, NVIDIA, Carta and 29
 * more). `Core Plus` folds into Core.
 *
 * This roster OVERLAPS the hand-built sets above, and both are kept on purpose:
 * `COMMUNITY_PARTNERS` is the list the published community posts were built
 * from, checked logo by logo against the website, and re-cutting it would change
 * who was already thanked on which post. This one answers a different question:
 * who is on the partner list right now, at what tier.
 */
export interface PartnerTierRoster {
  id: string;
  /** The tier as Airtable spells it — the button text and the wall's label. */
  tier: string;
  /** True for the seven money tiers, which form ONE ladder: on the tiered wall a
   *  higher tier must never draw smaller than a lower one. The groups after them
   *  (Investor, Tailored, International, Academic, Other) are separate deals, so
   *  they size themselves from their own logo count. */
  ladder: boolean;
  logos: PartnerSetEntry[];
}

// ── ALL_PARTNER_TIERS · generated by npm run logos:tiers:gen ─────────────
/** Every partner on the website list, grouped by tier and ordered by tier
 *  value, high to low. 113 partners across 7 tiers, generated from
 *  Airtable on the date in the git history of this block — re-run the two
 *  logos:tiers commands to refresh it, never hand-edit inside the markers. */
export const ALL_PARTNER_TIERS: PartnerTierRoster[] = [
  {
    id: "prime",
    tier: "Prime",
    ladder: true,
    logos: [
      { label: "Beyond Beta", src: "/logos/Partners%202026/Beyond%20Beta.svg" },
      { label: "Erhvervsfremmebestyrelsen", src: "/logos/Partners%202026/Erhvervsfremmebestyrelsen.svg" },
      { label: "Industriens Fond", src: "/logos/Partners%202026/Industriens%20Fond.svg" },
      { label: "Novo Nordisk Foundation", src: "/logos/Partners%202026/Novo%20Nordisk%20Foundation.svg" },
    ],
  },
  {
    id: "main",
    tier: "Main",
    ladder: true,
    logos: [
      { label: "Danish Life Science Cluster", src: "/logos/Partners%202026/Danish%20Life%20Science%20Cluster.svg" },
      { label: "Google Cloud", src: "/logos/Partners%202026/Google%20Cloud.svg" },
      { label: "Life Science Invest", src: "/logos/Partners%202026/Life%20Science%20Invest.svg" },
    ],
  },
  {
    id: "conqueror",
    tier: "Conqueror",
    ladder: true,
    logos: [
      { label: "Bobbie & Beastie", src: "/logos/Partners%202026/Bobbie%20%26%20Beastie.svg" },
      { label: "Danish Entrepreneurs", src: "/logos/Partners%202026/Danish%20Entrepreneurs.svg" },
      { label: "Danske Bank Growth", src: "/logos/Partners%202026/Danske%20Bank%20Growth.svg" },
      { label: "EIFO (Export & Investment Fund of Denmark)", src: "/logos/Partners%202026/EIFO%20(Export%20%26%20Investment%20Fund%20of%20Denmark).svg" },
      { label: "Innovation Centre Denmark", src: "/logos/Partners%202026/Innovation%20Centre%20Denmark.svg" },
      { label: "Nebius", src: "/logos/Partners%202026/Nebius.svg" },
      { label: "NVIDIA", src: "/logos/Partners%202026/NVIDIA.svg" },
      { label: "Southern Sweden", src: "/logos/Partners%202026/Southern%20Sweden.svg" },
    ],
  },
  {
    id: "pioneer",
    tier: "Pioneer",
    ladder: true,
    logos: [
      { label: "Boardway", src: "/logos/Partners%202026/Boardway.svg" },
      { label: "Business region Gothenburg AKA Gothenburg", src: "/logos/Partners%202026/Business%20region%20Gothenburg%20AKA%20Gothenburg.svg" },
      { label: "DPIIT", src: "/logos/Partners%202026/DPIIT.svg" },
      { label: "Erhvervshus Sjælland", src: "/logos/Partners%202026/Erhvervshus%20Sj%C3%A6lland.png" },
      { label: "European Innovation Council", src: "/logos/Partners%202026/European%20Innovation%20Council.svg" },
      { label: "Jyske Bank Growth", src: "/logos/Partners%202026/Jyske%20Bank%20Growth.svg" },
      { label: "Microsoft Danmark", src: "/logos/Partners%202026/Microsoft%20Danmark.svg" },
      { label: "Vanta", src: "/logos/Partners%202026/Vanta.svg" },
      { label: "WEZEO", src: "/logos/Partners%202026/WEZEO.svg" },
      { label: "Women in Tech Denmark", src: "/logos/Partners%202026/Women%20in%20Tech%20Denmark.svg" },
    ],
  },
  {
    id: "core",
    tier: "Core",
    ladder: true,
    logos: [
      { label: "Bio Innovation Institue", src: "/logos/Partners%202026/Bio%20Innovation%20Institue.svg" },
      { label: "BSI", src: "/logos/Partners%202026/BSI.svg" },
      { label: "Business Iceland", src: "/logos/Partners%202026/Business%20Iceland.svg" },
      { label: "Cloudflare", src: "/logos/Partners%202026/Cloudflare.svg" },
      { label: "Copenhagen", src: "/logos/Partners%202026/Copenhagen.svg" },
      { label: "Creative Business Network", src: "/logos/Partners%202026/Creative%20Business%20Network.png" },
      { label: "Crispa Technologies ApS", src: "/logos/Partners%202026/Crispa%20Technologies%20ApS.svg" },
      { label: "Danish Business Authority", src: "/logos/Partners%202026/Danish%20Business%20Authority.svg" },
      { label: "Deloitte", src: "/logos/Partners%202026/Deloitte.svg" },
      { label: "e-conomic", src: "/logos/Partners%202026/e-conomic.svg" },
      { label: "EIFO", src: "/logos/Partners%202026/EIFO.svg" },
      { label: "Embassy of the Netherlands", src: "/logos/Partners%202026/Embassy%20of%20the%20Netherlands.svg" },
      { label: "eryk", src: "/logos/Partners%202026/eryk.svg" },
      { label: "European Commission", src: "/logos/Partners%202026/European%20Commission.svg" },
      { label: "EY Danmark", src: "/logos/Partners%202026/EY%20Danmark.svg" },
      { label: "FBV - Association of Listed Danish Companies", src: "/logos/Partners%202026/FBV%20-%20Association%20of%20Listed%20Danish%20Companies.svg" },
      { label: "Flatpay", src: "/logos/Partners%202026/Flatpay.svg" },
      { label: "GetAccept AB", src: "/logos/Partners%202026/GetAccept%20AB.svg" },
      { label: "Grant Thornton Denmark", src: "/logos/Partners%202026/Grant%20Thornton%20Denmark.svg" },
      { label: "HSBC Innovation Banking", src: "/logos/Partners%202026/HSBC%20Innovation%20Banking.svg" },
      { label: "Impact Fund Denmark", src: "/logos/Partners%202026/Impact%20Fund%20Denmark.svg" },
      { label: "N.Rich", src: "/logos/Partners%202026/N.Rich.svg" },
      { label: "Owl Ventures", src: "/logos/Partners%202026/Owl%20Ventures.svg" },
      { label: "Plug and Play", src: "/logos/Partners%202026/Plug%20and%20Play.svg" },
      { label: "PSV", src: "/logos/Partners%202026/PSV.svg" },
      { label: "Skytek Nordics ApS", src: "/logos/Partners%202026/Skytek%20Nordics%20ApS.svg" },
      { label: "Teknologisk Institut (Humanoide robotter)", src: "/logos/Partners%202026/Teknologisk%20Institut%20(Humanoide%20robotter).svg" },
      { label: "TONIK", src: "/logos/Partners%202026/TONIK.svg" },
      { label: "World Fund", src: "/logos/Partners%202026/World%20Fund.svg" },
    ],
  },
  {
    id: "challenger",
    tier: "Challenger",
    ladder: true,
    logos: [
      { label: "Ada Ventures", src: "/logos/Partners%202026/Ada%20Ventures.svg" },
      { label: "Adeo Web", src: "/logos/Partners%202026/Adeo%20Web.svg" },
      { label: "advores Advokater & Rechtanwälte PartGmbB", src: "/logos/Partners%202026/advores%20Advokater%20%26%20Rechtanw%C3%A4lte%20PartGmbB.svg" },
      { label: "Antler", src: "/logos/Partners%202026/Antler.svg" },
      { label: "AstraZeneca", src: "/logos/Partners%202026/AstraZeneca.svg" },
      { label: "Breeze IP", src: "/logos/Partners%202026/Breeze%20IP.svg" },
      { label: "Carta", src: "/logos/Partners%202026/Carta.svg" },
      { label: "Cherry Ventures", src: "/logos/Partners%202026/Cherry%20Ventures.svg" },
      { label: "Cludo", src: "/logos/Partners%202026/Cludo.svg" },
      { label: "Copenhagen Fintech Lab", src: "/logos/Partners%202026/Copenhagen%20Fintech%20Lab.svg" },
      { label: "cse advisory, OMR Reviews", src: "/logos/Partners%202026/cse%20advisory%2C%20OMR%20Reviews.svg" },
      { label: "DanBAN - Danish Business Angels", src: "/logos/Partners%202026/DanBAN%20-%20Danish%20Business%20Angels.svg" },
      { label: "Eastern Peak", src: "/logos/Partners%202026/Eastern%20Peak.svg" },
      { label: "Embankment", src: "/logos/Partners%202026/Embankment.svg" },
      { label: "Famly ApS", src: "/logos/Partners%202026/Famly%20ApS.svg" },
      { label: "Florent VC", src: "/logos/Partners%202026/Florent%20VC.svg" },
      { label: "Heartcore Capital", src: "/logos/Partners%202026/Heartcore%20Capital.svg" },
      { label: "Highbridge Law Firm", src: "/logos/Partners%202026/Highbridge%20Law%20Firm.svg" },
      { label: "Humandone", src: "/logos/Partners%202026/Humandone.svg" },
      { label: "KLAK - Icelandic Startups", src: "/logos/Partners%202026/KLAK%20-%20Icelandic%20Startups.svg" },
      { label: "Knowsilo Inc.", src: "/logos/Partners%202026/Knowsilo%20Inc.svg" },
      { label: "Kromann Reumert", src: "/logos/Partners%202026/Kromann%20Reumert.svg" },
      { label: "Kveikja", src: "/logos/Partners%202026/Kveikja.svg" },
      { label: "Legora AB", src: "/logos/Partners%202026/Legora%20AB.svg" },
      { label: "Mazanti-Andersen", src: "/logos/Partners%202026/Mazanti-Andersen.svg" },
      { label: "Nordea", src: "/logos/Partners%202026/Nordea.svg" },
      { label: "Nordic Ninja", src: "/logos/Partners%202026/Nordic%20Ninja.svg" },
      { label: "PROSA", src: "/logos/Partners%202026/PROSA.svg" },
      { label: "rebriQ", src: "/logos/Partners%202026/rebriQ.svg" },
      { label: "Redalpine", src: "/logos/Partners%202026/Redalpine.svg" },
      { label: "Rockstart", src: "/logos/Partners%202026/Rockstart.svg" },
      { label: "Rukam", src: "/logos/Partners%202026/Rukam.svg" },
      { label: "​​San Francisco Oy", src: "/logos/Partners%202026/%E2%80%8B%E2%80%8BSan%20Francisco%20Oy.svg" },
      { label: "Seed Capital", src: "/logos/Partners%202026/Seed%20Capital.svg" },
      { label: "Shift 4 Good", src: "/logos/Partners%202026/Shift%204%20Good.svg" },
      { label: "Skiftr ApS", src: "/logos/Partners%202026/Skiftr%20ApS.svg" },
      { label: "Spintop Ventures", src: "/logos/Partners%202026/Spintop%20Ventures.svg" },
      { label: "Stinto", src: "/logos/Partners%202026/Stinto.svg" },
      { label: "Superseed", src: "/logos/Partners%202026/Superseed.svg" },
      { label: "swisstech", src: "/logos/Partners%202026/swisstech.svg" },
      { label: "Third Law ApS", src: "/logos/Partners%202026/Third%20Law%20ApS.svg" },
      { label: "Vend Marketplaces", src: "/logos/Partners%202026/Vend%20Marketplaces.svg" },
      { label: "Vibrant", src: "/logos/Partners%202026/Vibrant.svg" },
    ],
  },
  {
    id: "community",
    tier: "Community",
    ladder: true,
    logos: [
      { label: "BETA.HEALTH", src: "/logos/Partners%202026/BETA.HEALTH.svg" },
      { label: "BioMedical Design", src: "/logos/Partners%202026/BioMedical%20Design.svg" },
      { label: "Business Turku", src: "/logos/Partners%202026/Business%20Turku.svg" },
      { label: "Clean", src: "/logos/Partners%202026/Clean.svg" },
      { label: "Copenhagen School of Entrepreneurship", src: "/logos/Partners%202026/Copenhagen%20School%20of%20Entrepreneurship.svg" },
      { label: "DI", src: "/logos/Partners%202026/DI.svg" },
      { label: "DTU Entrepreneurship", src: "/logos/Partners%202026/DTU%20Entrepreneurship.svg" },
      { label: "DTU Science Park", src: "/logos/Partners%202026/DTU%20Science%20Park.svg" },
      { label: "Health Tech Hub Copenhagen", src: "/logos/Partners%202026/Health%20Tech%20Hub%20Copenhagen.svg" },
      { label: "INCUBA x KITCHEN", src: "/logos/Partners%202026/INCUBA%20x%20KITCHEN.svg" },
      { label: "Innovation District Copenhagen", src: "/logos/Partners%202026/Innovation%20District%20Copenhagen.svg" },
      { label: "MADE", src: "/logos/Partners%202026/MADE.svg" },
      { label: "Nordic Women's Health Hub", src: "/logos/Partners%202026/Nordic%20Women's%20Health%20Hub.svg" },
      { label: "Odense Robotics", src: "/logos/Partners%202026/Odense%20Robotics.svg" },
      { label: "Symbion", src: "/logos/Partners%202026/Symbion.svg" },
      { label: "TÜV SÜD Denmark Medical Health Services", src: "/logos/Partners%202026/T%C3%9CV%20S%C3%9CD%20Denmark%20Medical%20Health%20Services.svg" },
    ],
  },
];

/** The partners this roster could NOT place, kept in source so the gap is
 *  visible rather than silently missing from a wall. Each needs artwork a
 *  script cannot produce — see the reasons in partner-tiers-report.json. */
export const ALL_PARTNERS_UNRESOLVED: { label: string; tier: string; why: string }[] = [
];
// ── end generated block ─────────────────────────────────────────────────

/** Logos per wall for a tier that outgrows one image, and therefore how many
 *  walls a tier needs. The pages are explicit rather than a hidden truncation.
 *
 *  36 on Auri's call (2026-08-19: "can we make Community in 3"), because
 *  Community is 106 and 36 is the smallest cap that fits it on three. It also
 *  reads at 6 columns, which is the column count that tier already draws at. */
export const TIER_PER_WALL = 36;

/** Split `n` logos across `pages` walls as evenly as possible, biggest first.
 *
 *  Slicing at a fixed 36 would put the remainder alone on the last wall, and the
 *  remainder is usually tiny: Community came out 30/30/30/16 and Core came out
 *  30/4 — a wall holding four logos next to one holding thirty, which reads as a
 *  mistake rather than a page. Evenly, Community is 36/35/35 and Core fits on one.
 *
 *  The first pages take the extra, so page 1 is never smaller than page 2. */
function balancedPages(n: number, pages: number): number[] {
  const base = Math.floor(n / pages);
  const extra = n % pages;
  return Array.from({ length: pages }, (_, i) => base + (i < extra ? 1 : 0));
}

/** Every tier as one or more walls: `{ tier, page, of, logos }`, in tier order.
 *  A tier under the cap yields a single page with `of: 1`. */
export const ALL_PARTNER_WALLS: { tier: string; id: string; page: number; of: number; logos: PartnerSetEntry[] }[] =
  ALL_PARTNER_TIERS.flatMap((t) => {
    const pages = Math.max(1, Math.ceil(t.logos.length / TIER_PER_WALL));
    const sizes = balancedPages(t.logos.length, pages);
    let at = 0;
    return sizes.map((size, i) => {
      const logos = t.logos.slice(at, at + size);
      at += size;
      return {
        tier: t.tier,
        id: pages > 1 ? `all-${t.id}-${i + 1}` : `all-${t.id}`,
        page: i + 1,
        of: pages,
        logos,
      };
    });
  });

/** Every partner in the roster, tier by tier — the one-image wall. Deduplicated
 *  by file: a partner listed in two tiers (Copenhagen School of Entrepreneurship
 *  is both Tailored and Community) belongs on the higher one, and a wall cannot
 *  show the same logo twice. */
export const ALL_PARTNERS_FLAT: PartnerSetEntry[] = ALL_PARTNER_TIERS
  .flatMap((t) => t.logos)
  .filter((l, i, all) => all.findIndex((x) => x.src === l.src) === i);

/** The tier bands of `ALL_PARTNERS_FLAT`, in the same order — what the tiered
 *  wall needs to draw each tier at its own size.
 *
 *  `cols` is the hierarchy: cell size comes from the column count, so a tier
 *  drawn 4 across has cells 1.5x the width of one drawn 6 across.
 *
 *  The numbers are AURI'S SPEC, taken from `PARTNER_TIERS` in the airtable
 *  repo's `lib/partners.ts` — the same file this roster's tiers come from, and
 *  the one that feeds the wall on techbbq.dk. Four at the top, five in the
 *  middle, six for Community because it is 106 of the 217 and any fewer would
 *  run down the page forever. A tier not in the spec falls back to the old auto
 *  rule (roughly sqrt(3n), cells being wider than tall).
 *
 *  This replaced a guess. The auto rule sized each tier independently and only
 *  happened to keep the ladder monotonic while the tier counts cooperated; the
 *  ladder clamp below stays as a backstop, but with the spec it never fires. */
const TIER_COLS: Record<string, number> = {
  Prime: 4, Main: 4, Conqueror: 4,
  Pioneer: 5, Core: 5, Challenger: 5, International: 5,
  Community: 6,
};
export const ALL_PARTNERS_TIER_BANDS: { label: string; count: number; cols: number }[] = (() => {
  const seen = new Set<string>();
  let ladderCols = 0;
  const out: { label: string; count: number; cols: number }[] = [];
  for (const t of ALL_PARTNER_TIERS) {
    const fresh = t.logos.filter((l) => !seen.has(l.src));
    for (const l of fresh) seen.add(l.src);
    if (!fresh.length) continue;
    const auto = TIER_COLS[t.tier] ?? Math.ceil(Math.sqrt(fresh.length * 3));
    // A ladder tier keeps the widest column count seen above it even when it
    // holds fewer logos than that: Prime at 6 draws 5 across, so Main at 4 must
    // also draw on a 5-wide grid (one short row) or its four logos come out
    // BIGGER than Prime's six, which inverts the hierarchy the ladder exists to
    // express. Off the ladder there is no hierarchy to protect, so a band never
    // takes more columns than it has logos — Academic at 1 is one cell, not a
    // half-empty row of two.
    const cols = t.ladder
      ? Math.max(ladderCols, Math.min(fresh.length, auto))
      : Math.min(fresh.length, auto);
    if (t.ladder) ladderCols = cols;
    out.push({ label: t.tier, count: fresh.length, cols });
  }
  return out;
})();

/** The thank-you headline for one tier's wall: "Thank you to our Prime
 *  partners". The tier keeps the casing it has in the roster, because these are
 *  proper names of the partnership levels ("Prime", "Core"), not adjectives.
 *
 *  `Other` is the catch-all bucket for partners whose tier did not resolve, so
 *  naming it on a slide would be wrong; it falls back to the generic line. */
export function tierHeadline(tier: string): string {
  if (!tier || tier.toLowerCase() === "other") return "Thank you to our partners";
  return `Thank you to our ${tier} partners`;
}

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
    id: "ls-dt-exhibitors",
    name: "LS x DT Exhibiting",
    headline: "Thank you for exhibiting",
    featuredCount: 0,
    logos: LS_DT_EXHIBITORS,
  },
  // Not thank-yous: these walls announce a cohort BEFORE they pitch, which is
  // why they are the sets in this folder whose headline does not start
  // "Thank you".
  //
  // One combined 16-logo button used to stand here, on the reasoning that 16
  // fits one wall and the pages announce them as one cohort. Auri asked for
  // them split on 2026-08-20: they are two separate competitions with separate
  // juries, and a post announcing "the Life Science finalists" cannot carry
  // eight Deep Tech companies. The combined list still exists as a derived
  // array because the participating wall de-duplicates against it.
  {
    id: "ls-pitch-finalists",
    name: "LS Pitch Finalists",
    headline: "Meet our Life Science pitch finalists",
    featuredCount: 0,
    logos: LS_PITCH_FINALISTS,
  },
  {
    id: "dt-pitch-finalists",
    name: "DT Pitch Finalists",
    headline: "Meet our Deep Tech pitch finalists",
    featuredCount: 0,
    logos: DT_PITCH_FINALISTS,
  },
  {
    id: "ls-dt-participants",
    name: "LS x DT Participating",
    headline: "Thank you for participating",
    featuredCount: 0,
    logos: LS_DT_PARTICIPANTS,
  },
  {
    id: "investor",
    name: "Investor",
    headline: tierHeadline("Investor"),
    // The four main partners lead; the support partners fill the grid below.
    featuredCount: 4,
    logos: INVESTOR_PARTNERS,
  },
  // One button per page of 30. Community is the biggest tier by far and cannot
  // fit one wall, so the pages are explicit rather than a hidden truncation.
  ...COMMUNITY_PAGES.map((logos, i) => ({
    id: `community-${i + 1}`,
    // "1 / 3" rather than a range — the buttons sit in a narrow sidebar column
    // and "Community 31-60" wraps.
    name: `Community ${i + 1} / ${COMMUNITY_PAGES.length}`,
    headline: tierHeadline("Community"),
    // A community tier has no lead partners: one flat grid.
    featuredCount: 0,
    logos,
  })),
  // All Partners: one wall per tier, in tier order, paginated where a tier
  // outgrows one image. Each wall names its own tier in the headline ("Thank you
  // to our Prime partners") so a set of walls posted together reads as a series
  // rather than the same slide three times. `Other` is the exception: it is a
  // bucket, not a tier anyone is thanked as, so it keeps the generic line. Type
  // over the headline when a wall wants to say something else.
  // The whole list on ONE image, tier by tier, biggest tier first. A poster
  // rather than a slide — 210 logos means the Community band lands near 40px at
  // 16:9 — so it ships alongside the per-tier walls rather than instead of them.
  {
    id: "all-partners-one",
    name: "All tiers, one wall",
    headline: "Thank you to our partners",
    featuredCount: 0,
    tiers: ALL_PARTNERS_TIER_BANDS,
    logos: ALL_PARTNERS_FLAT,
  },
  ...ALL_PARTNER_WALLS.map((w) => ({
    id: w.id,
    name: w.of > 1 ? `${w.tier} ${w.page} / ${w.of}` : w.tier,
    headline: tierHeadline(w.tier),
    featuredCount: 0,
    logos: w.logos,
  })),
];

/**
 * A project folder: the sets that belong to one piece of work, grouped so the
 * sidebar answers "which projects do we have logos for" before it answers
 * "which wall do I fill". A flat list of eight fill buttons answered neither —
 * `Community 2 / 3` next to `LS x DT Exhibiting` reads like eight unrelated
 * things, and nothing told you WHICH logos a set holds without filling a wall
 * to find out. The folders name the project; each set inside opens to its
 * roster.
 */
export interface PartnerProject {
  id: string;
  /** Folder name — the project, not the wall. */
  name: string;
  /** One line under the name: what the project is. */
  note: string;
  sets: PartnerSet[];
}

/** Every set is filed under exactly one project; the test asserts none is
 *  orphaned, so adding a set to PARTNER_SETS and forgetting the folder fails
 *  the suite rather than hiding the set from the sidebar. */
const setById = (id: string): PartnerSet => {
  const found = PARTNER_SETS.find((s) => s.id === id);
  if (!found) throw new Error(`partnerSets: no set with id "${id}"`);
  return found;
};

/** Unique logos across a project — the sets overlap on purpose (Participating
 *  contains every Exhibiting logo), so summing the sets would double-count. */
export const projectLogoCount = (project: PartnerProject): number =>
  new Set(project.sets.flatMap((s) => s.logos.map((l) => l.src))).size;

export const PARTNER_PROJECTS: PartnerProject[] = [
  {
    id: "life-science-deep-tech",
    name: "Life Science x Deep Tech 2026",
    note: "Track partners, plus the startups in the area",
    sets: [
      setById("life-science"),
      setById("ls-dt-exhibitors"),
      setById("ls-pitch-finalists"),
      setById("dt-pitch-finalists"),
      setById("ls-dt-participants"),
    ],
  },
  {
    id: "investor",
    name: "Investor Partners 2026",
    note: "Main partners lead, support partners fill the grid",
    sets: [setById("investor")],
  },
  {
    id: "all-partners",
    name: "All Partners 2026",
    note: `${ALL_PARTNERS_FLAT.length} partners across ${ALL_PARTNER_TIERS.length} tiers, highest value first`,
    sets: [setById("all-partners-one"), ...ALL_PARTNER_WALLS.map((w) => setById(w.id))],
  },
  {
    id: "community",
    name: "Community Partners 2026",
    note: `${COMMUNITY_PARTNERS.length} partners across ${COMMUNITY_PAGES.length} walls of ${COMMUNITY_PER_WALL}`,
    sets: COMMUNITY_PAGES.map((_, i) => setById(`community-${i + 1}`)),
  },
];
