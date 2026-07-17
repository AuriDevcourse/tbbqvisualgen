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

// Built-in templates. The team authors these in-app, then ships them via
// "Copy code" in the Templates modal and pastes the generated
// `const … : Preset = {…}` back into this file, adding it to PRESETS below.

/**
 * The house-standard panel: a moderator (left, larger) with three speakers
 * stepping up to the right. Generated from the Panel Maker's canonical 3+1
 * layout, so the template and the generator agree. Photos ship as placeholder
 * slots — drop a headshot on each.
 */
const PANEL_3_MODERATOR: Preset = {
  "id": "panel-3-moderator",
  "name": "Panel · 3 speakers + moderator",
  "description": "House-standard panel discussion: moderator left, three speakers stepping up-right.",
  "category": "event",
  "format": "square",
  "customSize": {
    "width": 1500,
    "height": 1500
  },
  "design": {
    "backgroundId": "orb5",
    "texts": [
      {
        "id": "text-s0",
        "content": "Continuation Capital\n& Venture Secondaries:",
        "position": {
          "x": 0.06,
          "y": 0.18772727272727271
        },
        "fontSize": 109,
        "align": "left",
        "weight": 600,
        "font": "onest",
        "color": "#FFFFFF",
        "simpleRole": "headline"
      },
      {
        "id": "text-s1",
        "content": "Financing the Next Phase of European Growth",
        "position": {
          "x": 0.06,
          "y": 0.3084545454545454
        },
        "fontSize": 54,
        "align": "left",
        "weight": 500,
        "font": "onest",
        "color": "rgba(255,255,255,0.95)",
        "simpleRole": "subtitle"
      },
      {
        "id": "text-s3",
        "content": "PANEL DISCUSSION",
        "position": {
          "x": 0.09,
          "y": 0.38501454545454544
        },
        "fontSize": 54,
        "align": "left",
        "weight": 800,
        "font": "onest",
        "uppercase": true,
        "color": "#15110E",
        "letterSpacing": 1,
        "simpleRole": "label"
      },
      {
        "id": "text-s5",
        "content": "MODERATOR",
        "position": {
          "x": 0.08,
          "y": 0.8127582039911307
        },
        "fontSize": 29,
        "align": "left",
        "weight": 800,
        "font": "onest",
        "uppercase": true,
        "color": "#FFFFFF",
        "letterSpacing": 1,
        "shadow": "0 1px 4px rgba(0,0,0,0.5)"
      },
      {
        "id": "text-s6",
        "content": "Pierre Leroy",
        "position": {
          "x": 0.39,
          "y": 0.48665454545454545
        },
        "fontSize": 30,
        "align": "left",
        "weight": 700,
        "font": "onest",
        "color": "#FFFFFF",
        "simpleRole": "moderator.name"
      },
      {
        "id": "text-s7",
        "content": "Managing Director & Co-Head of\nSecondaries",
        "position": {
          "x": 0.39,
          "y": 0.5170545454545454
        },
        "fontSize": 22,
        "align": "left",
        "weight": 400,
        "font": "onest",
        "color": "rgba(255,255,255,0.82)",
        "simpleRole": "moderator.title"
      },
      {
        "id": "text-s8",
        "content": "at Stifel",
        "position": {
          "x": 0.39,
          "y": 0.5426545454545454
        },
        "fontSize": 22,
        "align": "left",
        "weight": 500,
        "font": "onest",
        "color": "rgba(255,255,255,0.64)",
        "simpleRole": "moderator.company"
      },
      {
        "id": "text-s9",
        "content": "Andrei Xydas",
        "position": {
          "x": 0.39,
          "y": 0.6675244444444445
        },
        "fontSize": 27,
        "align": "left",
        "weight": 700,
        "font": "onest",
        "color": "#FFFFFF",
        "simpleRole": "speaker-0.name"
      },
      {
        "id": "text-sa",
        "content": "Principal",
        "position": {
          "x": 0.39,
          "y": 0.6890044444444445
        },
        "fontSize": 19,
        "align": "left",
        "weight": 400,
        "font": "onest",
        "color": "rgba(255,255,255,0.82)",
        "simpleRole": "speaker-0.title"
      },
      {
        "id": "text-sb",
        "content": "Lightrock",
        "position": {
          "x": 0.39,
          "y": 0.7059644444444446
        },
        "fontSize": 19,
        "align": "left",
        "weight": 500,
        "font": "onest",
        "color": "rgba(255,255,255,0.64)",
        "simpleRole": "speaker-0.company"
      },
      {
        "id": "text-sd",
        "content": "SPEAKER",
        "position": {
          "x": 0.41000000000000003,
          "y": 0.9112499999999999
        },
        "fontSize": 23,
        "align": "left",
        "weight": 800,
        "font": "onest",
        "uppercase": true,
        "color": "#FFFFFF",
        "letterSpacing": 1,
        "shadow": "0 1px 4px rgba(0,0,0,0.5)"
      },
      {
        "id": "text-se",
        "content": "Nicholas Sando",
        "position": {
          "x": 0.5725,
          "y": 0.5906294949494949
        },
        "fontSize": 27,
        "align": "left",
        "weight": 700,
        "font": "onest",
        "color": "#FFFFFF",
        "simpleRole": "speaker-1.name"
      },
      {
        "id": "text-sf",
        "content": "Partner, Secondaries",
        "position": {
          "x": 0.5725,
          "y": 0.612109494949495
        },
        "fontSize": 19,
        "align": "left",
        "weight": 400,
        "font": "onest",
        "color": "rgba(255,255,255,0.82)",
        "simpleRole": "speaker-1.title"
      },
      {
        "id": "text-sg",
        "content": "Molten",
        "position": {
          "x": 0.5725,
          "y": 0.629069494949495
        },
        "fontSize": 19,
        "align": "left",
        "weight": 500,
        "font": "onest",
        "color": "rgba(255,255,255,0.64)",
        "simpleRole": "speaker-1.company"
      },
      {
        "id": "text-si",
        "content": "SPEAKER",
        "position": {
          "x": 0.5925,
          "y": 0.8343550505050503
        },
        "fontSize": 23,
        "align": "left",
        "weight": 800,
        "font": "onest",
        "uppercase": true,
        "color": "#FFFFFF",
        "letterSpacing": 1,
        "shadow": "0 1px 4px rgba(0,0,0,0.5)"
      },
      {
        "id": "text-sj",
        "content": "Omolade Adebisi",
        "position": {
          "x": 0.7549999999999999,
          "y": 0.5007745454545455
        },
        "fontSize": 27,
        "align": "left",
        "weight": 700,
        "font": "onest",
        "color": "#FFFFFF",
        "simpleRole": "speaker-2.name"
      },
      {
        "id": "text-sk",
        "content": "Principal & Head of\nSecondaries",
        "position": {
          "x": 0.7549999999999999,
          "y": 0.5287345454545455
        },
        "fontSize": 19,
        "align": "left",
        "weight": 400,
        "font": "onest",
        "color": "rgba(255,255,255,0.82)",
        "simpleRole": "speaker-2.title"
      },
      {
        "id": "text-sl",
        "content": "ISOMER Capital",
        "position": {
          "x": 0.7549999999999999,
          "y": 0.5521745454545455
        },
        "fontSize": 19,
        "align": "left",
        "weight": 500,
        "font": "onest",
        "color": "rgba(255,255,255,0.64)",
        "simpleRole": "speaker-2.company"
      },
      {
        "id": "text-sn",
        "content": "SPEAKER",
        "position": {
          "x": 0.7749999999999999,
          "y": 0.757460101010101
        },
        "fontSize": 23,
        "align": "left",
        "weight": 800,
        "font": "onest",
        "uppercase": true,
        "color": "#FFFFFF",
        "letterSpacing": 1,
        "shadow": "0 1px 4px rgba(0,0,0,0.5)"
      }
    ],
    "shapes": [
      {
        "id": "shape-s2",
        "type": "rectangle",
        "x": 0.28156,
        "y": 0.3810545454545454,
        "width": 0.44311999999999996,
        "height": 0.06119999999999999,
        "fillType": "fill",
        "strokeWidth": 0,
        "colorType": "solid",
        "color1": "#FFFFFF",
        "color2": "#FF6B00",
        "opacity": 1,
        "blur": 0,
        "rotation": 0,
        "borderRadius": 0.22
      },
      {
        "id": "shape-placeholder-1",
        "type": "rectangle",
        "x": 0.21,
        "y": 0.6535813747228381,
        "width": 0.3,
        "height": 0.36585365853658536,
        "fillType": "fill",
        "strokeWidth": 0.004,
        "colorType": "solid",
        "color1": "rgba(255,255,255,0.08)",
        "color2": "#FF6B00",
        "opacity": 1,
        "blur": 0,
        "rotation": 0,
        "borderRadius": 0.16,
        "imagePlaceholder": {
          "label": "PHOTO"
        }
      },
      {
        "id": "shape-placeholder-2",
        "type": "rectangle",
        "x": 0.48250000000000004,
        "y": 0.8272222222222222,
        "width": 0.185,
        "height": 0.20555555555555555,
        "fillType": "fill",
        "strokeWidth": 0.004,
        "colorType": "solid",
        "color1": "rgba(255,255,255,0.08)",
        "color2": "#FF6B00",
        "opacity": 1,
        "blur": 0,
        "rotation": 0,
        "borderRadius": 0.16,
        "imagePlaceholder": {
          "label": "PHOTO"
        }
      },
      {
        "id": "shape-placeholder-3",
        "type": "rectangle",
        "x": 0.665,
        "y": 0.7503272727272726,
        "width": 0.185,
        "height": 0.20555555555555555,
        "fillType": "fill",
        "strokeWidth": 0.004,
        "colorType": "solid",
        "color1": "rgba(255,255,255,0.08)",
        "color2": "#FF6B00",
        "opacity": 1,
        "blur": 0,
        "rotation": 0,
        "borderRadius": 0.16,
        "imagePlaceholder": {
          "label": "PHOTO"
        }
      },
      {
        "id": "shape-placeholder-4",
        "type": "rectangle",
        "x": 0.8474999999999999,
        "y": 0.6734323232323233,
        "width": 0.185,
        "height": 0.20555555555555555,
        "fillType": "fill",
        "strokeWidth": 0.004,
        "colorType": "solid",
        "color1": "rgba(255,255,255,0.08)",
        "color2": "#FF6B00",
        "opacity": 1,
        "blur": 0,
        "rotation": 0,
        "borderRadius": 0.16,
        "imagePlaceholder": {
          "label": "PHOTO"
        }
      }
    ],
    "showLogo": true,
    "logoStyle": "white",
    "logoPosition": "bottom-left"
  },
  "canvasImages": []
};

PANEL_3_MODERATOR.variants = {
  "presentation": {
    "customSize": {
      "width": 1920,
      "height": 1080
    },
    "design": {
      "backgroundId": "orb5",
      "texts": [
        {
          "id": "text-s0",
          "content": "Continuation Capital\n& Venture Secondaries:",
          "position": {
            "x": 0.06,
            "y": 0.197
          },
          "fontSize": 89,
          "align": "left",
          "weight": 600,
          "font": "onest",
          "color": "#FFFFFF",
          "simpleRole": "headline"
        },
        {
          "id": "text-s1",
          "content": "Financing the Next Phase of European Growth",
          "position": {
            "x": 0.06,
            "y": 0.327
          },
          "fontSize": 39,
          "align": "left",
          "weight": 500,
          "font": "onest",
          "color": "rgba(255,255,255,0.95)",
          "simpleRole": "subtitle"
        },
        {
          "id": "text-s3",
          "content": "PANEL DISCUSSION",
          "position": {
            "x": 0.076875,
            "y": 0.40356000000000003
          },
          "fontSize": 39,
          "align": "left",
          "weight": 800,
          "font": "onest",
          "uppercase": true,
          "color": "#15110E",
          "letterSpacing": 1,
          "simpleRole": "label"
        },
        {
          "id": "text-s4",
          "content": "Pierre Leroy",
          "position": {
            "x": 0.06,
            "y": 0.504
          },
          "fontSize": 22,
          "align": "left",
          "weight": 700,
          "font": "onest",
          "color": "#FFFFFF",
          "simpleRole": "moderator.name"
        },
        {
          "id": "text-s5",
          "content": "Managing Director & Co-Head of\nSecondaries",
          "position": {
            "x": 0.06,
            "y": 0.5344
          },
          "fontSize": 16,
          "align": "left",
          "weight": 400,
          "font": "onest",
          "color": "rgba(255,255,255,0.82)",
          "simpleRole": "moderator.title"
        },
        {
          "id": "text-s6",
          "content": "at Stifel",
          "position": {
            "x": 0.06,
            "y": 0.5599999999999999
          },
          "fontSize": 16,
          "align": "left",
          "weight": 500,
          "font": "onest",
          "color": "rgba(255,255,255,0.64)",
          "simpleRole": "moderator.company"
        },
        {
          "id": "text-s8",
          "content": "MODERATOR",
          "position": {
            "x": 0.08,
            "y": 0.8975000000000001
          },
          "fontSize": 19,
          "align": "left",
          "weight": 800,
          "font": "onest",
          "uppercase": true,
          "color": "#FFFFFF",
          "letterSpacing": 1,
          "shadow": "0 1px 4px rgba(0,0,0,0.5)"
        },
        {
          "id": "text-s9",
          "content": "Andrei Xydas",
          "position": {
            "x": 0.3277209302325581,
            "y": 0.5222800000000001
          },
          "fontSize": 19,
          "align": "left",
          "weight": 700,
          "font": "onest",
          "color": "#FFFFFF",
          "simpleRole": "speaker-0.name"
        },
        {
          "id": "text-sa",
          "content": "Principal",
          "position": {
            "x": 0.3277209302325581,
            "y": 0.5437600000000001
          },
          "fontSize": 14,
          "align": "left",
          "weight": 400,
          "font": "onest",
          "color": "rgba(255,255,255,0.82)",
          "simpleRole": "speaker-0.title"
        },
        {
          "id": "text-sb",
          "content": "Lightrock",
          "position": {
            "x": 0.3277209302325581,
            "y": 0.5607200000000002
          },
          "fontSize": 14,
          "align": "left",
          "weight": 500,
          "font": "onest",
          "color": "rgba(255,255,255,0.64)",
          "simpleRole": "speaker-0.company"
        },
        {
          "id": "text-sd",
          "content": "SPEAKER",
          "position": {
            "x": 0.3477209302325581,
            "y": 0.90125
          },
          "fontSize": 16,
          "align": "left",
          "weight": 800,
          "font": "onest",
          "uppercase": true,
          "color": "#FFFFFF",
          "letterSpacing": 1,
          "shadow": "0 1px 4px rgba(0,0,0,0.5)"
        },
        {
          "id": "text-se",
          "content": "Nicholas Sando",
          "position": {
            "x": 0.537813953488372,
            "y": 0.5222800000000001
          },
          "fontSize": 19,
          "align": "left",
          "weight": 700,
          "font": "onest",
          "color": "#FFFFFF",
          "simpleRole": "speaker-1.name"
        },
        {
          "id": "text-sf",
          "content": "Partner, Secondaries",
          "position": {
            "x": 0.537813953488372,
            "y": 0.5437600000000001
          },
          "fontSize": 14,
          "align": "left",
          "weight": 400,
          "font": "onest",
          "color": "rgba(255,255,255,0.82)",
          "simpleRole": "speaker-1.title"
        },
        {
          "id": "text-sg",
          "content": "Molten",
          "position": {
            "x": 0.537813953488372,
            "y": 0.5607200000000002
          },
          "fontSize": 14,
          "align": "left",
          "weight": 500,
          "font": "onest",
          "color": "rgba(255,255,255,0.64)",
          "simpleRole": "speaker-1.company"
        },
        {
          "id": "text-si",
          "content": "SPEAKER",
          "position": {
            "x": 0.557813953488372,
            "y": 0.90125
          },
          "fontSize": 16,
          "align": "left",
          "weight": 800,
          "font": "onest",
          "uppercase": true,
          "color": "#FFFFFF",
          "letterSpacing": 1,
          "shadow": "0 1px 4px rgba(0,0,0,0.5)"
        },
        {
          "id": "text-sj",
          "content": "Omolade Adebisi",
          "position": {
            "x": 0.7479069767441859,
            "y": 0.5222800000000001
          },
          "fontSize": 19,
          "align": "left",
          "weight": 700,
          "font": "onest",
          "color": "#FFFFFF",
          "simpleRole": "speaker-2.name"
        },
        {
          "id": "text-sk",
          "content": "Principal & Head of Secondaries",
          "position": {
            "x": 0.7479069767441859,
            "y": 0.5437600000000001
          },
          "fontSize": 14,
          "align": "left",
          "weight": 400,
          "font": "onest",
          "color": "rgba(255,255,255,0.82)",
          "simpleRole": "speaker-2.title"
        },
        {
          "id": "text-sl",
          "content": "ISOMER Capital",
          "position": {
            "x": 0.7479069767441859,
            "y": 0.5607200000000002
          },
          "fontSize": 14,
          "align": "left",
          "weight": 500,
          "font": "onest",
          "color": "rgba(255,255,255,0.64)",
          "simpleRole": "speaker-2.company"
        },
        {
          "id": "text-sn",
          "content": "SPEAKER",
          "position": {
            "x": 0.767906976744186,
            "y": 0.90125
          },
          "fontSize": 16,
          "align": "left",
          "weight": 800,
          "font": "onest",
          "uppercase": true,
          "color": "#FFFFFF",
          "letterSpacing": 1,
          "shadow": "0 1px 4px rgba(0,0,0,0.5)"
        }
      ],
      "shapes": [
        {
          "id": "shape-s2",
          "type": "rectangle",
          "x": 0.18572124999999998,
          "y": 0.3996,
          "width": 0.25144249999999996,
          "height": 0.06119999999999999,
          "fillType": "fill",
          "strokeWidth": 0,
          "colorType": "solid",
          "color1": "#FFFFFF",
          "color2": "#FF6B00",
          "opacity": 1,
          "blur": 0,
          "rotation": 0,
          "borderRadius": 0.22
        },
        {
          "id": "shape-placeholder-1",
          "type": "rectangle",
          "x": 0.1414725,
          "y": 0.7496,
          "width": 0.16294499999999998,
          "height": 0.3408,
          "fillType": "fill",
          "strokeWidth": 0.004,
          "colorType": "solid",
          "color1": "rgba(255,255,255,0.08)",
          "color2": "#FF6B00",
          "opacity": 1,
          "blur": 0,
          "rotation": 0,
          "borderRadius": 0.16,
          "imagePlaceholder": {
            "label": "PHOTO"
          }
        },
        {
          "id": "shape-placeholder-2",
          "type": "rectangle",
          "x": 0.4091934302325581,
          "y": 0.7496,
          "width": 0.16294499999999998,
          "height": 0.3408,
          "fillType": "fill",
          "strokeWidth": 0.004,
          "colorType": "solid",
          "color1": "rgba(255,255,255,0.08)",
          "color2": "#FF6B00",
          "opacity": 1,
          "blur": 0,
          "rotation": 0,
          "borderRadius": 0.16,
          "imagePlaceholder": {
            "label": "PHOTO"
          }
        },
        {
          "id": "shape-placeholder-3",
          "type": "rectangle",
          "x": 0.619286453488372,
          "y": 0.7496,
          "width": 0.16294499999999998,
          "height": 0.3408,
          "fillType": "fill",
          "strokeWidth": 0.004,
          "colorType": "solid",
          "color1": "rgba(255,255,255,0.08)",
          "color2": "#FF6B00",
          "opacity": 1,
          "blur": 0,
          "rotation": 0,
          "borderRadius": 0.16,
          "imagePlaceholder": {
            "label": "PHOTO"
          }
        },
        {
          "id": "shape-placeholder-4",
          "type": "rectangle",
          "x": 0.8293794767441859,
          "y": 0.7496,
          "width": 0.16294499999999998,
          "height": 0.3408,
          "fillType": "fill",
          "strokeWidth": 0.004,
          "colorType": "solid",
          "color1": "rgba(255,255,255,0.08)",
          "color2": "#FF6B00",
          "opacity": 1,
          "blur": 0,
          "rotation": 0,
          "borderRadius": 0.16,
          "imagePlaceholder": {
            "label": "PHOTO"
          }
        }
      ],
      "showLogo": true,
      "logoStyle": "white",
      "logoPosition": "bottom-left"
    },
    "canvasImages": []
  },
  "story": {
    "customSize": {
      "width": 1080,
      "height": 1920
    },
    "design": {
      "backgroundId": "orb5",
      "texts": [
        {
          "id": "text-s0",
          "content": "Continuation Capital\n& Venture Secondaries:",
          "position": {
            "x": 0.06,
            "y": 0.15590909090909089
          },
          "fontSize": 79,
          "align": "left",
          "weight": 600,
          "font": "onest",
          "color": "#FFFFFF",
          "simpleRole": "headline"
        },
        {
          "id": "text-s1",
          "content": "Financing the Next Phase of European Growth",
          "position": {
            "x": 0.06,
            "y": 0.2369431818181818
          },
          "fontSize": 39,
          "align": "left",
          "weight": 500,
          "font": "onest",
          "color": "rgba(255,255,255,0.95)",
          "simpleRole": "subtitle"
        },
        {
          "id": "text-s3",
          "content": "PANEL DISCUSSION",
          "position": {
            "x": 0.09,
            "y": 0.29050818181818183
          },
          "fontSize": 39,
          "align": "left",
          "weight": 800,
          "font": "onest",
          "uppercase": true,
          "color": "#15110E",
          "letterSpacing": 1,
          "simpleRole": "label"
        },
        {
          "id": "text-s5",
          "content": "MODERATOR",
          "position": {
            "x": 0.076,
            "y": 0.5563690909090909
          },
          "fontSize": 15,
          "align": "left",
          "weight": 800,
          "font": "onest",
          "uppercase": true,
          "color": "#FFFFFF",
          "letterSpacing": 1,
          "shadow": "0 1px 4px rgba(0,0,0,0.5)"
        },
        {
          "id": "text-s6",
          "content": "Pierre Leroy",
          "position": {
            "x": 0.076,
            "y": 0.572056590909091
          },
          "fontSize": 26,
          "align": "left",
          "weight": 700,
          "font": "onest",
          "color": "#FFFFFF",
          "simpleRole": "moderator.name"
        },
        {
          "id": "text-s7",
          "content": "Managing Director & Co-Head of\nSecondaries, at Stifel",
          "position": {
            "x": 0.076,
            "y": 0.594526590909091
          },
          "fontSize": 19,
          "align": "left",
          "weight": 400,
          "font": "onest",
          "color": "rgba(255,255,255,0.88)",
          "simpleRole": "moderator.secondary"
        },
        {
          "id": "text-s9",
          "content": "SPEAKER",
          "position": {
            "x": 0.528,
            "y": 0.566089090909091
          },
          "fontSize": 15,
          "align": "left",
          "weight": 800,
          "font": "onest",
          "uppercase": true,
          "color": "#FFFFFF",
          "letterSpacing": 1,
          "shadow": "0 1px 4px rgba(0,0,0,0.5)"
        },
        {
          "id": "text-sa",
          "content": "Andrei Xydas",
          "position": {
            "x": 0.528,
            "y": 0.5817765909090911
          },
          "fontSize": 26,
          "align": "left",
          "weight": 700,
          "font": "onest",
          "color": "#FFFFFF",
          "simpleRole": "speaker-0.name"
        },
        {
          "id": "text-sb",
          "content": "Principal, Lightrock",
          "position": {
            "x": 0.528,
            "y": 0.5993865909090911
          },
          "fontSize": 19,
          "align": "left",
          "weight": 400,
          "font": "onest",
          "color": "rgba(255,255,255,0.88)",
          "simpleRole": "speaker-0.secondary"
        },
        {
          "id": "text-sd",
          "content": "SPEAKER",
          "position": {
            "x": 0.076,
            "y": 0.8608425000000001
          },
          "fontSize": 15,
          "align": "left",
          "weight": 800,
          "font": "onest",
          "uppercase": true,
          "color": "#FFFFFF",
          "letterSpacing": 1,
          "shadow": "0 1px 4px rgba(0,0,0,0.5)"
        },
        {
          "id": "text-se",
          "content": "Nicholas Sando",
          "position": {
            "x": 0.076,
            "y": 0.8765300000000001
          },
          "fontSize": 26,
          "align": "left",
          "weight": 700,
          "font": "onest",
          "color": "#FFFFFF",
          "simpleRole": "speaker-1.name"
        },
        {
          "id": "text-sf",
          "content": "Partner, Secondaries, Molten",
          "position": {
            "x": 0.076,
            "y": 0.8941400000000002
          },
          "fontSize": 19,
          "align": "left",
          "weight": 400,
          "font": "onest",
          "color": "rgba(255,255,255,0.88)",
          "simpleRole": "speaker-1.secondary"
        },
        {
          "id": "text-sh",
          "content": "SPEAKER",
          "position": {
            "x": 0.528,
            "y": 0.8511225000000001
          },
          "fontSize": 15,
          "align": "left",
          "weight": 800,
          "font": "onest",
          "uppercase": true,
          "color": "#FFFFFF",
          "letterSpacing": 1,
          "shadow": "0 1px 4px rgba(0,0,0,0.5)"
        },
        {
          "id": "text-si",
          "content": "Omolade Adebisi",
          "position": {
            "x": 0.528,
            "y": 0.8668100000000002
          },
          "fontSize": 26,
          "align": "left",
          "weight": 700,
          "font": "onest",
          "color": "#FFFFFF",
          "simpleRole": "speaker-2.name"
        },
        {
          "id": "text-sj",
          "content": "Principal & Head of Secondaries, ISOMER\nCapital",
          "position": {
            "x": 0.528,
            "y": 0.8892800000000002
          },
          "fontSize": 19,
          "align": "left",
          "weight": 400,
          "font": "onest",
          "color": "rgba(255,255,255,0.88)",
          "simpleRole": "speaker-2.secondary"
        }
      ],
      "shapes": [
        {
          "id": "shape-s2",
          "type": "rectangle",
          "x": 0.2835044444444444,
          "y": 0.28828068181818184,
          "width": 0.4470088888888888,
          "height": 0.034425,
          "fillType": "fill",
          "strokeWidth": 0,
          "colorType": "solid",
          "color1": "#FFFFFF",
          "color2": "#FF6B00",
          "opacity": 1,
          "blur": 0,
          "rotation": 0,
          "borderRadius": 0.22
        },
        {
          "id": "shape-placeholder-1",
          "type": "rectangle",
          "x": 0.27399999999999997,
          "y": 0.4898698863636364,
          "width": 0.42799999999999994,
          "height": 0.27075340909090906,
          "fillType": "fill",
          "strokeWidth": 0.004,
          "colorType": "solid",
          "color1": "rgba(255,255,255,0.08)",
          "color2": "#FF6B00",
          "opacity": 1,
          "blur": 0,
          "rotation": 0,
          "borderRadius": 0.16,
          "imagePlaceholder": {
            "label": "PHOTO"
          }
        },
        {
          "id": "shape-placeholder-2",
          "type": "rectangle",
          "x": 0.726,
          "y": 0.4898698863636364,
          "width": 0.42799999999999994,
          "height": 0.27075340909090906,
          "fillType": "fill",
          "strokeWidth": 0.004,
          "colorType": "solid",
          "color1": "rgba(255,255,255,0.08)",
          "color2": "#FF6B00",
          "opacity": 1,
          "blur": 0,
          "rotation": 0,
          "borderRadius": 0.16,
          "imagePlaceholder": {
            "label": "PHOTO"
          }
        },
        {
          "id": "shape-placeholder-3",
          "type": "rectangle",
          "x": 0.27399999999999997,
          "y": 0.7846232954545456,
          "width": 0.42799999999999994,
          "height": 0.27075340909090906,
          "fillType": "fill",
          "strokeWidth": 0.004,
          "colorType": "solid",
          "color1": "rgba(255,255,255,0.08)",
          "color2": "#FF6B00",
          "opacity": 1,
          "blur": 0,
          "rotation": 0,
          "borderRadius": 0.16,
          "imagePlaceholder": {
            "label": "PHOTO"
          }
        },
        {
          "id": "shape-placeholder-4",
          "type": "rectangle",
          "x": 0.726,
          "y": 0.7846232954545456,
          "width": 0.42799999999999994,
          "height": 0.27075340909090906,
          "fillType": "fill",
          "strokeWidth": 0.004,
          "colorType": "solid",
          "color1": "rgba(255,255,255,0.08)",
          "color2": "#FF6B00",
          "opacity": 1,
          "blur": 0,
          "rotation": 0,
          "borderRadius": 0.16,
          "imagePlaceholder": {
            "label": "PHOTO"
          }
        }
      ],
      "showLogo": true,
      "logoStyle": "white",
      "logoPosition": "bottom-left"
    },
    "canvasImages": []
  }
};

export const PRESETS: Preset[] = [PANEL_3_MODERATOR];
