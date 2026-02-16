"use client";

import { cn } from "@/lib/utils";
import { X } from "lucide-react";

type LogoPosition = "top-left" | "top-center" | "top-right" | "bottom-left" | "bottom-center" | "bottom-right";

interface LogoPositionPickerProps {
  show: boolean;
  position: LogoPosition;
  logoStyle: "red" | "white" | "gradient";
  onShowChange: (show: boolean) => void;
  onPositionChange: (position: LogoPosition) => void;
  onStyleChange: (style: "red" | "white" | "gradient") => void;
}

const POSITIONS: { value: LogoPosition; row: number; col: number }[] = [
  { value: "top-left", row: 0, col: 0 },
  { value: "top-center", row: 0, col: 1 },
  { value: "top-right", row: 0, col: 2 },
  { value: "bottom-left", row: 1, col: 0 },
  { value: "bottom-center", row: 1, col: 1 },
  { value: "bottom-right", row: 1, col: 2 },
];

const STYLES: { value: "red" | "white" | "gradient"; label: string; color: string }[] = [
  { value: "red", label: "Red", color: "#FF0028" },
  { value: "white", label: "White", color: "#ffffff" },
  { value: "gradient", label: "Gradient", color: "" },
];

export function LogoPositionPicker({
  show,
  position,
  logoStyle,
  onShowChange,
  onPositionChange,
  onStyleChange,
}: LogoPositionPickerProps) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-3">
        {/* Off button */}
        <button
          onClick={() => onShowChange(false)}
          title="No logo"
          className={cn(
            "w-8 h-8 rounded-md border-2 transition-all duration-200 flex items-center justify-center shrink-0",
            !show
              ? "border-[#FF0028] shadow-[0_0_8px_rgba(255,0,40,0.3)]"
              : "border-white/10 hover:border-white/30 opacity-60 hover:opacity-100"
          )}
        >
          <X className="w-3.5 h-3.5 text-white/50" />
        </button>

        {/* Position grid */}
        <div className="grid grid-cols-3 grid-rows-2 gap-[3px] w-[72px]">
          {POSITIONS.map((pos) => (
            <button
              key={pos.value}
              onClick={() => onPositionChange(pos.value)}
              title={pos.value}
              className={cn(
                "w-[22px] h-[14px] rounded-[3px] transition-all duration-200 relative",
                show && position === pos.value
                  ? "bg-[#FF0028] shadow-[0_0_6px_rgba(255,0,40,0.4)]"
                  : "bg-white/10 hover:bg-white/20"
              )}
            >
              {/* Tiny dot to represent logo position */}
              <div
                className={cn(
                  "absolute w-[6px] h-[2px] rounded-full",
                  show && position === pos.value ? "bg-white" : "bg-white/30"
                )}
                style={{
                  top: pos.row === 0 ? 3 : undefined,
                  bottom: pos.row === 1 ? 3 : undefined,
                  left: pos.col === 0 ? 3 : pos.col === 1 ? "50%" : undefined,
                  right: pos.col === 2 ? 3 : undefined,
                  transform: pos.col === 1 ? "translateX(-50%)" : undefined,
                }}
              />
            </button>
          ))}
        </div>

        {/* Logo color style */}
        {show && (
          <div className="flex gap-1">
            {STYLES.map((s) => (
              <button
                key={s.value}
                onClick={() => onStyleChange(s.value)}
                title={s.label}
                className={cn(
                  "w-6 h-6 rounded-md border-2 transition-all duration-200 shrink-0",
                  logoStyle === s.value
                    ? "border-[#FF0028] shadow-[0_0_6px_rgba(255,0,40,0.3)] scale-105"
                    : "border-white/10 hover:border-white/30 opacity-60 hover:opacity-100"
                )}
                style={{
                  background: s.value === "gradient"
                    ? "linear-gradient(180deg, #FFD000 0%, #FF6B00 50%, #FF0028 100%)"
                    : s.color,
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
