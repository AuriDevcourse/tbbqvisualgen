// `npm run logos:tiers` — DRY RUN. `npm run logos:tiers -- --write` imports.
//
// Builds the All Partners rosters from Airtable's website partner list
// (Marketing Project Overview, view "Partner Deliverables 2026") — the same
// list techbbq.dk's partner page is built from. One row per partner, carrying
// the company name, its `Partnership Type 2026` tier and its logo attachment.
//
// The two questions this answers, per partner:
//   1. do we already hold this logo?  matched by NAME first, then by ARTWORK
//      (silhouette + ink, same 0.12 threshold logos:import uses) — a partner
//      filed under a different name must not be imported a second time.
//   2. is the artwork usable on a dark wall?  the walls need WHITE knockout
//      art, and partners supply their brand files. New SVGs are rewritten to
//      white ink on import (same rule as src/lib/svgTint.ts: every fill,
//      stroke and gradient stop becomes #FFFFFF, `none` is left alone).
//      Rasters cannot be recoloured, so a coloured PNG is REPORTED, never
//      imported — it needs a vector from the partner or a run of logos:svgify.
//
// Downloads land in gitignored `.logos-tiers/`. With `--write` the new white
// SVGs are copied into `public/logos` and the tier roster is written to
// `partner-tiers-report.json`, which `scripts/gen-partner-tiers.mjs` turns into
// the arrays in src/data/partnerSets.ts. Nothing else is ever overwritten: a
// file we already hold is reused as-is.
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, copyFileSync } from "node:fs";
import { join, extname } from "node:path";
import sharp from "sharp";
import { fetchTo, signature, compare } from "./lib/logo-web.mjs";

const WRITE = process.argv.includes("--write");
const OUT = ".logos-tiers";
const LOGO_DIR = "public/logos";
// ── ONE ARTWORK SOURCE: WHATEVER techbbq.dk SERVES ─────────────────────────
// Every partner's logo is downloaded from the same Airtable attachment the live
// wall renders, and lands here. The folder becomes a library tag ("partners
// 2026") through logos:manifest, so these sit beside the hand-curated library
// rather than fighting it for filenames.
//
// This replaced a name-and-artwork match against the library, and the reason is
// that the match kept being WRONG in ways nobody could see without opening two
// files side by side (Auri, 2026-08-19: "make sure that all of them are the same
// logos as in this whole tier list"). Of 221 partners it agreed with the live
// wall on 196 and diverged on 25 — Southern Sweden served the delegation strip
// while the library held the SOUTHERN SWEDEN logotype, DanBAN served a wordmark
// against a badge, and six partners had the SAME FILENAME on both sides holding
// different artwork, which no name rule can ever catch.
//
// So there is no matching step any more. The wall shows what techbbq.dk shows,
// and a partner replacing their logo in Airtable reaches this wall on the next
// sync. The library remains the FALLBACK, for a row whose cell holds nothing
// drawable.
const PARTNER_DIR = join(LOGO_DIR, "Partners 2026");
/** The library `src` for a file in PARTNER_DIR. Each path segment is encoded on
 *  its own, exactly as logos:manifest builds it — encoding the whole path would
 *  turn the separator into %2F and the image would 404. */
const partnerSrc = (label) => `/logos/${encodeURIComponent("Partners 2026")}/${encodeURIComponent(label)}`;
// The one logo that exists nowhere in Airtable: Erhvervshus Sjælland's tile is
// the EU co-funding frieze (Closing Loops + Co-funded by the European Union +
// Danish Board of Business Development), composed by hand and served from the
// airtable repo's own public folder. Mirrored here so this wall matches that one.
const SITE_LOGO_DIR = "C:/Users/User/Desktop/GITHUB/airtable/public/partner-logos";
const LOGO_FILE_OVERRIDES = {
  "Erhvervshus Sjælland": "Erhvervshus-frieze.png",
};

// ── lib/logoPick.ts, ported ────────────────────────────────────────────────
// Which attachment to use when a cell holds several. Scored on what the file IS
// rather than where it sits in the list: "first" served the colour original and
// "last" served the black twin. Kept in step with the reference file — if that
// scoring changes, this wall silently disagrees with techbbq.dk until it follows.
const WEB_IMAGE = /^image\/(png|jpeg|jpg|gif|webp|svg\+xml)$/i;
// The wall is near-black, so only a white SVG or a white PNG can go on it.
const PUBLISHABLE_LOGO = /^image\/(svg\+xml|png)$/i;
const WHITE_HINT = /(^|[^a-z])(white|bianco|blanco|blanc|weiss|hvid|negative|inverted|knockout)([^a-z]|$)/i;
const DARK_HINT = /(^|[^a-z])(black|nero|noir|negro|schwarz|sort|dark)([^a-z]|$)/i;
// Weaker than the colour words on purpose: it only breaks a tie between two files
// that look identical to the scorer.
const PRINT_HINT = /(^|[^a-z])(high[\s_-]?res|hi[\s_-]?res|print|cmyk|original)([^a-z]|$)/i;
// Files that win on their name and lose on their content, keyed on the filename
// exactly as lib/logoPick.ts keys them.
const DEMOTED_ATTACHMENTS = new Set(["white-Microsoft White.svg", "Virksomhedsguiden_Logo.svg"]);
const attScore = (a) => {
  const n = a.filename ?? "";
  if (DEMOTED_ATTACHMENTS.has(n)) return -100;
  let s = 0;
  if (/svg/i.test(a.type ?? "")) s += 5;
  if (WHITE_HINT.test(n)) s += 4;
  if (DARK_HINT.test(n)) s -= 4;
  if (PRINT_HINT.test(n)) s -= 2;
  return s;
};
/** Every drawable attachment, best first. Ties keep upload order so the choice
 *  is stable run to run. Returns a LIST, not one file: the download walks it,
 *  because the best-scoring file is sometimes a sheet export on an opaque plate
 *  and the next one is clean (SHE/THEY Club). */
const rankAttachments = (v) => (Array.isArray(v) ? v : [])
  .filter((a) => WEB_IMAGE.test(a?.type ?? "") && PUBLISHABLE_LOGO.test(a?.type ?? ""))
  .map((a, i) => ({ a, i, s: attScore(a) }))
  .sort((x, y) => (y.s - x.s) || (x.i - y.i))
  .map((x) => x.a);
const SAME_LOGO = 0.12; // silhouette distance under this = we already hold it
// The in-tier duplicate check needs a MUCH tighter bar than SAME_LOGO. That one
// asks "do we already hold this mark somewhere", where a near miss costs a
// redundant import. This one DROPS A PARTNER off the wall, and two unrelated
// wordmarks of similar length score close on silhouette alone — at 0.12 the
// check could quietly delete a real partner, which is worse than the duplicate
// it set out to prevent. ProWoc's two files, the case it exists for, measure
// 0.000: the same file exported twice. So the bar is "effectively identical".
const SAME_MARK_IN_TIER = 0.02;

const BASE = "appgXNjXJqpk9Ebxd";
const TABLE = "tblTecOBecLQCNIeD";
const VIEW = "viw7FVbsTb9IRaWF0";
const ENV = "C:/Users/User/Desktop/GITHUB/airtable/.env.local";

// ── THE TIER COMES FROM THE DEAL, AND techbbq.dk IS THE REFERENCE ──────────
// Ported from `Desktop/GITHUB/airtable` → `lib/partners.ts` on 2026-08-19 on
// Auri's instruction ("follow the logic in here, this is the correct tiers").
// That file feeds the live wall on techbbq.dk, so it is the source of truth for
// which band a partner belongs to, and this roster now agrees with it row for
// row. Read its header before changing anything here.
//
// The rule in one line: `Partnership Tier (from Tier)` decides, an exception can
// override it, and a no-contract fallback fills a gap. What this script used to
// do — read `Partnership Type 2026` — is exactly what that file stopped doing on
// 2026-08-05, and it had 58 of 217 partners in the wrong band, Nordea and Danish
// Life Science Cluster included, both sitting in Prime.
//
// The lookup derives from `Deal 2026` through a formula on Partners 2026, so the
// PRICE places the partner. Do not reintroduce a corrections table beside it.

/** Tier order, highest commitment first — the eight bands the live wall draws.
 *
 *  Investor, Tailored, Academic and Other are deliberately NOT here. They were
 *  values of `Partnership Type 2026`, and once the deal price places everyone
 *  those groups stop existing: an "Investor" partner has a deal, so it has a
 *  band. Auri removed them from techbbq.dk on 2026-08-05 for that reason.
 *
 *  `cols` is Auri's spec from the same file, and it is a RANKING device rather
 *  than a layout convenience: fewer columns means a bigger logo, so a Prime
 *  partner reads larger than a Community one. It replaces the sqrt(3n) guess
 *  this script used to make, which is also what kept the ladder monotonic by
 *  accident rather than by design. */
export const PARTNER_TIERS = [
  { name: "Prime", cols: 4 },
  { name: "Main", cols: 4 },
  { name: "Conqueror", cols: 4 },
  { name: "Pioneer", cols: 5 },
  { name: "Core", cols: 5 },
  { name: "Challenger", cols: 5 },
  { name: "International", cols: 5 },
  { name: "Community", cols: 6 },
];
export const TIER_ORDER = PARTNER_TIERS.map((t) => t.name);
const TIER_NAMES = new Set(TIER_ORDER);

/** Partners where the formula has NOTHING to work from: no contract, so no
 *  `Deal 2026`, so no tier, ever. Fills a MISSING tier and never replaces a
 *  resolved one. If a deal appears later the deal wins and the entry is dead
 *  weight — delete it then. */
const NO_CONTRACT_TIERS = {
  "crescita partners": "Community",
};

/** Tier exceptions, and they are NOT a corrections table. Each REPLACES a tier
 *  the formula did produce, which is the stronger claim, so the bar is: **the
 *  deal cannot express the tier**, not someone disagrees with it. Every one of
 *  these funds TechBBQ in a column the deal-size formula cannot read.
 *
 *    Skytek Nordics ApS  Core     · `Deal 2026` is 0 on all three records
 *    Industriens Fond    Prime    · funds by GRANT, never lands in `Deal 2026`
 *    Erhvervsfremmebest. Prime    · same, the Danish Board of Business Development
 *    Humandone           Challenger · built the website, never invoiced
 *    Jyske Bank Growth   Pioneer  · priced at 157,500 (Core), but two human-set
 *                                   CRM columns both say Pioneer
 *
 *  Keyed on the deliverables `Company` value, lowercased and space-collapsed, so
 *  a rename in Airtable silently stops matching. Erhvervsfremmebestyrelsen is
 *  the dangerous one: it has no deal tier to fall back to, so a rename to the
 *  English "Danish Board of Business Development" drops it off the wall.
 *  Not to be confused with Erhvervsstyrelsen (Danish Business Authority), which
 *  is a commercial partner whose deal computes to Core on its own. */
const TIER_EXCEPTIONS = {
  "skytek nordics aps": "Core",
  "industriens fond": "Prime",
  "erhvervsfremmebestyrelsen": "Prime",
  humandone: "Challenger",
  "jyske bank growth": "Pioneer",
};

/** Partners held back until a date. Repodo is not public until 26 August
 *  (Auri, 2026-08-04). Read from the clock on every run, never captured once. */
const HIDDEN_UNTIL = {
  repodo: "2026-08-25T22:00:00Z", // 26 August 2026, 00:00 Copenhagen (CEST)
};

/** This data is full of trailing spaces ("Boardway ", "Cloudflare
"), so every
 *  table above is keyed through here rather than on the raw cell. */
const nameKey = (company) => String(company ?? "").toLowerCase().replace(/\s+/g, " ").trim();

const hiddenUntilDate = (company, now = Date.now()) => {
  const until = HIDDEN_UNTIL[nameKey(company)];
  return until && now < Date.parse(until) ? until : null;
};

/** A lookup field always arrives as an ARRAY, because a link can point at
 *  several records. One partner, one tier, so the first value wins; a row linked
 *  to two tier records is a data error to fix in Airtable. */
const tierOf = (v) => {
  const raw = Array.isArray(v) ? v[0] : v;
  const t = String(raw ?? "").trim();
  if (!t) return "";
  if (t === "Core Plus") return "Core";
  return t;
};

// ── THE `Exceptions` COLUMN BEATS EVERY OTHER TIER SOURCE ──────────────────
// Ported from lib/partners.ts on 2026-08-19 (its commit ab142d7). The
// deliverables view has always carried a free-text `Exceptions` cell where the
// partnerships team writes "move this one", and neither wall read it — so
// Highbridge Law Firm and rebriQ rendered as Community while the instruction to
// put them in Challenger sat in the record.
//
// THE TEXT IS PROSE, NOT AN ENUM, and it stays prose. The four cells in the view
// are four phrasings of one instruction:
//
//   "Has to be Placed in Challenger"          Highbridge Law Firm
//   "we gotta put in in the Challenger tier"  rebriQ
//   "Has to be placed in Pioneer"             Jyske Bank Growth
//   "Has to be in Core"                       Skytek Nordics ApS
//
// So the cell is SCANNED for the name of a band rather than parsed: find every
// tier that appears in it as a whole word, and accept the answer only when
// exactly one does. Two names or none means a human has to read it — guessing
// there would put a partner in a band nobody chose.
//
// It runs AHEAD of TIER_EXCEPTIONS: a cell somebody typed in Airtable this
// morning should beat a constant written here last week, which also makes the
// Skytek and Jyske Bank Growth hardcodes redundant rather than contradictory.
// Those stay as a floor in case a cell is cleared.
function exceptionTier(raw) {
  const text = String(raw ?? "").trim();
  if (!text) return "";
  const haystack = text.toLowerCase();
  // Whole-word matching without building a regex: a `` inside a template
  // literal is one keystroke from being the BACKSPACE character, which matches
  // nothing and fails silently. Checking the neighbours cannot go wrong that
  // way, and it keeps "Community Core Partnership" (two bands) refusable.
  const isLetter = (ch) => !!ch && /[a-z]/.test(ch);
  const hits = TIER_ORDER.filter((name) => {
    const needle = name.toLowerCase();
    for (let i = haystack.indexOf(needle); i >= 0; i = haystack.indexOf(needle, i + 1)) {
      if (!isLetter(haystack[i - 1]) && !isLetter(haystack[i + needle.length])) return true;
    }
    return false;
  });
  if (hits.length === 1) return hits[0];
  if (hits.length) console.log(`  note: Exceptions cell "${text}" names ${hits.length} tiers (${hits.join(", ")}) — ignored, someone has to pick one`);
  else console.log(`  note: Exceptions cell "${text}" names no tier on the wall — ignored`);
  return "";
}

/** The band for one row, in the order lib/partners.ts uses it: the typed cell,
 *  then the hardcoded exception, then the deal-derived lookup, then the
 *  no-contract floor. An empty string means no band, and the caller drops the row
 *  rather than inventing one. */
function rowTier(fields) {
  const company = fields["Company"];
  const tier =
    exceptionTier(fields["Exceptions"]) ||
    TIER_EXCEPTIONS[nameKey(company)] ||
    tierOf(fields["Partnership Tier (from Tier)"]) ||
    NO_CONTRACT_TIERS[nameKey(company)] ||
    "";
  return TIER_NAMES.has(tier) ? tier : "";
}

// ── Airtable ───────────────────────────────────────────────────────────────
const env = Object.fromEntries(readFileSync(ENV, "utf8").split(/\r?\n/)
  .filter((l) => l.trim() && !l.startsWith("#") && l.includes("="))
  .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "")]));
const token = env.AIRTABLE_TOKEN || env.AIRTABLE_API_KEY;
if (!token) throw new Error(`no AIRTABLE_TOKEN in ${ENV}`);

const records = [];
let offset;
do {
  const u = new URL(`https://api.airtable.com/v0/${BASE}/${TABLE}`);
  u.searchParams.set("view", VIEW);
  u.searchParams.set("pageSize", "100");
  if (offset) u.searchParams.set("offset", offset);
  const res = await fetch(u, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`airtable ${res.status}: ${await res.text()}`);
  const page = await res.json();
  records.push(...page.records);
  offset = page.offset;
} while (offset);

// ── The library as it stands ────────────────────────────────────────────────
const LIBRARY = JSON.parse(readFileSync("src/data/logoLibrary.json", "utf8"));
const fileOf = (src) => join(LOGO_DIR, decodeURIComponent(src.replace(/^\/logos\//, "")));
/** Squash a company name to a comparison key: case, punctuation, legal
 *  suffixes and country words all vary between Airtable and the library. */
const key = (s) => (s ?? "").toLowerCase()
  .replace(/[^a-z0-9]+/g, " ")
  .replace(/\b(aps|a s|ab|oy|as|srl|s r l|sia|psa|ltd|inc|gmbh|bv|ou|plc|llc)\b/g, "")
  .replace(/[^a-z0-9]/g, "");
/** Library files that could BE this company: the same squashed name, or the
 *  same name plus a variant word (`Novo Nordisk Foundation Horizontal`,
 *  `Antler White`). The variant list is closed on purpose — a bare `startsWith`
 *  would hand "Clean" the file for "Clean Cluster". */
const VARIANT = /^(white|horizontal|vertical|colour|color|primary|logo|logotype|mark|wordmark|inverted|inv|neg|negative|pos|positive|stacked|black|dark|light|full|main|alt|new|rgb|cmyk|onwhite|ondark|small|large|[0-9])+$/;
const nameCandidates = (company) => {
  const k = key(company);
  if (!k) return [];
  return LIBRARY.filter((l) => {
    const lk = key(l.name);
    if (lk === k) return true;
    if (k.length >= 8 && lk.startsWith(k)) return VARIANT.test(lk.slice(k.length));
    return false;
  });
};

// Signature every library logo once, so an incoming file can be matched on
// artwork when its name doesn't match anything. Unreadable files just can't be
// matched against — that risks a duplicate import, never a wrong skip.
const signed = [];
for (const l of LIBRARY) {
  const sig = await signature(fileOf(l.src)).catch(() => null);
  if (sig) signed.push({ logo: l, sig });
}

// ── White-ink rewrite, the on-disk twin of src/lib/svgTint.ts ───────────────
const KEEP = /^(none|transparent|inherit|currentcolor|url\(.*)$/i;
const WHITE = "#FFFFFF";
function whiten(svg) {
  let out = svg
    // Presentation attributes: fill="#123456" / stroke='rgb(1,2,3)'
    .replace(/(\b(?:fill|stroke|stop-color|flood-color|lighting-color)\s*=\s*)(["'])(.*?)\2/gi,
      (m, head, q, val) => (KEEP.test(val.trim()) ? m : `${head}${q}${WHITE}${q}`))
    // Style declarations: fill:#123456; stroke: rgb(...)
    .replace(/(\b(?:fill|stroke|stop-color|flood-color|lighting-color)\s*:\s*)([^;"'}\)]+)/gi,
      (m, head, val) => (KEEP.test(val.trim()) ? m : `${head}${WHITE}`));
  // Shapes that declare no colour default to BLACK, so the root has to say white.
  if (!/<svg[^>]*\sfill\s*=/i.test(out)) out = out.replace(/<svg\b/i, `<svg fill="${WHITE}"`);
  return out;
}
/** True when an SVG still carries a saturated colour — the same check
 *  partnerSets.test.ts runs on every wall logo. */
const CHANNEL_SPREAD = 24;
function hasColour(svg) {
  for (const [, hex] of svg.matchAll(/(?:fill|stroke|stop-color)\s*[:=]\s*["']?(#[0-9a-fA-F]{6})/g)) {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    if (Math.max(r, g, b) - Math.min(r, g, b) > CHANNEL_SPREAD) return true;
  }
  return false;
}
/** An SVG exported as a SHEET carries an opaque full-canvas rectangle behind the
 *  mark. Either way it renders as a box on the wall, not a logo, so these are
 *  reported rather than imported. (SHE/THEY Club, 2026-08-17.)
 *
 *  A cheap PRE-FILTER, not the verdict. It only says "there is a full-size filled
 *  rect in here", which is true of plenty of files that draw nothing of the kind:
 *  `white-Business Iceland.svg` carries three of them as ANIMATED MASKS
 *  (`class="absolute will-change-transform"`, `animation-name:mask-over-…`) and
 *  renders as clean white artwork. Trusting this regex alone rejected that file
 *  and sent the walk on to `business-iceland-nott-1.svg`, which is dark grey and
 *  all but invisible on #0d0d0d — a worse logo than the one it refused, and one
 *  techbbq.dk serves correctly (Auri, 2026-08-19). */
const mightHavePlate = (svg) =>
  /<rect[^>]*\swidth\s*=\s*["'](?:100%|[1-9]\d{2,})["'][^>]*\sheight\s*=\s*["'](?:100%|[1-9]\d{2,})["'][^>]*\sfill\s*=\s*["']#/i.test(svg);

/** The verdict: RASTERISE it and look. A background plate paints every corner
 *  opaque, so if all four corners and the edge midpoints come back solid, the file
 *  is a box. Masks, clip paths and animated rects never survive to the corners,
 *  which is exactly what the regex cannot know. */
async function rendersAsPlate(file) {
  const N = 64;
  const { data, info } = await sharp(file, { density: 200 })
    .resize(N, N, { fit: "fill", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const at = (x, y) => data[(y * info.width + x) * info.channels + 3];
  const e = 2, m = Math.floor(N / 2), z = N - 1 - e;
  const probes = [[e, e], [z, e], [e, z], [z, z], [m, e], [m, z], [e, m], [z, m]];
  return probes.every(([x, y]) => at(x, y) >= 250);
}

/** Both halves: skip the rasterise for the overwhelming majority of files that
 *  carry no suspicious rect at all. */
const hasBackgroundPlate = async (svg, file) =>
  mightHavePlate(svg) && await rendersAsPlate(file).catch(() => false);
/** An SVG that just wraps a PNG. The white rewrite cannot touch the pixels, so
 *  the import only works when the raster is already a knockout — worth saying
 *  out loud rather than discovering on a published wall. */
const wrapsRaster = (svg) => /<image[^>]*(?:xlink:)?href\s*=\s*["']data:image\/(?:png|jpe?g|webp)/i.test(svg);

/** Mean saturation of the visible pixels, 0 for a pure knockout. Rasterised, so
 *  it answers for a PNG what hasColour() answers for an SVG's source.
 *
 *  This exists because "light" is not the same question as "white". Industriens
 *  Fond sat on the Prime wall in green: the library's only file for it was
 *  "Industriens Fond Colour.png", which measures luminance 198 — light — and
 *  saturation 0.61. The tone check passed it, hasColour() skipped it for not
 *  being an SVG, and it shipped as the loudest thing on a #0d0d0d wall
 *  (Auri, 2026-08-19). Airtable held a pure white SVG all along. */
async function rasterSaturation(file) {
  const { data } = await sharp(file, { density: 200 }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let n = 0, sat = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue; // transparent pixels are not ink
    const mx = Math.max(data[i], data[i + 1], data[i + 2]);
    const mn = Math.min(data[i], data[i + 1], data[i + 2]);
    sat += mx ? (mx - mn) / mx : 0;
    n++;
  }
  return n ? sat / n : 0;
}
/** Mean luminance of the visible pixels. The manifest measures this for library
 *  files and stores it as `tone`; this answers the same question for a file that
 *  was downloaded seconds ago and is not in the manifest yet. */
async function meanLuminance(file) {
  const { data } = await sharp(file, { density: 200 }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let n = 0, lum = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    lum += data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    n++;
  }
  return n ? lum / n : 0;
}
// Bright enough to read on #0d0d0d. A pure knockout measures 255; the three
// part-coloured brand marks the live wall ships sit in the 175-240 band, so the
// bar admits them and still catches a genuinely dark file.
const LIGHT_LUMINANCE_MIN = 140;

// A knockout export lands at 0.00; anti-aliasing and a stray brand accent can lift
// it a little, so the bar sits above pure white without admitting a colour logo.
// Industriens Fond's green measured 0.61.
const RASTER_SATURATION_MAX = 0.08;

/** Measured once per raster in the library, since rasterising on every lookup
 *  would rerun it for each of the 228 rows. */
const rasterSat = new Map();
for (const l of LIBRARY) {
  const file = fileOf(l.src);
  if (file.toLowerCase().endsWith(".svg") || !existsSync(file)) continue;
  rasterSat.set(l.src, await rasterSaturation(file).catch(() => 0));
}

/** A library file is wall-ready when it measures light AND carries no saturated
 *  colour — the two things partnerSets.test.ts asserts for every wall logo. A
 *  dark PNG is invisible on the canvas; a coloured SVG is off-brand on it, and
 *  so is a coloured PNG, which is what this used to wave through. */
const wallReady = (logo) => {
  if (logo.tone !== "light") return false;
  const file = fileOf(logo.src);
  if (!file.toLowerCase().endsWith(".svg")) {
    return (rasterSat.get(logo.src) ?? 1) <= RASTER_SATURATION_MAX;
  }
  return existsSync(file) ? !hasColour(readFileSync(file, "utf8")) : false;
};
/** Of several candidates for one company, take a wall-ready one — vector first,
 *  since a vector can be recoloured later and scales on a big wall. */
/** Library files that win their name match and are still the WRONG MARK, so a
 *  later candidate for the same company gets the wall instead.
 *
 *  Novo Nordisk Foundation is the case this exists for (Auri, 2026-08-19: "Novo
 *  nordisk has different logo"). Six files match that name and this picked the
 *  first SVG alphabetically, "Novo Nordisk Foundation 2.svg" — the stacked
 *  wordmark with no mark on it. techbbq.dk serves the ring plus the horizontal
 *  wordmark, and the library already HOLDS that artwork as "Novo Nordisk
 *  Foundation Horizontal.svg". Nothing needed importing; the tie-break just had
 *  to stop choosing on sort order.
 *
 *  Keyed on the FILENAME, the same way lib/logoPick.ts keys DEMOTED_FILES, and
 *  for the same reason: a filename is what every caller has in common, and a
 *  demoted file harmlessly matches nothing once it is deleted from the library. */
const DEMOTED_FILES = new Set(["Novo Nordisk Foundation 2.svg"]);

const bestOf = (candidates) => {
  const ready = candidates
    .filter(wallReady)
    .filter((l) => !DEMOTED_FILES.has(decodeURIComponent(l.src.replace(/^\/logos\//, ""))));
  return ready.find((l) => l.src.toLowerCase().endsWith(".svg")) ?? ready[0] ?? null;
};

/** Filenames are display names in this library, so they keep the company's own
 *  spelling — only the characters a path cannot hold are replaced. */
const safeName = (s) => s.trim().replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, " ").replace(/\.+$/, "");

// ── Walk the roster ────────────────────────────────────────────────────────
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
if (WRITE) mkdirSync(PARTNER_DIR, { recursive: true });

const held = [], imported = [], skipped = [], problems = [];
// Labels already written this run. A handful of companies sit in the view TWICE
// (Radia Network, Copenhagen School of Entrepreneurship, NORNORM, ProWoc,
// Kalvebod Fælled Skole) and both rows name their file after the company, so the
// second copy silently replaced the first. The roster keeps the FIRST row, the
// way the live wall's dedupe does, and the bytes have to belong to the row the
// roster kept — Radia's two rows hold DIFFERENT artwork ("Radia Network.svg"
// against a bare "Vector.svg"), so write order was quietly choosing the logo.
const written = new Set();

for (const r of records) {
  const company = (r.fields.Company ?? "").trim();
  const tier = rowTier(r.fields);
  const onWeb = r.fields["Put on web"] === true;
  const row = { company, tier, partnerId: r.fields["Partner ID"] ?? null };
  if (!company) { problems.push({ ...row, why: "row has no Company" }); continue; }
  // Not public yet. Checked before the tier and the artwork so an embargoed
  // partner cannot leak through either.
  const embargo = hiddenUntilDate(company);
  if (embargo) { skipped.push({ ...row, why: `held back until ${embargo}` }); continue; }
  if (!onWeb) { skipped.push({ ...row, why: "Put on web is off" }); continue; }
  // No band, no wall. Skipped rather than swept into a generic group: a partner
  // with no `Company Link`, or a linked partner with no `Deal 2026`, is a data
  // gap to fill in Airtable and this is the list that names it.
  if (!tier) { skipped.push({ ...row, why: "no partnership tier (no Company Link, or the linked partner has no Deal 2026)" }); continue; }

  // ── THE ARTWORK ─────────────────────────────────────────────────────────
  // One source, no matching: the attachment techbbq.dk renders, downloaded and
  // written into PARTNER_DIR under the company's own name. See the note there
  // for why the old name-and-artwork match against the library is gone.
  //
  // The file is stored AS IS. No white rewrite, because the point is parity: the
  // live wall serves these bytes and three of them are part-coloured by brand
  // (Adeo Web's orange bar, Creative Business Network's gem, French Tech
  // Copenhagen's red rooster). Whitening them here would make this wall disagree
  // with that one, which is the whole thing being fixed.
  const override = LOGO_FILE_OVERRIDES[company];
  if (override) {
    // Composed by hand, lives in the airtable repo, exists in no Airtable cell.
    const from = join(SITE_LOGO_DIR, override);
    const label = `${safeName(company)}${extname(override)}`;
    if (!existsSync(from)) { problems.push({ ...row, why: `site override ${override} is missing from ${SITE_LOGO_DIR}` }); continue; }
    if (WRITE) copyFileSync(from, join(PARTNER_DIR, label));
    // `staged` points at the airtable repo's own copy: it exists whether or not
    // this is a write, so the audit measures the real bytes either way.
    imported.push({ ...row, src: partnerSrc(label), how: "site override", wide: true, staged: from });
    continue;
  }

  const ranked = rankAttachments(r.fields.Logo);
  if (!ranked.length) {
    // Nothing drawable in the cell. The library is the fallback here, and only
    // here — a partner with artwork somewhere still beats an empty tile.
    const readyByName = bestOf(nameCandidates(company));
    if (readyByName) { held.push({ ...row, src: readyByName.src, how: "library fallback", tone: readyByName.tone }); continue; }
    const atts = r.fields.Logo ?? [];
    problems.push({ ...row, why: atts.length
      ? `no drawable attachment (${atts.map((a) => a.type ?? "unknown").join(", ")})`
      : "no logo attachment" });
    continue;
  }

  const stem = join(OUT, key(company) || `row-${r.id}`);
  const tmp = `${stem}.download`;

  // Walk the ranked cell. Only the PLATE check gets a retry: it is the one
  // rejection where another file in the same cell is routinely fine (SHE/THEY
  // Club ships a sheet export first and clean knockout art second). `plated`
  // remembers the first one seen so an all-plates cell still says so.
  let pick = null, ext = null, plated = null;
  for (const cand of ranked) {
    if (!(await fetchTo(cand.url, tmp))) continue;
    const head = readFileSync(tmp).subarray(0, 400).toString("latin1");
    const kind = /<svg/i.test(head) ? "svg" : head.startsWith("\x89PNG") ? "png" : head.startsWith("\xff\xd8") ? "jpg" : null;
    if (!kind) continue;
    if (kind === "svg" && await hasBackgroundPlate(readFileSync(tmp, "utf8"), tmp)) { plated ??= cand; continue; }
    pick = cand; ext = kind; break;
  }
  if (!pick) {
    problems.push({ ...row, why: plated
      ? "every SVG in the cell is a sheet export with an opaque background rectangle — needs a transparent cut"
      : `no attachment downloaded as a usable file (${ranked.map((a) => a.filename).join(", ")})` });
    continue;
  }

  const label = `${safeName(company)}.${ext}`;
  const staged = join(OUT, label);
  writeFileSync(staged, readFileSync(tmp));
  rmSync(tmp);

  const source = ext === "svg" ? readFileSync(staged, "utf8") : null;
  const entry = {
    ...row,
    src: partnerSrc(label),
    how: "site artwork",
    file: pick.filename,
    // Reported, not rejected. A wall of 217 logos where three carry brand colour
    // is what techbbq.dk ships; the audit below names them so the choice is
    // visible rather than discovered on a published image.
    coloured: source ? hasColour(source) : await rasterSaturation(staged).catch(() => 0) > RASTER_SATURATION_MAX,
    ...(source && wrapsRaster(source) ? { wrapsRaster: true } : {}),
    // Where the bytes are RIGHT NOW. On a dry run PARTNER_DIR holds nothing, so
    // the audit and the duplicate check below would have no file to measure and
    // would pass everything silently — a dry run has to see what a write would.
    staged,
  };
  if (WRITE && !written.has(label)) copyFileSync(staged, join(PARTNER_DIR, label));
  written.add(label);
  imported.push(entry);
}

// ── Audit the resolved roster ──────────────────────────────────────────────
// Two failures a name-and-artwork match cannot see, both of which ship a broken
// wall: artwork that is DARK or COLOURED (invisible, or off-brand, on the dark
// canvas — the same rule partnerSets.test.ts enforces), and the SAME file
// resolved for two partners in one tier (a wall with the logo twice).
const roster = [...held, ...imported];
const byTier = new Map(TIER_ORDER.map((t) => [t, []]));
for (const e of roster) byTier.get(e.tier).push(e);

/** The bytes behind a roster entry: the staged download for anything fetched
 *  this run, the library file for a fallback. Never `toneOf`, which only knows
 *  files the last logos:manifest saw — the freshly downloaded ones are not in it
 *  and every single row read back "tone: undefined". */
const bytesOf = (e) => (e.staged && existsSync(e.staged) ? e.staged : fileOf(e.src));

const toneOf = new Map(LIBRARY.map((l) => [l.src, l.tone]));
const notWhite = [];
for (const e of roster) {
  const file = bytesOf(e);
  if (!existsSync(file)) { notWhite.push({ ...e, why: "file is missing" }); continue; }
  // Measured, not looked up. A downloaded file has no manifest entry yet, and
  // "is it light" is the question that keeps a logo off a near-black wall.
  const lum = await meanLuminance(file).catch(() => null);
  const tone = lum === null ? toneOf.get(e.src) : lum >= LIGHT_LUMINANCE_MIN ? "light" : "dark";
  const coloured = file.toLowerCase().endsWith(".svg")
    ? hasColour(readFileSync(file, "utf8"))
    : (await rasterSaturation(file).catch(() => 0)) > RASTER_SATURATION_MAX;
  if (tone !== "light" || coloured) {
    notWhite.push({ ...e, tone, coloured, why: coloured ? "saturated colour in the artwork" : `tone: ${tone}` });
  }
}

// The same MARK twice in one tier is a wall with the logo twice — a duplicate
// Airtable row, or two partners who supplied the same artwork. The second one is
// dropped from the roster and reported: which of them is wrong is a human call,
// but shipping the wall twice-logoed is never right.
//
// Compared on the ARTWORK, not just the path. Two rows can resolve to two
// DIFFERENT library files holding the same mark: ProWoc sits in this view twice,
// as "Professional Women of Colour Network (ProWoc)" and "ProWoc - Professional
// Women of Colour", and the library holds a file under each of those names.
// Same silhouette, two paths, so a path-only check kept both and the Community
// wall drew ProWoc twice. techbbq.dk never showed that because both of its rows
// point at one Airtable attachment; here the names diverge, so the pixels have
// to be what decides.
const dupes = [];
for (const t of TIER_ORDER) {
  const seen = new Map();
  const kept = [];
  for (const e of byTier.get(t)) {
    // The path first, since it is free and catches most of them, then the
    // silhouette for the two-files-one-mark case.
    let hit = seen.get(e.src) ?? null;
    if (!hit) {
      const sig = await signature(bytesOf(e)).catch(() => null);
      if (sig) {
        for (const other of kept) {
          if (!other.sig) continue;
          const { shape } = compare(sig, other.sig);
          if (shape <= SAME_MARK_IN_TIER) { hit = other; break; }
        }
      }
      e.sig = sig;
    }
    if (hit) { dupes.push({ tier: t, src: e.src, kept: hit.company, dropped: e.company }); continue; }
    seen.set(e.src, e);
    kept.push(e);
  }
  // `sig` is a working value, never part of the report.
  byTier.set(t, kept.map(({ sig, ...rest }) => rest));
}

console.log(`${records.length} rows in the view · library ${LIBRARY.length} logos\n`);
console.log(`already held : ${held.length}`);
console.log(`${WRITE ? "imported    " : "would import"} : ${imported.length}`);
console.log(`problems     : ${problems.length}`);
console.log(`not on web   : ${skipped.length}\n`);
console.log("tier              logos");
for (const t of TIER_ORDER) console.log(`  ${t.padEnd(16)}${String(byTier.get(t).length).padStart(4)}`);

if (problems.length) {
  console.log("\nPROBLEMS — each needs a human:");
  for (const p of problems) console.log(`  ${p.tier.padEnd(14)} ${p.company} — ${p.why}`);
}

if (notWhite.length) {
  console.log(`\nNOT WHITE KNOCKOUT (${notWhite.length}) — these cannot go on a dark wall as they are:`);
  for (const e of notWhite) console.log(`  ${e.tier.padEnd(14)} ${e.company} → ${decodeURIComponent(e.src)} — ${e.why}`);
}

if (dupes.length) {
  console.log(`\nSAME FILE TWICE IN ONE TIER (${dupes.length}):`);
  for (const d of dupes) console.log(`  ${d.tier.padEnd(14)} ${decodeURIComponent(d.src)} — kept ${d.kept}, dropped ${d.dropped}`);
}

const rasterWrapped = imported.filter((e) => e.wrapsRaster);
if (rasterWrapped.length) {
  console.log(`\nSVG WRAPPING A RASTER (${rasterWrapped.length}) — imported, but the pixels could not be recoloured:`);
  for (const e of rasterWrapped) console.log(`  ${e.tier.padEnd(14)} ${e.company}`);
}

// Every artwork match, so the resolution can be reviewed rather than trusted:
// a wrong match puts another company's logo on the wall.
const matched = held.filter((h) => h.how.startsWith("artwork"));
console.log(`\nARTWORK MATCHES (${matched.length}) — name differs, silhouette agrees:`);
for (const m of [...matched].sort((a, b) => b.how.localeCompare(a.how))) console.log(`  ${m.company} → ${decodeURIComponent(m.src)}`);

writeFileSync("partner-tiers-report.json", JSON.stringify({
  fetchedRows: records.length,
  write: WRITE,
  tiers: TIER_ORDER.map((t) => ({ tier: t, logos: byTier.get(t) })),
  problems, skipped, notWhite, dupes,
}, null, 1));
console.log(`\nreport -> partner-tiers-report.json${WRITE ? "" : "  (dry run — nothing written to public/logos)"}`);
