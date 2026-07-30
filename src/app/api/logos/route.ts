import { NextResponse } from "next/server";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { libraryFileFromSrc } from "@/lib/logoFiles";

/**
 * Delete logos from the library — a LOCAL DEV tool.
 *
 * The library lives in `public/logos` and is committed, so removing a logo is a
 * repo change: it happens on the machine running `npm run dev`, and the change
 * reaches the team through a commit. On Vercel the filesystem is read-only and
 * the files are baked into the build, so this route refuses outright in
 * production rather than pretending to work.
 *
 * Safety, in order:
 *   1. production → 404, so the route does not exist where it cannot work.
 *   2. only files listed in `src/data/logoLibrary.json` can be named, which
 *      makes path traversal impossible (see `libraryFileFromSrc`).
 *   3. files are MOVED to a gitignored `.logos-trash/`, never unlinked, so a
 *      mis-click is recoverable.
 *   4. the manifest is rewritten to match, so the picker updates without a
 *      rebuild.
 */

const MAX_PER_REQUEST = 200;
const MANIFEST = join(process.cwd(), "src", "data", "logoLibrary.json");
const LOGO_DIR = join(process.cwd(), "public", "logos");
const TRASH_DIR = join(process.cwd(), ".logos-trash");

interface LogoEntry { src: string; name: string }

export async function DELETE(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }
  const srcs = (body as { srcs?: unknown })?.srcs;
  if (!Array.isArray(srcs) || srcs.length === 0) {
    return NextResponse.json({ error: "Expected { srcs: string[] }" }, { status: 400 });
  }
  if (srcs.length > MAX_PER_REQUEST) {
    return NextResponse.json({ error: `Too many at once — max ${MAX_PER_REQUEST}` }, { status: 413 });
  }

  let manifest: LogoEntry[];
  try {
    manifest = JSON.parse(await readFile(MANIFEST, "utf8")) as LogoEntry[];
  } catch {
    return NextResponse.json({ error: "Could not read the logo manifest" }, { status: 500 });
  }
  const known = manifest.map((l) => l.src);

  const deleted: string[] = [];
  const failed: { src: string; reason: string }[] = [];

  for (const src of srcs) {
    const rel = libraryFileFromSrc(src, known);
    if (!rel) {
      failed.push({ src: String(src), reason: "not a library file" });
      continue;
    }
    try {
      const target = join(TRASH_DIR, rel);
      await mkdir(dirname(target), { recursive: true });
      await rename(join(LOGO_DIR, rel), target);
      deleted.push(src as string);
    } catch (e) {
      // Node throws a SystemError; its `code` (ENOENT, EPERM…) says more than
      // the message, but it is not on the Error type.
      const code = (e as { code?: string })?.code;
      failed.push({ src: src as string, reason: code ?? (e instanceof Error ? e.message : "move failed") });
    }
  }

  if (deleted.length) {
    const gone = new Set(deleted);
    try {
      await writeFile(MANIFEST, `${JSON.stringify(manifest.filter((l) => !gone.has(l.src)), null, 2)}\n`, "utf8");
    } catch {
      // The files are already in the trash; the manifest catches up on the next
      // `npm run logos`, so report success with a warning rather than failing.
      return NextResponse.json({ deleted, failed, warning: "Manifest not rewritten — run npm run logos" });
    }
  }

  return NextResponse.json({ deleted, failed, remaining: manifest.length - deleted.length });
}
