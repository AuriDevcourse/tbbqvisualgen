// `node scripts/sync-ls-feed.mjs` — DRY RUN by default.
//
// Re-syncs the Life Science x Deep Tech exhibiting roster against the connector
// feed the live techbbq.dk/life-science page eats. It answers the three
// questions a re-sync actually has: who arrived, who fell off, and whose
// ARTWORK changed under an unchanged name — the last one is invisible to a
// name diff and is why this script compares silhouettes instead of just lists.
//
// It never writes to public/logos or to partnerSets.ts. New/changed artwork is
// downloaded to .logos-feed/ and the decisions are printed + written to
// ls-feed-sync-report.json for review.
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fetchTo, signature, compare } from "./lib/logo-web.mjs";

const FEED = process.env.LS_FEED ?? "https://airtable-woad.vercel.app/api/ls-startups";
const OUT = ".logos-feed";
// Above this silhouette difference the feed's artwork is a different mark from
// the file we hold, i.e. the company re-branded or supplied a new file. Same
// threshold logos:import uses for "these are not the same logo".
const SHAPE_CHANGED = 0.12;

const setSrc = (s) => decodeURIComponent(s.replace(/^\//, ""));

// The set as committed, read from source so this script has one source of truth
// for "what we currently ship" and cannot drift from the file it is checking.
const src = readFileSync("src/data/partnerSets.ts", "utf8");
const block = /export const LS_DT_EXHIBITORS: PartnerSetEntry\[\] = \[([\s\S]*?)\n\];/.exec(src)[1];
const current = [...block.matchAll(/\{ label: "([^"]+)", src: "([^"]+)" \}/g)]
  .map((m) => ({ label: m[1], file: join("public", setSrc(m[2])) }));

const res = await fetch(FEED);
const { startups } = await res.json();

// Airtable carries legal suffixes, country words and project names; the wall
// does not. Match on a squashed key, then a hand-kept alias table for the names
// no rule can bridge — the three below are documented mismatches in
// partnerSets.ts and must not be "fixed" in either direction.
const ALIASES = {
  "H+H LABS PSA (project Hydratico)": "Hydratico",
  "Bioelectrix Sweden AB": "Bioelectrix",
  "Rilemo S.r.l.": "Rilemo",
  "DiaDesign Technologies": "DiaDesign Technologies",
};
const key = (s) => (ALIASES[s] ?? s).toLowerCase()
  .replace(/[^a-z0-9]+/g, " ")
  .replace(/ (aps|a s|ab|oy|as|srl|s r l|sia|psa|ltd|inc|gmbh|bv|ou)\b/g, "")
  .replace(/[^a-z0-9]/g, "");

const byKey = new Map(current.map((c) => [key(c.label), c]));
const feedKeys = new Set(startups.map((s) => key(s.company)));

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const arrived = [], changed = [], same = [], unreadable = [];

for (const s of startups) {
  const held = byKey.get(key(s.company));
  if (!s.logo) { unreadable.push({ company: s.company, why: "feed carries no logo attachment" }); continue; }

  const tmp = join(OUT, `${key(s.company)}.download`);
  // The deployed connector returns absolute logo URLs; a connector running on
  // localhost returns them relative ("/api/photo/..."), which fetch cannot
  // resolve on its own. Resolve against the feed so either one works.
  const logoUrl = new URL(s.logo, FEED).toString();
  if (!(await fetchTo(logoUrl, tmp))) { unreadable.push({ company: s.company, why: "download failed" }); continue; }
  const head = readFileSync(tmp).subarray(0, 400).toString("latin1");
  const ext = /<svg/i.test(head) ? "svg" : /^\x89PNG/.test(head) ? "png" : /^\xff\xd8/.test(head) ? "jpg" : null;
  if (!ext) { unreadable.push({ company: s.company, why: `unknown file type (${head.slice(0, 24)})` }); continue; }
  const file = join(OUT, `${key(s.company)}.${ext}`);
  writeFileSync(file, readFileSync(tmp));
  rmSync(tmp);

  if (!held) { arrived.push({ company: s.company, staged: file, website: s.website }); continue; }
  if (!existsSync(held.file)) { changed.push({ company: s.company, held: held.file, staged: file, why: "library file missing" }); continue; }
  try {
    const diff = compare(await signature(held.file), await signature(file));
    const row = { company: s.company, label: held.label, held: held.file, staged: file, shape: +diff.shape.toFixed(3), ink: Math.round(diff.ink) };
    (diff.shape > SHAPE_CHANGED ? changed : same).push(row);
  } catch (e) {
    unreadable.push({ company: s.company, why: `compare failed: ${e.message}` });
  }
}

const dropped = current.filter((c) => !feedKeys.has(key(c.label)));

const report = { feed: FEED, count: startups.length, held: current.length, arrived, changed, dropped, unreadable, same };
writeFileSync("ls-feed-sync-report.json", JSON.stringify(report, null, 2));

const list = (rows, f) => rows.length ? rows.map(f).join("\n") : "  (none)";
console.log(`feed ${startups.length} · committed ${current.length}\n`);
console.log(`ARRIVED (${arrived.length}) — need a library file:\n${list(arrived, (r) => `  ${r.company}  → ${r.staged}`)}\n`);
console.log(`ARTWORK CHANGED (${changed.length}) — same company, different mark:\n${list(changed, (r) => `  ${r.company}  shape ${r.shape ?? "-"} ink ${r.ink ?? "-"}  ${r.held}`)}\n`);
console.log(`DROPPED (${dropped.length}) — in the set, no longer confirmed:\n${list(dropped, (r) => `  ${r.label}`)}\n`);
console.log(`UNREADABLE (${unreadable.length}):\n${list(unreadable, (r) => `  ${r.company}: ${r.why}`)}\n`);
console.log(`unchanged ${same.length} · full detail in ls-feed-sync-report.json`);
