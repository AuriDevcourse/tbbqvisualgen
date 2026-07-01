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
        className="flex items-center gap-1.5 px-4 py-2 rounded-full border border-surface/40 bg-transparent text-xs font-medium text-foreground hover:border-surface hover:bg-white/5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.5} />
        Back
      </button>
      <span className="flex-1 text-center text-[10px] font-medium text-muted uppercase tracking-[0.18em]">
        Step {current} / {total}
      </span>
      {isLast ? (
        <div className="flex items-center gap-1.5">
          {onExportFormatChange && (
            <div
              role="radiogroup"
              aria-label="Export format"
              className="flex items-center gap-1 rounded-full bg-card-2 p-1"
            >
              {(["png", "jpeg"] as const).map((fmt) => (
                <button
                  key={fmt}
                  role="radio"
                  aria-checked={exportFormat === fmt}
                  onClick={() => onExportFormatChange(fmt)}
                  className={`px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider transition-colors ${
                    exportFormat === fmt
                      ? "bg-surface text-ink"
                      : "text-muted hover:text-foreground"
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
            className="flex items-center gap-1.5 px-5 py-2 rounded-full bg-surface text-ink text-xs font-semibold tracking-wide hover:bg-white active:bg-white/90 transition-colors disabled:opacity-50"
          >
            {isFinishing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" strokeWidth={1.5} />}
            {isFinishing ? "Exporting..." : finishLabel}
          </button>
        </div>
      ) : (
        <button
          onClick={onNext}
          aria-label="Next step"
          className="flex items-center gap-1.5 px-5 py-2 rounded-full bg-red text-surface text-xs font-medium hover:bg-red-deep transition-colors"
        >
          Next
          <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.5} />
        </button>
      )}
    </div>
  );
}
