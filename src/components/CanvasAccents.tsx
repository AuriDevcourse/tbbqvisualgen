"use client";

import { COLORS } from "@/lib/constants";
import { ACCENT_REGISTRY } from "@/lib/accents";

/**
 * Picker thumbnail for the Investor Relations accents. The circles themselves
 * are real shape layers emitted by the builders (see `src/lib/accents.ts`) —
 * this only has to sell the CHOICE.
 *
 * NOT the real composition scaled down: at swatch size the corner circles shrink
 * to specks and every option looks like the same dark square. It draws the pair
 * on its own instead, big enough that the fill is obvious.
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
