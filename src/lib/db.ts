import { neon } from "@neondatabase/serverless";

/**
 * Neon Postgres client for the team library. `DATABASE_URL` comes from the
 * Vercel Neon integration (or .env.local in dev). Fails CLOSED: without the
 * env var every library call errors instead of silently doing nothing.
 */
function sql() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return neon(url);
}

/** One shared team library. `doc` is the full SimpleDoc/DocSnapshot JSON. */
export interface LibraryRow {
  id: string;
  name: string;
  kind: string; // "panel" | "partner" | "editor"
  doc: unknown;
  updated_by: string;
  updated_at: string;
}

let ensured = false;
async function ensureTable(): Promise<void> {
  if (ensured) return;
  await sql()`
    CREATE TABLE IF NOT EXISTS library_items (
      id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name       text NOT NULL,
      kind       text NOT NULL,
      doc        jsonb NOT NULL,
      updated_by text NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    )`;
  ensured = true;
}

export async function listItems(): Promise<Omit<LibraryRow, "doc">[]> {
  await ensureTable();
  const rows = await sql()`
    SELECT id, name, kind, updated_by, updated_at
    FROM library_items ORDER BY updated_at DESC LIMIT 200`;
  return rows as Omit<LibraryRow, "doc">[];
}

export async function getItem(id: string): Promise<LibraryRow | null> {
  await ensureTable();
  const rows = await sql()`SELECT * FROM library_items WHERE id = ${id}`;
  return (rows[0] as LibraryRow) ?? null;
}

export async function createItem(name: string, kind: string, doc: unknown, updatedBy: string): Promise<string> {
  await ensureTable();
  const rows = await sql()`
    INSERT INTO library_items (name, kind, doc, updated_by)
    VALUES (${name}, ${kind}, ${JSON.stringify(doc)}::jsonb, ${updatedBy})
    RETURNING id`;
  return (rows[0] as { id: string }).id;
}

export async function updateItem(id: string, name: string, kind: string, doc: unknown, updatedBy: string): Promise<boolean> {
  await ensureTable();
  const rows = await sql()`
    UPDATE library_items
    SET name = ${name}, kind = ${kind}, doc = ${JSON.stringify(doc)}::jsonb, updated_by = ${updatedBy}, updated_at = now()
    WHERE id = ${id} RETURNING id`;
  return rows.length > 0;
}

export async function deleteItem(id: string): Promise<boolean> {
  await ensureTable();
  const rows = await sql()`DELETE FROM library_items WHERE id = ${id} RETURNING id`;
  return rows.length > 0;
}
