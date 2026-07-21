import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { listItems, createItem } from "@/lib/db";
import { checkRate, validateItemBody, errorResponse } from "@/lib/libraryApi";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Sign in with your TechBBQ account" }, { status: 401 });
  try {
    return NextResponse.json({ items: await listItems() });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: Request) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "Sign in with your TechBBQ account" }, { status: 401 });
  const limited = checkRate(email);
  if (limited) return limited;
  const body = await validateItemBody(req);
  if (body instanceof NextResponse) return body;
  try {
    const id = await createItem(body.name, body.kind, body.doc, email);
    return NextResponse.json({ id }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
