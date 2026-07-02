import type { DesignConfig, PlatformFormat } from "@/types/template";
import { FORMAT_DIMENSIONS } from "@/types/template";
import type { CanvasImage } from "@/components/ImagePlacer";

/**
 * A pre-built starting point for the user. Loading a preset replaces the
 * current canvas state (format + design + canvasImages). Designed so adding
 * a new preset is just appending an entry to PRESETS — no other code changes.
 *
 * Conventions:
 *   - Coords/sizes are 0–1 fractional (same as the rest of the doc).
 *   - Image slots are represented by shapes with `imagePlaceholder: { label }`
 *     set; ShapeDragOverlay renders an "Upload photo" button on those shapes
 *     and page.tsx swaps them for a real CanvasImage on upload.
 *   - Pick a `format` per preset based on intended use (square for IG feed,
 *     story for IG/FB story, presentation for slides/event screens).
 */
/** Per-format override block. When the user clicks the preset and the canvas
 *  is currently on this format, this override replaces customSize / design /
 *  canvasImages from the preset's defaults. Lets a single preset entry ship
 *  hand-tuned layouts for square, presentation and story. */
export interface PresetVariant {
  customSize: { width: number; height: number };
  design: DesignConfig;
  canvasImages: CanvasImage[];
}

export interface Preset {
  id: string;
  name: string;
  /** Short tagline shown under the card. */
  description: string;
  /** Display category used to group presets in the picker (optional). */
  category?: "event" | "social" | "speaker";
  /** Folder label for visually grouping cards in the picker — e.g. "Panels",
   *  "Partners", "Chats". Presets without a group fall back to a default
   *  bucket ("Other" for built-ins, "My presets" for user-saved). */
  group?: string;
  /** Default format — used when no variant matches the canvas's current format. */
  format: PlatformFormat;
  customSize: { width: number; height: number };
  design: DesignConfig;
  canvasImages: CanvasImage[];
  /** Format-specific overrides. When the user clicks the preset and the
   *  canvas is on one of these formats, the matching variant is used instead
   *  of the default fields above. */
  variants?: Partial<Record<PlatformFormat, PresetVariant>>;
}

/** Pick the right snapshot to load given the canvas's current format.
 *
 * Resolution order (highest priority wins):
 *   1. localStorage override variant for the current format
 *   2. preset.variants[currentFormat]   (shipped variant)
 *   3. preset defaults                  (the top-level fields)
 *
 * `overrideVariants` is the per-preset block from usePresetOverrides — pass
 * `overrides[preset.id]?.variants` from the host. */
export function resolvePresetForFormat(
  preset: Preset,
  currentFormat: PlatformFormat,
  overrideVariants?: Partial<Record<PlatformFormat, PresetVariant>>,
): { format: PlatformFormat; customSize: { width: number; height: number }; design: DesignConfig; canvasImages: CanvasImage[] } {
  const override = overrideVariants?.[currentFormat];
  if (override) {
    return {
      format: currentFormat,
      customSize: override.customSize,
      design: override.design,
      canvasImages: override.canvasImages,
    };
  }
  const variant = preset.variants?.[currentFormat];
  if (variant) {
    return {
      format: currentFormat,
      customSize: variant.customSize,
      design: variant.design,
      canvasImages: variant.canvasImages,
    };
  }
  // No variant exists for the requested format. If it matches the preset's
  // own default, load that. Otherwise switch the canvas to the requested
  // format (using its default dimensions) and reuse the preset's design as
  // a starting point — the user can then adjust and click "Save variant".
  if (currentFormat === preset.format) {
    return {
      format: preset.format,
      customSize: preset.customSize,
      design: preset.design,
      canvasImages: preset.canvasImages,
    };
  }
  const fallbackDims = FORMAT_DIMENSIONS[currentFormat];
  return {
    format: currentFormat,
    customSize: { width: fallbackDims.width, height: fallbackDims.height },
    design: preset.design,
    canvasImages: preset.canvasImages,
  };
}

// No built-in presets shipped yet — clean slate. The team authors templates
// in-app, then ships them via "Copy code" in the Templates modal and pastes
// the generated `const … : Preset = {…}` back into this file, adding it below.
export const PRESETS: Preset[] = [];
