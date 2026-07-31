// Builds the searchable logo library index from whatever sits in
// public/logos/. Drop a file in, run `npm run logos` (or just start
// dev / build, which run this first), and the file shows up in the
// "Saved logos" search in Quick Templates.
//
// The FILENAME is the logo's name: "molten-ventures.svg" is found by typing
// "molten", "ventures" or "Molten Ventures". Subfolders are searched too and
// their name becomes a tag, so public/logos/2026/foo.svg is also found by
// typing "2026".
import { readdir, writeFile, readFile, stat } from "node:fs/promises";
import { join, extname, basename, relative, sep } from "node:path";
import sharp from "sharp";

const LOGO_DIR = join(process.cwd(), "public", "logos");

/**
 * How bright is the artwork? The picker needs this to choose a plate colour per
 * tile: a white knockout logo is invisible on a white plate, and a black one is
 * invisible on a dark plate. Returns "light" (bright artwork, needs a dark
 * plate), "dark" (needs a light plate) or "mixed" (colourful, grey plate).
 *
 * Background is detected from the corner pixels: transparent corners mean every
 * visible pixel is ink, opaque corners mean the logo sits on a solid card whose
 * colour is excluded. Judging the whole image is the fallback.
 */
async function toneOf(file) {
  try {
    const W = 32;
    const { data, info } = await sharp(file, { density: 96 })
      .resize(W, W, { fit: "inside" })
      .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const w = info.width, h = info.height;
    const at = (x, y) => {
      const i = (y * w + x) * 4;
      return [data[i], data[i + 1], data[i + 2], data[i + 3]];
    };
    const lumOf = ([r, g, b]) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

    // What counts as ink depends on how the file is built. A blanket
    // "near-white is background" rule threw away the ink of every
    // white-on-transparent logo (its glyphs ARE opaque white), which then fell
    // back to a light plate and rendered invisible.
    const corners = [at(0, 0), at(w - 1, 0), at(0, h - 1), at(w - 1, h - 1)];
    const transparentEdges = corners.every((c) => c[3] < 40);
    const bg = transparentEdges ? null : corners[0];
    const sameAsBg = (p) =>
      bg && Math.abs(p[0] - bg[0]) < 40 && Math.abs(p[1] - bg[1]) < 40 && Math.abs(p[2] - bg[2]) < 40;

    let sum = 0, n = 0;
    for (let i = 0; i < w * h; i++) {
      const p = [data[i * 4], data[i * 4 + 1], data[i * 4 + 2], data[i * 4 + 3]];
      if (p[3] < 40) continue;                 // transparent
      if (bg && sameAsBg(p)) continue;         // solid card background
      sum += lumOf(p);
      n++;
    }
    // No ink separable from the background: judge the whole image instead, so a
    // logo that fills its own card still gets a sensible plate.
    if (n < 3) {
      let all = 0, m = 0;
      for (let i = 0; i < w * h; i++) {
        if (data[i * 4 + 3] < 40) continue;
        all += lumOf([data[i * 4], data[i * 4 + 1], data[i * 4 + 2]]);
        m++;
      }
      if (!m) return "mixed";
      const avgAll = all / m;
      return avgAll > 0.62 ? "light" : avgAll < 0.38 ? "dark" : "mixed";
    }
    const avg = sum / n;
    return avg > 0.62 ? "light" : avg < 0.38 ? "dark" : "mixed";
  } catch {
    return "mixed";
  }
}
const OUT_FILE = join(process.cwd(), "src", "data", "logoLibrary.json");
const ALLOWED = new Set([".svg", ".png", ".jpg", ".jpeg", ".webp"]);

/**
 * The filename IS the display name — "byFounders.svg" shows as "byFounders",
 * "Akademikernes A-kasse.svg" keeps its hyphen, "identity.vc.svg" keeps its dot.
 *
 * An earlier version replaced separators and re-capitalised every word, which
 * made sense while the folder was full of scraped names like
 * "blackwoodventures.svg". Now that the files carry proper names, rewriting them
 * only corrupts intentional casing ("ByFounders", "A Kasse"). Underscores are
 * the one exception: they are never intentional in a display name.
 */
function titleFromFile(file) {
  return basename(file, extname(file)).replace(/_+/g, " ").replace(/\s+/g, " ").trim();
}

// Files the browser can't display (.ai, .zip, .pdf…). Collected rather than
// silently skipped: a designer who drops an Illustrator file in here otherwise
// wonders why the logo never shows up in the picker.
const unusable = [];

async function walk(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return []; // no logos folder yet — an empty library is a valid state
  }
  const out = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await walk(full)));
      continue;
    }
    if (!ALLOWED.has(extname(entry.name).toLowerCase())) {
      if (entry.name !== "README.md") unusable.push(relative(LOGO_DIR, full));
      continue;
    }
    const rel = relative(LOGO_DIR, full).split(sep);
    const { size } = await stat(full);
    out.push({
      // URL the browser fetches. Encoded per segment so spaces and & survive.
      src: `/logos/${rel.map(encodeURIComponent).join("/")}`,
      name: titleFromFile(entry.name),
      // Folder names become extra search terms ("2026", "community", …).
      tags: rel.slice(0, -1).map((s) => s.toLowerCase()),
      bytes: size,
    });
  }
  return out;
}

const logos = (await walk(LOGO_DIR)).sort((a, b) => a.name.localeCompare(b.name));

// Rasterizing 850+ files takes a while, so carry over the tone of any file whose
// path and size are unchanged since the last run. Only new or edited files are
// measured, which keeps `predev` / `prebuild` quick.
const TONE_ALGO = 2;   // bump when toneOf changes, to invalidate cached tones
const previous = new Map();
try {
  for (const l of JSON.parse(await readFile(OUT_FILE, "utf8"))) {
    if (l.tone && l.toneAlgo === TONE_ALGO) previous.set(`${l.src}|${l.bytes}`, l.tone);
  }
} catch { /* first run, or the file was hand-edited */ }

let measured = 0;
for (const l of logos) {
  l.toneAlgo = TONE_ALGO;
  const cached = previous.get(`${l.src}|${l.bytes}`);
  if (cached) { l.tone = cached; continue; }
  l.tone = await toneOf(join(LOGO_DIR, decodeURIComponent(l.src.replace(/^\/logos\//, ""))));
  measured++;
}
await writeFile(OUT_FILE, `${JSON.stringify(logos, null, 2)}\n`, "utf8");
const big = logos.filter((l) => l.bytes > 400_000);
console.log(`logo library: ${logos.length} file(s) -> src/data/logoLibrary.json (${measured} newly measured for brightness)`);
if (big.length) {
  console.warn(
    `warning: ${big.length} file(s) over 400KB — they become data URLs inside saved designs and eat the library's 4MB save limit:\n` +
    big.map((l) => `  ${l.src} (${Math.round(l.bytes / 1024)}KB)`).join("\n"),
  );
}
if (unusable.length) {
  console.warn(
    `warning: ${unusable.length} file(s) a browser can't display, so they are NOT in the picker — export them as SVG or PNG:\n` +
    unusable.map((f) => `  ${f}`).join("\n"),
  );
}
