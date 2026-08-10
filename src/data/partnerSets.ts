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
  { label: "Women in Data Science, AI and ML", src: "/logos/Womenindatascience.svg" },
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
 * Pulled from the **Life Science Project** table in Airtable
 * (`appgXNjXJqpk9Ebxd` / `tblvukXfmR7KTFymG`) on 2026-08-10, and the filter is
 * worth writing down because the obvious one is wrong: the roster is
 * `status = "Confirmed startup"` AND `Stakeholder type = "Exhibiting Startup"`,
 * read across the WHOLE table. The "Startup Library 2026" view shows only 17 of
 * them, and the `Confirmation` field is a shortlisting flag, not attendance —
 * it says "Selected" for companies still marked "To be contacted", and even for
 * two that declined.
 *
 * That filter returns **46**, which is the number Auri was given. Three of the
 * 46 are tagged `LS Type: Intersection` rather than one of the three tracks
 * (BIOADVIO, Molecular Quantum Solutions, Peak Emulsions) and were dropped on
 * his call, leaving 43.
 *
 * **This set is 31, not 43.** Twelve of the 43 have no SVG in the library at
 * all, and a wall entry with no artwork renders an empty outlined box. Missing
 * as of 2026-08-10: AlterEcho, ArcanaBio, BÆTA Carbon Solutions, Fepod, H+H
 * LABS, Mirno, Nordstar Medical, OvartiX, Seaqure labs, Tergy Sagava,
 * VentriLabs, Volta Greentech. Drop a white SVG for any of them into
 * `public/logos`, run `npm run logos`, and add the line here.
 *
 * Labels drop the legal suffix — no thank-you wall says "ApS".
 */
export const LS_DT_EXHIBITORS: PartnerSetEntry[] = [
  { label: "Blue2", src: "/logos/Blue2%20White.svg" },
  { label: "Completion", src: "/logos/Completion.svg" },
  { label: "Drylabz", src: "/logos/Drylabz.svg" },
  { label: "GreenCow Biosolutions", src: "/logos/Life%20Science%20Pitch%20Finalists%202026/greenCow%20BioSolutions.svg" },
  { label: "Hemispherian", src: "/logos/Hemispherian.svg" },
  { label: "Hydram Research", src: "/logos/Hydram.svg" },
  { label: "Immunordic", src: "/logos/Life%20Science%20Pitch%20Finalists%202026/Immunordic.svg" },
  { label: "Lucero", src: "/logos/Lucero.svg" },
  { label: "MagCath", src: "/logos/MagCath%20White.svg" },
  { label: "Magnolia Quantum Sensing", src: "/logos/Deep%20Tech%20Pitch%20Finalists%202026/Magnolia%20Quantum%20Sensing.svg" },
  { label: "Mimbly", src: "/logos/Mimbly.svg" },
  { label: "NeoCare Nordic", src: "/logos/NeoCare%20Nordic.svg" },
  { label: "Nordiq Products", src: "/logos/Nordiq.svg" },
  { label: "Nyctea Technologies", src: "/logos/Nyctea.svg" },
  { label: "Ownwell", src: "/logos/Ownwell%20White.svg" },
  { label: "Paindrainer", src: "/logos/Paindrainer%20White.svg" },
  { label: "PERPLANT", src: "/logos/Perplant.svg" },
  { label: "Previto", src: "/logos/Previto%20White.svg" },
  { label: "Rilemo", src: "/logos/Deep%20Tech%20Pitch%20Finalists%202026/Rilemo.svg" },
  { label: "Sea Growth", src: "/logos/Sea%20Growth.svg" },
  { label: "SmartSens", src: "/logos/SmartSens%20White.svg" },
  { label: "Sorbus Biomedical", src: "/logos/Sorbus%20Biomedical%20White.svg" },
  { label: "Sveppa", src: "/logos/Sveppa.svg" },
  { label: "Sylvia Health", src: "/logos/Sylvia%20Health.svg" },
  { label: "Uman Sense", src: "/logos/Uman%20Sense.svg" },
  { label: "UVision", src: "/logos/Uvision.svg" },
  { label: "Vetbac", src: "/logos/Vetbac%20White.svg" },
  { label: "Visibuilt", src: "/logos/Visibuilt.svg" },
  { label: "Walther Therapeutics", src: "/logos/Walther%20Therapeutics%20White.svg" },
  { label: "Yngvi Bio", src: "/logos/Yngvi%20Bio.svg" },
  { label: "Yoke Bio", src: "/logos/Yoke%20Bio%20White.svg" },
];

/**
 * The 16 pitch competition finalists — 8 from the Life Science Pitch
 * Competition, 8 from the Deep Tech Pitch Competition. Auri supplied all 16 as
 * white SVGs on 2026-08-10; they live in their own two folders under
 * `public/logos` so the pitch cohort stays findable as a group (a folder name
 * is a search tag, so typing "finalists" returns exactly these).
 *
 * Every one was checked with `npm run logos:tighten -- --check`: all 16 report
 * their artwork filling 100% of the viewBox, so none of them will render a
 * fraction of its neighbours' size the way the padded partner files did.
 *
 * Four of these companies ALSO exhibit, so the participating wall below
 * de-duplicates rather than showing them twice.
 */
export const LS_DT_PITCH_FINALISTS: PartnerSetEntry[] = [
  // ── Life Science Pitch Competition ──
  { label: "3sonic", src: "/logos/Life%20Science%20Pitch%20Finalists%202026/3sonic.svg" },
  { label: "AnalgesiaAI", src: "/logos/Life%20Science%20Pitch%20Finalists%202026/AnalgesiaAI.svg" },
  { label: "Bioelectrix", src: "/logos/Life%20Science%20Pitch%20Finalists%202026/Bioelectrix.svg" },
  { label: "Crossingbio", src: "/logos/Life%20Science%20Pitch%20Finalists%202026/Crossingbio.svg" },
  { label: "greenCow BioSolutions", src: "/logos/Life%20Science%20Pitch%20Finalists%202026/greenCow%20BioSolutions.svg" },
  { label: "Immunordic", src: "/logos/Life%20Science%20Pitch%20Finalists%202026/Immunordic.svg" },
  { label: "Monix", src: "/logos/Life%20Science%20Pitch%20Finalists%202026/Monix.svg" },
  { label: "Oasicare", src: "/logos/Life%20Science%20Pitch%20Finalists%202026/Oasicare.svg" },
  // ── Deep Tech Pitch Competition ──
  { label: "AnyoLabs", src: "/logos/Deep%20Tech%20Pitch%20Finalists%202026/AnyoLabs.svg" },
  { label: "DigeHealth", src: "/logos/Deep%20Tech%20Pitch%20Finalists%202026/DigeHealth.svg" },
  { label: "Epidetect Labs", src: "/logos/Deep%20Tech%20Pitch%20Finalists%202026/Epidetect%20Labs.svg" },
  { label: "Magnolia Quantum Sensing", src: "/logos/Deep%20Tech%20Pitch%20Finalists%202026/Magnolia%20Quantum%20Sensing.svg" },
  { label: "N23 health", src: "/logos/Deep%20Tech%20Pitch%20Finalists%202026/N23%20health.svg" },
  { label: "Rilemo", src: "/logos/Deep%20Tech%20Pitch%20Finalists%202026/Rilemo.svg" },
  { label: "Scientek", src: "/logos/Deep%20Tech%20Pitch%20Finalists%202026/Scientek.svg" },
  { label: "Videm", src: "/logos/Deep%20Tech%20Pitch%20Finalists%202026/Videm.svg" },
];

/**
 * "Thank you for participating" — the exhibitors and the pitch finalists on one
 * wall, which is what was asked for over splitting them across two slides.
 *
 * De-duplicated **by `src`**, not by label: four companies appear in both lists
 * and two of them are spelled differently between the two (`GreenCow
 * Biosolutions` vs `greenCow BioSolutions`, `Immunordic` in both, `Magnolia
 * Quantum Sensing`, `Rilemo`). Both lists already point at the same file for
 * those, so the file path is the reliable identity. 31 + 16 - 4 = 43.
 */
export const LS_DT_PARTICIPANTS: PartnerSetEntry[] = [
  ...LS_DT_EXHIBITORS,
  ...LS_DT_PITCH_FINALISTS.filter((f) => !LS_DT_EXHIBITORS.some((e) => e.src === f.src)),
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
    id: "ls-dt-exhibitors",
    name: "LS x DT Exhibiting",
    headline: "Thank you for exhibiting",
    featuredCount: 0,
    logos: LS_DT_EXHIBITORS,
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
    headline: "Thank you to our investor partners",
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
    headline: "Thank you to our community partners",
    // A community tier has no lead partners: one flat grid.
    featuredCount: 0,
    logos,
  })),
];
