// `npm run logos:import -- <folder>`
//
// Import logos out of a techbbq.dk site export into the library, skipping the
// ones we already have.
//
// The export ships meaningless filenames (svgexport-1.svg, svgexport-2.svg …),
// so a name comparison is useless here. Files are matched on ARTWORK instead:
// silhouette + ink signature against every library logo, same scoring as the
// duplicate finder. Anything within MATCH% of an existing logo is a copy we
// already have and is skipped.
//
// This script never writes into public/logos. It stages the new files and
// renders contact sheets, because every import needs a human-supplied name —
// the whole point of the library is that the filename IS the display name.
//
// Output:
//   <stage>/new/          the unmatched files, ready to be named and moved in
//   <stage>/import-*.png  numbered contact sheets for naming
//   <stage>/report.json   full match detail incl. what each file matched
import sharp from "sharp";
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, readdirSync, rmSync } from "node:fs";
import { join, basename, extname } from "node:path";
import { signature, compare } from "./lib/logo-web.mjs";

const SRC = process.argv[2];
if (!SRC) {
  console.error("usage: npm run logos:import -- <folder with exported logo files>");
  process.exit(1);
}
const STAGE = process.env.STAGE
  ?? "C:/Users/User/AppData/Local/Temp/claude/C--Users-User/2f9c020b-7114-4a8f-bc56-3bbfba1f9e40/scratchpad/logo-import";
const D = "public/logos";
const MATCH = 0.12;          // silhouette distance under this = we already have it
const PER_SHEET = 12;

rmSync(STAGE, { recursive: true, force: true });
mkdirSync(join(STAGE, "new"), { recursive: true });

const LOGOS = JSON.parse(readFileSync("src/data/logoLibrary.json", "utf8"));
const incoming = readdirSync(SRC)
  .filter((f) => /\.(svg|png|jpe?g|webp)$/i.test(f))
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

console.log(`library: ${LOGOS.length} logos · incoming: ${incoming.length} files\n`);

// Signature every library logo once. Unreadable ones just can't be matched
// against, which only risks a duplicate import — never a wrong skip.
const lib = [];
for (const l of LOGOS) {
  const file = decodeURIComponent(l.src.replace("/logos/", ""));
  try { lib.push({ name: l.name, file, sig: await signature(join(D, file)) }); } catch { /* skip */ }
}
console.log(`signatured ${lib.length}/${LOGOS.length} library logos\n`);

const results = [];
for (const [i, f] of incoming.entries()) {
  const out = { file: f };
  try {
    const sig = await signature(join(SRC, f));
    let best = null;
    for (const l of lib) {
      const c = compare(sig, l.sig);
      if (!best || c.shape < best.shape) best = { shape: c.shape, ink: c.ink, name: l.name, libFile: l.file };
    }
    out.best = best;
    out.verdict = best && best.shape < MATCH ? "have it" : "NEW";
  } catch {
    out.verdict = "unreadable";
  }
  results.push(out);
  if ((i + 1) % 25 === 0) console.log(`  ${i + 1}/${incoming.length}`);
}

const fresh = results.filter((r) => r.verdict === "NEW");
const counts = results.reduce((a, r) => ((a[r.verdict] = (a[r.verdict] ?? 0) + 1), a), {});
console.log("\n" + Object.entries(counts).map(([k, v]) => `${String(v).padStart(4)}  ${k}`).join("\n"));

// Stage the new files under an index that matches the contact sheets, so a
// name read off a sheet lands on the right file.
for (const [i, r] of fresh.entries()) {
  r.staged = `${String(i).padStart(3, "0")}${extname(r.file)}`;
  copyFileSync(join(SRC, r.file), join(STAGE, "new", r.staged));
}
writeFileSync(join(STAGE, "report.json"), JSON.stringify(results, null, 2));

// Contact sheets. Mid grey so both white and dark artwork stay visible.
const CW = 300, CH = 150, COLS = 3, BG = "#6b6b6b";
for (let page = 0; page * PER_SHEET < fresh.length; page++) {
  const slice = fresh.slice(page * PER_SHEET, page * PER_SHEET + PER_SHEET);
  const rows = Math.ceil(slice.length / COLS);
  const cells = [];
  for (const [i, r] of slice.entries()) {
    const col = i % COLS, row = (i / COLS) | 0;
    try {
      const buf = await sharp(join(SRC, r.file), { density: 200 })
        .resize({ width: CW - 20, height: CH - 40, fit: "contain", background: BG })
        .flatten({ background: BG }).png().toBuffer();
      cells.push({ input: buf, left: col * CW + 10, top: row * CH + 26 });
    } catch { /* skip */ }
    const label = `${r.staged}  ${basename(r.file)}`;
    cells.push({
      input: Buffer.from(`<svg width="${CW - 12}" height="16"><text x="0" y="12" font-family="monospace" font-size="12" fill="#00e5ff">${label.replace(/[<>&]/g, "")}</text></svg>`),
      left: col * CW + 10, top: row * CH + 6,
    });
  }
  const out = join(STAGE, `import-${page}.png`);
  await sharp({ create: { width: COLS * CW, height: rows * CH, channels: 3, background: "#1f1f1f" } })
    .composite(cells).png().toFile(out);
  console.log(out);
}
console.log(`\nstaged ${fresh.length} new file(s) in ${join(STAGE, "new")}`);
console.log(`report: ${join(STAGE, "report.json")}`);
