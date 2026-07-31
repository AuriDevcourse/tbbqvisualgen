// `npm run logos:svgify -- <batch.txt>`
//
// Upgrade raster logos to SVG. Input is one `Our file.png|domain.com` per line
// (the same format logos:verify / logos:compare take, so `logos:match` output
// works directly).
//
// For each row it fetches the company's site, pulls the header logo, and keeps it
// ONLY if it is genuinely vector. Then it scores the fetched artwork against the
// raster we already have, because the whole risk here is silently swapping in
// the wrong logo — a busy marketing page will happily hand over a customer's
// mark. A row only reaches "ready" when the silhouettes agree.
//
// Nothing is written into public/logos. Candidates are staged and a side-by-side
// sheet is rendered so a human confirms before anything replaces a real file.
//
// Verdicts:
//   ready       vector found, silhouette within 12% of ours
//   check       vector found, 12-30% — probably a different treatment, look
//   different   over 30% — most likely the wrong logo, look before trusting
//   raster only the site ships PNG too, nothing to gain
//   no logo     nothing extractable
import sharp from "sharp";
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fetchTo, fetchText, findLogo, signature, compare } from "./lib/logo-web.mjs";

const BATCH = process.argv[2];
if (!BATCH) {
  console.error("usage: npm run logos:svgify -- <batch.txt with 'file.png|domain.com' lines>");
  process.exit(1);
}
const STAGE = process.env.STAGE
  ?? "C:/Users/User/AppData/Local/Temp/claude/C--Users-User/2f9c020b-7114-4a8f-bc56-3bbfba1f9e40/scratchpad/svgify";
const D = "public/logos";
const CONCURRENCY = 6;

rmSync(STAGE, { recursive: true, force: true });
mkdirSync(join(STAGE, "new"), { recursive: true });

const rows = readFileSync(BATCH, "utf8").split(/\r?\n/).map((l) => l.trim())
  .filter((l) => l && !l.startsWith("#"))
  .map((l) => { const [file, host] = l.split("|").map((s) => s.trim()); return { file, host }; })
  .filter((r) => r.file && r.host && existsSync(join(D, r.file)));

console.log(`looking for SVG versions of ${rows.length} raster logo(s)\n`);

const results = [];
let done = 0;
const queue = [...rows];
await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
  while (queue.length) {
    const r = queue.shift();
    const name = r.file.replace(/\.[a-z]+$/i, "");
    const out = { name, file: r.file, host: r.host };
    try {
      const html = await fetchText(`https://${r.host}/`, 15);
      const found = html ? findLogo(html, `https://${r.host}/`, name) : null;
      if (!found) out.verdict = "no logo";
      else if (found.url && !/\.svg(\?|$)/i.test(found.url.split("?")[0])) out.verdict = "raster only";
      else {
        const staged = join(STAGE, "new", `${name}.svg`);
        if (found.inlineSvg) writeFileSync(staged, found.inlineSvg, "utf8");
        else if (!(await fetchTo(found.url, staged, 15))) out.verdict = "no logo";
        if (!out.verdict) {
          // A fetched ".svg" URL can still be an HTML error page.
          const head = readFileSync(staged, "utf8").slice(0, 300).toLowerCase();
          if (!head.includes("<svg")) out.verdict = "no logo";
          else {
            const c = compare(await signature(join(D, r.file)), await signature(staged));
            out.shape = +(c.shape * 100).toFixed(1);
            out.ink = Math.round(c.ink);
            out.staged = staged;
            out.verdict = c.shape < 0.12 ? "ready" : c.shape < 0.30 ? "check" : "different";
          }
        }
      }
    } catch {
      out.verdict = out.verdict ?? "no logo";
    }
    results.push(out);
    if (++done % 10 === 0) console.log(`  ${done}/${rows.length}`);
  }
}));

const order = { ready: 0, check: 1, different: 2, "raster only": 3, "no logo": 4 };
results.sort((a, b) => (order[a.verdict] - order[b.verdict]) || a.name.localeCompare(b.name));
writeFileSync(join(STAGE, "report.json"), JSON.stringify(results, null, 2));

const counts = results.reduce((a, r) => ((a[r.verdict] = (a[r.verdict] ?? 0) + 1), a), {});
console.log("\n" + Object.entries(counts).map(([k, v]) => `${String(v).padStart(4)}  ${k}`).join("\n"));

// Sheet for everything we actually downloaded: ours left, candidate right.
const sheet = results.filter((r) => r.staged);
const CW = 360, CH = 130, PER = 12, BG = "#6b6b6b";
for (let page = 0; page * PER < sheet.length; page++) {
  const slice = sheet.slice(page * PER, page * PER + PER);
  const cells = [];
  for (const [i, r] of slice.entries()) {
    const put = async (path, col, label) => {
      try {
        const buf = await sharp(path, { density: 200 })
          .resize({ width: CW - 16, height: CH - 34, fit: "contain", background: BG })
          .flatten({ background: BG }).png().toBuffer();
        cells.push({ input: buf, left: col * CW + 8, top: i * CH + 22 });
      } catch { /* skip */ }
      cells.push({
        input: Buffer.from(`<svg width="${CW - 16}" height="13"><text x="0" y="10" font-family="monospace" font-size="10" fill="#cfe">${label.slice(0, 48).replace(/[<>&]/g, "")}</text></svg>`),
        left: col * CW + 8, top: i * CH + CH - 12,
      });
    };
    await put(join(D, r.file), 0, `OURS ${r.file}`);
    await put(r.staged, 1, `SVG  ${r.host}`);
    cells.push({
      input: Buffer.from(`<svg width="700" height="15"><text x="0" y="11" font-family="monospace" font-size="11" fill="#00e5ff">${r.verdict.toUpperCase()}  shape ${r.shape}%  ${r.name.slice(0, 40).replace(/[<>&]/g, "")}</text></svg>`),
      left: 8, top: i * CH + 4,
    });
  }
  const out = join(STAGE, `svgify-${page}.png`);
  await sharp({ create: { width: 2 * CW, height: slice.length * CH, channels: 3, background: "#1a1a1a" } })
    .composite(cells).png().toFile(out);
  console.log(out);
}
console.log(`\nstaged in ${join(STAGE, "new")}\nreport: ${join(STAGE, "report.json")}`);
