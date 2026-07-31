/**
 * Recolour an SVG logo in place.
 *
 * Most logos in `public/logos` are single-colour marks, and the library carries
 * whichever version the partner supplied — often only a dark one, which is
 * invisible on the dark canvas. Rather than hunting for a knockout version,
 * the picker can restain the vector: every fill / stroke / gradient stop is
 * rewritten to one colour, and the root `fill` is set so shapes that declare no
 * colour of their own (they default to black) follow too.
 *
 * `fill="none"` is left alone — that is what makes an outline logo an outline
 * rather than a filled blob.
 *
 * Pure string work on the SVG source, so the result is still a normal SVG data
 * URL: the export pipeline, the team library and `retargetTunedDoc` need to know
 * nothing about it.
 */

const SVG_DATA_URL = /^data:image\/svg\+xml[;,]/i;

/** Values that must never be replaced: they are not colours. */
const KEEP = /^(none|transparent|inherit|currentcolor|url\(.*)$/i;

export function isSvgDataUrl(src: string | undefined): boolean {
  return Boolean(src && SVG_DATA_URL.test(src));
}

/** Decode an SVG data URL (base64 or percent-encoded) to its source text. */
export function decodeSvgDataUrl(src: string): string | null {
  if (!isSvgDataUrl(src)) return null;
  const comma = src.indexOf(",");
  if (comma < 0) return null;
  const meta = src.slice(0, comma);
  const payload = src.slice(comma + 1);
  try {
    if (/;base64/i.test(meta)) {
      const binary = atob(payload);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return new TextDecoder().decode(bytes);
    }
    return decodeURIComponent(payload);
  } catch {
    return null;
  }
}

/** Encode SVG source back to a base64 data URL (safe for non-ASCII content). */
export function encodeSvgDataUrl(svg: string): string {
  const bytes = new TextEncoder().encode(svg);
  let binary = "";
  // Chunked: String.fromCharCode(...bytes) blows the call stack on big files.
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return `data:image/svg+xml;base64,${btoa(binary)}`;
}

/** Rewrite every colour in the SVG source to `colour`. */
export function tintSvgSource(svg: string, colour: string): string {
  let out = svg;

  // 1. Presentation attributes: fill="#fff" stroke='red' stop-color="…"
  out = out.replace(
    /\b(fill|stroke|stop-color|flood-color|lighting-color)\s*=\s*(["'])(.*?)\2/gi,
    (match, prop: string, quote: string, value: string) =>
      (KEEP.test(value.trim()) ? match : `${prop}=${quote}${colour}${quote}`),
  );

  // 2. CSS declarations, whether in a <style> block or a style="" attribute.
  out = out.replace(
    /\b(fill|stroke|stop-color|flood-color|lighting-color)\s*:\s*([^;}"']+)/gi,
    (match, prop: string, value: string) =>
      (KEEP.test(value.trim()) ? match : `${prop}:${colour}`),
  );

  // 3. Shapes that declare NO colour render black by default. `fill` and
  //    `stroke` inherit in SVG, so setting them on the root element carries to
  //    every child that has not been given its own value above.
  out = out.replace(/<svg\b([^>]*)>/i, (match, attrs: string) => {
    const cleaned = attrs.replace(/\s(fill|stroke)\s*=\s*(["']).*?\2/gi, "");
    return `<svg${cleaned} fill="${colour}">`;
  });

  return out;
}

/**
 * Recolour an SVG data URL. Returns null when the input is not an SVG or cannot
 * be decoded, so callers can leave rasters untouched instead of guessing.
 */
export function tintSvgDataUrl(src: string, colour: string): string | null {
  const svg = decodeSvgDataUrl(src);
  if (!svg) return null;
  return encodeSvgDataUrl(tintSvgSource(svg, colour));
}
