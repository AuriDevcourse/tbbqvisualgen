"use client";

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
}

export function BackgroundPicker({ value, onChange, excludeGroups, compact }: BackgroundPickerProps) {
  // Preserve first-seen order of groups from BACKGROUND_OPTIONS.
  const groups: string[] = [];
  for (const bg of BACKGROUND_OPTIONS) {
    if (excludeGroups?.includes(bg.group)) continue;
    if (!groups.includes(bg.group)) groups.push(bg.group);
  }

  return (
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
}
