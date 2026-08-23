"use client";

import { useRef } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StepDef {
  id: number;
  label: string;
  icon: LucideIcon;
}

interface StepperProps {
  steps: StepDef[];
  current: number;
  onChange: (step: number) => void;
  /**
   * How many things each panel holds, keyed by step id. Omit a step (or pass 0)
   * and it shows no count — same rule as the Templates badge in the header.
   *
   * The counts were already rendered, one row too low: the tab read `TEXT` and
   * the first row of the panel beneath it read `Text (7)`. So the one control
   * that decides which list you see was the only one that could not tell you
   * whether the list had anything in it.
   *
   * It rides the ICON line, not the label. Measured at a 340px panel: the label
   * box gives 72px of usable width, "ELEMENTS" is 57.4px and "ELEMENTS (5)" is
   * 75.5px — inline does not fit, and at the 300px panel the tab is only ~70px
   * wide. The icon line has room to spare. (PROGRESS.md handoff 48.)
   */
  counts?: Partial<Record<number, number>>;
}

/** `id` of a tab button, so the panel can point back at it with
 *  `aria-labelledby`. Shared with the editor, which owns the panel. */
export const panelTabId = (id: number) => `panel-tab-${id}`;
/** `id` of the panel a tab controls. */
export const panelId = (id: number) => `panel-${id}`;

export function Stepper({ steps, current, onChange, counts }: StepperProps) {
  const btnRefs = useRef<Map<number, HTMLButtonElement>>(new Map());

  /**
   * Arrow keys move between tabs, and this is not optional decoration.
   *
   * The strip already declared `role="tablist"`, which PROMISES that Left/Right
   * move between tabs and that the group is one tab stop. It delivered neither:
   * all four buttons sat in the tab order and arrows did nothing. Declaring a
   * role and then not honouring its keyboard contract is worse than not
   * declaring it, because assistive tech announces the promise either way.
   *
   * Home / End jump to the ends, per the ARIA tabs pattern. Selection follows
   * focus, which is the right choice here: switching panels is instant and
   * reversible, so there is nothing to confirm.
   */
  const onKeyDown = (e: React.KeyboardEvent) => {
    const i = steps.findIndex((s) => s.id === current);
    if (i === -1) return;
    let next: number | null = null;
    if (e.key === "ArrowRight") next = (i + 1) % steps.length;
    else if (e.key === "ArrowLeft") next = (i - 1 + steps.length) % steps.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = steps.length - 1;
    if (next === null) return;
    e.preventDefault();
    const target = steps[next];
    onChange(target.id);
    btnRefs.current.get(target.id)?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label="Editor panels"
      onKeyDown={onKeyDown}
      className="flex gap-1 bg-card-2 rounded-lg p-1"
    >
      {steps.map((step) => {
        const active = current === step.id;
        const Icon = step.icon;
        const count = counts?.[step.id];
        return (
          <button
            key={step.id}
            ref={(node) => {
              if (node) btnRefs.current.set(step.id, node);
              else btnRefs.current.delete(step.id);
            }}
            role="tab"
            id={panelTabId(step.id)}
            // Says WHICH panel this tab switches to. Without it a screen reader
            // announces "tab, selected" and nothing about what it controls.
            aria-controls={panelId(step.id)}
            // Roving tabIndex: the strip is ONE tab stop, and arrows move
            // inside it. It used to dump four stops into the page's tab order.
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(step.id)}
            // The count is a visual badge, so it has to be spoken too —
            // otherwise the tab announces less than it shows.
            aria-label={count ? `${step.label}, ${count}` : step.label}
            aria-selected={active}
            className={cn(
              "flex-1 flex flex-col items-center justify-center gap-1 py-2 rounded-md transition-colors min-w-0 outline-none focus-visible:ring-2 focus-visible:ring-surface/70",
              active
                ? "bg-surface text-ink"
                : "text-muted hover:text-foreground hover:bg-white/5"
            )}
          >
            <span className="flex items-center gap-1">
              <Icon className={cn("w-4 h-4", active ? "text-ink" : "")} strokeWidth={1.5} />
              {count ? (
                <span
                  className={cn(
                    "min-w-[15px] px-1 rounded-full text-[9px] font-semibold leading-[15px] tabular-nums",
                    active ? "bg-ink/15 text-ink" : "bg-white/10 text-muted"
                  )}
                >
                  {count}
                </span>
              ) : null}
            </span>
            <span className="text-[10px] font-medium uppercase tracking-wider truncate w-full px-1">
              {step.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
