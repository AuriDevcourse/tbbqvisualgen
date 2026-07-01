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
  const [mode, setMode] = useState<"hex" | "rgb">("hex");
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

  const handleRgbChange = (channel: "r" | "g" | "b", value: number) => {
    const { r, g, b } = hexToRgb(active);
    const nextRgb = { r, g, b, [channel]: value } as { r: number; g: number; b: number };
    handlePick(rgbToHex(nextRgb.r, nextRgb.g, nextRgb.b));
  };

  const { r, g, b } = hexToRgb(active);

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
          // The native <input type="color"> below opens the OS color dialog,
          // which steals focus. Without these guards Radix dismisses the popover
          // on that focus-out — unmounting the input mid-pick (so the color
          // never applies) and leaving focus/aria state broken (every later
          // click triggers the Windows error ding). Keep the popover open when
          // focus leaves to the OS dialog, and don't force focus-return on close.
          onFocusOutside={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
          className="z-50 w-64 rounded-xl border border-white/15 bg-[#15110e]/95 backdrop-blur-xl p-3 shadow-2xl"
        >
          <div className="flex flex-col gap-3">
            {/* Brand palette */}
            <div className="flex flex-col gap-1">
              <span className="text-[9px] uppercase tracking-wider text-white/40">TechBBQ brand</span>
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
                <span className="text-[9px] uppercase tracking-wider text-white/40">Recent</span>
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

            {/* Color wheel (native) */}
            <div className="relative w-full h-12 rounded-md overflow-hidden border border-white/15">
              <input
                type="color"
                value={active}
                onChange={(e) => handlePick(e.target.value)}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                aria-label="Color wheel"
              />
              <div className="w-full h-full" style={{ backgroundColor: active }} />
            </div>

            {/* HEX / RGB toggle */}
            <div className="grid grid-cols-2 gap-1 bg-white/5 border border-white/10 rounded-md p-1">
              {(["hex", "rgb"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={cn(
                    "text-[10px] uppercase tracking-wider py-1 rounded transition-colors",
                    mode === m
                      ? "bg-white/15 text-white"
                      : "text-white/50 hover:text-white/80"
                  )}
                >
                  {m}
                </button>
              ))}
            </div>

            {/* HEX input */}
            {mode === "hex" && (
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-white/40">#</span>
                <input
                  type="text"
                  value={hexInput.replace(/^#/, "")}
                  onChange={(e) => handleHexChange(e.target.value)}
                  maxLength={6}
                  spellCheck={false}
                  aria-label="Hex color value"
                  className="w-full pl-5 pr-2 py-1.5 bg-white/5 border border-white/15 rounded-md text-sm font-mono text-white placeholder:text-white/30 focus:outline-none focus:border-[#FF6B00]/40"
                />
              </div>
            )}

            {/* RGB inputs */}
            {mode === "rgb" && (
              <div className="grid grid-cols-3 gap-2">
                {(["r", "g", "b"] as const).map((channel) => (
                  <label key={channel} className="flex flex-col gap-1">
                    <span className="text-[10px] uppercase tracking-wider text-white/40 text-center">
                      {channel.toUpperCase()}
                    </span>
                    <input
                      type="number"
                      min={0}
                      max={255}
                      value={channel === "r" ? r : channel === "g" ? g : b}
                      onChange={(e) => handleRgbChange(channel, Number(e.target.value) || 0)}
                      className="w-full px-1.5 py-1 bg-white/5 border border-white/15 rounded-md text-sm font-mono text-white text-center focus:outline-none focus:border-[#FF6B00]/40"
                    />
                  </label>
                ))}
              </div>
            )}

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
