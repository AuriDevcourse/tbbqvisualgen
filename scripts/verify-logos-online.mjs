// `npm run logos:verify -- scripts/logo-checks/batch1.txt [tag]`
//
// Check library logos against what each company ships on its own site TODAY.
// Input is one "Our file.svg|domain.com" per line. For each row: fetch the
// homepage, pull the logo out of the header, download it, and compose it beside
// our copy so a human can compare the pair. Writes a sheet to the scratchpad
// previews dir and a JSON summary.
//
// Known limits, so nobody over-trusts it:
//   * there is no reverse IMAGE search available — this is name + own-site
//     verification, which is the closest honest equivalent;
//   * a domain must be supplied per company (no reliable way to guess);
//   * expect roughly 1 in 4 rows to grab the wrong asset (sites differ wildly);
//     those need a manual look rather than a silent pass.
import sharp from "sharp";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const D = "public/logos";
const WORK = "C:/Users/User/AppData/Local/Temp/claude/C--Users-User/2f9c020b-7114-4a8f-bc56-3bbfba1f9e40/scratchpad/webcheck";
const OUT = "C:/Users/User/AppData/Local/Temp/claude/C--Users-User/2f9c020b-7114-4a8f-bc56-3bbfba1f9e40/scratchpad/previews";
const TONES = new Map(JSON.parse(readFileSync("src/data/logoLibrary.json", "utf8"))
  .map((l) => [decodeURIComponent(l.src.replace("/logos/", "")), l.tone]));

const curl = (url, out) => {
  try {
    execFileSync("curl", ["-sL", "-m", "25", "-A", "Mozilla/5.0", "-o", out, url], { stdio: "pipe" });
    return existsSync(out);
  } catch { return false; }
};

/**
 * Pick the site's OWN logo. Scoped to the header/nav block first, because a
 * marketing page is full of customer logos — an unscoped search returned
 * "Lovable" for antler.co and "FOSSIL" for cloudflare.com. Inline <svg> is
 * supported too: that is where most modern sites keep the wordmark, and it can
 * be written straight out as a file.
 */
function findLogo(html, base, name) {
  const abs = (u) => { try { return new URL(u, base).href; } catch { return null; } };
  // Header-ish region: up to the first </header>, or the first 40KB.
  const headEnd = html.search(/<\/header>/i);
  const region = headEnd > 0 ? html.slice(0, headEnd) : html.slice(0, 40000);
  const brand = name.toLowerCase().replace(/[^a-z0-9]/g, "");

  // 1. Inline <svg> that looks like a logo.
  for (const m of region.matchAll(/<svg[\s\S]{0,20000}?<\/svg>/gi)) {
    const svg = m[0];
    const head = svg.slice(0, 400).toLowerCase();
    if (!/logo|brand|wordmark/.test(head) && !(brand && head.includes(brand))) continue;
    if (/menu|burger|arrow|chevron|close|search|play/.test(head)) continue;
    if (svg.length < 300) continue;                       // an icon, not a wordmark
    return { inlineSvg: svg.replace(/^<svg/i, '<svg xmlns="http://www.w3.org/2000/svg"').replace(/xmlns="[^"]*"\s+xmlns=/, "xmlns=") };
  }
  // 2. <img> inside the header.
  const cands = [];
  for (const m of region.matchAll(/<img[^>]+>/gi)) {
    const tag = m[0], hay = tag.toLowerCase();
    const src = /src\s*=\s*["']([^"']+)/i.exec(tag)?.[1];
    if (!src) continue;
    let score = 0;
    if (/logo|brand|wordmark/.test(hay)) score += 10;
    if (brand && hay.includes(brand)) score += 8;
    if (/\.svg(\?|$)/i.test(src)) score += 6;
    if (/icon|favicon|sprite|avatar|flag|badge|award/.test(hay)) score -= 6;
    if (score > 4) cands.push({ url: abs(src), score });
  }
  cands.sort((a, b) => b.score - a.score);
  if (cands[0]?.url) return { url: cands[0].url };
  // 3. Last resort: a file whose PATH mentions the brand or "logo", anywhere.
  for (const m of html.matchAll(/["']([^"']*\/[^"']*(?:logo|wordmark)[^"']*\.(?:svg|png))["']/gi)) {
    const u = abs(m[1]);
    if (u) return { url: u };
  }
  return null;
}

const rows = readFileSync(process.argv[2], "utf8").split("\n").map((l) => l.trim()).filter(Boolean)
  .map((l) => { const [file, domain] = l.split("|"); return { file: file.trim(), domain: domain.trim() }; });

const results = [];
for (const r of rows) {
  const html = join(WORK, `${r.domain.replace(/[^a-z0-9]/gi, "_")}.html`);
  const ok = curl(`https://${r.domain}/`, html);
  if (!ok) { results.push({ ...r, status: "site unreachable" }); continue; }
  const body = readFileSync(html, "utf8");
  const title = (/<title[^>]*>([^<]{0,80})/i.exec(body)?.[1] ?? "").replace(/\s+/g, " ").trim();
  const found = findLogo(body, `https://${r.domain}/`, r.file.replace(/\.[a-z]+$/i, ""));
  if (!found) { results.push({ ...r, title, status: "no logo found in header" }); continue; }
  const stem = r.domain.replace(/[^a-z0-9]/gi, "_");
  if (found.inlineSvg) {
    const live = join(WORK, `${stem}_live.svg`);
    writeFileSync(live, found.inlineSvg, "utf8");
    results.push({ ...r, title, source: "inline svg", live, status: "ok" });
    continue;
  }
  const ext = (found.url.split("?")[0].match(/\.(svg|png|jpe?g|webp|avif)$/i)?.[1] ?? "png").toLowerCase();
  const live = join(WORK, `${stem}_live.${ext}`);
  const got = curl(found.url, live);
  results.push({ ...r, title, logoUrl: found.url, source: "img", live: got ? live : null, status: got ? "ok" : "logo download failed" });
}

// Sheet: ours on the left, theirs on the right.
const CW = 380, CH = 130, BG = "#6b6b6b";
const cells = [];
for (const [i, r] of results.entries()) {
  const tone = TONES.get(r.file) ?? "mixed";
  const oursBg = tone === "light" ? "#141414" : BG;
  const put = async (path, col, label, bg) => {
    try {
      const buf = await sharp(path, { density: 150 })
        .resize({ width: CW - 14, height: CH - 30, fit: "contain", background: bg })
        .flatten({ background: bg }).png().toBuffer();
      cells.push({ input: buf, left: col * CW + 7, top: i * CH + 18 });
    } catch { /* unrenderable */ }
    cells.push({
      input: Buffer.from(`<svg width="${CW - 14}" height="13"><text x="0" y="10" font-family="monospace" font-size="10" fill="#cfe">${label.slice(0, 48).replace(/[<>&]/g, "")}</text></svg>`),
      left: col * CW + 7, top: i * CH + CH - 13,
    });
  };
  await put(join(D, r.file), 0, `OURS  ${r.file}`, oursBg);
  if (r.live) await put(r.live, 1, `LIVE  ${r.domain}`, BG);
  else cells.push({
    input: Buffer.from(`<svg width="${CW - 20}" height="20"><text x="0" y="14" font-family="monospace" font-size="12" fill="#ff9">${r.status}</text></svg>`),
    left: CW + 10, top: i * CH + 50,
  });
  cells.push({
    input: Buffer.from(`<svg width="740" height="14"><text x="0" y="11" font-family="monospace" font-size="11" fill="#00e5ff">${i} ${r.domain} — ${(r.title || "").slice(0, 60).replace(/[<>&]/g, "")}</text></svg>`),
    left: 7, top: i * CH + 3,
  });
}
await sharp({ create: { width: 2 * CW, height: results.length * CH, channels: 3, background: "#1f1f1f" } })
  .composite(cells).png().toFile(join(OUT, `web-${process.argv[3] ?? "0"}.png`));

writeFileSync(join(WORK, "web-check.json"), JSON.stringify(results, null, 2));
for (const r of results) console.log(`${r.status.padEnd(28)} ${r.file.padEnd(34)} ${r.domain}`);
