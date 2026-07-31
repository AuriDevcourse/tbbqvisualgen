// `npm run logos:compare`
//
// Compare EVERY library logo against the one its company ships today, and score
// the difference automatically so a human only has to look at the ones that
// disagree.
//
// Input is the domain sweep's report (`npm run logos:sweep` first), which
// already resolved a domain per logo. For each row: fetch the page, pull the
// site's own logo out of the header, and score silhouette + ink colour against
// our copy.
//
// SHAPE is the signal that matters. Ink colour is reported but never decides a
// verdict, because our copy is usually the white knockout while the site ships
// the colour version — same logo, different treatment.
//
// Verdicts:
//   match        silhouette within 12%  -> our artwork is current
//   check        12-30%                 -> needs eyes (sheet rendered)
//   mismatch     over 30%               -> needs eyes (sheet rendered)
//   no logo      nothing extractable from the page
//   unreadable   downloaded, but not a renderable image
import sharp from "sharp";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { fetchTo, fetchText, findLogo, signature, compare } from "./lib/logo-web.mjs";

const SCRATCH = "C:/Users/User/AppData/Local/Temp/claude/C--Users-User/2f9c020b-7114-4a8f-bc56-3bbfba1f9e40/scratchpad";
const SWEEP = join(SCRATCH, "sweep", "domain-sweep.json");
const WORK = join(SCRATCH, "webcheck");
const PREVIEWS = join(SCRATCH, "previews");
const D = "public/logos";
const CONCURRENCY = 8;
const LIMIT = Number(process.env.LIMIT ?? 0);      // 0 = everything

mkdirSync(WORK, { recursive: true });
mkdirSync(PREVIEWS, { recursive: true });

const batchArg = process.argv[2];
const sweep = batchArg
  ? readFileSync(batchArg, "utf8").split(/\r?\n/).map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#"))
      .map((l) => { const [file, host] = l.split("|").map((x) => x.trim()); return { name: file.replace(/\.[a-z]+$/i, ""), file: `/logos/${encodeURIComponent(file)}`, tried: host, host }; })
  : JSON.parse(readFileSync(SWEEP, "utf8"));
const TONES = new Map(JSON.parse(readFileSync("src/data/logoLibrary.json", "utf8"))
  .map((l) => [l.name, l.tone]));

// Only rows where a domain answered are comparable.
let rows = sweep.filter((r) => r.host && r.tried);
if (LIMIT) rows = rows.slice(0, LIMIT);
console.log(`comparing ${rows.length} logos that have a live site\n`);

const results = [];
let done = 0;
const queue = [...rows];
await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
  while (queue.length) {
    const r = queue.shift();
    const file = decodeURIComponent(r.file.replace("/logos/", ""));
    const stem = r.tried.replace(/[^a-z0-9]/gi, "_");
    const out = { name: r.name, file, domain: r.tried, host: r.host, title: r.title };
    try {
      const html = await fetchText(`https://${r.tried}/`, 15);
      const found = html ? findLogo(html, `https://${r.tried}/`, r.name) : null;
      if (!found) {
        out.verdict = "no logo";
      } else {
        let live;
        if (found.inlineSvg) {
          live = join(WORK, `${stem}_live.svg`);
          writeFileSync(live, found.inlineSvg, "utf8");
        } else {
          const ext = (found.url.split("?")[0].match(/\.(svg|png|jpe?g|webp|avif)$/i)?.[1] ?? "png").toLowerCase();
          live = join(WORK, `${stem}_live.${ext}`);
          if (!(await fetchTo(found.url, live, 15))) live = null;
        }
        if (!live) out.verdict = "no logo";
        else {
          try {
            const [ours, theirs] = [await signature(join(D, file)), await signature(live)];
            const c = compare(ours, theirs);
            out.shape = +(c.shape * 100).toFixed(1);
            out.ink = Math.round(c.ink);
            out.live = live;
            out.verdict = c.shape < 0.12 ? "match" : c.shape < 0.30 ? "check" : "mismatch";
          } catch {
            out.verdict = "unreadable";
            out.live = live;
          }
        }
      }
    } catch {
      out.verdict = "no logo";
    }
    results.push(out);
    if (++done % 25 === 0) console.log(`  ${done}/${rows.length}`);
  }
}));

results.sort((a, b) => (b.shape ?? 999) - (a.shape ?? 999) || a.name.localeCompare(b.name));
writeFileSync(join(SCRATCH, "sweep", "logo-compare.json"), JSON.stringify(results, null, 2));

const counts = results.reduce((a, r) => ((a[r.verdict] = (a[r.verdict] ?? 0) + 1), a), {});
console.log("\n" + Object.entries(counts).map(([k, v]) => `${String(v).padStart(4)}  ${k}`).join("\n"));

// Sheets for the rows that need eyes: ours left, live right.
const needEyes = results.filter((r) => r.verdict === "check" || r.verdict === "mismatch");
const CW = 360, CH = 120, PER = 14, BG = "#6b6b6b";
for (let page = 0; page * PER < needEyes.length; page++) {
  const slice = needEyes.slice(page * PER, page * PER + PER);
  const cells = [];
  for (const [i, r] of slice.entries()) {
    const oursBg = TONES.get(r.name) === "light" ? "#141414" : BG;
    const put = async (path, col, label, bg) => {
      try {
        const buf = await sharp(path, { density: 150 })
          .resize({ width: CW - 14, height: CH - 30, fit: "contain", background: bg })
          .flatten({ background: bg }).png().toBuffer();
        cells.push({ input: buf, left: col * CW + 7, top: i * CH + 18 });
      } catch { /* skip */ }
      cells.push({
        input: Buffer.from(`<svg width="${CW - 14}" height="13"><text x="0" y="10" font-family="monospace" font-size="10" fill="#cfe">${label.slice(0, 46).replace(/[<>&]/g, "")}</text></svg>`),
        left: col * CW + 7, top: i * CH + CH - 13,
      });
    };
    await put(join(D, r.file), 0, `OURS ${r.file}`, oursBg);
    if (r.live) await put(r.live, 1, `LIVE ${r.domain}`, BG);
    cells.push({
      input: Buffer.from(`<svg width="700" height="14"><text x="0" y="11" font-family="monospace" font-size="11" fill="#00e5ff">${page * PER + i} shape ${r.shape ?? "?"}% ink ${r.ink ?? "?"} — ${r.name.slice(0, 40).replace(/[<>&]/g, "")}</text></svg>`),
      left: 7, top: i * CH + 3,
    });
  }
  const out = join(PREVIEWS, `compare-${page}.png`);
  await sharp({ create: { width: 2 * CW, height: slice.length * CH, channels: 3, background: "#1f1f1f" } })
    .composite(cells).png().toFile(out);
  console.log(out);
}
console.log(`\nreport: ${join(SCRATCH, "sweep", "logo-compare.json")}`);
