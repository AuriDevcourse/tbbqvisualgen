import { NextResponse } from "next/server";
import { ITEM_KINDS } from "@/lib/editorLibraryDb";

/**
 * Guards for the shared editor library API.
 *
 * Reads are OPEN because /editor itself is open — an unauthenticated visitor
 * still needs to see the team's templates. Writes require an @techbbq.org
 * session, so an open page can't be used to vandalise the shared list
 * (SECURITY.md r5). Both sides are rate limited (r8): writes per account,
 * reads per IP.
 *
 * The limiter is in-memory per serverless instance — best effort, not a hard
 * wall. On Vercel each instance keeps its own counter.
 */
const WINDOW_MS = 60_000;

const store = ((globalThis as Record<string, unknown>).__editorLibRate ??= new Map<string, number[]>()) as Map<string, number[]>;

export function checkRate(key: string, maxPerWindow: number): NextResponse | null {
  const now = Date.now();
  const hits = (store.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (hits.length >= maxPerWindow) {
    return NextResponse.json(
      { error: "Too many requests — wait a minute and try again" },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }
  hits.push(now);
  store.set(key, hits);
  return null;
}

/** Client IP for read limiting. Falls back to a constant so a missing header
 *  means "share one bucket", never "skip the limit". */
export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for") ?? "";
  return fwd.split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";
}

/** App-level ids: `user-1755…-ab3c` for saved presets, the built-in's own
 *  slug for overrides. Deliberately narrow so nothing exotic reaches the DB. */
const ID_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/;

export function validId(id: string): boolean {
  return ID_RE.test(id);
}

/** Vercel's serverless body cap is ~4.5MB; stop short of it so a too-large
 *  save fails as OUR clear 413 rather than an opaque platform error. A single
 *  preset gets this big when it carries uploaded photos as data URLs. */
const MAX_BYTES = 4_000_000;

export interface ItemBody {
  kind: string;
  data: Record<string, unknown>;
}

export async function validateItemBody(req: Request): Promise<ItemBody | NextResponse> {
  const parsed = await readJson(req);
  if (parsed instanceof NextResponse) return parsed;
  const b = parsed as Partial<ItemBody>;
  if (typeof b.kind !== "string" || !ITEM_KINDS.has(b.kind)) {
    return NextResponse.json(
      { error: `kind must be one of: ${[...ITEM_KINDS].join(", ")}` },
      { status: 422 },
    );
  }
  if (!b.data || typeof b.data !== "object" || Array.isArray(b.data)) {
    return NextResponse.json({ error: "data must be an object" }, { status: 422 });
  }
  return { kind: b.kind, data: b.data as Record<string, unknown> };
}

/** Both settings keys hold a list of strings. Cap the length so a loop in the
 *  client can't grow the row without bound. */
export async function validateSettingBody(req: Request): Promise<string[] | NextResponse> {
  const parsed = await readJson(req);
  if (parsed instanceof NextResponse) return parsed;
  const data = (parsed as { data?: unknown }).data;
  if (!Array.isArray(data) || !data.every((v) => typeof v === "string")) {
    return NextResponse.json({ error: "data must be an array of strings" }, { status: 422 });
  }
  if (data.length > 1000) {
    return NextResponse.json({ error: "Too many entries" }, { status: 422 });
  }
  return data.map((v) => v.slice(0, 200));
}

async function readJson(req: Request): Promise<unknown | NextResponse> {
  let raw: string;
  try {
    raw = await req.text();
  } catch {
    return NextResponse.json({ error: "Unreadable request body" }, { status: 400 });
  }
  if (raw.length > MAX_BYTES) {
    return NextResponse.json(
      { error: "Too large to save — it exceeds 4MB. Large uploaded photos are usually the cause." },
      { status: 413 },
    );
  }
  try {
    return JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }
}

/** Log the real error, return a safe message with a correlation id (r20). */
export function errorResponse(e: unknown): NextResponse {
  const id = Math.random().toString(36).slice(2, 10);
  console.error(`[editor-library ${id}]`, e);
  const notConfigured = e instanceof Error && e.message.includes("DATABASE_URL");
  return NextResponse.json(
    {
      error: notConfigured
        ? "The shared template library is not configured yet (missing database)"
        : `Template library error — try again (ref ${id})`,
    },
    { status: notConfigured ? 503 : 500 },
  );
}
