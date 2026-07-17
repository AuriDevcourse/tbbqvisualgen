export type PlatformFormat = "square" | "presentation" | "story" | "custom";

export interface FormatDimensions {
  width: number;
  height: number;
  label: string;
}

export const FORMAT_DIMENSIONS: Record<PlatformFormat, FormatDimensions> = {
  square: { width: 1500, height: 1500, label: "1:1 Square (1500×1500)" },
  presentation: { width: 1920, height: 1080, label: "16:9 Full HD (1920×1080)" },
  story: { width: 1080, height: 1920, label: "9:16 Story (1080×1920)" },
  custom: { width: 1080, height: 1080, label: "Custom" },
};

// Background labels are kept in sync with the BG_REGISTRY in CanvasBackground.tsx.
// This array preserves the picker order and is the source of truth for what
// the user sees in the BackgroundPicker / Layers panel.
export const BACKGROUND_OPTIONS: { id: string; label: string; group: string }[] = [
  // New styling — ported from the newer TechBBQ design-system project: 2D-canvas
  // orbs (#FA7000 -> #CE0F2E) drifting on dark or deep-red bases.
  { id: "orb5", label: "Soft Ember", group: "New styling" },
  { id: "orb6", label: "Right Bloom", group: "New styling" },
  { id: "orb7", label: "Corner Heat", group: "New styling" },
  { id: "orb1", label: "Founder Orbs", group: "New styling" },
  { id: "orb2", label: "Crimson Wash", group: "New styling" },
  { id: "orb3", label: "Ember Drift", group: "New styling" },
  { id: "orb4", label: "Ignite", group: "New styling" },
  // Yellow / gold liquid-metal
  { id: "lm1", label: "Honey Glow", group: "Liquid metal" },
  { id: "lm2", label: "Sunbeam", group: "Liquid metal" },
  { id: "lm3", label: "Amber Pulse", group: "Liquid metal" },
  // Red / lava liquid-metal
  { id: "lm4", label: "Crimson Flow", group: "Liquid metal" },
  { id: "lm5", label: "Ember Red", group: "Liquid metal" },
  { id: "lm6", label: "Scarlet Tide", group: "Liquid metal" },
  // Purple / magenta liquid-metal
  { id: "lm7", label: "Royal Plum", group: "Liquid metal" },
  { id: "lm8", label: "Twilight Violet", group: "Liquid metal" },
  { id: "lm9", label: "Mystic Magenta", group: "Liquid metal" },
  // Shaped variants — same liquid-metal shader, different geometry.
  { id: "lm10", label: "Lava Bloom", group: "Liquid metal" },
  { id: "lm11", label: "Solar Crown", group: "Liquid metal" },
  { id: "lm12", label: "Daisy Ember", group: "Liquid metal" },
  { id: "lm13", label: "Diamond Ruby", group: "Liquid metal" },
  // Cool palette for variety
  { id: "lm14", label: "Cyber Teal", group: "Liquid metal" },
  { id: "lm15", label: "Ocean Deep", group: "Liquid metal" },
  { id: "lm16", label: "Forest Mist", group: "Liquid metal" },
  { id: "lm17", label: "Rose Gold", group: "Liquid metal" },
  { id: "lm18", label: "Midnight Sky", group: "Liquid metal" },
];

/**
 * A single piece of text on the canvas. Each TextElement is its own layer —
 * the user can add as many as they want, each with its own content, size,
 * color, weight and position. Replaces the old fixed headline/subtitle/etc.
 */
export interface TextElement {
  id: string;
  content: string;
  /** Which Panel Maker field this layer came from — e.g. "headline",
   *  "speaker-1.title". Lets Panel Maker retarget a form edit at the matching
   *  layer of a hand-tuned design instead of regenerating and losing the
   *  tuning. Absent on layers the user added by hand in the editor. */
  simpleRole?: string;
  /** Font size in px at canvas resolution. */
  fontSize: number;
  /** Position on canvas (0–1 fractional, center anchor). */
  position: { x: number; y: number };
  /** Optional color (CSS color string). When undefined and `gradient` is false, defaults to white. */
  color?: string;
  /** When true, the brand gold→red gradient overrides `color`. */
  gradient?: boolean;
  /** Font weight (400–900). Default 700. */
  weight?: number;
  /** Uppercase the rendered text. Default false. */
  uppercase?: boolean;
  /** Letter spacing in px. */
  letterSpacing?: number;
  /** Text alignment when content wraps across multiple lines. */
  align?: "left" | "center" | "right";
  /** Visibility flag — when true, the layer renders nothing on the canvas. */
  hidden?: boolean;
  /** When true the layer can't be selected via marquee or dragged on canvas
   *  (still toggleable via the Layers panel). */
  locked?: boolean;
  /** Font face on the canvas. Defaults to "onest". */
  font?: "onest" | "inter";
  /** Line height as a multiple of font size. Default 1.1. */
  lineHeight?: number;
  /** Rotation in degrees. Default 0. */
  rotation?: number;
  /** Italic style. Default false. */
  italic?: boolean;
  /** 0–1 opacity. Default 1. */
  opacity?: number;
  /** Gaussian blur, fractional (multiplied by canvas width when rendered). */
  blur?: number;
  /** Shared group identifier — clicking any member selects the whole group. */
  groupId?: string;
  /** Optional CSS text-shadow (e.g. for legible labels overlaid on photos). */
  shadow?: string;
}

/** A vector shape on the canvas — rectangle / circle / line / star. */
export type ShapeType = "rectangle" | "circle" | "line" | "star";

export interface ShapeBorderRadii {
  tl: number;
  tr: number;
  br: number;
  bl: number;
}

export interface ShapeElement {
  id: string;
  type: ShapeType;
  /** Center position in 0–1 fractional canvas coords. */
  x: number;
  y: number;
  /** Size in 0–1 fractional canvas coords. */
  width: number;
  height: number;
  /** Filled body or outline-only. */
  fillType: "fill" | "outline";
  /** Stroke width in 0–1 fractional (relative to canvas width). */
  strokeWidth: number;
  colorType: "solid" | "gradient";
  /** Primary color (also the stroke color when `fillType === "outline"`). */
  color1: string;
  /** Secondary color, only used when `colorType === "gradient"`. */
  color2: string;
  /** 0–1. */
  opacity: number;
  /** Gaussian blur, fractional (multiplied by canvas width when rendered). */
  blur: number;
  /** Rotation in degrees. */
  rotation: number;
  /** Visibility flag — hidden shapes don't render. */
  hidden?: boolean;
  /** When true the shape can't be selected via marquee or dragged on canvas. */
  locked?: boolean;
  /** Shared group identifier — clicking any member selects the whole group. */
  groupId?: string;
  // ── Per-type ────────────────────────────────────────────────────────────
  /** Rectangle only. Either a single radius (uniform) or per-corner. Stored
   *  as a fraction of the shorter side: 0 = sharp, 0.5 = pill. */
  borderRadius?: number | ShapeBorderRadii;
  /** Star only. Number of points. */
  spikes?: number;
  /** Star only. Inner-radius ratio (0–1) — 0 = sharp spikes, 1 = circle. */
  innerRadius?: number;
  /** When set, the shape acts as an image-upload slot — clicking opens a file
   *  picker, and on upload the shape is replaced with a CanvasImage at the
   *  same position/size. Used by presets (e.g. "Fireside Chat" moderator &
   *  speaker slots). The label is rendered centered inside the shape.
   *
   *  `mode` controls how the uploaded image fits the slot:
   *    - "cover" (default): crops to fill — for headshots, hero photos
   *    - "contain": fits whole image inside, no crop — for logos / any
   *      asset with a non-matching aspect ratio you want fully visible */
  imagePlaceholder?: { label: string; mode?: "cover" | "contain" };
}

/** Defaults for a freshly-added image-placeholder slot — rounded rect at
 *  canvas center, sized as a typical portrait headshot. Renders with a dashed
 *  border + "Upload photo" button; click swaps it for an uploaded image. */
export function newImagePlaceholder(label = "PHOTO"): ShapeElement {
  return {
    id: `shape-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type: "rectangle",
    x: 0.5,
    y: 0.5,
    width: 0.18,
    height: 0.26,
    fillType: "fill",
    strokeWidth: 0.004,
    colorType: "solid",
    color1: "rgba(255,255,255,0.08)",
    color2: "#FF6B00",
    opacity: 1,
    blur: 0,
    rotation: 0,
    borderRadius: 0.06,
    imagePlaceholder: { label },
  };
}

/** Defaults for a freshly-added shape — placed at canvas center. */
export function newShapeElement(type: ShapeType): ShapeElement {
  const base: ShapeElement = {
    id: `shape-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type,
    x: 0.5,
    y: 0.5,
    width: 0.25,
    height: 0.25,
    fillType: "fill",
    strokeWidth: 0.004,
    colorType: "solid",
    color1: "#FFFFFF",
    color2: "#FF6B00",
    opacity: 1,
    blur: 0,
    rotation: 0,
  };
  if (type === "rectangle") return { ...base, borderRadius: 0 };
  if (type === "line") return { ...base, height: 0.006 };
  if (type === "star") return { ...base, spikes: 5, innerRadius: 0.5 };
  return base;
}

export interface DesignConfig {
  backgroundId: string;

  /** Multiple text layers — each independently positioned, sized and styled. */
  texts: TextElement[];

  /** Vector shapes (rectangle / circle / line / star). */
  shapes?: ShapeElement[];

  // Decorative elements
  showTopBar?: boolean;

  // TechBBQ Logo
  logoStyle?: "red" | "white" | "gradient";
  showLogo?: boolean;
  logoPosition?: "top-left" | "top-center" | "top-right" | "bottom-left" | "bottom-center" | "bottom-right";
  /** When set, overrides `logoPosition`: fractional center-anchor coords from dragging. */
  logoCustomPosition?: { x: number; y: number };
  /** Multiplier applied to the logo's default rendered height. 1 = default,
   *  0.5 = half size, 2 = double. Clamped to [0.3, 3.0] in the UI. */
  logoScale?: number;

  // Multi-image canvas layout (legacy AI field)
  collageLayout?: CollageLayout;

  // Overlay (manual)
  overlayColor?: string;
  overlayOpacity?: number;
  overlayBlend?: string;

  // Layer-system flags
  hideOverlay?: boolean;

  /**
   * Explicit layer stack order — bottom to top. Entries use stable ids:
   *   - `overlay`, `tbbqLogo`
   *   - `image:${canvasImage.id}` for each canvas image
   *   - `text:${textElement.id}` for each text layer
   */
  layerOrder?: string[];
}

/**
 * Reconcile a stored layerOrder with the currently-available layers:
 *   - drop entries that no longer exist (e.g. a deleted image or text)
 *   - insert new entries at their default stack position so a fresh text/photo
 *     lands at a predictable place rather than always force-pushed to the top.
 * Returns the effective order to use for rendering, bottom-to-top.
 */
export function reconcileLayerOrder(stored: string[] | undefined, available: string[]): string[] {
  if (!stored?.length) return available;
  const storedSet = new Set(stored);
  const result = stored.filter((id) => available.includes(id));
  for (let i = 0; i < available.length; i++) {
    if (storedSet.has(available[i])) continue;
    const missingId = available[i];
    // Anchor: the next default-neighbor that already exists in `result`. Insert
    // the missing layer just below that anchor (i.e. at the anchor's index).
    let insertAt = result.length; // fallback: top of stack
    for (let j = i + 1; j < available.length; j++) {
      const idx = result.indexOf(available[j]);
      if (idx !== -1) { insertAt = idx; break; }
    }
    result.splice(insertAt, 0, missingId);
  }
  return result;
}

export type CollageLayout = "single" | "side-by-side" | "grid-2x2" | "top-bottom" | "hero-with-thumbnails";

export const DEFAULT_DESIGN: DesignConfig = {
  backgroundId: "orb5",
  texts: [],
  showLogo: true,
  logoPosition: "bottom-center",
  logoStyle: "white",
};

/** Default values for a newly-created TextElement. */
export function newTextElement(content = "TEXT"): TextElement {
  return {
    id: `text-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    content,
    fontSize: 96,
    position: { x: 0.5, y: 0.5 },
    weight: 700,
    uppercase: false,
    align: "center",
    gradient: false,
  };
}
