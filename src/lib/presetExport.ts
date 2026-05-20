import type { DesignConfig, PlatformFormat, ShapeElement } from "@/types/template";
import type { CanvasImage } from "@/components/ImagePlacer";
import { PRESETS, type Preset } from "@/data/presets";

interface DocSnapshot {
  format: PlatformFormat;
  customSize: { width: number; height: number };
  design: DesignConfig;
  canvasImages: CanvasImage[];
}

interface SerializeOpts {
  id: string;
  name: string;
  description: string;
  category?: "event" | "social" | "speaker";
}

/**
 * Build a Preset object from a doc snapshot. Strips uploaded image dataURLs
 * by converting each CanvasImage into a placeholder shape at the same
 * coords. Used by both `serializeAsPreset` (which stringifies it for the
 * codebase workflow) and `useUserPresets.add` (which stores the live object
 * in localStorage).
 */
export function buildPresetFromDoc(doc: DocSnapshot, opts: SerializeOpts): Preset {
  const placeholderShapes = doc.canvasImages.map(canvasImageToPlaceholder);
  return {
    id: opts.id,
    name: opts.name,
    description: opts.description,
    ...(opts.category ? { category: opts.category } : {}),
    format: doc.format,
    customSize: doc.customSize,
    design: {
      ...doc.design,
      shapes: [...(doc.design.shapes ?? []), ...placeholderShapes],
    },
    canvasImages: [],
  };
}

/**
 * Convert a CanvasImage into an image-placeholder ShapeElement at the same
 * position/size. Used by the preset export so designs that include test
 * photos round-trip into reusable presets without baking dataURLs into source.
 *
 * If the canvas image is a perfect circle (cornerRadius >= 50) the resulting
 * shape is a circle; otherwise it's a rounded rectangle preserving the corner
 * radius proportionally.
 */
function canvasImageToPlaceholder(ci: CanvasImage, idx: number): ShapeElement {
  const isCircle = (ci.cornerRadius ?? 0) >= 50;
  const borderRadius = isCircle ? undefined : (ci.cornerRadius ?? 0) / 50;
  return {
    id: `shape-placeholder-${idx + 1}`,
    type: isCircle ? "circle" : "rectangle",
    x: ci.x,
    y: ci.y,
    width: ci.width,
    height: ci.height,
    fillType: "fill",
    strokeWidth: 0.004,
    colorType: "solid",
    color1: "rgba(255,255,255,0.08)",
    color2: "#FF6B00",
    opacity: 1,
    blur: 0,
    rotation: 0,
    ...(borderRadius !== undefined ? { borderRadius } : {}),
    groupId: ci.groupId,
    imagePlaceholder: { label: "PHOTO" },
  };
}

/**
 * Stringify a value as TypeScript object-literal source. Differs from
 * JSON.stringify in three ways that matter for readable presets:
 *   - undefined entries are dropped (JSON would crash on them)
 *   - keys are emitted unquoted when they're valid JS identifiers
 *   - 2-space indent
 */
function tsStringify(value: unknown, indent = 0): string {
  const pad = "  ".repeat(indent);
  const padNext = "  ".repeat(indent + 1);
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    const items = value.map((v) => `${padNext}${tsStringify(v, indent + 1)}`);
    return `[\n${items.join(",\n")},\n${pad}]`;
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).filter(
      ([, v]) => v !== undefined,
    );
    if (entries.length === 0) return "{}";
    const lines = entries.map(([k, v]) => {
      const key = /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(k) ? k : JSON.stringify(k);
      return `${padNext}${key}: ${tsStringify(v, indent + 1)}`;
    });
    return `{\n${lines.join(",\n")},\n${pad}}`;
  }
  return String(value);
}

/** Find an existing preset whose name OR id matches what the user typed.
 *  Case-insensitive on name; exact match on id. */
function findExistingPreset(name: string, id: string) {
  const norm = name.trim().toLowerCase();
  return PRESETS.find((p) => p.id === id || p.name.toLowerCase() === norm) ?? null;
}

/**
 * Convert the current canvas doc into a TypeScript Preset literal string,
 * ready to paste into src/data/presets.ts. Strips uploaded image dataURLs by
 * converting each CanvasImage into a placeholder shape at the same coords.
 *
 * If the typed name matches an existing preset, emits a VARIANT block instead
 * of a new const — you paste it under that preset's `variants:` field to add
 * a format-specific override (e.g. a square version of an existing 16:9 preset).
 */
export function serializeAsPreset(doc: DocSnapshot, opts: SerializeOpts): string {
  const placeholderShapes = doc.canvasImages.map(canvasImageToPlaceholder);
  const designWithPlaceholders: DesignConfig = {
    ...doc.design,
    shapes: [...(doc.design.shapes ?? []), ...placeholderShapes],
  };

  // ── Variant-emit mode ────────────────────────────────────────────────────
  // If a preset with this name/id already ships, emit ONLY the variant block
  // for the current format. The user pastes it under the existing preset's
  // `variants:` field (creating that field if it doesn't yet exist).
  const existing = findExistingPreset(opts.name, opts.id);
  if (existing) {
    const variantBlock = {
      customSize: doc.customSize,
      design: designWithPlaceholders,
      canvasImages: [] as CanvasImage[],
    };
    return [
      `// Variant for "${existing.name}" — format: ${doc.format}`,
      `// Paste this under that preset's \`variants:\` field. If the preset has`,
      `// no variants field yet, add: variants: { ${doc.format}: { ...below... } }`,
      ``,
      `${doc.format}: ${tsStringify(variantBlock, 0)},`,
    ].join("\n");
  }

  // ── Full-preset emit mode (default) ──────────────────────────────────────
  const preset = {
    id: opts.id,
    name: opts.name,
    description: opts.description,
    ...(opts.category ? { category: opts.category } : {}),
    format: doc.format,
    customSize: doc.customSize,
    design: designWithPlaceholders,
    canvasImages: [] as CanvasImage[],
  };

  const varName = opts.id.replace(/[^A-Za-z0-9]+(.)/g, (_, c: string) => c.toUpperCase()).replace(/[^A-Za-z0-9]/g, "");
  const safeVarName = /^[A-Za-z]/.test(varName) ? varName : `preset${varName}`;

  return `const ${safeVarName}: Preset = ${tsStringify(preset, 0)};\n\n// Add to PRESETS array:\n// export const PRESETS: Preset[] = [\n//   ...existing,\n//   ${safeVarName},\n// ];`;
}
