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
    <div className="flex gap-1 bg-white/5 border border-white/10 rounded-lg p-1">
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
              "flex-1 flex flex-col items-center justify-center gap-1 py-2 rounded-md transition-colors min-w-0",
              active
                ? "bg-[#FF0028] text-white shadow-[0_4px_18px_-6px_rgba(255,0,40,0.6)]"
                : "text-white/45 hover:text-white/80 hover:bg-white/5"
            )}
          >
            <Icon className={cn("w-4 h-4", active ? "text-white" : "text-white/55")} />
            <span className="text-[10px] font-medium uppercase tracking-wider truncate w-full px-1">
              {step.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
