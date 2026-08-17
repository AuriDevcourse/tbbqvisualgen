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
import { join } from "node:path";
import { fetchTo, signature, compare } from "./lib/logo-web.mjs";

const WRITE = process.argv.includes("--write");
const OUT = ".logos-tiers";
const LOGO_DIR = "public/logos";
const SAME_LOGO = 0.12; // silhouette distance under this = we already hold it

const BASE = "appgXNjXJqpk9Ebxd";
const TABLE = "tblTecOBecLQCNIeD";
const VIEW = "viw7FVbsTb9IRaWF0";
const ENV = "C:/Users/User/Desktop/GITHUB/airtable/.env.local";

/** Tier order is MONEY order, high to low — confirmed by Auri 2026-08-17.
 *  `Core Plus` folds into Core (one partner, a Core variant). The tiers below
 *  the seven named ones are separate deals rather than a rung on this ladder,
 *  so they sort after it in their own groups; `Other` is every row whose
 *  `Partnership Type 2026` is empty. */
export const TIER_ORDER = [
  "Prime", "Main", "Conqueror", "Pioneer", "Core", "Challenger", "Community",
  "Investor", "Tailored", "International", "Academic", "Other",
];
const tierOf = (raw) => {
  const t = (raw ?? "").trim();
  if (!t) return "Other";
  if (t === "Core Plus") return "Core";
  return TIER_ORDER.includes(t) ? t : "Other";
};

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
/** An SVG exported as a SHEET carries an opaque full-canvas rectangle behind
 *  the mark. Recolouring it to white gives a white plate, and leaving it gives a
 *  black one — either way it is a box on the wall, not a logo, so these are
 *  reported rather than imported. (SHE/THEY Club, 2026-08-17.) */
const hasBackgroundPlate = (svg) =>
  /<rect[^>]*\swidth\s*=\s*["'](?:100%|[1-9]\d{2,})["'][^>]*\sheight\s*=\s*["'](?:100%|[1-9]\d{2,})["'][^>]*\sfill\s*=\s*["']#/i.test(svg);
/** An SVG that just wraps a PNG. The white rewrite cannot touch the pixels, so
 *  the import only works when the raster is already a knockout — worth saying
 *  out loud rather than discovering on a published wall. */
const wrapsRaster = (svg) => /<image[^>]*(?:xlink:)?href\s*=\s*["']data:image\/(?:png|jpe?g|webp)/i.test(svg);

/** A library file is wall-ready when it measures light AND carries no saturated
 *  colour — the two things partnerSets.test.ts asserts for every wall logo. A
 *  dark PNG is invisible on the canvas; a coloured SVG is off-brand on it. */
const wallReady = (logo) => {
  if (logo.tone !== "light") return false;
  const file = fileOf(logo.src);
  if (!file.toLowerCase().endsWith(".svg")) return true; // a light raster is fine as-is
  return existsSync(file) ? !hasColour(readFileSync(file, "utf8")) : false;
};
/** Of several candidates for one company, take a wall-ready one — vector first,
 *  since a vector can be recoloured later and scales on a big wall. */
const bestOf = (candidates) => {
  const ready = candidates.filter(wallReady);
  return ready.find((l) => l.src.toLowerCase().endsWith(".svg")) ?? ready[0] ?? null;
};

/** Filenames are display names in this library, so they keep the company's own
 *  spelling — only the characters a path cannot hold are replaced. */
const safeName = (s) => s.trim().replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, " ").replace(/\.+$/, "");

// ── Walk the roster ────────────────────────────────────────────────────────
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const held = [], imported = [], skipped = [], problems = [];

for (const r of records) {
  const company = (r.fields.Company ?? "").trim();
  const tier = tierOf(r.fields["Partnership Type 2026"]);
  const onWeb = r.fields["Put on web"] === true;
  const row = { company, tier, partnerId: r.fields["Partner ID"] ?? null };
  if (!company) { problems.push({ ...row, why: "row has no Company" }); continue; }
  if (!onWeb) { skipped.push({ ...row, why: "Put on web is off" }); continue; }

  // Already in the library under a matching name, in wall-ready artwork? Reuse
  // it untouched. A dark or coloured hit does NOT count: we would rather whiten
  // the vector Airtable holds than ship an invisible logo.
  const named = nameCandidates(company);
  const readyByName = bestOf(named);
  if (readyByName) { held.push({ ...row, src: readyByName.src, how: "name match", tone: readyByName.tone }); continue; }
  row.heldNotWallReady = named.map((l) => l.src);

  const atts = r.fields.Logo ?? [];
  if (!atts.length) { problems.push({ ...row, why: "no logo attachment" }); continue; }
  // Prefer vector: it can be recoloured to white, a raster cannot.
  const pick = atts.find((a) => /svg/i.test(a.type) || /\.svg$/i.test(a.filename))
    ?? atts.find((a) => /png|jpe?g|webp/i.test(a.type));
  if (!pick) {
    problems.push({ ...row, why: `only unusable files (${atts.map((a) => a.type).join(", ")})` });
    continue;
  }

  const stem = join(OUT, key(company) || `row-${r.id}`);
  const tmp = `${stem}.download`;
  if (!(await fetchTo(pick.url, tmp))) { problems.push({ ...row, why: "download failed" }); continue; }
  const head = readFileSync(tmp).subarray(0, 400).toString("latin1");
  const ext = /<svg/i.test(head) ? "svg" : head.startsWith("\x89PNG") ? "png" : head.startsWith("\xff\xd8") ? "jpg" : null;
  if (!ext) { problems.push({ ...row, why: `unknown file type (${pick.filename})` }); continue; }
  const raw = `${stem}.${ext}`;
  writeFileSync(raw, readFileSync(tmp));
  rmSync(tmp);

  // Same artwork as something we already hold, under another name? Reuse that
  // file rather than shipping a second copy of the same mark.
  const sig = await signature(raw).catch(() => null);
  if (sig) {
    // `compare` returns { shape, ink }; only the SILHOUETTE decides sameness
    // here — the ink differs by design, since the library holds white knockouts
    // and Airtable holds the partner's coloured brand file.
    // `compare` returns { shape, ink }; only the SILHOUETTE decides sameness
    // here — the ink differs by design, since the library holds white knockouts
    // and Airtable holds the partner's coloured brand file.
    const same = [];
    let closest = null;
    for (const s of signed) {
      const c = compare(sig, s.sig);
      if (!closest || c.shape < closest.shape) closest = { shape: c.shape, logo: s.logo };
      if (c.shape <= SAME_LOGO) same.push({ shape: c.shape, logo: s.logo });
    }
    const readyByArt = bestOf(same.sort((a, b) => a.shape - b.shape).map((x) => x.logo));
    if (readyByArt) {
      const hit = same.find((x) => x.logo.src === readyByArt.src);
      held.push({ ...row, src: readyByArt.src, how: `artwork match with "${readyByArt.name}" (${hit.shape.toFixed(3)})`, tone: readyByArt.tone });
      continue;
    }
    if (same.length) row.heldNotWallReady = [...new Set([...(row.heldNotWallReady ?? []), ...same.map((x) => x.logo.src)])];
    row.closest = closest && { name: closest.logo.name, shape: +closest.shape.toFixed(3) };
  }

  if (ext !== "svg") {
    // A raster cannot be turned into knockout art, so it only ships if it is
    // already light. `tone` is measured by logos:manifest after the import.
    problems.push({
      ...row,
      why: row.heldNotWallReady?.length
        ? `raster only (${pick.filename}) and the file we hold is not wall-ready (${row.heldNotWallReady.map((x) => decodeURIComponent(x)).join(", ")})`
        : `raster only (${pick.filename}) — needs a vector before it can go on a wall`,
      staged: raw,
    });
    continue;
  }

  const source = readFileSync(raw, "utf8");
  if (hasBackgroundPlate(source)) {
    problems.push({ ...row, why: "the SVG is a sheet export with an opaque background rectangle — needs a transparent cut", staged: raw });
    continue;
  }
  const white = whiten(source);
  // When the library already holds this company in artwork we cannot use, the
  // white cut ships BESIDE it rather than replacing it: the coloured file is
  // the partner's real asset and other work may point at it.
  // Name it after the company; when the library already holds that name in
  // artwork we cannot use, the white cut ships BESIDE it rather than replacing
  // it — the coloured file is the partner's real asset and other work may point
  // at it. "Knockout" is the third choice, for the partners whose unusable file
  // is ALREADY called White (Adeo Web ships a coloured "White" cut).
  const label = [safeName(company), `${safeName(company)} White`, `${safeName(company)} Knockout`]
    .find((n) => !existsSync(join(LOGO_DIR, `${n}.svg`)))
    ?? `${safeName(company)} ${Date.now()}`;
  const file = join(OUT, `${label}.svg`);
  writeFileSync(file, white);
  const stillColoured = hasColour(white);
  const target = join(LOGO_DIR, `${label}.svg`);
  const entry = { ...row, src: `/logos/${encodeURIComponent(`${label}.svg`)}`, how: "imported", staged: file, stillColoured, wrapsRaster: wrapsRaster(source) };
  if (stillColoured) { problems.push({ ...entry, why: "still carries a colour after the white rewrite" }); continue; }
  if (WRITE) {
    if (existsSync(target)) { problems.push({ ...entry, why: `${target} already exists — name collision, not overwritten` }); continue; }
    copyFileSync(file, target);
  }
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

const toneOf = new Map(LIBRARY.map((l) => [l.src, l.tone]));
const notWhite = [];
for (const e of roster) {
  const file = e.how === "imported" ? e.staged : fileOf(e.src);
  const tone = e.how === "imported" ? "light" : toneOf.get(e.src);
  const coloured = file.toLowerCase().endsWith(".svg") && existsSync(file) && hasColour(readFileSync(file, "utf8"));
  if (tone !== "light" || coloured) {
    notWhite.push({ ...e, tone, coloured, why: coloured ? "saturated colour in the artwork" : `tone: ${tone}` });
  }
}

// The same FILE twice in one tier is a wall with the logo twice — a duplicate
// Airtable row, or two partners who supplied the same artwork. The second one is
// dropped from the roster and reported: which of them is wrong is a human call,
// but shipping the wall twice-logoed is never right.
const dupes = [];
for (const t of TIER_ORDER) {
  const seen = new Map();
  const kept = [];
  for (const e of byTier.get(t)) {
    const prev = seen.get(e.src);
    if (prev) { dupes.push({ tier: t, src: e.src, kept: prev.company, dropped: e.company }); continue; }
    seen.set(e.src, e);
    kept.push(e);
  }
  byTier.set(t, kept);
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
