import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getItem, updateItem, deleteItem } from "@/lib/db";
import { checkRate, validateItemBody, errorResponse } from "@/lib/libraryApi";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function guard(params: Promise<{ id: string }>) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return { error: NextResponse.json({ error: "Sign in with your TechBBQ account" }, { status: 401 }) };
  const { id } = await params;
  if (!UUID_RE.test(id)) return { error: NextResponse.json({ error: "Invalid id" }, { status: 400 }) };
  return { email, id };
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await guard(ctx.params);
  if ("error" in g) return g.error;
  try {
    const item = await getItem(g.id);
    if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ item });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await guard(ctx.params);
  if ("error" in g) return g.error;
  const limited = checkRate(g.email);
  if (limited) return limited;
  const body = await validateItemBody(req);
  if (body instanceof NextResponse) return body;
  try {
    const ok = await updateItem(g.id, body.name, body.kind, body.doc, g.email);
    if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await guard(ctx.params);
  if ("error" in g) return g.error;
  const limited = checkRate(g.email);
  if (limited) return limited;
  try {
    const ok = await deleteItem(g.id);
    if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
