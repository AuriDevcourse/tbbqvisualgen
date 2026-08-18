import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { readLibrary } from "@/lib/editorLibraryDb";
import { checkRate, clientIp, errorResponse } from "@/lib/editorLibraryApi";

export const dynamic = "force-dynamic";

/** One request serves the editor's whole shared Templates state, so the page
 *  makes a single round trip on mount instead of five.
 *
 *  Open to anyone: /editor has no auth gate, and a visitor who can't read the
 *  team's templates has an empty editor. `canWrite` tells the client whether
 *  to allow saves, so the UI can explain "sign in to save for the team"
 *  instead of failing a write after the fact. */
export async function GET(req: Request) {
  const limited = checkRate(`read:${clientIp(req)}`, 60);
  if (limited) return limited;
  const session = await auth();
  try {
    const library = await readLibrary();
    return NextResponse.json({ ...library, canWrite: Boolean(session?.user?.email) });
  } catch (e) {
    return errorResponse(e);
  }
}
