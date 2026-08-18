import { neon } from "@neondatabase/serverless";

/**
 * Shared editor library — the Templates list every signed-in TechBBQ person
 * sees. Before 2026-08-18 all of this lived in each browser's localStorage,
 * so a preset one person built was invisible to everyone else.
 *
 * Two tables, on purpose:
 *
 *   editor_items    one row per THING (a user preset, a saved template, or a
 *                   built-in override). Row-per-item because these carry full
 *                   design snapshots and photo data URLs — up to megabytes
 *                   each. A single blob row would mean every rename rewrote
 *                   the whole library and two people saving at once would
 *                   stomp each other.
 *
 *   editor_settings two small shared lists (which built-ins are hidden, what
 *                   order the folders sit in). Both are inherently whole-list
 *                   values, so full replace is the correct write and
 *                   last-write-wins is fine.
 *
 * Fails CLOSED like lib/db.ts: no DATABASE_URL means every call throws rather
 * than silently pretending to save.
 */
function sql() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return neon(url);
}

/** `preset` = user-built preset · `template` = saved template with thumbnail ·
 *  `override` = a rename / folder move / format variant layered on a built-in
 *  preset (id is the built-in's own id). */
export const ITEM_KINDS = new Set(["preset", "template", "override"]);
/** Only these two settings keys exist. Anything else is a 422 — an unknown key
 *  is a client bug, not something to persist and forget about. */
export const SETTING_KEYS = new Set(["hiddenPresets", "folderOrder"]);

export interface EditorItemRow {
  id: string;
  kind: string;
  data: unknown;
  updated_by: string;
  updated_at: string;
}

let ensured = false;
async function ensureTables(): Promise<void> {
  if (ensured) return;
  const q = sql();
  await q`
    CREATE TABLE IF NOT EXISTS editor_items (
      id         text PRIMARY KEY,
      kind       text NOT NULL,
      data       jsonb NOT NULL,
      updated_by text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )`;
  // Every read filters on kind and orders by updated_at (SECURITY.md r21 —
  // an unindexed user-driven lookup is a soft DoS).
  await q`CREATE INDEX IF NOT EXISTS editor_items_kind_idx ON editor_items (kind, updated_at DESC)`;
  await q`
    CREATE TABLE IF NOT EXISTS editor_settings (
      key        text PRIMARY KEY,
      data       jsonb NOT NULL,
      updated_by text NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    )`;
  ensured = true;
}

/** Hard ceiling on rows returned so one runaway save spree can't make the
 *  editor's first paint download an unbounded payload. */
const LIST_LIMIT = 500;

export interface SharedLibrary {
  presets: unknown[];
  templates: unknown[];
  overrides: Record<string, unknown>;
  hiddenPresets: string[];
  folderOrder: string[];
  /** True when the list hit LIST_LIMIT, so the UI can say so instead of
   *  quietly showing a truncated library. */
  truncated: boolean;
}

export async function readLibrary(): Promise<SharedLibrary> {
  await ensureTables();
  const q = sql();
  const [items, settings] = await Promise.all([
    q`SELECT id, kind, data FROM editor_items ORDER BY updated_at DESC LIMIT ${LIST_LIMIT}`,
    q`SELECT key, data FROM editor_settings`,
  ]);
  const rows = items as { id: string; kind: string; data: unknown }[];
  const settingOf = (key: string): unknown =>
    (settings as { key: string; data: unknown }[]).find((s) => s.key === key)?.data;
  const asStringArray = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

  const overrides: Record<string, unknown> = {};
  for (const r of rows) if (r.kind === "override") overrides[r.id] = r.data;

  return {
    presets: rows.filter((r) => r.kind === "preset").map((r) => r.data),
    // Thumbnails are stripped: at ~90KB of base64 each they would dominate the
    // payload the editor downloads on every load. The client fetches them from
    // /api/editor-library/thumbnails right after, and the card shows
    // "No preview" for the moment in between.
    templates: rows.filter((r) => r.kind === "template").map((r) => stripThumbnail(r.data)),
    overrides,
    hiddenPresets: asStringArray(settingOf("hiddenPresets")),
    folderOrder: asStringArray(settingOf("folderOrder")),
    truncated: rows.length >= LIST_LIMIT,
  };
}

function stripThumbnail(data: unknown): unknown {
  if (!data || typeof data !== "object") return data;
  const rest = { ...(data as Record<string, unknown>) };
  delete rest.thumbnail;
  return rest;
}

/** Just the template thumbnails, keyed by template id. Split out from
 *  readLibrary so the editor's first paint isn't waiting on megabytes of
 *  base64 PNG. */
export async function readThumbnails(): Promise<Record<string, string>> {
  await ensureTables();
  const rows = await sql()`
    SELECT id, data->>'thumbnail' AS thumbnail
    FROM editor_items
    WHERE kind = 'template' AND data ? 'thumbnail'
    ORDER BY updated_at DESC LIMIT ${LIST_LIMIT}`;
  const out: Record<string, string> = {};
  for (const r of rows as { id: string; thumbnail: string | null }[]) {
    if (r.thumbnail) out[r.id] = r.thumbnail;
  }
  return out;
}

export async function upsertItem(id: string, kind: string, data: unknown, updatedBy: string): Promise<void> {
  await ensureTables();
  await sql()`
    INSERT INTO editor_items (id, kind, data, updated_by)
    VALUES (${id}, ${kind}, ${JSON.stringify(data)}::jsonb, ${updatedBy})
    ON CONFLICT (id) DO UPDATE
      SET kind = EXCLUDED.kind,
          -- Carry the stored thumbnail over when the incoming write omits it.
          -- The client is served thumbnail-free templates (see readLibrary), so
          -- a rename issued before the previews finish loading would otherwise
          -- write the template back WITHOUT its thumbnail and lose it.
          data = CASE
            WHEN EXCLUDED.data ? 'thumbnail' OR NOT (editor_items.data ? 'thumbnail')
              THEN EXCLUDED.data
            ELSE EXCLUDED.data || jsonb_build_object('thumbnail', editor_items.data->'thumbnail')
          END,
          updated_by = EXCLUDED.updated_by,
          updated_at = now()`;
}

export async function deleteItem(id: string): Promise<boolean> {
  await ensureTables();
  const rows = await sql()`DELETE FROM editor_items WHERE id = ${id} RETURNING id`;
  return rows.length > 0;
}

export async function writeSetting(key: string, data: unknown, updatedBy: string): Promise<void> {
  await ensureTables();
  await sql()`
    INSERT INTO editor_settings (key, data, updated_by)
    VALUES (${key}, ${JSON.stringify(data)}::jsonb, ${updatedBy})
    ON CONFLICT (key) DO UPDATE
      SET data = EXCLUDED.data,
          updated_by = EXCLUDED.updated_by,
          updated_at = now()`;
}
