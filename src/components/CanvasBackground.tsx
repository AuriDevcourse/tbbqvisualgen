"use client";

import { useEffect, useRef } from "react";
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

/**
 * "New styling" backgrounds — ported from the newer TechBBQ design-system
 * project (tdesignsystem/components/brand/background-creator.tsx). These use a
 * plain 2D <canvas> instead of the WebGL LiquidMetal shader: drifting
 * #FA7000 -> #CE0F2E orbs on either a near-black or deep-red base, matching the
 * official Figma orb spec (orange hot-spot, solid crimson body, soft red halo).
 *
 * A 2D canvas is captured cleanly by html-to-image (PNG/JPG/MP4 export) and
 * doesn't count against the browser's ~16 active-WebGL-context limit.
 *
 * Orb layouts are seeded (deterministic), so a given preset always looks the
 * same and its picker thumbnail matches the real render.
 */

type OrbBase = "dark" | "deep-red";

interface Orb {
  x: number;    // 0..1 relative start position
  y: number;
  r: number;    // radius relative to canvas width
  dx: number;   // drift speed
  dy: number;
  phase: number;
  angle: number; // direction of the offset gradient core
}

interface OrbEntry {
  label: string;
  base: OrbBase;
  speed: number;
  orbs: Orb[];
  thumb: string; // CSS gradient approximation for the picker thumbnail
  /** Soft variant: orbs fade to transparent at the edge so the orange blooms
   *  melt into the black base instead of reading as defined crimson disks.
   *  Matches the calmer "orange glow on near-black" reference backgrounds. */
  soft?: boolean;
}

// Hand-placed orb with sensible drift defaults — for authored (non-seeded)
// layouts where position matters (e.g. an orange bloom offset to one side).
function orb(x: number, y: number, r: number, phase: number, angle: number): Orb {
  return { x, y, r, dx: 0.018, dy: 0.014, phase, angle };
}

// Deterministic PRNG so every preset's orb layout is stable across renders.
function mulberry32(seed: number): () => number {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededOrbs(count: number, seed: number): Orb[] {
  const rand = mulberry32(seed);
  return Array.from({ length: count }, () => ({
    x: rand(),
    y: rand(),
    r: 0.18 + rand() * 0.3,
    dx: (rand() - 0.5) * 0.06,
    dy: (rand() - 0.5) * 0.06,
    phase: rand() * Math.PI * 2,
    angle: rand() * Math.PI * 2,
  }));
}

export const ORB_REGISTRY: Record<string, OrbEntry> = {
  orb1: {
    label: "Founder Orbs",
    base: "dark",
    speed: 1,
    orbs: seededOrbs(5, 1337),
    thumb: "radial-gradient(circle at 35% 40%, #fa7000 0%, #ce0f2e 32%, #0d0d0d 78%)",
  },
  orb2: {
    label: "Crimson Wash",
    base: "deep-red",
    speed: 0.9,
    orbs: seededOrbs(4, 42),
    thumb: "radial-gradient(circle at 65% 60%, #fa7000 0%, #ce0f2e 42%, #5e101a 100%)",
  },
  orb3: {
    label: "Ember Drift",
    base: "dark",
    speed: 0.65,
    orbs: seededOrbs(3, 7),
    thumb: "radial-gradient(circle at 50% 55%, #fa7000 0%, #ce0f2e 38%, #0d0d0d 82%)",
  },
  orb4: {
    label: "Ignite",
    base: "deep-red",
    speed: 1.15,
    orbs: seededOrbs(6, 99),
    thumb: "radial-gradient(circle at 30% 35%, #fa7000 0%, #ce0f2e 40%, #5e101a 100%)",
  },
  // ---- Soft blooms — orange glow melting into near-black (reference look) ----
  orb5: {
    label: "Soft Ember",
    base: "dark",
    speed: 0.5,
    soft: true,
    orbs: [orb(0.72, 0.42, 0.55, 0.3, 2.4), orb(0.12, 0.9, 0.34, 1.7, 4.0)],
    thumb: "radial-gradient(circle at 70% 42%, #fa7000 0%, #ce0f2e 28%, #0d0d0d 70%)",
  },
  orb6: {
    label: "Right Bloom",
    base: "dark",
    speed: 0.42,
    soft: true,
    orbs: [orb(0.84, 0.5, 0.52, 0.8, 1.2), orb(0.5, 0.32, 0.3, 2.2, 3.1)],
    thumb: "radial-gradient(circle at 82% 50%, #fa7000 0%, #ce0f2e 30%, #0d0d0d 72%)",
  },
  orb7: {
    label: "Corner Heat",
    base: "dark",
    speed: 0.5,
    soft: true,
    orbs: [orb(0.85, 0.85, 0.5, 0.5, 0.6), orb(0.16, 0.2, 0.32, 3.0, 2.0)],
    thumb: "radial-gradient(circle at 82% 82%, #fa7000 0%, #ce0f2e 28%, #0d0d0d 70%)",
  },
};

// Paint one frame of an orb preset onto a 2D context. `t` is elapsed
// (speed-scaled) seconds — the orbs drift via per-orb sin/cos offsets.
function drawOrbs(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, entry: OrbEntry) {
  ctx.globalCompositeOperation = "source-over";
  if (entry.base === "deep-red") {
    const bg = ctx.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, "#5e101a");
    bg.addColorStop(0.55, "#8c1023");
    bg.addColorStop(1, "#ce0f2e");
    ctx.fillStyle = bg;
  } else {
    ctx.fillStyle = "#0d0d0d";
  }
  ctx.fillRect(0, 0, w, h);

  for (const orb of entry.orbs) {
    const x = (orb.x + Math.sin(t * orb.dx + orb.phase) * 0.22) * w;
    const y = (orb.y + Math.cos(t * orb.dy + orb.phase) * 0.18) * h;
    const r = orb.r * w * (1 + 0.12 * Math.sin(t * 0.05 + orb.phase));

    // Offset radial gradient — orange core melting into a solid crimson body.
    const ga = orb.angle + t * 0.04;
    const gx = x + Math.cos(ga) * r * 0.45;
    const gy = y + Math.sin(ga) * r * 0.45;
    const g = ctx.createRadialGradient(gx, gy, 0, x, y, r);
    if (entry.soft) {
      // Bloom that fades into the base — orange core, red mid, transparent edge.
      g.addColorStop(0, "#fa7000");
      g.addColorStop(0.4, "rgba(250, 112, 0, 0.7)");
      g.addColorStop(0.75, "rgba(206, 15, 46, 0.35)");
      g.addColorStop(1, "rgba(206, 15, 46, 0)");
    } else {
      // Defined orb — orange core melting into a solid crimson body.
      g.addColorStop(0, "#fa7000");
      g.addColorStop(0.65, "#ce0f2e");
      g.addColorStop(1, "#ce0f2e");
    }

    // Soft orbs get their softness from the transparent-fading gradient, so
    // they need only a light blur. No shadowBlur — it's one of the most
    // expensive canvas ops and the gradient already reads as a warm halo.
    ctx.save();
    ctx.filter = `blur(${Math.round(r * (entry.soft ? 0.08 : 0.1))}px)`;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function OrbCanvasBackground({ id, width, height, paused }: CanvasBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timeRef = useRef(0);
  const lastRef = useRef(0);
  const rafRef = useRef(0);
  const pausedRef = useRef(!!paused);
  pausedRef.current = !!paused;

  const entry = ORB_REGISTRY[id];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !entry) return;
    // Render at design resolution (not supersampled). The orbs are soft blooms,
    // so the 2x export upscale doesn't visibly hurt them — and a full-size
    // canvas redrawn every frame with blur filters is far too expensive
    // (2x quadruples the pixel work and caused noticeable lag).
    const bw = width;
    const bh = height;
    canvas.width = bw;
    canvas.height = bh;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    const draw = () => drawOrbs(ctx, bw, bh, timeRef.current, entry);
    draw(); // always paint at least the first frame (needed for export)

    // Throttle the actual redraw to ~30fps. Time still advances on real dt so
    // motion speed is unchanged; we just skip half the (expensive) blur redraws.
    const FRAME_MS = 1000 / 30;
    let lastDraw = 0;
    const loop = (now: number) => {
      if (!lastRef.current) lastRef.current = now;
      const dt = (now - lastRef.current) / 1000;
      lastRef.current = now;
      if (!pausedRef.current && !reduceMotion) {
        timeRef.current += dt * entry.speed;
        if (now - lastDraw >= FRAME_MS) {
          draw();
          lastDraw = now;
        }
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [entry, width, height]);

  if (!entry) return null;
  return (
    <canvas
      ref={canvasRef}
      style={{ position: "absolute", inset: 0, width, height }}
    />
  );
}

interface CanvasBackgroundProps {
  id: string;
  width: number;
  height: number;
  paused?: boolean;
}

export function CanvasBackground({ id, width, height, paused }: CanvasBackgroundProps) {
  // "New styling" orb presets render on a 2D canvas.
  if (ORB_REGISTRY[id]) {
    return <OrbCanvasBackground id={id} width={width} height={height} paused={paused} />;
  }
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
  const orb = ORB_REGISTRY[id];
  if (orb) return <div className="w-full h-full" style={{ background: orb.thumb }} />;
  const entry = BG_REGISTRY[id];
  if (!entry) return null;
  return <div className="w-full h-full" style={previewStyle(entry.config)} />;
}
