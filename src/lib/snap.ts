/**
 * Snap-to-align utility used by the drag handlers. Targets include the canvas
 * edges/center/thirds and each other element's edges and center. The dragged
 * element's left edge, right edge, and center are each tested against every
 * target; the closest match (within threshold) wins on each axis.
 */

const SNAP_THRESHOLD = 0.008; // 0.8% of canvas — ≈12px on a 1500px square.

export interface Bbox {
  /** Center x in 0–1 fractional canvas coords. */
  x: number;
  /** Center y. */
  y: number;
  /** Width in 0–1 fractional canvas coords. */
  width: number;
  /** Height. */
  height: number;
}

export interface SnapTargets {
  x: number[];
  y: number[];
}

export interface SnapResult {
  /** Adjusted center x (may be unchanged if no snap). */
  cx: number;
  /** Adjusted center y. */
  cy: number;
  /** Fractional x position where a vertical guide line should render. */
  guideX: number | null;
  /** Fractional y position where a horizontal guide line should render. */
  guideY: number | null;
}

/** Build snap targets from canvas anchors + each other element's edges/center. */
export function computeSnapTargets(otherBboxes: Bbox[]): SnapTargets {
  // Canvas anchors: edges, center, rule-of-thirds.
  const x = [0, 0.333, 0.5, 0.667, 1];
  const y = [0, 0.333, 0.5, 0.667, 1];
  for (const o of otherBboxes) {
    x.push(o.x - o.width / 2, o.x, o.x + o.width / 2);
    y.push(o.y - o.height / 2, o.y, o.y + o.height / 2);
  }
  return { x, y };
}

/**
 * Snap the given bbox to the nearest target on each axis. The dragged element's
 * left edge, center x, and right edge are each candidates for matching a target;
 * whichever pair (candidate, target) has the smallest absolute distance under
 * the threshold wins. Same for the y axis.
 */
export function snapBbox(bbox: Bbox, targets: SnapTargets): SnapResult {
  const { width, height } = bbox;

  let bestCx = bbox.x;
  let bestGuideX: number | null = null;
  let bestDistX = SNAP_THRESHOLD;

  const candidatesX = [
    { offset: -width / 2, sample: bbox.x - width / 2 }, // left edge
    { offset: 0, sample: bbox.x },                       // center
    { offset: width / 2, sample: bbox.x + width / 2 },   // right edge
  ];
  for (const c of candidatesX) {
    for (const t of targets.x) {
      const dist = Math.abs(c.sample - t);
      if (dist < bestDistX) {
        bestDistX = dist;
        bestCx = t - c.offset;
        bestGuideX = t;
      }
    }
  }

  let bestCy = bbox.y;
  let bestGuideY: number | null = null;
  let bestDistY = SNAP_THRESHOLD;

  const candidatesY = [
    { offset: -height / 2, sample: bbox.y - height / 2 },
    { offset: 0, sample: bbox.y },
    { offset: height / 2, sample: bbox.y + height / 2 },
  ];
  for (const c of candidatesY) {
    for (const t of targets.y) {
      const dist = Math.abs(c.sample - t);
      if (dist < bestDistY) {
        bestDistY = dist;
        bestCy = t - c.offset;
        bestGuideY = t;
      }
    }
  }

  return { cx: bestCx, cy: bestCy, guideX: bestGuideX, guideY: bestGuideY };
}
