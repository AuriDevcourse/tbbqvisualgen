"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { BACKGROUND_OPTIONS } from "@/types/template";
import { BackgroundThumbnail } from "@/components/CanvasBackground";

interface BackgroundPickerProps {
  value: string;
  onChange: (value: string) => void;
  /** Group names to hide — e.g. the stage groups on templates where a
   *  stage-specific background makes no sense. */
  excludeGroups?: string[];
  /** Denser grid — more, smaller thumbnails per row. For sidebars where the
   *  full-size picker crowds out the actual form. */
  compact?: boolean;
  /**
   * Show each group as a collapsible section, one open at a time, instead of
   * every group expanded at once.
   *
   * Both callers now opt in. The editor's Canvas panel was measured at 1916px
   * of content in a 622px column — 3.1 screens, of which 57 thumbnails across
   * 8 groups were the bulk (PROGRESS.md handoff 36). `/simple` was left out at
   * the time with a note saying it had not been measured; it has been now
   * (handoff 59) and had the same disease: 41 swatches rendering flat at 474px
   * inside a panel already 2.86 screens long.
   *
   * The prop stays opt-in rather than becoming the default so a future third
   * caller has to make the same measurement before inheriting the behaviour.
   */
  collapsible?: boolean;
}

export function BackgroundPicker({ value, onChange, excludeGroups, compact, collapsible }: BackgroundPickerProps) {
  // Preserve first-seen order of groups from BACKGROUND_OPTIONS.
  const groups: string[] = [];
  for (const bg of BACKGROUND_OPTIONS) {
    if (excludeGroups?.includes(bg.group)) continue;
    if (!groups.includes(bg.group)) groups.push(bg.group);
  }

  /** The group holding the current background, so the panel opens showing
   *  where you already are rather than eight closed drawers. */
  const currentGroup = BACKGROUND_OPTIONS.find((bg) => bg.id === value)?.group;
  // One open at a time. `undefined` means "not touched yet", which is what
  // lets the current group be the initial answer without pinning it forever.
  const [openGroup, setOpenGroup] = useState<string | undefined>(undefined);
  const shownOpen = openGroup !== undefined ? openGroup : currentGroup;

  if (!collapsible) return (
    <div className={cn("flex flex-col", compact ? "gap-2" : "gap-3")}>
      {groups.map((group) => (
        <div key={group} className="flex flex-col gap-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
            {group}
          </p>
          <div className={cn("grid", compact ? "grid-cols-8 gap-1" : "grid-cols-5 gap-1.5")}>
            {BACKGROUND_OPTIONS.filter((bg) => bg.group === group).map((bg) => (
              <button
                key={bg.id}
                onClick={() => onChange(bg.id)}
                title={bg.label}
                aria-label={`Background: ${bg.label}`}
                aria-pressed={value === bg.id}
                className={cn(
                  "aspect-square w-full overflow-hidden border-2 transition-all duration-200 relative",
                  compact ? "rounded-md" : "rounded-lg",
                  value === bg.id
                    ? "border-[#FF0028] shadow-[0_0_10px_rgba(255,0,40,0.3)] scale-105"
                    : "border-white/10 hover:border-white/30 opacity-70 hover:opacity-100",
                )}
              >
                <BackgroundThumbnail id={bg.id} />
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="flex flex-col">
      {groups.map((group) => {
        const items = BACKGROUND_OPTIONS.filter((bg) => bg.group === group);
        const open = shownOpen === group;
        const holdsCurrent = currentGroup === group;
        return (
          <div key={group} className="flex flex-col">
            <button
              onClick={() => setOpenGroup(open ? "" : group)}
              aria-expanded={open}
              className={cn(
                "flex items-center gap-1.5 py-1.5 pr-1 rounded-md transition-colors text-left",
                "hover:bg-white/[0.06]",
              )}
            >
              {open
                ? <ChevronDown className="w-3.5 h-3.5 shrink-0 text-white/60" />
                : <ChevronRight className="w-3.5 h-3.5 shrink-0 text-white/60" />}
              <span className="flex-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted truncate">
                {group}
              </span>
              {/* A dot, not a label: it says "your background is in here" without
                  spending width that the group names need. */}
              {holdsCurrent && !open && (
                <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-[#FF0028] shrink-0" />
              )}
              <span className="text-[10px] tabular-nums text-white/35 shrink-0">{items.length}</span>
            </button>
            {open && (
              <div className={cn("grid pb-2 pt-0.5", compact ? "grid-cols-8 gap-1" : "grid-cols-5 gap-1.5")}>
                {items.map((bg) => (
                  <button
                    key={bg.id}
                    onClick={() => onChange(bg.id)}
                    title={bg.label}
                    aria-label={`Background: ${bg.label}`}
                    aria-pressed={value === bg.id}
                    className={cn(
                      "aspect-square w-full overflow-hidden border-2 transition-all duration-200 relative",
                      compact ? "rounded-md" : "rounded-lg",
                      value === bg.id
                        ? "border-[#FF0028] shadow-[0_0_10px_rgba(255,0,40,0.3)] scale-105"
                        : "border-white/10 hover:border-white/30 opacity-70 hover:opacity-100",
                    )}
                  >
                    <BackgroundThumbnail id={bg.id} />
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
