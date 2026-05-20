"use client";

import { LiquidMetal } from "@paper-design/shaders-react";
import type { LiquidMetalShape } from "@paper-design/shaders";

/**
 * All canvas backgrounds in one registry. Every entry uses the same Paper
 * Design "LiquidMetal" shader with different colour / motion presets.
 *
 * Picker thumbnails render as a STATIC CSS gradient (derived from the same
 * colors). This avoids the ~16 active-WebGL-context limit that browsers
 * impose — with 18 presets + the main canvas a WebGL-thumbnail approach
 * blows past the cap and the main canvas's context gets evicted (the live
 * preview goes blank). The CSS gradient is an obvious approximation, not a
 * pixel-perfect render, but it's enough to tell presets apart at a glance.
 */

interface LmConfig {
  colorBack: string;
  colorTint: string;
  shape: LiquidMetalShape;
  scale: number;
  speed: number;
  repetition: number;
  softness: number;
  distortion: number;
  contour: number;
  angle: number;
  shiftRed: number;
  shiftBlue: number;
  frame: number;
}

interface BgEntry {
  label: string;
  config: LmConfig;
}

export const BG_REGISTRY: Record<string, BgEntry> = {
  // ---- Yellow / gold ----
  lm1: { label: "Honey Glow",      config: { colorBack: "#1a0d00", colorTint: "#FFC400", shape: "none",      scale: 2.0, speed: 0.2,  repetition: 1.8, softness: 0.55, distortion: 0.05, contour: 0.2,  angle: 45,  shiftRed: 0.2,   shiftBlue: -0.25, frame: 5  } },
  lm2: { label: "Sunbeam",         config: { colorBack: "#120800", colorTint: "#FFE066", shape: "none",      scale: 2.4, speed: 0.15, repetition: 2.4, softness: 0.75, distortion: 0.03, contour: 0.12, angle: 100, shiftRed: 0.1,   shiftBlue: -0.3,  frame: 15 } },
  lm3: { label: "Amber Pulse",     config: { colorBack: "#0d0500", colorTint: "#FFA500", shape: "none",      scale: 1.8, speed: 0.22, repetition: 1.6, softness: 0.45, distortion: 0.07, contour: 0.28, angle: 65,  shiftRed: 0.25,  shiftBlue: -0.2,  frame: 8  } },

  // ---- Red / lava ----
  lm4: { label: "Crimson Flow",    config: { colorBack: "#0a0000", colorTint: "#FF1830", shape: "none",      scale: 1.9, speed: 0.22, repetition: 1.7, softness: 0.5,  distortion: 0.06, contour: 0.22, angle: 55,  shiftRed: 0.35,  shiftBlue: -0.2,  frame: 4  } },
  lm5: { label: "Ember Red",       config: { colorBack: "#050000", colorTint: "#CC1100", shape: "none",      scale: 2.2, speed: 0.16, repetition: 2.2, softness: 0.7,  distortion: 0.04, contour: 0.15, angle: 120, shiftRed: 0.3,   shiftBlue: -0.25, frame: 18 } },
  lm6: { label: "Scarlet Tide",    config: { colorBack: "#080000", colorTint: "#FF0028", shape: "none",      scale: 1.7, speed: 0.25, repetition: 1.5, softness: 0.4,  distortion: 0.08, contour: 0.3,  angle: 30,  shiftRed: 0.4,   shiftBlue: -0.15, frame: 2  } },

  // ---- Purple / magenta ----
  lm7: { label: "Royal Plum",      config: { colorBack: "#08000d", colorTint: "#7B2CBF", shape: "none",      scale: 2.0, speed: 0.2,  repetition: 1.8, softness: 0.55, distortion: 0.05, contour: 0.22, angle: 70,  shiftRed: -0.1,  shiftBlue: 0.3,   frame: 10 } },
  lm8: { label: "Twilight Violet", config: { colorBack: "#06000a", colorTint: "#9D4EDD", shape: "none",      scale: 2.4, speed: 0.15, repetition: 2.4, softness: 0.75, distortion: 0.03, contour: 0.12, angle: 140, shiftRed: -0.15, shiftBlue: 0.35,  frame: 22 } },
  lm9: { label: "Mystic Magenta",  config: { colorBack: "#0a0008", colorTint: "#C724B1", shape: "none",      scale: 1.8, speed: 0.24, repetition: 1.6, softness: 0.45, distortion: 0.07, contour: 0.28, angle: 90,  shiftRed: 0.05,  shiftBlue: 0.25,  frame: 6  } },

  // ---- Shaped variants ----
  lm10: { label: "Lava Bloom",    config: { colorBack: "#0a0000", colorTint: "#FF4500", shape: "metaballs", scale: 1.6, speed: 0.18, repetition: 1.4, softness: 0.4,  distortion: 0.08, contour: 0.25, angle: 35,  shiftRed: 0.45, shiftBlue: -0.2,  frame: 7  } },
  lm11: { label: "Solar Crown",   config: { colorBack: "#0d0700", colorTint: "#FFD200", shape: "circle",    scale: 1.8, speed: 0.16, repetition: 1.6, softness: 0.5,  distortion: 0.06, contour: 0.3,  angle: 90,  shiftRed: 0.3,  shiftBlue: -0.3,  frame: 14 } },
  lm12: { label: "Daisy Ember",   config: { colorBack: "#0a0200", colorTint: "#FF8A00", shape: "daisy",     scale: 1.7, speed: 0.2,  repetition: 1.5, softness: 0.45, distortion: 0.07, contour: 0.28, angle: 110, shiftRed: 0.35, shiftBlue: -0.25, frame: 9  } },
  lm13: { label: "Diamond Ruby",  config: { colorBack: "#080000", colorTint: "#E60039", shape: "diamond",   scale: 1.9, speed: 0.18, repetition: 1.6, softness: 0.5,  distortion: 0.05, contour: 0.32, angle: 60,  shiftRed: 0.4,  shiftBlue: -0.15, frame: 11 } },

  // ---- Cool palette ----
  lm14: { label: "Cyber Teal",    config: { colorBack: "#001218", colorTint: "#00D4D4", shape: "none",      scale: 2.0, speed: 0.22, repetition: 1.8, softness: 0.55, distortion: 0.06, contour: 0.22, angle: 45,  shiftRed: -0.3,  shiftBlue: 0.25, frame: 8  } },
  lm15: { label: "Ocean Deep",    config: { colorBack: "#000714", colorTint: "#1E5DFF", shape: "metaballs", scale: 1.8, speed: 0.18, repetition: 1.6, softness: 0.5,  distortion: 0.07, contour: 0.25, angle: 80,  shiftRed: -0.25, shiftBlue: 0.4,  frame: 12 } },
  lm16: { label: "Forest Mist",   config: { colorBack: "#021200", colorTint: "#34D266", shape: "none",      scale: 2.2, speed: 0.16, repetition: 2.0, softness: 0.6,  distortion: 0.05, contour: 0.2,  angle: 130, shiftRed: -0.2,  shiftBlue: -0.1, frame: 16 } },
  lm17: { label: "Rose Gold",     config: { colorBack: "#1a0408", colorTint: "#FF8FA6", shape: "circle",    scale: 2.0, speed: 0.18, repetition: 1.8, softness: 0.55, distortion: 0.05, contour: 0.22, angle: 25,  shiftRed: 0.2,   shiftBlue: 0.15, frame: 6  } },
  lm18: { label: "Midnight Sky",  config: { colorBack: "#02020a", colorTint: "#3A2BFF", shape: "none",      scale: 2.3, speed: 0.14, repetition: 2.2, softness: 0.7,  distortion: 0.04, contour: 0.14, angle: 150, shiftRed: -0.2,  shiftBlue: 0.4,  frame: 20 } },
};

interface CanvasBackgroundProps {
  id: string;
  width: number;
  height: number;
  paused?: boolean;
}

export function CanvasBackground({ id, width, height, paused }: CanvasBackgroundProps) {
  const entry = BG_REGISTRY[id];
  if (!entry) return null;
  const c = entry.config;
  return (
    <LiquidMetal
      colorBack={c.colorBack}
      colorTint={c.colorTint}
      shape={c.shape}
      scale={c.scale}
      speed={paused ? 0 : c.speed}
      repetition={c.repetition}
      softness={c.softness}
      distortion={c.distortion}
      contour={c.contour}
      angle={c.angle}
      shiftRed={c.shiftRed}
      shiftBlue={c.shiftBlue}
      frame={c.frame}
      fit="cover"
      style={{ position: "absolute", inset: 0, width, height }}
      minPixelRatio={1}
      maxPixelCount={Math.min(Math.max(width * height, 1), 16 * 1024 * 1024)}
      webGlContextAttributes={{ preserveDrawingBuffer: true }}
    />
  );
}

// CSS gradient approximation for picker thumbnails. The shader's `angle`
// controls its flow direction in the shader; we map that to the gradient
// direction so warm/cool/dark thumbnails feel roughly similar to the real
// thing. For shaped variants ("circle", "metaballs", etc.) we use a radial
// gradient with a tint blob to hint at the bias.
function previewStyle(c: LmConfig): React.CSSProperties {
  const isRadial = c.shape === "circle" || c.shape === "metaballs" || c.shape === "daisy";
  if (isRadial) {
    return {
      background: `radial-gradient(circle at 30% 35%, ${c.colorTint} 0%, ${c.colorBack} 70%)`,
    };
  }
  return {
    background: `linear-gradient(${c.angle}deg, ${c.colorBack} 0%, ${c.colorTint} 50%, ${c.colorBack} 100%)`,
  };
}

export function BackgroundThumbnail({ id }: { id: string; size?: number }) {
  const entry = BG_REGISTRY[id];
  if (!entry) return null;
  return <div className="w-full h-full" style={previewStyle(entry.config)} />;
}
