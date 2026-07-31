// `npm run logos:sweep`
//
// Cheap first-pass staleness check across the WHOLE library. For every logo it
// guesses a domain from the name, then records what the internet says: does it
// resolve, where does it finally land, and what does the page call itself.
//
// The point is not to compare artwork — that needs `logos:verify` and human
// eyes. The point is to catch the class of error that matters most and can be
// spotted without eyes: a brand that no longer exists. A domain that redirects
// to a DIFFERENT host, or a title naming another company, is how Vækstfonden
// (now EIFO) was caught.
//
// MEASURED LIMITATION: guessing domains from a company name does not work well.
// Across 782 logos the guesses produced 217 non-resolving domains and 56 parked
// ones ("atlas.com" is not Atlas the VC, "plugandplay.com" is not Plug and Play
// Tech Center, "thetelegraph.net" is not The Telegraph) — almost all bad
// guesses rather than dead companies. Feed this script REAL domains (from the
// partner records) and it becomes useful; on guesses alone the yield is poor.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { execFile } from "node:child_process";
import { join } from "node:path";

const OUT_DIR = "C:/Users/User/AppData/Local/Temp/claude/C--Users-User/2f9c020b-7114-4a8f-bc56-3bbfba1f9e40/scratchpad/sweep";
mkdirSync(OUT_DIR, { recursive: true });

const LOGOS = JSON.parse(readFileSync("src/data/logoLibrary.json", "utf8"));
const CONCURRENCY = 12;
const TLDS = [".com", ".dk", ".io", ".co", ".org", ".vc", ".ai", ".net", ".eu", ".se", ".fi", ".no"];

// Variant/qualifier words that are not part of the company name.
const STRIP = /\b(white|black|dark|light|colour|color|grey|mono|inverted|negative|horizontal|vertical|stacked|full|icon|mark|large|small|logo|\d+)\b/gi;

/** Candidate domains for a logo name, best guess first. */
function domainsFor(name) {
  const base = name.replace(STRIP, " ").replace(/[^a-zA-Z0-9\s.&-]/g, " ").replace(/\s+/g, " ").trim();
  if (!base) return [];
  const slug = base.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (slug.length < 3) return [];
  const words = base.toLowerCase().split(" ").filter(Boolean);
  const short = words.length > 2 ? words.slice(0, 2).join("") : null;
  const out = [];
  for (const t of TLDS) out.push(slug + t);
  if (short && short !== slug) for (const t of TLDS.slice(0, 4)) out.push(short + t);
  return out.slice(0, 10);
}

const run = (args) => new Promise((resolve) => {
  execFile("curl", args, { timeout: 20000, maxBuffer: 4 << 20 }, (err, stdout) => resolve(stdout ?? ""));
});

/** First candidate domain that answers, with where it ended up. */
async function probe(name) {
  for (const d of domainsFor(name)) {
    // -I first (cheap); some hosts refuse HEAD, so fall back to a ranged GET.
    let out = await run(["-sIL", "-m", "8", "-A", "Mozilla/5.0", "-o", "/dev/null",
      "-w", "%{http_code} %{url_effective}", `https://${d}/`]);
    let [code, url] = out.trim().split(" ");
    if (!code || code === "000" || Number(code) >= 400) {
      out = await run(["-sL", "-m", "10", "-A", "Mozilla/5.0", "-r", "0-40000",
        "-w", "\n%{http_code} %{url_effective}", `https://${d}/`]);
      const lines = out.trim().split("\n");
      const last = lines[lines.length - 1].split(" ");
      code = last[0]; url = last[1];
      if (code && code !== "000" && Number(code) < 400) {
        const html = lines.slice(0, -1).join("\n");
        const title = (/<title[^>]*>([^<]{0,90})/i.exec(html)?.[1] ?? "").replace(/\s+/g, " ").trim();
        return { tried: d, code, finalUrl: url, title };
      }
      continue;
    }
    // Resolved via HEAD — one small GET for the title.
    const body = await run(["-sL", "-m", "10", "-A", "Mozilla/5.0", "-r", "0-40000", url ?? `https://${d}/`]);
    const title = (/<title[^>]*>([^<]{0,90})/i.exec(body)?.[1] ?? "").replace(/\s+/g, " ").trim();
    return { tried: d, code, finalUrl: url, title };
  }
  return null;
}

const hostOf = (u) => { try { return new URL(u).host.replace(/^www\./, ""); } catch { return ""; } };
/** Registrable name without its TLD: "www.eifo.dk" -> "eifo". Both sides of a
 *  redirect comparison MUST go through this — an earlier version normalised the
 *  host and the guessed domain with two different regexes, so 536 identical
 *  hosts were reported as redirects. */
const siteName = (hostOrDomain) => (hostOrDomain || "").replace(/^www\./, "").split(".")[0].toLowerCase();

const rows = [];
let done = 0;
const queue = [...LOGOS];
await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
  while (queue.length) {
    const l = queue.shift();
    const r = await probe(l.name);
    done++;
    if (done % 50 === 0) console.log(`  ${done}/${LOGOS.length}`);
    if (!r) { rows.push({ name: l.name, file: l.src, verdict: "no domain resolved" }); continue; }
    const host = hostOf(r.finalUrl ?? "");
    const redirected = Boolean(host) && siteName(host) !== siteName(r.tried);
    const flat = (x) => x.toLowerCase().replace(/[^a-z0-9]/g, "");
    const nameInTitle = flat(r.title).includes(flat(l.name.split(" ")[0]));
    const parked = /for sale|expired|parked|coming soon|hugedomains|spaceship|namecheap|godaddy|premium domain/i.test(r.title || "");
    rows.push({
      name: l.name, file: l.src, tried: r.tried, code: r.code, host, title: r.title,
      verdict: parked ? "domain parked / for sale (usually a BAD GUESS, not a dead company)"
        : redirected ? "redirects elsewhere"
        : nameInTitle ? "name matches page"
        : "name not in page title",
    });
  }
}));

rows.sort((a, b) => a.name.localeCompare(b.name));
writeFileSync(join(OUT_DIR, "domain-sweep.json"), JSON.stringify(rows, null, 2));
const counts = rows.reduce((a, r) => ((a[r.verdict] = (a[r.verdict] ?? 0) + 1), a), {});
console.log("\n" + Object.entries(counts).map(([k, v]) => `${String(v).padStart(4)}  ${k}`).join("\n"));
console.log("\n— redirects elsewhere (possible rebrand / dead brand) —");
for (const r of rows.filter((x) => x.verdict === "redirects elsewhere")) {
  console.log(`  ${r.name.padEnd(34)} ${r.tried.padEnd(26)} -> ${r.host.padEnd(26)} ${r.title.slice(0, 44)}`);
}
console.log(`\nfull report: ${join(OUT_DIR, "domain-sweep.json")}`);
