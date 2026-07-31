// `npm run logos:dupes` — report duplicate logos in public/logos. READ-ONLY:
// it never deletes anything, because the last pass proved the judgement call
// needs human eyes (it flagged "European Investment Bank" and "European
// Investment Fund" as one logo, and the TechBBQ Investor Day colour/mono
// variants as copies). Verify the groups before removing anything.
//
// Two files are reported as duplicates only when ALL of these hold:
//   1. similar aspect ratio (a 10:1 wordmark is never the same mark as a square)
//   2. near-identical ink mask, compared on a STRETCHED 32x32 grid so wide
//      wordmarks keep their detail (a "contain" fit squashed them all into the
//      same thin bar, which grouped four unrelated companies)
//   3. similar ink colour, so a white knockout version is kept as its own
//      variant instead of being deleted as a copy
import sharp from "sharp";
import { readdirSync, statSync, readFileSync, writeFileSync } from "node:fs";
import { join, extname } from "node:path";
import { createHash } from "node:crypto";

const D = "public/logos";
const N = 48;
const MASK_TOLERANCE = 0.03; // fraction of the 1024 cells allowed to differ
const INK_TOLERANCE = 45;

const files = readdirSync(D).filter((f) =>
  f !== "README.md" && statSync(join(D, f)).isFile() && /\.(svg|png|webp|jpe?g)$/i.test(f));

const recs = [];
for (const f of files) {
  const p = join(D, f);
  const bytes = statSync(p).size;
  const md5 = createHash("md5").update(readFileSync(p)).digest("hex");
  try {
    const meta = await sharp(p, { density: 150 }).metadata();
    // TRIM to the ink box first. Most of these SVGs are a wide wordmark centred
    // in a square 100x100 viewBox, so untrimmed they all reduce to "a bar
    // across the middle" and 27 unrelated companies grouped together. Trimming
    // also normalises padding differences between two exports of one logo.
    let src = p, tw = meta.width ?? 0, th = meta.height ?? 0;
    try {
      const t = await sharp(p, { density: 150 }).ensureAlpha().trim({ threshold: 10 }).png().toBuffer({ resolveWithObject: true });
      src = t.data; tw = t.info.width; th = t.info.height;
    } catch { /* nothing to trim (blank or uniform) — use the original */ }
    const { data } = await sharp(src, typeof src === "string" ? { density: 150 } : undefined)
      .resize(N, N, { fit: "fill" })          // stretch: keeps detail for wide marks
      .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const mask = new Uint8Array(N * N);
    let rs = 0, gs = 0, bs = 0, n = 0;
    for (let i = 0; i < N * N; i++) {
      const [r, g, b, a] = [data[i * 4], data[i * 4 + 1], data[i * 4 + 2], data[i * 4 + 3]];
      const opaqueBg = a > 200 && r > 235 && g > 235 && b > 235;
      const isInk = a > 40 && !opaqueBg ? 1 : 0;
      mask[i] = isInk;
      if (isInk) { rs += r; gs += g; bs += b; n++; }
    }
    recs.push({
      file: f, bytes, md5, ext: extname(f).toLowerCase(),
      w: meta.width ?? 0, h: meta.height ?? 0,
      // Aspect of the TRIMMED artwork, which is what actually identifies a mark.
      ar: tw && th ? tw / th : 1,
      ink: n ? [Math.round(rs / n), Math.round(gs / n), Math.round(bs / n)] : null,
      density: n / (N * N),
      mask: Buffer.from(mask).toString("base64"),
    });
  } catch {
    recs.push({ file: f, bytes, md5, ext: extname(f).toLowerCase(), unrenderable: true });
  }
}

const unmask = (r) => new Uint8Array(Buffer.from(r.mask, "base64"));
const maskDiff = (a, b) => {
  const x = unmask(a), y = unmask(b);
  let d = 0;
  for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) d++;
  return d / x.length;
};
const inkClose = (a, b) => a && b && [0, 1, 2].every((i) => Math.abs(a[i] - b[i]) < INK_TOLERANCE);
const arClose = (a, b) => Math.abs(Math.log(a / b)) < 0.05;   // within ~5%

const usable = recs.filter((r) => !r.unrenderable && r.density > 0.005);
// Union-find over the pairwise comparison, so A~B and B~C land in one group.
const parent = new Map(usable.map((r) => [r.file, r.file]));
const find = (x) => (parent.get(x) === x ? x : (parent.set(x, find(parent.get(x))), parent.get(x)));
const union = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) parent.set(ra, rb); };

for (let i = 0; i < usable.length; i++) {
  for (let j = i + 1; j < usable.length; j++) {
    const a = usable[i], b = usable[j];
    if (!arClose(a.ar, b.ar)) continue;
    if (Math.abs(a.density - b.density) > 0.06) continue;
    if (!inkClose(a.ink, b.ink)) continue;
    if (maskDiff(a, b) > MASK_TOLERANCE) continue;
    union(a.file, b.file);
  }
}

const byRoot = new Map();
for (const r of usable) {
  const k = find(r.file);
  (byRoot.get(k) ?? byRoot.set(k, []).get(k)).push(r);
}
const groups = [...byRoot.values()].filter((g) => g.length > 1)
  .map((g) => g.map(({ mask, ...rest }) => rest));

const exact = [...new Map(recs.map((r) => [r.md5, null])).keys()]
  .map((h) => recs.filter((r) => r.md5 === h)).filter((g) => g.length > 1);

writeFileSync("duplicate-logos-report.json", JSON.stringify({ total: recs.length, exact, groups }, null, 2));
console.log(`scanned ${recs.length} | byte-identical groups ${exact.length} | visual groups ${groups.length} (${groups.reduce((n, g) => n + g.length - 1, 0)} redundant)`);
console.log("report: duplicate-logos-report.json");
console.log(`skipped: ${recs.filter((r) => r.unrenderable).length} unrenderable, ${recs.length - usable.length - recs.filter((r) => r.unrenderable).length} near-empty`);
