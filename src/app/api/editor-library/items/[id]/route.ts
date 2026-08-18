import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { upsertItem, deleteItem } from "@/lib/editorLibraryDb";
import { checkRate, errorResponse, validId, validateItemBody } from "@/lib/editorLibraryApi";

export const dynamic = "force-dynamic";

/** Writes are gated: only an @techbbq.org session may change what the whole
 *  team sees. Rate limited per account (SECURITY.md r5, r8). */
async function guard(params: Promise<{ id: string }>) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return { error: NextResponse.json({ error: "Sign in with your TechBBQ account to save for the team" }, { status: 401 }) };
  }
  const { id } = await params;
  if (!validId(id)) return { error: NextResponse.json({ error: "Invalid id" }, { status: 400 }) };
  const limited = checkRate(`write:${email}`, 60);
  if (limited) return { error: limited };
  return { email, id };
}

/** Upsert, not create: the client owns the id (it is the app-level preset id),
 *  and every mutation the UI offers — rename, move folder, save variant — is
 *  "write this preset's current state". */
export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await guard(ctx.params);
  if ("error" in g) return g.error;
  const body = await validateItemBody(req);
  if (body instanceof NextResponse) return body;
  try {
    await upsertItem(g.id, body.kind, body.data, g.email);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await guard(ctx.params);
  if ("error" in g) return g.error;
  try {
    // Already gone counts as success — the client's optimistic delete already
    // removed it, and a 404 would make it flap back into the list.
    await deleteItem(g.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
