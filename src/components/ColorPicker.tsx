"use client";

import { useEffect, useState } from "react";
import { Popover } from "radix-ui";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ColorPickerProps {
  /** Current color as `#RRGGBB`. `undefined` means "no color set". */
  color?: string;
  onChange: (color: string | undefined) => void;
  /** Default color shown when `color` is undefined and user opens picker. */
  defaultColor?: string;
  /** Show the "clear" (no color) button. */
  allowClear?: boolean;
  /** Compact trigger (smaller swatch, no hex label). */
  compact?: boolean;
  /** Optional label for screen readers. */
  ariaLabel?: string;
}

const HEX_RE = /^#([0-9A-F]{3}){1,2}$/i;

// ── TechBBQ brand palette ───────────────────────────────────────────────────
// Sourced from the existing brand gradient + UI tokens. Order matters — the
// row reads gold → orange → red, then neutrals.
const BRAND_SWATCHES: { value: string; label: string }[] = [
  { value: "#FFD000", label: "Gold" },
  { value: "#FFB840", label: "Amber" },
  { value: "#FF6B00", label: "Orange" },
  { value: "#FF0028", label: "Red" },
  { value: "#E0140F", label: "Crimson" },
  { value: "#15110E", label: "Warm Dark" },
  { value: "#FFFFFF", label: "White" },
  { value: "#000000", label: "Black" },
];

// ── Recently-used colors store ──────────────────────────────────────────────
// Module-level state keeps it in sync across every ColorPicker mount. We
// persist to localStorage so swatches survive a reload but reset on a fresh
// browser profile.
const RECENT_KEY = "tbbqvisualgen.recentColors.v1";
const MAX_RECENTS = 12;

function loadRecents(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((c: unknown): c is string => typeof c === "string" && HEX_RE.test(c));
  } catch {
    return [];
  }
}

function saveRecents(list: string[]) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  } catch {
    /* quota / private-mode — ignore */
  }
}

let recentColors: string[] = loadRecents();
const recentListeners = new Set<(c: string[]) => void>();

function pushRecent(color: string) {
  const upper = color.toUpperCase();
  if (BRAND_SWATCHES.some((b) => b.value === upper)) return; // brand is its own row
  // Move-to-front + dedupe.
  recentColors = [upper, ...recentColors.filter((c) => c !== upper)].slice(0, MAX_RECENTS);
  saveRecents(recentColors);
  for (const fn of recentListeners) fn(recentColors);
}

function useRecentColors(): string[] {
  const [list, setList] = useState<string[]>(recentColors);
  useEffect(() => {
    recentListeners.add(setList);
    return () => {
      recentListeners.delete(setList);
    };
  }, []);
  return list;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return match
    ? { r: parseInt(match[1], 16), g: parseInt(match[2], 16), b: parseInt(match[3], 16) }
    : { r: 255, g: 255, b: 255 };
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => {
    const clamped = Math.max(0, Math.min(255, Math.round(n)));
    const h = clamped.toString(16);
    return h.length === 1 ? "0" + h : h;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// HSL <-> RGB. Hue 0–360, saturation/lightness 0–100. Used by the in-DOM
// slider picker so we never open the native OS color dialog (its focus-steal
// broke the popover and triggered the Windows error ding).
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  const d = max - min;
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return [Math.round(h), Math.round(s * 100), Math.round(l * 100)];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h /= 360; s /= 100; l /= 100;
  if (s === 0) return [l * 255, l * 255, l * 255];
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [hue2rgb(p, q, h + 1 / 3) * 255, hue2rgb(p, q, h) * 255, hue2rgb(p, q, h - 1 / 3) * 255];
}

export function ColorPicker({
  color,
  onChange,
  defaultColor = "#FF0028",
  allowClear = false,
  compact = false,
  ariaLabel = "Pick a color",
}: ColorPickerProps) {
  const active = color ?? defaultColor;
  const isUnset = !color;
  const [hexInput, setHexInput] = useState(active);
  const recents = useRecentColors();

  useEffect(() => {
    setHexInput(active);
  }, [active]);

  // Wrap every onChange so the picked color also lands in the recent list.
  const handlePick = (next: string) => {
    const upper = next.toUpperCase();
    onChange(upper);
    pushRecent(upper);
  };

  const handleHexChange = (raw: string) => {
    const next = raw.startsWith("#") ? raw : `#${raw}`;
    setHexInput(next);
    if (HEX_RE.test(next)) handlePick(next);
  };

  const { r, g, b } = hexToRgb(active);
  const [h, s, l] = rgbToHsl(r, g, b);
  const setHsl = (nh: number, ns: number, nl: number) => {
    const [nr, ng, nb] = hslToRgb(nh, ns, nl);
    handlePick(rgbToHex(nr, ng, nb));
  };
  const sliderCls =
    "flex-1 h-2 appearance-none rounded-full cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B00]/70 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-black/40 [&::-webkit-slider-thumb]:shadow";

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={ariaLabel}
          className={cn(
            "flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 transition-colors",
            compact ? "h-7 w-7 p-0.5 justify-center" : "h-9 px-2 pr-3 min-w-0"
          )}
        >
          <span
            className={cn(
              "rounded-md border border-white/15 shrink-0",
              compact ? "w-5 h-5" : "w-6 h-6"
            )}
            style={{
              backgroundColor: isUnset ? "transparent" : active,
              backgroundImage: isUnset
                ? "linear-gradient(45deg, rgba(255,255,255,0.15) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.15) 50%, rgba(255,255,255,0.15) 75%, transparent 75%)"
                : undefined,
              backgroundSize: isUnset ? "8px 8px" : undefined,
            }}
          />
          {!compact && (
            <span className="text-[11px] font-mono text-white/70 truncate">
              {isUnset ? "None" : active.toUpperCase()}
            </span>
          )}
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          side="right"
          sideOffset={8}
          align="start"
          collisionPadding={12}
          avoidCollisions
          className="z-50 w-64 rounded-xl border border-white/15 bg-[#15110e]/95 backdrop-blur-xl p-3 shadow-2xl"
        >
          <div className="flex flex-col gap-3">
            {/* Brand palette */}
            <div className="flex flex-col gap-1">
              <span className="text-[9px] uppercase tracking-wider text-white/65">TechBBQ brand</span>
              <div className="grid grid-cols-8 gap-1">
                {BRAND_SWATCHES.map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => handlePick(s.value)}
                    aria-label={s.label}
                    title={`${s.label} · ${s.value}`}
                    className={cn(
                      "w-6 h-6 rounded-md border transition-all duration-150",
                      active.toUpperCase() === s.value
                        ? "border-[#FF6B00] scale-110 ring-1 ring-[#FF6B00]/40"
                        : "border-white/10 hover:border-white/40 hover:scale-105",
                    )}
                    style={{ backgroundColor: s.value }}
                  />
                ))}
              </div>
            </div>

            {/* Recents */}
            {recents.length > 0 && (
              <div className="flex flex-col gap-1">
                <span className="text-[9px] uppercase tracking-wider text-white/65">Recent</span>
                <div className="grid grid-cols-8 gap-1">
                  {recents.slice(0, 8).map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => handlePick(c)}
                      aria-label={c}
                      title={c}
                      className={cn(
                        "w-6 h-6 rounded-md border transition-all duration-150",
                        active.toUpperCase() === c
                          ? "border-[#FF6B00] scale-110 ring-1 ring-[#FF6B00]/40"
                          : "border-white/10 hover:border-white/40 hover:scale-105",
                      )}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Live preview of the current color */}
            <div
              className="w-full h-9 rounded-md border border-white/15"
              style={{ backgroundColor: active }}
            />

            {/* HSL sliders — plain range inputs, fully in-DOM. No native OS
                color dialog, so no focus-steal / error ding. */}
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-wider text-white/65 w-3">H</span>
                <input
                  type="range" min={0} max={360} value={h}
                  onChange={(e) => setHsl(Number(e.target.value), s, l)}
                  aria-label="Hue"
                  className={sliderCls}
                  style={{ background: "linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)" }}
                />
              </label>
              <label className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-wider text-white/65 w-3">S</span>
                <input
                  type="range" min={0} max={100} value={s}
                  onChange={(e) => setHsl(h, Number(e.target.value), l)}
                  aria-label="Saturation"
                  className={sliderCls}
                  style={{ background: `linear-gradient(to right, hsl(${h} 0% ${l}%), hsl(${h} 100% ${l}%))` }}
                />
              </label>
              <label className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-wider text-white/65 w-3">L</span>
                <input
                  type="range" min={0} max={100} value={l}
                  onChange={(e) => setHsl(h, s, Number(e.target.value))}
                  aria-label="Lightness"
                  className={sliderCls}
                  style={{ background: `linear-gradient(to right, #000, hsl(${h} ${s}% 50%), #fff)` }}
                />
              </label>
            </div>

            {/* HEX input — for pasting an exact value */}
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-white/65">#</span>
              <input
                type="text"
                value={hexInput.replace(/^#/, "")}
                onChange={(e) => handleHexChange(e.target.value)}
                maxLength={6}
                spellCheck={false}
                aria-label="Hex color value"
                className="w-full pl-5 pr-2 py-1.5 bg-white/5 border border-white/15 rounded-md text-sm font-mono text-white placeholder:text-white/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B00]/70 focus:border-[#FF6B00]/40"
              />
            </div>

            {/* Clear button */}
            {allowClear && (
              <button
                type="button"
                onClick={() => onChange(undefined)}
                disabled={isUnset}
                className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md bg-white/5 border border-white/10 text-[11px] text-white/60 hover:bg-white/10 hover:text-white/90 disabled:opacity-30 transition-colors"
              >
                <X className="w-3 h-3" />
                Clear color
              </button>
            )}
          </div>

          <Popover.Arrow className="fill-[#15110e]" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
