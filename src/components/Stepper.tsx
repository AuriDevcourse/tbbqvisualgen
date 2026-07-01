"use client";

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
}

export function Stepper({ steps, current, onChange }: StepperProps) {
  return (
    <div className="flex gap-1 bg-card-2 rounded-lg p-1">
      {steps.map((step) => {
        const active = current === step.id;
        const Icon = step.icon;
        return (
          <button
            key={step.id}
            onClick={() => onChange(step.id)}
            aria-label={`Step ${step.id}: ${step.label}`}
            aria-current={active ? "step" : undefined}
            className={cn(
              "flex-1 flex flex-col items-center justify-center gap-1 py-2 rounded-md transition-colors min-w-0 outline-none focus-visible:ring-2 focus-visible:ring-surface/70",
              active
                ? "bg-surface text-ink"
                : "text-muted hover:text-foreground hover:bg-white/5"
            )}
          >
            <Icon className={cn("w-4 h-4", active ? "text-ink" : "")} strokeWidth={1.5} />
            <span className="text-[10px] font-medium uppercase tracking-wider truncate w-full px-1">
              {step.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
