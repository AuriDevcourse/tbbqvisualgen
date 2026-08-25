/**
 * One-off migration: base64 photos inside saved templates -> Vercel Blob URLs.
 *
 * Why: 95% of the ~626KB the editor downloads on every focus refresh is four
 * base64 JPEGs embedded in template documents. base64 is ~33% larger than the
 * bytes it encodes, a CDN cannot cache it, and Neon bills egress on every read.
 * New uploads already go to Blob; this converts the ones saved before that.
 *
 * SAFETY
 * - Dry run by default. Pass --write to actually update rows.
 * - Every affected row is dumped to a timestamped .json backup BEFORE any write,
 *   and the script refuses to write if the backup cannot be created.
 * - Reads DATABASE_URL from the environment, so pointing it at the `dev` branch
 *   rehearses the whole thing against a copy. Run it there first.
 * - Idempotent: rows with no `data:` src are skipped, so a second run is a
 *   no-op rather than a duplicate upload.
 *
 * Usage:
 *   node scripts/migrate-photos-to-blob.mjs           # dry run
 *   node scripts/migrate-photos-to-blob.mjs --write   # apply
 */
import { neon } from "@neondatabase/serverless";
import { put } from "@vercel/blob";
import { writeFileSync } from "node:fs";

const WRITE = process.argv.includes("--write");
const DATA_URL_RE = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/;

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");
if (WRITE && !process.env.BLOB_READ_WRITE_TOKEN) {
  throw new Error("BLOB_READ_WRITE_TOKEN is not set — uploads would fail");
}
const sql = neon(url);
const host = new URL(url.replace("postgresql://", "https://")).hostname.split(".")[0];

/** Walks any nested structure and yields every { holder, key } whose value is a data URL. */
function findDataUrls(node, out = []) {
  if (Array.isArray(node)) {
    for (const v of node) findDataUrls(v, out);
  } else if (node && typeof node === "object") {
    for (const [k, v] of Object.entries(node)) {
      // `thumbnail` is deliberately left alone: it is served by its own
      // endpoint and never rides along in the list payload.
      if (typeof v === "string" && k !== "thumbnail" && DATA_URL_RE.test(v)) out.push({ holder: node, key: k });
      else findDataUrls(v, out);
    }
  }
  return out;
}

const rows = await sql`SELECT id, kind, data FROM editor_items WHERE kind = 'template' ORDER BY updated_at DESC`;
console.log(`branch ${host} · ${rows.length} templates\n`);

const affected = [];
for (const r of rows) {
  const hits = findDataUrls(r.data);
  if (hits.length === 0) continue;
  const bytes = hits.reduce((n, h) => n + h.holder[h.key].length, 0);
  affected.push({ row: r, hits, bytes });
  console.log(`  ${String(r.data?.name ?? r.id).slice(0, 34).padEnd(34)} ${hits.length} image(s)  ${Math.round(bytes / 1024)}KB`);
}

if (affected.length === 0) {
  console.log("\nNothing to migrate — no data: URLs found. (Safe to re-run.)");
  process.exit(0);
}

const total = affected.reduce((n, a) => n + a.bytes, 0);
console.log(`\n${affected.length} template(s), ${Math.round(total / 1024)}KB of base64`);

if (!WRITE) {
  console.log("\nDRY RUN — nothing written. Re-run with --write to apply.");
  process.exit(0);
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const backup = `backup-templates-${host}-${stamp}.json`;
writeFileSync(backup, JSON.stringify(affected.map((a) => ({ id: a.row.id, kind: a.row.kind, data: a.row.data })), null, 2));
console.log(`\nbackup written: ${backup}`);

let uploaded = 0;
for (const a of affected) {
  for (const h of a.hits) {
    const m = DATA_URL_RE.exec(h.holder[h.key]);
    const [, mime, b64] = m;
    const ext = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
    const { url: blobUrl } = await put(`photos/migrated-${Date.now()}.${ext}`, Buffer.from(b64, "base64"), {
      access: "public",
      contentType: mime,
      addRandomSuffix: true,
      cacheControlMaxAge: 31_536_000,
    });
    h.holder[h.key] = blobUrl;
    uploaded++;
  }
  await sql`UPDATE editor_items SET data = ${JSON.stringify(a.row.data)}::jsonb WHERE id = ${a.row.id}`;
  console.log(`  updated ${String(a.row.data?.name ?? a.row.id).slice(0, 40)}`);
}

console.log(`\ndone: ${uploaded} image(s) moved to Blob across ${affected.length} template(s)`);
console.log(`restore with the backup above if anything looks wrong.`);
