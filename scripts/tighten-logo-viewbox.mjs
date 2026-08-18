/**
 * Tighten an SVG logo's viewBox to the artwork inside it.
 *
 * WHY THIS KEEPS BEING NEEDED: a wall cell is contain-fit, and a contain fit
 * cannot tell padding from logo. A wide wordmark delivered inside a square
 * 100x100 viewBox therefore renders at roughly a THIRD of the size of a
 * neighbour whose file is cropped to its artwork — it looks like the partner
 * was deliberately shrunk. Several partners send their logo this way (every
 * `white-*.svg` exported from the same tool has it), so this is a script rather
 * than a hand edit.
 *
 * HOW: rasterise the file with sharp, find the bounding box of every pixel that
 * is not fully transparent, map that box back into viewBox units and write it
 * back. Only the WINDOW changes — no path data is touched, so the artwork is
 * bit-identical, it is just no longer surrounded by empty space. Any width and
 * height attributes are dropped, because a stale 200x200 would fight the new
 * box's aspect ratio.
 *
 *   node scripts/tighten-logo-viewbox.mjs "Terkko Health Hub.svg" ...
 *   node scripts/tighten-logo-viewbox.mjs --check "SKYtek.svg"   (report only)
 *
 * Re-running is safe: a file already tight reports "already tight" and is left
 * alone. Originals are copied to `.logos-trash/viewbox-<date>/` first.
 */
import sharp from "sharp";
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const LOGO_DIR = "public/logos";
/** Render width for the bounds probe. Big enough that a hairline rule still
 *  lands on a pixel; small enough to stay instant. */
const PROBE = 1200;
/** Breathing room left around the artwork, as a fraction of the tightened box.
 *  Zero would clip antialiased edges on a diagonal. */
const PAD = 0.01;
/** Below this, the file is already cropped and rewriting it would be churn. */
const ALREADY_TIGHT = 0.97;

const args = process.argv.slice(2);
const checkOnly = args.includes("--check");
const files = args.filter((a) => !a.startsWith("--"));
if (!files.length) {
  console.error("usage: node scripts/tighten-logo-viewbox.mjs [--check] <file.svg> ...");
  process.exit(1);
}

/** The alpha bounding box, in 0..1 fractions of the rendered canvas. */
async function inkBounds(buf) {
  const png = sharp(buf, { density: 300 }).resize({ width: PROBE, fit: "inside" }).ensureAlpha();
  const { data, info } = await png.raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Ignore near-transparent pixels: antialiasing leaves a faint halo that
      // would defeat the whole point by re-inflating the box.
      if (data[(y * width + x) * channels + 3] > 8) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null; // nothing rendered
  return { x: minX / width, y: minY / height, w: (maxX - minX + 1) / width, h: (maxY - minY + 1) / height };
}

/** Drop width/height from the opening <svg> tag. A stale 200x200 fights the
 *  viewBox's aspect both when rasterising and in the browser. */
function stripSize(svg) {
  const open = svg.indexOf("<svg");
  const close = svg.indexOf(">", open);
  if (open < 0 || close < 0) return svg;
  const tag = svg.slice(open, close).replace(/\s(?:width|height)\s*=\s*"[^"]*"/g, "");
  return svg.slice(0, open) + tag + svg.slice(close);
}

const trash = join(".logos-trash", `viewbox-${new Date().toISOString().slice(0, 10)}`);

for (const name of files) {
  const file = join(LOGO_DIR, name);
  if (!existsSync(file)) { console.log(`missing   ${name}`); continue; }
  const svg = readFileSync(file, "utf8");
  const vb = svg.match(/viewBox\s*=\s*"([^"]+)"/);
  if (!vb) { console.log(`no viewBox ${name} — skipped`); continue; }
  const [vx, vy, vw, vh] = vb[1].trim().split(/[\s,]+/).map(Number);
  if (!(vw > 0 && vh > 0)) { console.log(`bad viewBox ${name} — skipped`); continue; }

  // Measure the file with any width/height REMOVED. Those attributes override
  // the viewBox's aspect when rasterising (Flatpay ships viewBox 110x23.38 with
  // width=height=200), and then the ink fractions describe a square render that
  // does not map onto a 4.7:1 viewBox — mapping them back wrote a box that
  // CLIPPED the artwork. Stripping first makes raster aspect == viewBox aspect,
  // which is what the conversion below assumes.
  const b = await inkBounds(Buffer.from(stripSize(svg)));
  if (!b) { console.log(`empty     ${name} — skipped`); continue; }

  // BOTH axes, not the larger one. A wide wordmark centred in a square box
  // fills ~98% of the width and ~18% of the height, and that is the worst case
  // on a wall, not a tight file — testing the larger axis called it tight and
  // let Google Cloud draw at a fifth of its neighbours' size.
  const cover = Math.min(b.w, b.h);
  if (cover >= ALREADY_TIGHT) {
    // A tight viewBox is not the whole job. width/height set the SVG's
    // intrinsic size, so a square 200x200 on a 4.7:1 viewBox makes the BROWSER
    // letterbox the artwork inside a square, and a contain-fit wall cell then
    // draws it at a fraction of its size — the tight box never gets a say.
    // Flatpay and San Francisco both ship this way.
    const stripped = stripSize(svg);
    if (stripped !== svg) {
      console.log(`${checkOnly ? "would strip" : "stripped"} width/height  ${name}  (viewBox already tight at ${(b.w * 100).toFixed(0)}x${(b.h * 100).toFixed(0)}%, but the attributes forced another aspect)`);
      if (!checkOnly) {
        mkdirSync(trash, { recursive: true });
        copyFileSync(file, join(trash, name));
        writeFileSync(file, stripped);
      }
      continue;
    }
    console.log(`already tight  ${name}  (artwork fills ${(b.w * 100).toFixed(0)}x${(b.h * 100).toFixed(0)}%)`);
    continue;
  }

  // Bounds are fractions of the rendered canvas, which maps 1:1 onto the
  // viewBox rectangle — so scaling them by the viewBox is the whole conversion.
  const padX = b.w * vw * PAD;
  const padY = b.h * vh * PAD;
  const nx = vx + b.x * vw - padX;
  const ny = vy + b.y * vh - padY;
  const nw = b.w * vw + padX * 2;
  const nh = b.h * vh + padY * 2;
  const round = (n) => Number(n.toFixed(3));
  const next = `${round(nx)} ${round(ny)} ${round(nw)} ${round(nh)}`;

  const before = `${(b.w * 100).toFixed(0)}x${(b.h * 100).toFixed(0)}%`;
  console.log(`${checkOnly ? "would tighten" : "tightened"}  ${name}`);
  console.log(`    viewBox "${vb[1].trim()}" -> "${next}"   (artwork filled ${before} of the old box)`);
  if (checkOnly) continue;

  mkdirSync(trash, { recursive: true });
  copyFileSync(file, join(trash, name));
  // Drop width/height: a leftover 200x200 would impose a square aspect on a
  // viewBox that is no longer square.
  const out = stripSize(svg).replace(/viewBox\s*=\s*"[^"]+"/, `viewBox="${next}"`);
  writeFileSync(file, out);
}

console.log(`\nDone. Run \`npm run logos\` to refresh the manifest.`);
