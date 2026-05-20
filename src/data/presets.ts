import type { DesignConfig, PlatformFormat, ShapeElement } from "@/types/template";
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

/**
 * "Fireside Chat" — title + panel name + two head-shot slots (moderator +
 * speaker). Square format so it works for IG / LinkedIn feed.
 */
const firesideChat: Preset = {
  id: "fireside-chat",
  name: "Fireside Chat",
  description: "Panel title + moderator & speaker headshots.",
  category: "event",
  group: "Chats",
  format: "square",
  customSize: { width: 1500, height: 1500 },
  design: {
    backgroundId: "lm5",
    showLogo: true,
    logoPosition: "bottom-center",
    logoStyle: "white",
    texts: [
      {
        id: "text-fc-eyebrow",
        content: "FIRESIDE CHAT",
        fontSize: 36,
        position: { x: 0.5, y: 0.07 },
        weight: 700,
        uppercase: true,
        align: "center",
        gradient: false,
        color: "#FFD27A",
        letterSpacing: 6,
        font: "onest",
      },
      {
        id: "text-fc-title",
        content: "The Future of\nEuropean Tech",
        fontSize: 88,
        position: { x: 0.5, y: 0.17 },
        weight: 800,
        uppercase: false,
        align: "center",
        gradient: false,
        color: "#FFFFFF",
        lineHeight: 1.05,
        font: "onest",
      },
      {
        id: "text-fc-moderator-label",
        content: "MODERATOR",
        fontSize: 22,
        position: { x: 0.27, y: 0.72 },
        weight: 700,
        uppercase: true,
        align: "center",
        gradient: false,
        color: "#FFD27A",
        letterSpacing: 3,
        font: "onest",
      },
      {
        id: "text-fc-moderator-name",
        content: "Name Surname",
        fontSize: 34,
        position: { x: 0.27, y: 0.765 },
        weight: 700,
        align: "center",
        gradient: false,
        color: "#FFFFFF",
        font: "onest",
      },
      {
        id: "text-fc-moderator-title",
        content: "Title · Company",
        fontSize: 22,
        position: { x: 0.27, y: 0.81 },
        weight: 500,
        align: "center",
        gradient: false,
        color: "rgba(255,255,255,0.7)",
        font: "onest",
      },
      {
        id: "text-fc-speaker-label",
        content: "SPEAKER",
        fontSize: 22,
        position: { x: 0.73, y: 0.72 },
        weight: 700,
        uppercase: true,
        align: "center",
        gradient: false,
        color: "#FFD27A",
        letterSpacing: 3,
        font: "onest",
      },
      {
        id: "text-fc-speaker-name",
        content: "Name Surname",
        fontSize: 34,
        position: { x: 0.73, y: 0.765 },
        weight: 700,
        align: "center",
        gradient: false,
        color: "#FFFFFF",
        font: "onest",
      },
      {
        id: "text-fc-speaker-title",
        content: "Title · Company",
        fontSize: 22,
        position: { x: 0.73, y: 0.81 },
        weight: 500,
        align: "center",
        gradient: false,
        color: "rgba(255,255,255,0.7)",
        font: "onest",
      },
      {
        id: "text-fc-date",
        content: "12 SEP · 14:30 · MAIN STAGE",
        fontSize: 24,
        position: { x: 0.5, y: 0.92 },
        weight: 600,
        uppercase: true,
        align: "center",
        gradient: false,
        color: "rgba(255,255,255,0.7)",
        letterSpacing: 3,
        font: "onest",
      },
    ],
    shapes: [
      {
        id: "shape-fc-moderator",
        type: "rectangle",
        x: 0.27,
        y: 0.5,
        width: 0.30,
        height: 0.32,
        fillType: "fill",
        strokeWidth: 0.004,
        colorType: "solid",
        color1: "rgba(255,255,255,0.08)",
        color2: "#FF6B00",
        opacity: 1,
        blur: 0,
        rotation: 0,
        borderRadius: 0.08,
        imagePlaceholder: { label: "MODERATOR" },
      },
      {
        id: "shape-fc-speaker",
        type: "rectangle",
        x: 0.73,
        y: 0.51,
        width: 0.24,
        height: 0.26,
        fillType: "fill",
        strokeWidth: 0.004,
        colorType: "solid",
        color1: "rgba(255,255,255,0.08)",
        color2: "#FF6B00",
        opacity: 1,
        blur: 0,
        rotation: 0,
        borderRadius: 0.08,
        imagePlaceholder: { label: "SPEAKER" },
      },
    ],
  },
  canvasImages: [],
};

/**
 * "Investor Panel" — 1 moderator (large) + 5 speakers (smaller row).
 * Presentation 16:9. Title top-left, branded badge top-right, MODERATOR
 * tag on the moderator photo, names + titles under each headshot.
 */
const investorPanel: Preset = {
  id: "investor-panel",
  name: "Investor Panel",
  description: "1 moderator + 5 speakers, presentation 16:9.",
  category: "event",
  group: "Panels",
  format: "presentation",
  customSize: { width: 1920, height: 1080 },
  design: {
    backgroundId: "lm4",
    showLogo: true,
    logoPosition: "bottom-left",
    logoStyle: "red",
    texts: [
      // Title block — two stacked text elements so they can have distinct
      // sizes/weights (e.g. bold year + regular subtitle).
      {
        id: "text-ip-year",
        content: "2026",
        fontSize: 100,
        position: { x: 0.05, y: 0.14 },
        weight: 800,
        align: "left",
        gradient: false,
        color: "#FFFFFF",
        lineHeight: 1.0,
        font: "onest",
      },
      {
        id: "text-ip-subtitle",
        content: "Investor Panel",
        fontSize: 80,
        position: { x: 0.05, y: 0.23 },
        weight: 400,
        align: "left",
        gradient: false,
        color: "#FFFFFF",
        lineHeight: 1.0,
        font: "onest",
      },
      // Top-right outlined badge label
      {
        id: "text-ip-badge",
        content: "Hero\nAcademy",
        fontSize: 30,
        position: { x: 0.92, y: 0.16 },
        weight: 600,
        align: "center",
        gradient: false,
        color: "#FF6B00",
        lineHeight: 1.0,
        font: "onest",
      },
      // MODERATOR tag label (sits on top of the orange tag shape)
      {
        id: "text-ip-mod-tag",
        content: "MODERATOR",
        fontSize: 14,
        position: { x: 0.073, y: 0.355 },
        weight: 700,
        uppercase: true,
        align: "center",
        gradient: false,
        color: "#FFFFFF",
        letterSpacing: 2,
        font: "onest",
      },
      // Moderator name + title — left-aligned to photo left edge (0.03).
      {
        id: "text-ip-mod-name",
        content: "Name Surname",
        fontSize: 26,
        position: { x: 0.03, y: 0.84 },
        weight: 700,
        align: "left",
        gradient: false,
        color: "#FFFFFF",
        font: "onest",
      },
      {
        id: "text-ip-mod-title",
        content: "Title · Company",
        fontSize: 18,
        position: { x: 0.03, y: 0.88 },
        weight: 400,
        align: "left",
        gradient: false,
        color: "rgba(255,255,255,0.75)",
        font: "onest",
      },
      // Speakers 1–5 names + titles — left-aligned to each photo's left edge
      // (speaker photos sit at x=cx with width=0.10, so left edge = cx - 0.05).
      ...[0.32, 0.44, 0.56, 0.68, 0.80].flatMap((cx, idx) => [
        {
          id: `text-ip-sp${idx + 1}-name`,
          content: "Name Surname",
          fontSize: 20,
          position: { x: cx - 0.05, y: 0.82 },
          weight: 700,
          align: "left" as const,
          gradient: false,
          color: "#FFFFFF",
          font: "onest" as const,
        },
        {
          id: `text-ip-sp${idx + 1}-title`,
          content: "Title · Company",
          fontSize: 14,
          position: { x: cx - 0.05, y: 0.86 },
          weight: 400,
          align: "left" as const,
          gradient: false,
          color: "rgba(255,255,255,0.75)",
          font: "onest" as const,
        },
      ]),
    ],
    shapes: [
      // Thin outlined frame around the whole canvas (~1px at 1920 width).
      {
        id: "shape-ip-frame",
        type: "rectangle",
        x: 0.5,
        y: 0.5,
        width: 0.985,
        height: 0.97,
        fillType: "outline",
        strokeWidth: 0.0006,
        colorType: "solid",
        color1: "rgba(255,255,255,0.22)",
        color2: "rgba(255,255,255,0.22)",
        opacity: 1,
        blur: 0,
        rotation: 0,
        borderRadius: 0.02,
      },
      // Top-right outlined "Hero Academy" badge
      {
        id: "shape-ip-badge",
        type: "rectangle",
        x: 0.92,
        y: 0.16,
        width: 0.10,
        height: 0.13,
        fillType: "outline",
        strokeWidth: 0.0022,
        colorType: "solid",
        color1: "#FF6B00",
        color2: "#FF6B00",
        opacity: 1,
        blur: 0,
        rotation: 0,
        borderRadius: 0.18,
      },
      // Moderator photo placeholder — LARGE on the left
      {
        id: "shape-ip-mod",
        type: "rectangle",
        x: 0.10,
        y: 0.58,
        width: 0.14,
        height: 0.44,
        fillType: "fill",
        strokeWidth: 0.004,
        colorType: "solid",
        color1: "rgba(255,255,255,0.08)",
        color2: "#FF6B00",
        opacity: 1,
        blur: 0,
        rotation: 0,
        borderRadius: 0.06,
        imagePlaceholder: { label: "MODERATOR" },
      },
      // Orange MODERATOR tag (small filled rect at top-left of moderator photo)
      {
        id: "shape-ip-mod-tag",
        type: "rectangle",
        x: 0.073,
        y: 0.355,
        width: 0.062,
        height: 0.028,
        fillType: "fill",
        strokeWidth: 0,
        colorType: "solid",
        color1: "#FF0028",
        color2: "#FF6B00",
        opacity: 1,
        blur: 0,
        rotation: 0,
        borderRadius: 0.15,
      },
      // 5 speaker photo placeholders, evenly spaced
      ...[0.32, 0.44, 0.56, 0.68, 0.80].map((cx, idx): ShapeElement => ({
        id: `shape-ip-sp${idx + 1}`,
        type: "rectangle",
        x: cx,
        y: 0.62,
        width: 0.10,
        height: 0.30,
        fillType: "fill",
        strokeWidth: 0.004,
        colorType: "solid",
        color1: "rgba(255,255,255,0.08)",
        color2: "#FF6B00",
        opacity: 1,
        blur: 0,
        rotation: 0,
        borderRadius: 0.07,
        imagePlaceholder: { label: "SPEAKER" },
      })),
    ],
  },
  canvasImages: [],
};

const preset3: Preset = {
  id: "preset-3",
  name: "Preset 3",
  description: "Custom layout — 0 image(s) converted to placeholders.",
  category: "event",
  group: "Panels",
  format: "presentation",
  customSize: {
    width: 1080,
    height: 1080,
  },
  design: {
    backgroundId: "lm10",
    texts: [
      {
        id: "text-1778760511314-kgu3",
        content: "Investor Panel",
        fontSize: 88,
        position: {
          x: 0.06469748866705272,
          y: 0.2426678347908093,
        },
        weight: 400,
        uppercase: false,
        align: "left",
        gradient: false,
      },
      {
        id: "text-1778760540248-anu5",
        content: "2026",
        fontSize: 106,
        position: {
          x: 0.12783620876736107,
          y: 0.15225006965877916,
        },
        weight: 700,
        uppercase: true,
        align: "center",
        gradient: false,
      },
      {
        id: "text-1778760649032-82ja",
        content: "Marc Aas Nilsson",
        fontSize: 38,
        position: {
          x: 0.06329701967592596,
          y: 0.7598112568587108,
        },
        weight: 700,
        uppercase: false,
        align: "left",
        gradient: false,
      },
      {
        id: "text-1778761388681-8ib2",
        content: "Marc Aas Nilsson",
        fontSize: 30,
        position: {
          x: 0.2738628833912037,
          y: 0.7924074663494514,
        },
        weight: 700,
        uppercase: false,
        align: "left",
        gradient: false,
      },
      {
        id: "text-1778761444718-sq8k",
        content: "Professor & Entrepreneura",
        fontSize: 26,
        position: {
          x: 0.06470042136863444,
          y: 0.7944437800068591,
        },
        weight: 400,
        uppercase: false,
        align: "left",
        gradient: false,
      },
      {
        id: "text-1778761572813-nlhd",
        content: "Professor & Entrepreneur",
        fontSize: 22,
        position: {
          x: 0.27386291051793993,
          y: 0.8199074663494516,
        },
        weight: 400,
        uppercase: false,
        align: "left",
        gradient: false,
      },
      {
        id: "text-1778842454810-h6ij",
        content: "Marc Aas Nilsson",
        fontSize: 30,
        position: {
          x: 0.442984790943287,
          y: 0.7937102730624144,
        },
        weight: 700,
        uppercase: false,
        align: "left",
        gradient: false,
      },
      {
        id: "text-1778842454810-upw8",
        content: "Professor & Entrepreneur",
        fontSize: 22,
        position: {
          x: 0.44298481807002327,
          y: 0.8212102730624146,
        },
        weight: 400,
        uppercase: false,
        align: "left",
        gradient: false,
      },
      {
        id: "text-1778842471670-ii0n",
        content: "Marc Aas Nilsson",
        fontSize: 30,
        position: {
          x: 0.6236960238233025,
          y: 0.7910952557013032,
        },
        weight: 700,
        uppercase: false,
        align: "left",
        gradient: false,
      },
      {
        id: "text-1778842471670-0d4t",
        content: "Professor & Entrepreneur",
        fontSize: 22,
        position: {
          x: 0.6236960509500387,
          y: 0.8185952557013034,
        },
        weight: 400,
        uppercase: false,
        align: "left",
        gradient: false,
      },
      {
        id: "text-1778842471670-v3zn",
        content: "Marc Aas Nilsson",
        fontSize: 30,
        position: {
          x: 0.7928179313753858,
          y: 0.7923980624142662,
        },
        weight: 700,
        uppercase: false,
        align: "left",
        gradient: false,
      },
      {
        id: "text-1778842471670-wm0q",
        content: "Professor & Entrepreneur",
        fontSize: 22,
        position: {
          x: 0.792817958502122,
          y: 0.8198980624142664,
        },
        weight: 400,
        uppercase: false,
        align: "left",
        gradient: false,
      },
    ],
    showLogo: true,
    logoPosition: "bottom-center",
    logoStyle: "red",
    overlayOpacity: 1,
    overlayBlend: "color",
    shapes: [
      {
        id: "shape-1778759438516-avyl",
        type: "rectangle",
        x: 0.5,
        y: 0.5,
        width: 0.943,
        height: 0.893,
        fillType: "outline",
        strokeWidth: 0.001,
        colorType: "solid",
        color1: "#FFFFFF",
        color2: "#FF6B00",
        opacity: 1,
        blur: 0,
        rotation: 0,
        borderRadius: 0.045,
        locked: true,
        hidden: true,
      },
      {
        id: "shape-1778842236195-wqqp",
        type: "rectangle",
        x: 0.3421782407407406,
        y: 0.5937654320987654,
        width: 0.142,
        height: 0.328,
        fillType: "outline",
        strokeWidth: 0.004,
        colorType: "solid",
        color1: "#FFFFFF",
        color2: "#FF6B00",
        opacity: 1,
        blur: 0,
        rotation: 0,
        borderRadius: 0.095,
        imagePlaceholder: {
          label: "PHOTO",
        },
      },
      {
        id: "shape-1778842267138-31v2",
        type: "rectangle",
        x: 0.5118078703703702,
        y: 0.5937654320987654,
        width: 0.142,
        height: 0.328,
        fillType: "fill",
        strokeWidth: 0.004,
        colorType: "solid",
        color1: "rgba(255,255,255,0.08)",
        color2: "#FF6B00",
        opacity: 1,
        blur: 0,
        rotation: 0,
        borderRadius: 0.095,
        imagePlaceholder: {
          label: "PHOTO",
        },
      },
      {
        id: "shape-1778842267616-3doe",
        type: "rectangle",
        x: 0.6871165123456789,
        y: 0.5937654320987654,
        width: 0.142,
        height: 0.328,
        fillType: "fill",
        strokeWidth: 0.004,
        colorType: "solid",
        color1: "rgba(255,255,255,0.08)",
        color2: "#FF6B00",
        opacity: 1,
        blur: 0,
        rotation: 0,
        borderRadius: 0.095,
        imagePlaceholder: {
          label: "PHOTO",
        },
      },
      {
        id: "shape-1778842277337-4dyt",
        type: "rectangle",
        x: 0.8616844135802468,
        y: 0.5937654320987654,
        width: 0.142,
        height: 0.328,
        fillType: "fill",
        strokeWidth: 0.004,
        colorType: "solid",
        color1: "rgba(255,255,255,0.08)",
        color2: "#FF6B00",
        opacity: 1,
        blur: 0,
        rotation: 0,
        borderRadius: 0.1,
        imagePlaceholder: {
          label: "PHOTO",
        },
      },
      {
        id: "shape-1778842503854-7w08",
        type: "rectangle",
        x: 0.14806172839506174,
        y: 0.523,
        width: 0.174,
        height: 0.38,
        fillType: "outline",
        strokeWidth: 0.004,
        colorType: "solid",
        color1: "#FFFFFF",
        color2: "#FF6B00",
        opacity: 1,
        blur: 0,
        rotation: 0,
        borderRadius: 0.095,
        imagePlaceholder: {
          label: "PHOTO",
        },
      },
    ],
    logoCustomPosition: {
      x: 0.09285074869791667,
      y: 0.8923905821330589,
    },
  },
  canvasImages: [],
};

/**
 * Panel 4 — literal clone of preset3 (Panel 5) with the rightmost speaker
 * box and its associated name/title text removed. Every other property is
 * verbatim (background, overlay opacity/blend, frame, sizes, fonts) so the
 * two presets look like siblings instead of separate designs.
 *
 * For other formats (16:9, 9:16) — save them as variants via the editing
 * bar's "Save [format] variant" button. They're not pre-baked here.
 */
const panel4: Preset = {
  id: "panel-4",
  name: "Panel 4",
  description: "Panel — 1 moderator + 3 speakers (cloned from Panel 5).",
  category: "event",
  group: "Panels",
  format: "square",
  customSize: {
    width: 1080,
    height: 1080,
  },
  design: {
    backgroundId: "lm10",
    texts: [
      {
        id: "text-p4-subtitle",
        content: "Investor Panel",
        fontSize: 88,
        position: {
          x: 0.06469748866705272,
          y: 0.2426678347908093,
        },
        weight: 400,
        uppercase: false,
        align: "left",
        gradient: false,
      },
      {
        id: "text-p4-title",
        content: "2026",
        fontSize: 106,
        position: {
          x: 0.12783620876736107,
          y: 0.15225006965877916,
        },
        weight: 700,
        uppercase: true,
        align: "center",
        gradient: false,
      },
      {
        id: "text-p4-mod-name",
        content: "Marc Aas Nilsson",
        fontSize: 38,
        position: {
          x: 0.06329701967592596,
          y: 0.7598112568587108,
        },
        weight: 700,
        uppercase: false,
        align: "left",
        gradient: false,
      },
      {
        id: "text-p4-sp1-name",
        content: "Marc Aas Nilsson",
        fontSize: 30,
        position: {
          x: 0.334,
          y: 0.7924074663494514,
        },
        weight: 700,
        uppercase: false,
        align: "left",
        gradient: false,
      },
      {
        id: "text-p4-mod-title",
        content: "Professor & Entrepreneur",
        fontSize: 26,
        position: {
          x: 0.06470042136863444,
          y: 0.7944437800068591,
        },
        weight: 400,
        uppercase: false,
        align: "left",
        gradient: false,
      },
      {
        id: "text-p4-sp1-title",
        content: "Professor & Entrepreneur",
        fontSize: 22,
        position: {
          x: 0.334,
          y: 0.8199074663494516,
        },
        weight: 400,
        uppercase: false,
        align: "left",
        gradient: false,
      },
      {
        id: "text-p4-sp2-name",
        content: "Marc Aas Nilsson",
        fontSize: 30,
        position: {
          x: 0.539,
          y: 0.7937102730624144,
        },
        weight: 700,
        uppercase: false,
        align: "left",
        gradient: false,
      },
      {
        id: "text-p4-sp2-title",
        content: "Professor & Entrepreneur",
        fontSize: 22,
        position: {
          x: 0.539,
          y: 0.8212102730624146,
        },
        weight: 400,
        uppercase: false,
        align: "left",
        gradient: false,
      },
      {
        id: "text-p4-sp3-name",
        content: "Marc Aas Nilsson",
        fontSize: 30,
        position: {
          x: 0.744,
          y: 0.7910952557013032,
        },
        weight: 700,
        uppercase: false,
        align: "left",
        gradient: false,
      },
      {
        id: "text-p4-sp3-title",
        content: "Professor & Entrepreneur",
        fontSize: 22,
        position: {
          x: 0.744,
          y: 0.8185952557013034,
        },
        weight: 400,
        uppercase: false,
        align: "left",
        gradient: false,
      },
    ],
    showLogo: true,
    logoPosition: "bottom-center",
    logoStyle: "red",
    overlayOpacity: 1,
    overlayBlend: "color",
    shapes: [
      {
        id: "shape-p4-frame",
        type: "rectangle",
        x: 0.5,
        y: 0.5,
        width: 0.943,
        height: 0.893,
        fillType: "outline",
        strokeWidth: 0.001,
        colorType: "solid",
        color1: "#FFFFFF",
        color2: "#FF6B00",
        opacity: 1,
        blur: 0,
        rotation: 0,
        borderRadius: 0.045,
        locked: true,
      },
      {
        id: "shape-p4-sp1",
        type: "rectangle",
        x: 0.405,
        y: 0.5937654320987654,
        width: 0.142,
        height: 0.328,
        fillType: "fill",
        strokeWidth: 0.004,
        colorType: "solid",
        color1: "rgba(255,255,255,0.08)",
        color2: "#FF6B00",
        opacity: 1,
        blur: 0,
        rotation: 0,
        borderRadius: 0.095,
        imagePlaceholder: {
          label: "PHOTO",
        },
      },
      {
        id: "shape-p4-sp2",
        type: "rectangle",
        x: 0.610,
        y: 0.5937654320987654,
        width: 0.142,
        height: 0.328,
        fillType: "fill",
        strokeWidth: 0.004,
        colorType: "solid",
        color1: "rgba(255,255,255,0.08)",
        color2: "#FF6B00",
        opacity: 1,
        blur: 0,
        rotation: 0,
        borderRadius: 0.095,
        imagePlaceholder: {
          label: "PHOTO",
        },
      },
      {
        id: "shape-p4-sp3",
        type: "rectangle",
        x: 0.815,
        y: 0.5937654320987654,
        width: 0.142,
        height: 0.328,
        fillType: "fill",
        strokeWidth: 0.004,
        colorType: "solid",
        color1: "rgba(255,255,255,0.08)",
        color2: "#FF6B00",
        opacity: 1,
        blur: 0,
        rotation: 0,
        borderRadius: 0.095,
        imagePlaceholder: {
          label: "PHOTO",
        },
      },
      {
        id: "shape-p4-mod",
        type: "rectangle",
        x: 0.14806172839506174,
        y: 0.523,
        width: 0.174,
        height: 0.38,
        fillType: "outline",
        strokeWidth: 0.004,
        colorType: "solid",
        color1: "#FFFFFF",
        color2: "#FF6B00",
        opacity: 1,
        blur: 0,
        rotation: 0,
        borderRadius: 0.095,
        imagePlaceholder: {
          label: "PHOTO",
        },
      },
    ],
    logoCustomPosition: {
      x: 0.09285074869791667,
      y: 0.8923905821330589,
    },
  },
  canvasImages: [],
  variants: {
    // 9:16 — portrait layout. Title centered at top, moderator photo
    // centered in the upper-middle, 3 speaker photos in a row below.
    // Same background, overlay, frame style as the 1:1 default.
    story: {
      customSize: { width: 1080, height: 1920 },
      canvasImages: [],
      design: {
        backgroundId: "lm10",
        showLogo: true,
        logoPosition: "bottom-center",
        logoStyle: "red",
        overlayOpacity: 1,
        overlayBlend: "color",
        texts: [
          { id: "text-p4st-subtitle", content: "Investor Panel", fontSize: 56,
            position: { x: 0.5, y: 0.06 }, weight: 400, align: "center", gradient: false },
          { id: "text-p4st-title", content: "2026", fontSize: 140,
            position: { x: 0.5, y: 0.12 }, weight: 700, uppercase: true, align: "center", gradient: false },
          { id: "text-p4st-mod-name", content: "Marc Aas Nilsson", fontSize: 40,
            position: { x: 0.5, y: 0.52 }, weight: 700, align: "center", gradient: false },
          { id: "text-p4st-mod-title", content: "Professor & Entrepreneur", fontSize: 26,
            position: { x: 0.5, y: 0.56 }, weight: 400, align: "center", gradient: false },
          { id: "text-p4st-sp1-name", content: "Marc Aas Nilsson", fontSize: 24,
            position: { x: 0.19, y: 0.84 }, weight: 700, align: "center", gradient: false },
          { id: "text-p4st-sp1-title", content: "Professor & Entrepreneur", fontSize: 17,
            position: { x: 0.19, y: 0.87 }, weight: 400, align: "center", gradient: false },
          { id: "text-p4st-sp2-name", content: "Marc Aas Nilsson", fontSize: 24,
            position: { x: 0.5, y: 0.84 }, weight: 700, align: "center", gradient: false },
          { id: "text-p4st-sp2-title", content: "Professor & Entrepreneur", fontSize: 17,
            position: { x: 0.5, y: 0.87 }, weight: 400, align: "center", gradient: false },
          { id: "text-p4st-sp3-name", content: "Marc Aas Nilsson", fontSize: 24,
            position: { x: 0.81, y: 0.84 }, weight: 700, align: "center", gradient: false },
          { id: "text-p4st-sp3-title", content: "Professor & Entrepreneur", fontSize: 17,
            position: { x: 0.81, y: 0.87 }, weight: 400, align: "center", gradient: false },
        ],
        shapes: [
          { id: "shape-p4st-frame", type: "rectangle", x: 0.5, y: 0.5, width: 0.943, height: 0.893,
            fillType: "outline", strokeWidth: 0.001, colorType: "solid",
            color1: "#FFFFFF", color2: "#FF6B00", opacity: 1, blur: 0, rotation: 0,
            borderRadius: 0.045, locked: true },
          { id: "shape-p4st-mod", type: "rectangle", x: 0.5, y: 0.32, width: 0.40, height: 0.27,
            fillType: "outline", strokeWidth: 0.004, colorType: "solid",
            color1: "#FFFFFF", color2: "#FF6B00", opacity: 1, blur: 0, rotation: 0,
            borderRadius: 0.095, imagePlaceholder: { label: "PHOTO" } },
          { id: "shape-p4st-sp1", type: "rectangle", x: 0.19, y: 0.72, width: 0.26, height: 0.20,
            fillType: "fill", strokeWidth: 0.004, colorType: "solid",
            color1: "rgba(255,255,255,0.08)", color2: "#FF6B00", opacity: 1, blur: 0, rotation: 0,
            borderRadius: 0.095, imagePlaceholder: { label: "PHOTO" } },
          { id: "shape-p4st-sp2", type: "rectangle", x: 0.5, y: 0.72, width: 0.26, height: 0.20,
            fillType: "fill", strokeWidth: 0.004, colorType: "solid",
            color1: "rgba(255,255,255,0.08)", color2: "#FF6B00", opacity: 1, blur: 0, rotation: 0,
            borderRadius: 0.095, imagePlaceholder: { label: "PHOTO" } },
          { id: "shape-p4st-sp3", type: "rectangle", x: 0.81, y: 0.72, width: 0.26, height: 0.20,
            fillType: "fill", strokeWidth: 0.004, colorType: "solid",
            color1: "rgba(255,255,255,0.08)", color2: "#FF6B00", opacity: 1, blur: 0, rotation: 0,
            borderRadius: 0.095, imagePlaceholder: { label: "PHOTO" } },
        ],
      },
    },
  },
};

/**
 * Partner spotlight — single large logo slot. Uses `imagePlaceholder.mode:
 * "contain"` so any logo (wide/tall/square) fits without being cropped.
 * Same visual language as the panel presets (lm10 background, white outline
 * frame, "2026" + subtitle headline, red TechBBQ logo bottom-center).
 *
 * Variants for 16:9 and 9:16 are NOT pre-baked — switch the canvas to the
 * format you need, adjust, and click "Save [format] variant" on the
 * editing bar to bake your own.
 */
const partnerSpotlight: Preset = {
  id: "partner-spotlight",
  name: "Partner Spotlight",
  description: "Logo slot — any aspect ratio fits without cropping.",
  category: "event",
  group: "Partners",
  format: "square",
  customSize: { width: 1080, height: 1080 },
  design: {
    backgroundId: "lm10",
    showLogo: true,
    logoPosition: "bottom-center",
    logoStyle: "red",
    overlayOpacity: 1,
    overlayBlend: "color",
    texts: [
      {
        id: "text-pp-eyebrow",
        content: "PROUD PARTNER",
        fontSize: 32,
        position: { x: 0.5, y: 0.13 },
        weight: 700,
        uppercase: true,
        align: "center",
        gradient: false,
        letterSpacing: 6,
      },
      {
        id: "text-pp-title",
        content: "We are partnering with",
        fontSize: 60,
        position: { x: 0.5, y: 0.21 },
        weight: 400,
        align: "center",
        gradient: false,
      },
      {
        id: "text-pp-footer",
        content: "TechBBQ 2026",
        fontSize: 36,
        position: { x: 0.5, y: 0.82 },
        weight: 700,
        align: "center",
        gradient: false,
      },
    ],
    shapes: [
      // Outline frame (same look as the panel presets).
      {
        id: "shape-pp-frame",
        type: "rectangle",
        x: 0.5,
        y: 0.5,
        width: 0.943,
        height: 0.893,
        fillType: "outline",
        strokeWidth: 0.001,
        colorType: "solid",
        color1: "#FFFFFF",
        color2: "#FF6B00",
        opacity: 1,
        blur: 0,
        rotation: 0,
        borderRadius: 0.045,
        locked: true,
      },
      // Logo slot — large rounded rect centered. `mode: "contain"` so any
      // logo aspect ratio displays in full. Subtle white-ish fill so logos
      // with transparent backgrounds still have a visible frame.
      {
        id: "shape-pp-logo-slot",
        type: "rectangle",
        x: 0.5,
        y: 0.50,
        width: 0.70,
        height: 0.36,
        fillType: "fill",
        strokeWidth: 0.004,
        colorType: "solid",
        color1: "rgba(255,255,255,0.08)",
        color2: "#FF6B00",
        opacity: 1,
        blur: 0,
        rotation: 0,
        borderRadius: 0.03,
        imagePlaceholder: { label: "LOGO", mode: "contain" },
      },
    ],
  },
  canvasImages: [],
};

export const PRESETS: Preset[] = [
  firesideChat,
  investorPanel,
  preset3,
  panel4,
  partnerSpotlight,
];
