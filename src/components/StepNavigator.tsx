"use client";

import { ArrowLeft, ArrowRight, Download, Loader2 } from "lucide-react";
import type { ExportFormat } from "@/hooks/useExport";

interface StepNavigatorProps {
  current: number;
  total: number;
  onBack: () => void;
  onNext: () => void;
  onFinish: () => void;
  isFinishing?: boolean;
  exportFormat?: ExportFormat;
  onExportFormatChange?: (format: ExportFormat) => void;
}

export function StepNavigator({
  current, total, onBack, onNext, onFinish, isFinishing,
  exportFormat = "png", onExportFormatChange,
}: StepNavigatorProps) {
  const isLast = current >= total;
  const finishLabel = "Save Image";
  return (
    <div className="flex items-center gap-2 shrink-0">
      <button
        onClick={onBack}
        disabled={current === 1}
        aria-label="Previous step"
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs font-medium text-white/70 hover:bg-white/10 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back
      </button>
      <span className="flex-1 text-center text-[10px] font-medium text-white/40 uppercase tracking-[0.18em]">
        Step {current} / {total}
      </span>
      {isLast ? (
        <div className="flex items-center gap-1.5">
          {onExportFormatChange && (
            <div
              role="radiogroup"
              aria-label="Export format"
              className="flex items-center rounded-lg bg-white/5 border border-white/10 p-0.5"
            >
              {(["png", "jpeg"] as const).map((fmt) => (
                <button
                  key={fmt}
                  role="radio"
                  aria-checked={exportFormat === fmt}
                  onClick={() => onExportFormatChange(fmt)}
                  className={`px-2 py-1 rounded-md text-[10px] font-semibold uppercase tracking-wider transition-colors ${
                    exportFormat === fmt
                      ? "bg-white/15 text-white"
                      : "text-white/40 hover:text-white/70"
                  }`}
                >
                  {fmt === "jpeg" ? "JPG" : fmt}
                </button>
              ))}
            </div>
          )}
          <button
            onClick={() => onFinish()}
            disabled={isFinishing}
            aria-label={finishLabel}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-r from-[#FF6B00] to-[#FF0028] hover:from-[#FF7A1A] hover:to-[#E00224] text-white text-xs font-semibold tracking-wide transition-all shadow-[0_4px_18px_-6px_rgba(255,0,40,0.6)] disabled:opacity-50"
          >
            {isFinishing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            {isFinishing ? "Exporting..." : finishLabel}
          </button>
        </div>
      ) : (
        <button
          onClick={onNext}
          aria-label="Next step"
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#FF0028] hover:bg-[#E00224] text-white text-xs font-medium transition-colors"
        >
          Next
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
