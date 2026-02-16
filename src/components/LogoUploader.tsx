"use client";

import { Upload, X } from "lucide-react";
import { useCallback, useState, useRef } from "react";
import { cn } from "@/lib/utils";

interface LogoUploaderProps {
  value: string | null;
  onChange: (value: string | null) => void;
}

export function LogoUploader({ value, onChange }: LogoUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    (file: File) => {
      if (file.size > 5 * 1024 * 1024) {
        alert("File too large. Max 5MB.");
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        onChange(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    },
    [onChange]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file && (file.type.startsWith("image/") || file.type === "image/svg+xml")) {
        handleFile(file);
      }
    },
    [handleFile]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  if (value) {
    return (
      <div className="relative">
        <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
          <img src={value} alt="Partner logo" className="w-12 h-12 object-contain rounded" />
          <span className="text-sm text-white/70 flex-1">Logo uploaded</span>
          <button
            onClick={() => onChange(null)}
            className="p-1 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4 text-white/50" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={cn(
        "flex flex-col items-center gap-2 p-6 rounded-xl border-2 border-dashed cursor-pointer transition-all duration-200",
        isDragging
          ? "border-[#FF0028] bg-[#FF0028]/10"
          : "border-white/20 hover:border-white/40 bg-white/5"
      )}
    >
      <Upload className="w-5 h-5 text-white/50" />
      <span className="text-sm text-white/50">Drop logo here or click to upload</span>
      <span className="text-xs text-white/30">PNG or SVG, max 5MB</span>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/svg+xml,image/jpeg,image/webp"
        onChange={handleChange}
        className="hidden"
      />
    </div>
  );
}
