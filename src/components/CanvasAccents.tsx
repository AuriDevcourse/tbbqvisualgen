"use client";

import { memo } from "react";
import { COLORS } from "@/lib/constants";

/**
 * The Investor Relations circle accents — a filled bubble with an empty white
 * ring beside it, straddling opposite corners so both get cropped by the frame.
 * Auri's 2025 LP Forum visuals are the reference.
 *
 * The bubble's FILL says which investor thing the post is about:
 *   investor  → the brand gold→red gradient (investor relations in general)
 *   lpForum   → LP Forum orange
 *   investorDay → TechBBQ Investor Day red
 *
 * Drawn as one inline SVG rather than the source PNGs: the artwork is two
 * circles and a stroke, so it stays crisp at 1500px and at 1920px, costs no
 * download, exports cleanly through html-to-image, and the fill can change
 * without shipping another asset. The two solid colours are sampled from Auri's
 * own `FilledCircle_Orange.png` and `FilledCircle_red.png`.
 *
 * It renders BEHIND every content layer (right after the background, outside
 * the `data-canvas-bg` wrapper so the MP4 export rasterizes it with the
 * content, not with the live background canvas).
 */

export type AccentFill = { kind: "solid"; color: string } | { kind: "gradient" };

export const ACCENT_REGISTRY: Record<string, { label: string; fill: AccentFill }> = {
  investor: { label: "Investor Relations", fill: { kind: "gradient" } },
  lpForum: { label: "LP Forum", fill: { kind: "solid", color: "#EE7D4B" } },
  investorDay: { label: "Investor Day", fill: { kind: "solid", color: "#FF4258" } },
};

export const ACCENT_OPTIONS: { id: string; label: string }[] =
  Object.entries(ACCENT_REGISTRY).map(([id, a]) => ({ id, label: a.label }));

/**
 * The composition, in fractions: x/y of the canvas, radius of its SHORTER side
 * so the circles read the same in 1:1, 16:9 and 9:16. Measured off the 2025
 * reference — a smaller pair biting the top-right corner, a larger pair the
 * bottom-left, each ring overlapping its bubble.
 */
const CIRCLES = [
  { x: 0.942, y: 0.128, r: 0.121, ring: false },
  { x: 0.770, y: 0.102, r: 0.092, ring: true },
  { x: 0.160, y: 1.013, r: 0.180, ring: false },
  { x: 0.003, y: 0.823, r: 0.177, ring: true },
] as const;

/** Ring stroke as a share of the ring's own diameter, from `Empty Circle.png`. */
const RING_STROKE = 0.011;

export function hasAccents(id: string | undefined): boolean {
  return Boolean(id && ACCENT_REGISTRY[id]);
}

export const CanvasAccents = memo(function CanvasAccents({
  id, width, height,
}: {
  id: string | undefined;
  width: number;
  height: number;
}) {
  const accent = id ? ACCENT_REGISTRY[id] : undefined;
  if (!accent) return null;
  const short = Math.min(width, height);
  // One gradient id per accent, so two canvases on screen (preview + export
  // clone) can't collide on a shared SVG def id.
  const gradId = `accent-grad-${id}`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
      aria-hidden
    >
      {accent.fill.kind === "gradient" && (
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={COLORS.gradientStart} />
            <stop offset="50%" stopColor={COLORS.gradientMid} />
            <stop offset="100%" stopColor={COLORS.gradientEnd} />
          </linearGradient>
        </defs>
      )}
      {CIRCLES.map((c, i) => {
        const r = c.r * short;
        return c.ring ? (
          <circle
            key={i}
            cx={c.x * width}
            cy={c.y * height}
            r={r}
            fill="none"
            stroke="#FFFFFF"
            strokeWidth={Math.max(1, RING_STROKE * 2 * r)}
          />
        ) : (
          <circle
            key={i}
            cx={c.x * width}
            cy={c.y * height}
            r={r}
            fill={accent.fill.kind === "gradient" ? `url(#${gradId})` : accent.fill.color}
          />
        );
      })}
    </svg>
  );
});

/**
 * Picker thumbnail. NOT the real composition scaled down — at swatch size the
 * corner circles shrink to specks and every option looks like the same dark
 * square. This draws the pair on its own instead: one filled bubble, one ring
 * beside it, big enough that the fill (which is the whole point) is obvious.
 */
export function AccentThumbnail({ id }: { id: string }) {
  const accent = ACCENT_REGISTRY[id];
  if (!accent) return null;
  const gradId = `accent-thumb-${id}`;
  return (
    <svg viewBox="0 0 100 100" className="w-full h-full bg-[#15110E]" aria-hidden>
      {accent.fill.kind === "gradient" && (
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={COLORS.gradientStart} />
            <stop offset="50%" stopColor={COLORS.gradientMid} />
            <stop offset="100%" stopColor={COLORS.gradientEnd} />
          </linearGradient>
        </defs>
      )}
      <circle cx="62" cy="50" r="30" fill={accent.fill.kind === "gradient" ? `url(#${gradId})` : accent.fill.color} />
      <circle cx="34" cy="46" r="24" fill="none" stroke="#FFFFFF" strokeWidth="2" />
    </svg>
  );
}
