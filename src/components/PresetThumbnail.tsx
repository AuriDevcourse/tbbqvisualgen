"use client";

import { BackgroundThumbnail } from "@/components/CanvasBackground";
import { FORMAT_DIMENSIONS } from "@/types/template";
import { resolvePresetForFormat, type Preset } from "@/data/presets";
import type { PlatformFormat, ShapeElement, TextElement } from "@/types/template";

/**
 * Static, read-only mini-preview of a preset. Deliberately does NOT use the
 * live WebGL/canvas background (18 of those would blow the browser's ~16
 * GL-context limit) — it fills with the same CSS-gradient approximation the
 * BackgroundPicker uses, then lays text + shapes on top by their fractional
 * coords. Faithful enough to recognise a template at a glance; cheap enough to
 * render a whole gallery of them.
 */
export function PresetThumbnail({
  preset,
  format,
  width = 180,
}: {
  preset: Preset;
  /** Which format's layout to preview (falls back to the preset's default). */
  format?: PlatformFormat;
  /** Rendered box width in px. Height derives from the format's aspect. */
  width?: number;
}) {
  const targetFormat = format ?? preset.format;
  const snap = resolvePresetForFormat(preset, targetFormat);
  const dims =
    snap.format === "custom"
      ? snap.customSize
      : FORMAT_DIMENSIONS[snap.format];
  const aspect = dims.width / dims.height;
  const height = width / aspect;
  // px-per-canvas-px — used to scale font sizes down to the thumbnail.
  const k = width / dims.width;
  const design = snap.design;

  return (
    <div
      className="relative overflow-hidden bg-[#0D0D0D]"
      style={{ width, height }}
      aria-hidden
    >
      {/* Background (static gradient approximation) */}
      <div className="absolute inset-0">
        <BackgroundThumbnail id={design.backgroundId} />
      </div>

      {/* Color overlay */}
      {design.overlayColor && (design.overlayOpacity ?? 0) > 0 && (
        <div
          className="absolute inset-0"
          style={{
            background: design.overlayColor,
            opacity: design.overlayOpacity,
            mixBlendMode: (design.overlayBlend as React.CSSProperties["mixBlendMode"]) ?? "normal",
          }}
        />
      )}

      {/* Shapes (incl. image slots) */}
      {(design.shapes ?? []).map((s) => (
        <ShapeMark key={s.id} shape={s} />
      ))}

      {/* Text layers */}
      {design.texts.map((t) => (
        <TextMark key={t.id} text={t} k={k} />
      ))}
    </div>
  );
}

function ShapeMark({ shape: s }: { shape: ShapeElement }) {
  if (s.hidden) return null;
  const isSlot = !!s.imagePlaceholder;
  const style: React.CSSProperties = {
    position: "absolute",
    left: `${(s.x - s.width / 2) * 100}%`,
    top: `${(s.y - s.height / 2) * 100}%`,
    width: `${s.width * 100}%`,
    height: `${s.height * 100}%`,
    opacity: s.opacity,
    transform: s.rotation ? `rotate(${s.rotation}deg)` : undefined,
  };
  if (isSlot) {
    // Image slot — show a neutral placeholder box.
    return (
      <div
        style={{
          ...style,
          background: "rgba(255,255,255,0.12)",
          border: "1px dashed rgba(255,255,255,0.35)",
          borderRadius: s.type === "circle" ? "9999px" : 4,
        }}
      />
    );
  }
  const fill =
    s.colorType === "gradient"
      ? `linear-gradient(120deg, ${s.color1}, ${s.color2})`
      : s.color1;
  const common: React.CSSProperties = {
    ...style,
    borderRadius:
      s.type === "circle"
        ? "9999px"
        : typeof s.borderRadius === "number"
          ? `${s.borderRadius * 50}%`
          : 3,
  };
  if (s.type === "line") {
    return <div style={{ ...common, background: s.color1, borderRadius: 2 }} />;
  }
  if (s.fillType === "outline") {
    return <div style={{ ...common, border: `1.5px solid ${s.color1}`, background: "transparent" }} />;
  }
  return <div style={{ ...common, background: fill }} />;
}

function TextMark({ text: t, k }: { text: TextElement; k: number }) {
  if (t.hidden) return null;
  const content = t.uppercase ? t.content.toUpperCase() : t.content;
  const gradient = t.gradient;
  // Match DynamicTemplate's horizontal anchoring: left-align pins position.x to
  // the left edge (translateX 0), right-align to the right edge (-100%),
  // center to the middle (-50%).
  const tx = t.align === "left" ? "0" : t.align === "right" ? "-100%" : "-50%";
  const style: React.CSSProperties = {
    position: "absolute",
    left: `${t.position.x * 100}%`,
    top: `${t.position.y * 100}%`,
    transform: `translate(${tx}, -50%)${t.rotation ? ` rotate(${t.rotation}deg)` : ""}`,
    fontSize: Math.max(4, t.fontSize * k),
    fontWeight: t.weight ?? 700,
    lineHeight: 1.05,
    letterSpacing: t.letterSpacing ? t.letterSpacing * k : undefined,
    textAlign: t.align ?? "center",
    fontStyle: t.italic ? "italic" : undefined,
    maxWidth: "94%",
    whiteSpace: "pre-wrap",
    ...(gradient
      ? {
          background: "linear-gradient(120deg, #FA7000 0%, #FF2600 45%, #CE0F2E 100%)",
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          color: "transparent",
        }
      : { color: t.color ?? "#ffffff" }),
  };
  return <div style={style}>{content}</div>;
}
