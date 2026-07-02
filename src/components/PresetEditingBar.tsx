"use client";

import { Sparkles, Save, RotateCcw, X, Check } from "lucide-react";
import type { PlatformFormat } from "@/types/template";
import type { Preset } from "@/data/presets";

const FORMAT_BADGES: Record<PlatformFormat, string> = {
  square: "1:1",
  presentation: "16:9",
  story: "9:16",
  custom: "Custom",
};

interface PresetEditingBarProps {
  preset: Preset;
  /** Display name (factoring in user rename overrides). */
  displayName: string;
  currentFormat: PlatformFormat;
  /** Formats this preset has user-saved (localStorage) variants for. */
  customFormats: Set<PlatformFormat>;
  /** Formats this preset ships with (default + preset.variants keys). */
  builtInFormats: Set<PlatformFormat>;
  onSaveVariant: () => void;
  onResetVariant?: () => void;
  onDismiss: () => void;
  /** Click handler for the format chips — switches the canvas to that format
   *  and re-loads the preset (picks the matching variant if one exists, or
   *  the preset's default otherwise). */
  onSelectFormat?: (format: PlatformFormat) => void;
}

/**
 * Sticky bar that sits above the canvas while a preset is loaded. Makes the
 * relationship between canvas and preset always visible: which preset you're
 * editing, what format the canvas is in, whether THAT format has a saved
 * customization, and a one-click button to save the current canvas as the
 * variant for the current format.
 */
export function PresetEditingBar({
  preset,
  displayName,
  currentFormat,
  customFormats,
  builtInFormats,
  onSaveVariant,
  onResetVariant,
  onDismiss,
  onSelectFormat,
}: PresetEditingBarProps) {
  const hasCustomForCurrent = customFormats.has(currentFormat);
  const hasBuiltInForCurrent = builtInFormats.has(currentFormat);
  const allFormats: PlatformFormat[] = ["presentation", "square", "story"];

  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-2 rounded-xl border border-emerald-400/30 bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent backdrop-blur-sm">
      {/* Identity: ✨ preset name */}
      <div className="flex items-center gap-2 min-w-0">
        <Sparkles className="w-4 h-4 text-emerald-300/90 shrink-0" />
        <div className="flex flex-col min-w-0">
          <span className="text-[9px] uppercase tracking-[0.18em] text-emerald-300/70 font-semibold leading-tight">
            Editing template
          </span>
          <span className="text-[13px] font-semibold text-white/95 truncate leading-tight">
            {displayName}
          </span>
        </div>
      </div>

      {/* Format chips — clickable; clicking switches the canvas to that
       *  format and reloads the matching variant of this preset. */}
      <div className="flex items-center gap-1">
        {allFormats.map((f) => {
          const isCurrent = f === currentFormat;
          const hasCustom = customFormats.has(f);
          const hasBuiltIn = builtInFormats.has(f);
          const exists = hasCustom || hasBuiltIn;
          const baseChip = `relative text-[10px] font-mono px-1.5 py-0.5 rounded border transition-colors ${
            isCurrent
              ? "border-emerald-400/80 bg-emerald-500/30 text-white"
              : exists
                ? "border-white/20 bg-white/5 text-white/75 hover:border-emerald-400/60 hover:bg-emerald-500/15 hover:text-white"
                : "border-white/10 bg-transparent text-white/65 hover:border-white/30 hover:text-white/70"
          }`;
          const title = [
            isCurrent ? "Current canvas format" : "Click to switch to this variant",
            hasCustom ? "Your saved variant" : hasBuiltIn ? "Ships with preset" : "No variant yet — loads default",
          ].filter(Boolean).join(" · ");
          const inner = (
            <>
              {FORMAT_BADGES[f]}
              {hasCustom && (
                <span className="absolute -top-1 -right-1 w-1.5 h-1.5 rounded-full bg-emerald-400 ring-1 ring-emerald-900/40" />
              )}
            </>
          );
          if (!onSelectFormat || isCurrent) {
            return <span key={f} className={baseChip} title={title}>{inner}</span>;
          }
          return (
            <button
              key={f}
              type="button"
              onClick={() => onSelectFormat(f)}
              className={`${baseChip} cursor-pointer`}
              title={title}
            >
              {inner}
            </button>
          );
        })}
      </div>

      {/* Status pill */}
      <div className="hidden md:flex items-center gap-1 text-[11px] text-white/70">
        {hasCustomForCurrent ? (
          <>
            <Check className="w-3 h-3 text-emerald-300/90" />
            <span>Your {FORMAT_BADGES[currentFormat]} variant is saved.</span>
          </>
        ) : hasBuiltInForCurrent ? (
          <span>Built-in {FORMAT_BADGES[currentFormat]} variant — adjust & save to override.</span>
        ) : (
          <span className="text-amber-300/80">
            No {FORMAT_BADGES[currentFormat]} variant yet — adjust & save to add one.
          </span>
        )}
      </div>

      {/* Spacer + actions */}
      <div className="flex-1" />
      <div className="flex items-center gap-1.5">
        {hasCustomForCurrent && onResetVariant && (
          <button
            onClick={onResetVariant}
            title={`Discard your saved ${FORMAT_BADGES[currentFormat]} variant and revert to built-in`}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            Reset
          </button>
        )}
        <button
          onClick={onSaveVariant}
          title={`Save the current canvas as the ${FORMAT_BADGES[currentFormat]} variant of "${preset.name}"`}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-500/25 border border-emerald-400/60 text-emerald-100 text-[11px] font-semibold hover:bg-emerald-500/40 hover:border-emerald-400/90 transition-colors"
        >
          <Save className="w-3.5 h-3.5" />
          Save {FORMAT_BADGES[currentFormat]} variant
        </button>
        <button
          onClick={onDismiss}
          title="Stop tracking this preset (canvas stays unchanged)"
          className="p-1 rounded text-white/65 hover:text-white hover:bg-white/10 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
