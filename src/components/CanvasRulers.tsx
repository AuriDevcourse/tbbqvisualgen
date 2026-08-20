"use client";

/**
 * Illustrator-style rulers along the top and left of the preview.
 *
 * WHY THEY LIVE OUTSIDE THE SCALED CANVAS: if the rulers were rendered inside
 * the `translate(pan) scale(s)` wrapper, their tick labels would scale with the
 * zoom — 4px tall at 30%, enormous at 400%. A ruler has to stay a fixed size on
 * screen while the thing it measures moves and scales underneath it, which is
 * the same reasoning as the resize handles.
 *
 * HOW THE TICKS LINE UP WITHOUT MEASURING THE CONTAINER: the canvas is centred
 * in the container and then panned, so canvas coordinate `k` sits at
 * `50% + (pan - canvasSize/2 + k * scale)px`. Anchoring each tick to `50%` of
 * the container means the CSS does the centring, and no ResizeObserver or
 * width measurement is needed for the rulers to track a resize.
 *
 * Units are CANVAS pixels — the same numbers as the export — so what the ruler
 * says is what lands in the file.
 */

/** Aim for roughly this many screen px between labelled ticks. */
const TARGET_TICK_GAP = 78;
/** Only round numbers, so labels never read 137 or 264. */
const NICE_STEPS = [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];

/** The smallest nice step whose on-screen gap clears TARGET_TICK_GAP. */
function tickStep(scale: number): number {
  const wanted = TARGET_TICK_GAP / (scale > 0 ? scale : 1);
  return NICE_STEPS.find((s) => s >= wanted) ?? NICE_STEPS[NICE_STEPS.length - 1];
}

const THICKNESS = 18;

interface CanvasRulersProps {
  /** Canvas size in its own px (the export size). */
  width: number;
  height: number;
  /** Preview scale and pan, exactly as applied to the canvas wrapper. */
  scale: number;
  pan: { x: number; y: number };
}

export function CanvasRulers({ width, height, scale, pan }: CanvasRulersProps) {
  const step = tickStep(scale);
  const halfW = (width * scale) / 2;
  const halfH = (height * scale) / 2;

  const xs: number[] = [];
  for (let k = 0; k <= width; k += step) xs.push(k);
  const ys: number[] = [];
  for (let k = 0; k <= height; k += step) ys.push(k);

  const face = "rgba(20,20,20,0.92)";
  const line = "rgba(255,255,255,0.28)";
  const label = "rgba(255,255,255,0.55)";
  const edge = "rgba(255,255,255,0.10)";

  return (
    <>
      {/* Top ruler */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: THICKNESS,
          background: face,
          borderBottom: `1px solid ${edge}`,
          overflow: "hidden",
          pointerEvents: "none",
          zIndex: 40,
        }}
      >
        {xs.map((k) => (
          <div
            key={k}
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              // See the header comment: 50% is the container centre.
              left: `calc(50% + ${pan.x - halfW + k * scale}px)`,
              borderLeft: `1px solid ${line}`,
              paddingLeft: 3,
              fontSize: 9,
              lineHeight: `${THICKNESS}px`,
              color: label,
              fontVariantNumeric: "tabular-nums",
              whiteSpace: "nowrap",
            }}
          >
            {k}
          </div>
        ))}
      </div>

      {/* Left ruler */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: THICKNESS,
          left: 0,
          bottom: 0,
          width: THICKNESS,
          background: face,
          borderRight: `1px solid ${edge}`,
          overflow: "hidden",
          pointerEvents: "none",
          zIndex: 40,
        }}
      >
        {ys.map((k) => (
          <div
            key={k}
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              // The top ruler occupies the first THICKNESS px, so shift by half
              // of it to keep the vertical scale aligned with the canvas.
              top: `calc(50% + ${pan.y - halfH + k * scale - THICKNESS / 2}px)`,
              borderTop: `1px solid ${line}`,
              fontSize: 9,
              color: label,
              fontVariantNumeric: "tabular-nums",
              // Rotated so the number reads along the ruler rather than
              // overflowing an 18px-wide strip.
              writingMode: "vertical-rl",
              paddingTop: 3,
              lineHeight: `${THICKNESS}px`,
              whiteSpace: "nowrap",
            }}
          >
            {k}
          </div>
        ))}
      </div>

      {/* The corner where the two rulers meet, so the numbers do not collide. */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: THICKNESS,
          height: THICKNESS,
          background: face,
          borderRight: `1px solid ${edge}`,
          borderBottom: `1px solid ${edge}`,
          pointerEvents: "none",
          zIndex: 41,
        }}
      />
    </>
  );
}
