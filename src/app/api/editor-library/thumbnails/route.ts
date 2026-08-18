import { NextResponse } from "next/server";
import { readThumbnails } from "@/lib/editorLibraryDb";
import { checkRate, clientIp, errorResponse } from "@/lib/editorLibraryApi";

export const dynamic = "force-dynamic";

/** Template thumbnails, keyed by id. Separate from the main library read so the
 *  editor can render its Templates list immediately and fill the previews in
 *  afterwards, instead of blocking first paint on base64 PNG data. */
export async function GET(req: Request) {
  const limited = checkRate(`thumbs:${clientIp(req)}`, 30);
  if (limited) return limited;
  try {
    return NextResponse.json({ thumbnails: await readThumbnails() });
  } catch (e) {
    return errorResponse(e);
  }
}
