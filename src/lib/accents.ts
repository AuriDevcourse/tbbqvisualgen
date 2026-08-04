// The Investor Relations circle accents: a filled bubble with an empty white
// ring beside it, straddling opposite corners so both get cropped by the frame.
// Auri's 2025 LP Forum visuals are the reference.
//
// Pure module — no React — because the builders in simpleLayout.ts emit these as
// real SHAPE LAYERS. That is deliberate: they started as one background SVG,
// which meant they could not be moved, and Auri's first note back was "I should
// be able to move them in fine-tuning". As circle shapes they are ordinary
// layers: drag, resize, recolour, delete, reorder, all for free.
import { COLORS } from "@/lib/constants";
import type { ShapeElement } from "@/types/template";

/** The bubble's FILL says which investor thing the post is about. */
export type AccentFill = { kind: "solid"; color: string } | { kind: "gradient" };

export const ACCENT_REGISTRY: Record<string, { label: string; fill: AccentFill }> = {
  investor: { label: "Investor Relations", fill: { kind: "gradient" } },
  lpForum: { label: "LP Forum", fill: { kind: "solid", color: "#EE7D4B" } },
  investorDay: { label: "Investor Day", fill: { kind: "solid", color: "#FF4258" } },
};

export const ACCENT_OPTIONS: { id: string; label: string }[] =
  Object.entries(ACCENT_REGISTRY).map(([id, a]) => ({ id, label: a.label }));

export function isAccentId(id: string | undefined): id is string {
  return Boolean(id && ACCENT_REGISTRY[id]);
}

/** True for a shape the accent picker owns (as opposed to a hand-drawn one). */
export function isAccentShape(s: { simpleRole?: string }): boolean {
  return Boolean(s.simpleRole?.startsWith("accent."));
}

/**
 * The composition, taken from **Auri's own approved wall** — the "Thank You"
 * library item (`29f38736`), read straight out of its doc rather than eyeballed
 * off a screenshot. He moved all four circles and shrank the bottom-left pair,
 * and said "this is the way I like it to look".
 *
 * Both earlier passes are worth knowing about, so nobody re-derives them:
 * eyeballing put the rings far too small; a least-squares fit to the 2025
 * reference screenshot got the radii right but still had every circle in the
 * wrong place, because the reference was a different composition. The tuned doc
 * is the authority.
 *
 * x/y are fractions of width/height; r is a fraction of the SHORTER side, so
 * the circles read the same in 1:1, 16:9 and 9:16. His doc is square, where all
 * three denominators coincide, so its numbers map across directly.
 */
const CIRCLES = [
  { role: "accent.0.ring", x: 0.937, y: 0.000, r: 0.171, ring: true },
  { role: "accent.0.bubble", x: 0.993, y: 0.085, r: 0.123, ring: false },
  { role: "accent.1.ring", x: -0.063, y: 0.995, r: 0.154, ring: true },
  { role: "accent.1.bubble", x: 0.139, y: 1.000, r: 0.139, ring: false },
] as const;

/** Ring stroke as a share of the ring's own diameter, from `Empty Circle.png`. */
const RING_STROKE = 0.011;

/**
 * The accent shapes for a canvas of these dimensions. `nextId` supplies ids from
 * the caller's own deterministic counter, so a rebuild of the same form always
 * yields the same doc (server and client included).
 *
 * A shape carries no gradient stop count beyond two, so the brand gold→red pair
 * stands in for the three-stop signature gradient; interpolating gold to red
 * passes through the same orange.
 */
export function accentShapes(
  accentId: string | undefined,
  width: number,
  height: number,
  nextId: () => string,
): ShapeElement[] {
  const accent = accentId ? ACCENT_REGISTRY[accentId] : undefined;
  if (!accent) return [];
  const short = Math.min(width, height);

  return CIRCLES.map((c) => {
    // Fractional width/height of the shape's bounding box: a circle of radius
    // `r * short`, expressed per axis.
    const w = (2 * c.r * short) / width;
    const h = (2 * c.r * short) / height;
    const solid = accent.fill.kind === "solid";
    return {
      id: nextId(),
      type: "circle" as const,
      simpleRole: c.role,
      x: c.x,
      y: c.y,
      width: w,
      height: h,
      fillType: c.ring ? ("outline" as const) : ("fill" as const),
      // Stroke is a fraction of canvas WIDTH, and should stay proportional to
      // the ring itself rather than to the canvas.
      strokeWidth: c.ring ? (RING_STROKE * 2 * c.r * short) / width : 0,
      colorType: c.ring || solid ? ("solid" as const) : ("gradient" as const),
      color1: c.ring ? "#FFFFFF" : solid ? (accent.fill as { color: string }).color : COLORS.gradientStart,
      color2: c.ring ? "#FFFFFF" : solid ? (accent.fill as { color: string }).color : COLORS.gradientEnd,
      opacity: 1,
      blur: 0,
      rotation: 0,
    };
  });
}

/**
 * Switch a design's accent directly — the editor's path, where there is no form
 * to rebuild from. Adds the circles, restains them, or removes them, keeping any
 * hand-placed geometry. Ids are derived from the role so they stay unique and
 * stable across repeated switches.
 */
export function applyAccent<T extends { accentId?: string; shapes?: ShapeElement[] }>(
  design: T,
  accentId: string | undefined,
  width: number,
  height: number,
): T {
  const want = accentShapes(accentId, width, height, () => "");
  const withIds = want.map((s) => ({ ...s, id: (s.simpleRole ?? "accent").replace(/\./g, "-") }));
  return {
    ...design,
    accentId,
    shapes: syncAccentShapes(design.shapes ?? [], withIds),
  };
}

/**
 * Reconcile the accent layers of a hand-tuned doc against a rebuild.
 *
 * The accent is a form field but the layers are hand-movable, so neither side
 * can simply win: the tuned doc owns the GEOMETRY (that is the whole point of
 * dragging one), the rebuild owns the CHOICE — which accent, or none at all.
 * A deleted accent layer stays deleted, because the rebuild only refills roles
 * the tuned doc still has.
 */
export function syncAccentShapes(tuned: ShapeElement[], rebuilt: ShapeElement[]): ShapeElement[] {
  const want = rebuilt.filter(isAccentShape);
  const had = tuned.filter(isAccentShape);
  // Accents turned off — drop them, whatever the user did to them.
  if (!want.length) return had.length ? tuned.filter((s) => !isAccentShape(s)) : tuned;

  const wantByRole = new Map(want.map((s) => [s.simpleRole as string, s]));
  const restained = tuned.map((s) => {
    if (!isAccentShape(s)) return s;
    const next = wantByRole.get(s.simpleRole as string);
    if (!next) return s;
    // Fill only: position, size, rotation, opacity and blur stay the user's.
    return { ...s, fillType: next.fillType, colorType: next.colorType, color1: next.color1, color2: next.color2 };
  });
  // Circles are only ADDED when the doc had none — that is the switched-on case.
  // Once a doc has accents, a role it is missing was deleted by hand, and
  // re-adding it would resurrect a layer the user threw away on every edit.
  return had.length ? restained : [...want, ...restained];
}
