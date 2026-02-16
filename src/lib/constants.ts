export const COLORS = {
  background: "#000000",
  text: "#f2f2f2",
  textMuted: "rgba(242, 242, 242, 0.7)",
  accent: "#FF0028",
  // Gradient colors (yellow → orange → red) — the TechBBQ signature
  gradientStart: "#FFD000",
  gradientMid: "#FF6B00",
  gradientEnd: "#FF0028",
  // Photo card border (gold/amber)
  cardBorder: "rgba(255, 180, 50, 0.5)",
} as const;

export const FONTS = {
  // Archivo Expanded — used for big social media headlines
  headline: "var(--font-archivo), 'Host Grotesk', system-ui, sans-serif",
  // Host Grotesk — used for subtitles/secondary text
  subtitle: "'Host Grotesk', system-ui, -apple-system, sans-serif",
  // Inter — body text
  body: "var(--font-inter), system-ui, -apple-system, sans-serif",
} as const;

// CSS gradient for the signature TechBBQ headline text effect
export const GRADIENT_TEXT_CSS = `linear-gradient(90deg, ${COLORS.gradientStart} 0%, ${COLORS.gradientMid} 50%, ${COLORS.gradientEnd} 100%)`;

// CSS gradient for border effect (used on photo cards and frames)
export const GRADIENT_BORDER_CSS = `linear-gradient(135deg, ${COLORS.gradientStart}, ${COLORS.gradientMid}, ${COLORS.gradientEnd})`;
