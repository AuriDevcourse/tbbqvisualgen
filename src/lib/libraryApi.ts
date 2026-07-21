import { NextResponse } from "next/server";

/**
 * Shared guards for the library API: per-user rate limit, body validation,
 * and safe error responses (SECURITY.md r4, r8, r20).
 *
 * The rate limiter is in-memory per serverless instance — best-effort, not a
 * hard wall. The primary protection is the @techbbq.org auth gate; this only
 * stops a runaway client from hammering the DB.
 */

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 30;

const store = ((globalThis as Record<string, unknown>).__libraryRate ??= new Map<string, number[]>()) as Map<string, number[]>;

export function checkRate(key: string): NextResponse | null {
  const now = Date.now();
  const hits = (store.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (hits.length >= MAX_PER_WINDOW) {
    return NextResponse.json(
      { error: "Too many requests — wait a minute and try again" },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }
  hits.push(now);
  store.set(key, hits);
  return null;
}

const KINDS = new Set(["panel", "partner", "editor"]);
/** Keep well under Vercel's ~4.5MB serverless body cap so failures are OURS
 *  (a clear 413) rather than an opaque platform error. */
const MAX_BYTES = 4_000_000;

export interface ItemBody {
  name: string;
  kind: string;
  doc: Record<string, unknown>;
}

export async function validateItemBody(req: Request): Promise<ItemBody | NextResponse> {
  let raw: string;
  try {
    raw = await req.text();
  } catch {
    return NextResponse.json({ error: "Unreadable request body" }, { status: 400 });
  }
  if (raw.length > MAX_BYTES) {
    return NextResponse.json(
      { error: "Design too large to save — it exceeds 4MB. Large uploaded photos are usually the cause." },
      { status: 413 },
    );
  }
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }
  const b = body as Partial<ItemBody>;
  const name = typeof b.name === "string" ? b.name.trim().slice(0, 120) : "";
  if (!name) return NextResponse.json({ error: "A name is required" }, { status: 422 });
  if (typeof b.kind !== "string" || !KINDS.has(b.kind)) {
    return NextResponse.json({ error: "kind must be panel, partner or editor" }, { status: 422 });
  }
  const doc = b.doc;
  if (!doc || typeof doc !== "object" || !("design" in doc) || !("format" in doc)) {
    return NextResponse.json({ error: "doc must be a design document" }, { status: 422 });
  }
  return { name, kind: b.kind, doc: doc as Record<string, unknown> };
}

/** Log the real error server-side, return a safe generic message (r20). */
export function errorResponse(e: unknown): NextResponse {
  const id = Math.random().toString(36).slice(2, 10);
  console.error(`[library ${id}]`, e);
  const notConfigured = e instanceof Error && e.message.includes("DATABASE_URL");
  return NextResponse.json(
    {
      error: notConfigured
        ? "The team library is not configured yet (missing database)"
        : `Library error — try again (ref ${id})`,
    },
    { status: notConfigured ? 503 : 500 },
  );
}
