/**
 * Path safety for the logo-library delete route.
 *
 * A route that removes files off disk is only ever as safe as the check in
 * front of it, so deletion is restricted to files the MANIFEST already lists:
 * an unknown or crafted path can never resolve, which rules out traversal
 * (`../../.env`), absolute paths and URL-encoded escapes without needing to
 * reason about path normalisation.
 */

/** The `/logos/…` src values the picker knows about, from logoLibrary.json. */
export type KnownSrcs = readonly string[];

/**
 * Map a requested src to the file name (relative to public/logos) to delete,
 * or null when it is not a known library file.
 *
 * Comparison is done on the DECODED form so "/logos/My%20Logo.svg" and
 * "/logos/My Logo.svg" both match the manifest entry, while anything outside
 * the library is rejected.
 */
export function libraryFileFromSrc(src: unknown, known: KnownSrcs): string | null {
  if (typeof src !== "string" || !src) return null;
  const decode = (s: string) => {
    try {
      return decodeURIComponent(s);
    } catch {
      return s; // malformed escape — compare raw, which simply won't match
    }
  };
  const wanted = decode(src);
  const hit = known.find((k) => decode(k) === wanted);
  if (!hit) return null;
  const rel = decode(hit).replace(/^\/logos\//, "");
  // Belt and braces: the manifest is generated, but never trust a path with a
  // traversal segment or a drive/root prefix even if it appears there.
  if (!rel || rel.startsWith("/") || rel.startsWith("\\") || /(^|[\\/])\.\.([\\/]|$)/.test(rel) || /^[a-zA-Z]:/.test(rel)) {
    return null;
  }
  return rel;
}
