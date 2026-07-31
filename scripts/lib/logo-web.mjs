// Shared helpers for checking library logos against company websites:
// fetching, pulling the site's own logo out of a page, and scoring how close
// two logo files are. Used by verify-logos-online.mjs and
// compare-logos-online.mjs.
import sharp from "sharp";
import { execFile } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";

/** curl to a file. Resolves true when something was written. */
export function fetchTo(url, out, timeout = 20) {
  return new Promise((resolve) => {
    execFile("curl", ["-sL", "-m", String(timeout), "-A", "Mozilla/5.0", "-o", out, url],
      { timeout: (timeout + 5) * 1000 }, () => resolve(existsSync(out)));
  });
}

/** curl to a string (capped, so a huge page can't blow memory). */
export function fetchText(url, timeout = 20) {
  return new Promise((resolve) => {
    execFile("curl", ["-sL", "-m", String(timeout), "-A", "Mozilla/5.0", "-r", "0-300000", url],
      { timeout: (timeout + 5) * 1000, maxBuffer: 8 << 20 }, (err, stdout) => resolve(stdout ?? ""));
  });
}

/**
 * Pull the site's OWN logo out of a page.
 *
 * Scoped to the header/nav region first: a marketing page is full of customer
 * logos, and an unscoped search returned "Lovable" for antler.co and "FOSSIL"
 * for cloudflare.com. Inline <svg> is handled too — that is where most modern
 * sites keep the wordmark, and it can be written straight out as a file.
 *
 * Returns { inlineSvg } or { url }, or null when nothing logo-like is found.
 */
export function findLogo(html, base, name) {
  const abs = (u) => { try { return new URL(u, base).href; } catch { return null; } };
  const headEnd = html.search(/<\/header>/i);
  const region = headEnd > 0 ? html.slice(0, headEnd) : html.slice(0, 40000);
  const brand = name.toLowerCase().replace(/[^a-z0-9]/g, "");

  for (const m of region.matchAll(/<svg[\s\S]{0,20000}?<\/svg>/gi)) {
    const svg = m[0];
    const head = svg.slice(0, 400).toLowerCase();
    if (!/logo|brand|wordmark/.test(head) && !(brand && head.includes(brand))) continue;
    if (/menu|burger|arrow|chevron|close|search|play|cart|user/.test(head)) continue;
    if (svg.length < 300) continue;                    // an icon, not a wordmark
    return { inlineSvg: svg.replace(/^<svg/i, '<svg xmlns="http://www.w3.org/2000/svg"').replace(/xmlns="[^"]*"\s+xmlns=/, "xmlns=") };
  }
  const cands = [];
  for (const m of region.matchAll(/<img[^>]+>/gi)) {
    const tag = m[0], hay = tag.toLowerCase();
    const src = /src\s*=\s*["']([^"']+)/i.exec(tag)?.[1];
    if (!src || src.startsWith("data:")) continue;
    let score = 0;
    if (/logo|brand|wordmark/.test(hay)) score += 10;
    if (brand && hay.includes(brand)) score += 8;
    if (/\.svg(\?|$)/i.test(src)) score += 6;
    if (/icon|favicon|sprite|avatar|flag|badge|award|partner|client|customer/.test(hay)) score -= 6;
    if (score > 4) cands.push({ url: abs(src), score });
  }
  cands.sort((a, b) => b.score - a.score);
  if (cands[0]?.url) return { url: cands[0].url };
  for (const m of html.matchAll(/["']([^"']*\/[^"']*(?:logo|wordmark)[^"']*\.(?:svg|png))["']/gi)) {
    const u = abs(m[1]);
    if (u) return { url: u };
  }
  return null;
}

export function writeInlineSvg(svg, out) {
  writeFileSync(out, svg, "utf8");
  return out;
}

const N = 48;

/**
 * Ink signature of a logo file: silhouette mask + mean ink colour, measured
 * after trimming to the artwork. So a white-on-transparent mark and one on a
 * white card are both read correctly.
 *
 * Transparency decides what is background WHENEVER the file has any, because
 * alpha is unambiguous and position is not. Trimming crops to the artwork, so a
 * wordmark whose first letter sits flush in the corner ("Uber", "Revolut",
 * "Accenture", "Y Combinator") puts INK at pixel 0 — reading background from
 * that pixel made every ink pixel count as background, emptied the mask and
 * threw "blank", silently dropping 15 of 778 library logos out of duplicate
 * detection and import matching. Reading the border instead just moves the bug:
 * a tightly trimmed wordmark has an ink-heavy border too.
 *
 * Only a genuinely opaque image falls back to colour, and then the background is
 * the MEDIAN border colour, so a few ink pixels along one edge cannot move it.
 */
export async function signature(file) {
  let src = file, tw = 0, th = 0;
  try {
    const t = await sharp(file, { density: 200 }).ensureAlpha().trim({ threshold: 10 }).png().toBuffer({ resolveWithObject: true });
    src = t.data; tw = t.info.width; th = t.info.height;
  } catch { /* nothing to trim */ }
  const { data } = await sharp(src, typeof src === "string" ? { density: 200 } : undefined)
    .resize(N, N, { fit: "fill" }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const px = (i) => [data[i * 4], data[i * 4 + 1], data[i * 4 + 2], data[i * 4 + 3]];

  let clear = 0;
  for (let i = 0; i < N * N; i++) if (px(i)[3] < 40) clear++;
  const transparent = clear > N * N * 0.02;

  const border = [];
  for (let i = 0; i < N; i++) border.push(i, (N - 1) * N + i, i * N, i * N + N - 1);
  const median = (k) => { const v = border.map((i) => px(i)[k]).sort((a, b) => a - b); return v[v.length >> 1]; };
  const bgc = transparent ? null : [median(0), median(1), median(2)];

  const mask = new Uint8Array(N * N);
  let r = 0, g = 0, b = 0, n = 0;
  for (let i = 0; i < N * N; i++) {
    const p = px(i);
    const bg = transparent ? p[3] < 40
      : p[3] < 40 || (Math.abs(p[0] - bgc[0]) < 40 && Math.abs(p[1] - bgc[1]) < 40 && Math.abs(p[2] - bgc[2]) < 40);
    mask[i] = bg ? 0 : 1;
    if (!bg) { r += p[0]; g += p[1]; b += p[2]; n++; }
  }
  if (n < 4) throw new Error("blank");
  return { mask, ink: [r / n, g / n, b / n], ar: tw && th ? tw / th : 0, density: n / (N * N) };
}

/** How different two signatures are: silhouette % and max ink-channel delta. */
export function compare(a, b) {
  let d = 0;
  for (let i = 0; i < a.mask.length; i++) if (a.mask[i] !== b.mask[i]) d++;
  return {
    shape: d / a.mask.length,
    ink: Math.max(...[0, 1, 2].map((k) => Math.abs(a.ink[k] - b.ink[k]))),
  };
}
