import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { auth } from "@/auth";
import { checkRate } from "@/lib/editorLibraryApi";
import { PHOTO_ACCEPT, PHOTO_MAX_BYTES } from "@/lib/photoBackground";

/**
 * Store a photo background and hand back its URL.
 *
 * Why this exists: photos used to be inlined into the saved document as base64
 * data URLs, and 95% of the 626KB the editor downloads on every focus refresh
 * was four such JPEGs (PROGRESS.md handoff 55). base64 is ~33% larger than the
 * bytes it encodes, a CDN cannot cache it, and Neon bills egress on every read
 * of it — which is what exhausted the transfer quota on 2026-08-25. A URL is
 * ~57 characters.
 *
 * ## Auth is required, and that is not a regression
 *
 * The editor itself is open, so gating uploads looks like it takes a feature
 * away from anonymous visitors. It does not: `readImageFile` falls back to the
 * old data-URL path whenever this route refuses, so an anonymous visitor gets
 * exactly today's behaviour — the photo lives in their own session and never
 * reaches a server.
 *
 * The people who need the URL form are the people who SAVE templates, and
 * saving already requires an @techbbq.org session. So the bytes that end up in
 * Postgres are precisely the ones this route handles.
 *
 * The alternative — an open upload endpoint — is a stranger filling paid
 * storage from a page with no login, which is exactly the shape SECURITY.md r5
 * exists to stop.
 *
 * ## The other guards
 *
 * Rate limit per account (r8), a hard byte cap read from the SAME constant the
 * client uses so the two cannot drift, and a content-type allowlist checked
 * against the actual header rather than a filename (r4).
 */

const ALLOWED = new Set(PHOTO_ACCEPT.split(","));
const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function POST(req: Request) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    // 401 and not 403: the client treats any refusal as "fall back to a data
    // URL", but the status should still say what is actually wrong.
    return NextResponse.json({ error: "Sign in to upload photos for the team" }, { status: 401 });
  }

  const limited = checkRate(`photo:${email}`, 30);
  if (limited) return limited;

  const type = (req.headers.get("content-type") ?? "").split(";")[0].trim();
  if (!ALLOWED.has(type)) {
    return NextResponse.json({ error: "Only PNG, JPG or WebP" }, { status: 415 });
  }

  // Trust the body, not the header: Content-Length is client-supplied. Reading
  // first and measuring the real buffer is what actually enforces the cap.
  const buf = await req.arrayBuffer();
  if (buf.byteLength === 0) {
    return NextResponse.json({ error: "Empty file" }, { status: 400 });
  }
  if (buf.byteLength > PHOTO_MAX_BYTES) {
    return NextResponse.json({ error: "Too large — max 10MB" }, { status: 413 });
  }

  try {
    const { url } = await put(`photos/${Date.now()}.${EXT[type]}`, buf, {
      access: "public",
      contentType: type,
      // Vercel appends a random suffix, so two uploads a millisecond apart
      // cannot collide and a URL cannot be guessed from the timestamp.
      addRandomSuffix: true,
      // Immutable: nothing ever rewrites a photo at the same path, and a saved
      // template must still render months from now.
      cacheControlMaxAge: 31_536_000,
    });
    return NextResponse.json({ url });
  } catch (e) {
    // Log the detail, return a safe message with no storage internals (r20).
    const ref = Math.random().toString(36).slice(2, 10);
    console.error(`[photo ${ref}]`, e);
    return NextResponse.json({ error: `Upload failed — try again (ref ${ref})` }, { status: 502 });
  }
}
