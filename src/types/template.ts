export type PlatformFormat = "linkedin" | "instagram" | "story" | "facebook" | "twitter" | "presentation" | "custom";

export interface FormatDimensions {
  width: number;
  height: number;
  label: string;
}

export const FORMAT_DIMENSIONS: Record<PlatformFormat, FormatDimensions> = {
  instagram: { width: 1080, height: 1080, label: "Instagram (1080×1080)" },
  story: { width: 1080, height: 1920, label: "Story (1080×1920)" },
  linkedin: { width: 1200, height: 627, label: "LinkedIn (1200×627)" },
  facebook: { width: 1200, height: 630, label: "Facebook (1200×630)" },
  twitter: { width: 1600, height: 900, label: "Twitter/X (1600×900)" },
  presentation: { width: 1920, height: 1080, label: "Presentation (1920×1080)" },
  custom: { width: 1080, height: 1080, label: "Custom" },
};

export const BACKGROUND_OPTIONS = [
  { id: "lm1", label: "Elegant Gold" },
  { id: "lm2", label: "Warm Amber" },
  { id: "lm3", label: "Creative Magenta" },
  { id: "lm4", label: "Energetic Copper" },
  { id: "lm5", label: "Bold Red-Gold" },
  { id: "lm6", label: "Deep Copper" },
  { id: "lm7", label: "Crimson Ember" },
  { id: "lm8", label: "Midnight Gold" },
  { id: "lm9", label: "Volcanic" },
  { id: "lm10", label: "Dark Flame" },
  { id: "lm11", label: "Amber Noir" },
  { id: "lm12", label: "Scarlet Edge" },
];

export interface DesignConfig {
  headline: string;
  subtitle: string;
  additionalText?: string;
  backgroundId: string;
  partnerName?: string;

  // Layout
  alignment: "left" | "center" | "right";
  textPosition: "center" | "bottom" | "top";
  headlineScale: number;

  // Glass card — frosted dark container for text (premium look)
  showGlassCard?: boolean;
  glassCardPosition?: "center" | "top-center" | "bottom-center" | "center-left" | "center-right";

  // Decorative elements
  showTopBar?: boolean;

  // Logo
  logoStyle?: "red" | "white" | "gradient";
  showLogo?: boolean;
  logoPosition?: "top-left" | "top-center" | "top-right" | "bottom-left" | "bottom-center" | "bottom-right";

  // Multi-image canvas layout (AI-controlled)
  collageLayout?: CollageLayout;

  // Headline style
  headlineGradient?: boolean; // true = gradient text, false = solid white (default: true)

  // Overlay (manual only — AI doesn't control these)
  overlayColor?: string;
  overlayOpacity?: number;
  overlayBlend?: string;
}

export type CollageLayout = "single" | "side-by-side" | "grid-2x2" | "top-bottom" | "hero-with-thumbnails";

export const DEFAULT_DESIGN: DesignConfig = {
  headline: "",
  subtitle: "",
  backgroundId: "lm1",
  alignment: "center",
  textPosition: "center",
  headlineScale: 1.0,
};
