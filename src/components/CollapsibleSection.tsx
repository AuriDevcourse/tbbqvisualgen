"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

interface CollapsibleSectionProps {
  label: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

export function CollapsibleSection({ label, defaultOpen = false, children }: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        // aria-expanded was missing. A chevron that rotates tells a sighted
        // user the state and tells a screen reader nothing, which is the same
        // fault as a tablist without arrow keys: the affordance is announced
        // visually and not at all otherwise.
        aria-expanded={open}
        className="w-full flex h-6 items-center justify-between text-xs font-medium text-white/50 uppercase tracking-wider hover:text-white/70 transition-colors"
      >
        {label}
        <ChevronDown
          className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? "rotate-0" : "-rotate-90"}`}
        />
      </button>
      {open && <div className="mt-2">{children}</div>}
    </div>
  );
}
