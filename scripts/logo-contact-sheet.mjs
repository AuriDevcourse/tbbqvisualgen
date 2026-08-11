// `node scripts/logo-contact-sheet.mjs <dir> [outfile]` — render every SVG in a
// folder into one numbered grid PNG so a human (or a vision model) can identify
// the marks and name them. Cells sit on mid-grey so white-knockout and black
// logos are both legible.
import sharp from "sharp";
import { readdirSync, writeFileSync } from "node:fs";
import { join, extname, basename } from "node:path";

const DIR = process.argv[2] ?? ".logos-staging/named";
const OUTFILE = process.argv[3] ?? "logo-contact-sheet.png";
const COLS = 4, CW = 360, CH = 200, PAD = 18, LABEL = 22;

const files = readdirSync(DIR).filter((f) => /\.(svg|png|webp|jpe?g)$/i.test(f)).sort();
const rows = Math.ceil(files.length / COLS);
const W = COLS * CW, H = rows * (CH + LABEL);

const cells = [];
for (const [i, f] of files.entries()) {
  const col = i % COLS, row = Math.floor(i / COLS);
  const x = col * CW, y = row * (CH + LABEL);
  let art;
  try {
    art = await sharp(join(DIR, f), { density: 300 })
      .ensureAlpha().trim({ threshold: 10 })
      .resize(CW - PAD * 2, CH - PAD * 2, { fit: "inside", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png().toBuffer();
  } catch { continue; }
  const m = await sharp(art).metadata();
  cells.push({
    input: art,
    left: x + Math.round((CW - (m.width ?? 0)) / 2),
    top: y + Math.round((CH - (m.height ?? 0)) / 2),
  });
  const label = `${i + 1}. ${basename(f, extname(f))}`.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  cells.push({
    input: Buffer.from(
      `<svg width="${CW}" height="${LABEL}"><rect width="${CW}" height="${LABEL}" fill="#111"/>` +
      `<text x="8" y="16" font-family="Arial" font-size="13" fill="#fff">${label}</text></svg>`),
    left: x, top: y + CH,
  });
  // cell border
  cells.push({
    input: Buffer.from(`<svg width="${CW}" height="${CH}"><rect x="0.5" y="0.5" width="${CW - 1}" height="${CH - 1}" fill="none" stroke="#555"/></svg>`),
    left: x, top: y,
  });
}

await sharp({ create: { width: W, height: H, channels: 4, background: { r: 128, g: 128, b: 128, alpha: 1 } } })
  .composite(cells).png().toFile(OUTFILE);
console.log(`${files.length} logos -> ${OUTFILE} (${W}x${H})`);
