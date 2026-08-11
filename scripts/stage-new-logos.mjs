// `node scripts/stage-new-logos.mjs` — DRY RUN. Collects logo SVGs from the
// off-project folders on this machine, drops anything that already exists in
// public/logos (byte-identical OR visually the same mark), and proposes a
// library-style name for each survivor.
//
// It NEVER writes to public/logos. Survivors are copied to .logos-staging/ and
// the decisions are written to logo-staging-report.json for review.
//
// Naming, in order of confidence:
//   1. canonical  — the file matches a name in scripts/logo-checks/techbbq-partners.txt
//   2. filename   — the file name cleans up to something readable (camelCase split,
//                   separators, dropped "logo"/"-01"/"(2)" noise)
//   3. embedded   — the SVG carries a <title>/<desc>/aria-label/<text> we can read
//   4. unknown    — nothing usable (svgexport-12.svg); needs eyes on the artwork
import sharp from "sharp";
import { readdirSync, statSync, readFileSync, writeFileSync, mkdirSync, copyFileSync, rmSync, existsSync } from "node:fs";
import { join, extname, basename } from "node:path";
import { createHash } from "node:crypto";

const LIB = "public/logos";
// Logos already removed from the library once. Re-importing them would undo a
// judgement call that was made with eyes on the artwork, so they are dropped
// with a distinct reason rather than silently kept.
const TRASH = ".logos-trash";
const OUT = ".logos-staging";
const SOURCES = process.argv.slice(2).length ? process.argv.slice(2) : [
  "C:/Users/User/Desktop/TBBQ/2025 stuff/Techbbq_partners",
  "C:/Users/User/Desktop/TBBQ/Logos",
  "C:/Users/User/Desktop/TBBQ/2026 Season/Partners/SVG",
];

const N = 48;
const MASK_TOLERANCE = 0.03;
const INK_TOLERANCE = 45;

// ── naming ──────────────────────────────────────────────────────────────────
// Acronyms and brand casings that title-casing would otherwise mangle.
const CASINGS = ["AI", "APX", "BPOC", "BSI", "CBS", "CIFS", "DTU", "EIFO", "EU", "HSBC",
  "IDA", "IT", "ITU", "KPMG", "NSW", "PwC", "SDU", "VC", "AIESEC", "AUXXO", "DK", "UK", "US"];

const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Turn a raw file name into a readable candidate: "AngellaInvest_Color" → "Angella Invest Color". */
function fromFilename(file) {
  let s = basename(file, extname(file));
  s = s.replace(/\s*\(\d+\)\s*$/, "");            // "Danske Bank (1)"
  s = s.replace(/[-_]?\d{2,}$/, "");               // "AktiviteEjere-01"
  s = s.replace(/[-_]?(logo|logotype|vector|final|rgb|export)$/i, "");
  s = s.replace(/^(logo|svgexport)[-_]?\d*[-_]?/i, "");
  s = s.replace(/[_.]+/g, " ").replace(/-+/g, " ");
  s = s.replace(/([a-z0-9])([A-Z])/g, "$1 $2");    // camelCase split
  s = s.replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2"); // ACRONYMWord split
  s = s.replace(/\s+/g, " ").trim();
  if (!s) return "";
  return s.split(" ").map((w) => {
    const hit = CASINGS.find((c) => c.toLowerCase() === w.toLowerCase());
    if (hit) return hit;
    if (/^[A-Z0-9]{2,}$/.test(w)) return w;        // already an acronym
    return w[0].toUpperCase() + w.slice(1);
  }).join(" ");
}

/** Any human-readable string the SVG itself carries. */
function fromSvgText(xml) {
  const grab = (re) => [...xml.matchAll(re)].map((m) => m[1]);
  const bits = [
    ...grab(/<title[^>]*>([\s\S]*?)<\/title>/gi),
    ...grab(/<desc[^>]*>([\s\S]*?)<\/desc>/gi),
    ...grab(/aria-label\s*=\s*"([^"]+)"/gi),
    ...grab(/<text[^>]*>([\s\S]*?)<\/text>/gi),
  ].map((t) => t.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim())
   .filter((t) => t && t.length > 1 && t.length < 60)
   // Illustrator/Figma leave these behind; they name nothing.
   .filter((t) => !/^(layer|group|artboard|vector|path|clip|mask|rect|shape|untitled|svg|asset|frame|logo)\b/i.test(t));
  return bits[0] ?? "";
}

// Canonical partner spellings from the techbbq.dk list.
const partnerFile = "scripts/logo-checks/techbbq-partners.txt";
const canonical = new Map();
if (existsSync(partnerFile)) {
  for (const line of readFileSync(partnerFile, "utf8").split(/\r?\n/)) {
    if (!line.trim() || line.startsWith("#")) continue;
    const name = line.split("|")[0].trim();
    if (name) canonical.set(norm(name), name);
  }
}
// Existing library names are canonical too — reuse their exact spelling.
const libNames = new Map();

// ── fingerprint ─────────────────────────────────────────────────────────────
async function fingerprint(p) {
  const meta = await sharp(p, { density: 150 }).metadata();
  let src = p, tw = meta.width ?? 0, th = meta.height ?? 0;
  try {
    const t = await sharp(p, { density: 150 }).ensureAlpha().trim({ threshold: 10 })
      .png().toBuffer({ resolveWithObject: true });
    src = t.data; tw = t.info.width; th = t.info.height;
  } catch { /* blank or uniform — use the original */ }
  const { data } = await sharp(src, typeof src === "string" ? { density: 150 } : undefined)
    .resize(N, N, { fit: "fill" }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const mask = new Uint8Array(N * N);
  let rs = 0, gs = 0, bs = 0, n = 0;
  for (let i = 0; i < N * N; i++) {
    const [r, g, b, a] = [data[i * 4], data[i * 4 + 1], data[i * 4 + 2], data[i * 4 + 3]];
    const opaqueBg = a > 200 && r > 235 && g > 235 && b > 235;
    const isInk = a > 40 && !opaqueBg ? 1 : 0;
    mask[i] = isInk;
    if (isInk) { rs += r; gs += g; bs += b; n++; }
  }
  return {
    ar: tw && th ? tw / th : 1,
    ink: n ? [Math.round(rs / n), Math.round(gs / n), Math.round(bs / n)] : null,
    density: n / (N * N),
    mask,
  };
}
const maskDiff = (a, b) => {
  let d = 0;
  for (let i = 0; i < a.mask.length; i++) if (a.mask[i] !== b.mask[i]) d++;
  return d / a.mask.length;
};
const inkClose = (a, b) => a && b && [0, 1, 2].every((i) => Math.abs(a[i] - b[i]) < INK_TOLERANCE);
const arClose = (a, b) => Math.abs(Math.log(a / b)) < 0.05;
const sameMark = (a, b) =>
  a.fp && b.fp && a.fp.density > 0.005 && b.fp.density > 0.005 &&
  arClose(a.fp.ar, b.fp.ar) && Math.abs(a.fp.density - b.fp.density) <= 0.06 &&
  inkClose(a.fp.ink, b.fp.ink) && maskDiff(a.fp, b.fp) <= MASK_TOLERANCE;

// ── index the existing library ──────────────────────────────────────────────
const libFiles = readdirSync(LIB).filter((f) =>
  statSync(join(LIB, f)).isFile() && /\.(svg|png|webp|jpe?g)$/i.test(f));
const lib = [];
for (const f of libFiles) {
  const p = join(LIB, f);
  const name = basename(f, extname(f));
  libNames.set(norm(name), name);
  const rec = { file: f, md5: createHash("md5").update(readFileSync(p)).digest("hex"), fp: null };
  try { rec.fp = await fingerprint(p); } catch { /* unrenderable */ }
  lib.push(rec);
}
const libMd5 = new Set(lib.map((r) => r.md5));
console.log(`library: ${lib.length} files indexed (${lib.filter((r) => r.fp).length} renderable)`);

const trash = [];
if (existsSync(TRASH)) {
  for (const f of readdirSync(TRASH).filter((f) => /\.(svg|png|webp|jpe?g)$/i.test(f))) {
    const p = join(TRASH, f);
    const rec = { file: f, md5: createHash("md5").update(readFileSync(p)).digest("hex"), fp: null };
    try { rec.fp = await fingerprint(p); } catch { /* unrenderable */ }
    trash.push(rec);
  }
}
const trashMd5 = new Set(trash.map((r) => r.md5));
console.log(`trash: ${trash.length} previously-rejected files indexed`);

// ── collect candidates ──────────────────────────────────────────────────────
const walk = (dir) => {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== "node_modules" && !e.name.startsWith(".")) out.push(...walk(p)); }
    else if (extname(e.name).toLowerCase() === ".svg") out.push(p);
  }
  return out;
};
const cands = SOURCES.filter(existsSync).flatMap(walk);
console.log(`candidates: ${cands.length} SVGs from ${SOURCES.length} folders`);

// ── decide ──────────────────────────────────────────────────────────────────
const kept = [], dropped = [];
for (const p of cands) {
  const bytes = readFileSync(p);
  const md5 = createHash("md5").update(bytes).digest("hex");
  const rec = { path: p, file: basename(p), md5, fp: null };
  try { rec.fp = await fingerprint(p); } catch { /* unrenderable */ }

  if (libMd5.has(md5)) { dropped.push({ ...rec, mask: undefined, reason: "byte-identical to library" }); continue; }

  const visualLib = rec.fp ? lib.find((l) => sameMark(rec, l)) : null;
  if (visualLib) { dropped.push({ file: rec.file, path: p, reason: `same mark as library "${visualLib.file}"` }); continue; }

  if (trashMd5.has(md5)) { dropped.push({ file: rec.file, path: p, reason: "previously rejected (byte-identical to .logos-trash)" }); continue; }
  const visualTrash = rec.fp ? trash.find((t) => sameMark(rec, t)) : null;
  if (visualTrash) { dropped.push({ file: rec.file, path: p, reason: `previously rejected (same mark as .logos-trash/"${visualTrash.file}")` }); continue; }

  const dupeKept = kept.find((k) => k.md5 === md5 || (rec.fp && sameMark(rec, k)));
  if (dupeKept) { dropped.push({ file: rec.file, path: p, reason: `same mark as staged "${dupeKept.file}"` }); continue; }

  // name it
  const xml = bytes.toString("utf8");
  const fname = fromFilename(rec.file);
  const embedded = fromSvgText(xml);
  let name = fname, source = "filename";
  const canon = canonical.get(norm(fname)) ?? libNames.get(norm(fname));
  if (canon) { name = canon; source = "canonical"; }
  else if (!fname || /^\d+$/.test(fname)) {
    if (embedded) { name = embedded; source = "embedded"; }
    else { name = ""; source = "unknown"; }
  }
  kept.push({ ...rec, mask: undefined, name, nameSource: source, filenameGuess: fname, embedded });
}

// ── write staging ───────────────────────────────────────────────────────────
rmSync(OUT, { recursive: true, force: true });
mkdirSync(join(OUT, "named"), { recursive: true });
mkdirSync(join(OUT, "unknown"), { recursive: true });
const used = new Set();
for (const k of kept) {
  if (k.nameSource === "unknown") {
    copyFileSync(k.path, join(OUT, "unknown", k.file));
    k.stagedAs = `unknown/${k.file}`;
    continue;
  }
  let out = `${k.name}.svg`, i = 2;
  while (used.has(out.toLowerCase())) out = `${k.name} ${i++}.svg`;
  used.add(out.toLowerCase());
  copyFileSync(k.path, join(OUT, "named", out));
  k.stagedAs = `named/${out}`;
}

const report = {
  sources: SOURCES,
  scanned: cands.length,
  kept: kept.length,
  dropped: dropped.length,
  byNameSource: kept.reduce((a, k) => ((a[k.nameSource] = (a[k.nameSource] ?? 0) + 1), a), {}),
  keptFiles: kept.map(({ fp, ...r }) => r),
  droppedFiles: dropped.map(({ fp, ...r }) => r),
};
writeFileSync("logo-staging-report.json", JSON.stringify(report, null, 2));
console.log(`kept ${kept.length} | dropped ${dropped.length}`);
console.log(`name source:`, report.byNameSource);
console.log(`staged in ${OUT}/ (public/logos untouched) | report: logo-staging-report.json`);
