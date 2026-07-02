"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { DesignConfig, PlatformFormat, TextElement, ShapeElement, ShapeBorderRadii } from "@/types/template";
import { FORMAT_DIMENSIONS, reconcileLayerOrder } from "@/types/template";
import { COLORS, FONTS, GRADIENT_TEXT_CSS, GRADIENT_BORDER_CSS } from "@/lib/constants";
import { CanvasBackground } from "@/components/CanvasBackground";
import type { CanvasImage } from "@/components/ImagePlacer";
import { computeSnapTargets, snapBbox } from "@/lib/snap";
import type { Bbox } from "@/lib/snap";

interface DynamicTemplateProps {
  design: DesignConfig;
  format: PlatformFormat;
  customWidth?: number;
  customHeight?: number;
  canvasImages?: CanvasImage[];
  paused?: boolean;
  /** Click-to-edit a text element — flips it into inline edit mode. */
  onEditText?: (textId: string) => void;
  /** Inline-edit commits the new content for a text element. */
  onTextContentChange?: (textId: string, content: string) => void;
  /** Drag updates the TechBBQ logo's manual position (fractional center coords). */
  onLogoPositionChange?: (position: { x: number; y: number }) => void;
  /** Selection — IDs in layer format ("text:xyz"). Used for visual highlight. */
  selectedIds?: Set<string>;
  /** Id of the image currently in inline crop-edit mode (Google Slides–style).
   *  When set, that image renders its full source extending beyond the frame
   *  (dimmed) so the user can drag inside the frame to pan. */
  cropEditingId?: string | null;
  /** Crop update from inline pan. */
  onCropChange?: (imageId: string, crop: { x: number; y: number; width: number; height: number }) => void;
  /** Called on drag-start of a text element so the host can snapshot pre-drag
   *  positions of every selected element for group translation. */
  onBeginDrag?: (id: string) => void;
  /** Called per tick with the (dx, dy) translation in fractional canvas coords. */
  onMoveBy?: (dx: number, dy: number) => void;
  /** Called on drag-end so the host can clear its drag-origin snapshot. */
  onEndDrag?: () => void;
  /** Currently-edited text id — gets a persistent orange ring. */
  editingTextId?: string | null;
  /** Called when any text layer overflows the canvas — host renders red side bars. */
  onOverflowChange?: (sides: { left: boolean; right: boolean; top: boolean; bottom: boolean }) => void;
  /** Live snap-guide coordinates (fractional). Host renders orange lines. */
  onGuidesChange?: (guides: { x: number | null; y: number | null }) => void;
  /** Called on drag-start (pointerdown) — host opens a history transaction. */
  onEditStart?: () => void;
  /** Called on drag-end (pointerup) — host closes the history transaction. */
  onEditEnd?: () => void;
}

// Tailwind classes for the hover/active states on canvas-interactive elements.
// The base state has a transparent outline (no visible mark) so PNG exports
// stay clean — the orange ring only appears on hover or while editing.
const textEditableHoverClass =
  "rounded transition-[outline-color] outline outline-2 outline-offset-4 outline-transparent hover:outline-[#FF6B00]/70";
const editingActiveClass =
  "outline-[#FF6B00] outline-2 outline-offset-4";
// Multi-select highlight is applied as an INLINE style so it overrides the
// Tailwind utility outline width/style. Kept identical to the image overlay's
// selected style for visual consistency.
const SELECTED_INLINE_OUTLINE: React.CSSProperties = {
  outline: "4px dashed #FF6B00",
  outlineOffset: 4,
  boxShadow: "0 0 0 2px rgba(255, 107, 0, 0.25)",
};

// ── Shape rendering ─────────────────────────────────────────────────────────
// Standalone helper so the canvas template can render every shape with the
// same code path. Positions / sizes are fractional; we convert to canvas
// pixels here so the DOM matches the export resolution exactly.

function starPath(spikes: number, innerR: number, w: number, h: number): string {
  const cx = w / 2;
  const cy = h / 2;
  const rOuter = Math.min(w, h) / 2;
  const rInner = rOuter * Math.max(0.05, Math.min(0.95, innerR));
  const points: string[] = [];
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? rOuter : rInner;
    const angle = (Math.PI / spikes) * i - Math.PI / 2;
    points.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`);
  }
  return points.join(" ");
}

function radiusCSS(br: ShapeElement["borderRadius"], w: number, h: number): string {
  if (br === undefined || br === 0) return "0";
  const shorter = Math.min(w, h);
  if (typeof br === "number") {
    return `${Math.min(br, 0.5) * shorter}px`;
  }
  const r = br as ShapeBorderRadii;
  const px = (v: number) => `${Math.min(v, 0.5) * shorter}px`;
  return `${px(r.tl)} ${px(r.tr)} ${px(r.br)} ${px(r.bl)}`;
}

function renderShapeElement(
  s: ShapeElement,
  dims: { width: number; height: number },
  zOf: (id: string) => number,
  selectedIds: Set<string> | undefined,
): React.JSX.Element | null {
  if (s.hidden) return null;
  const isLine = s.type === "line";
  const w = Math.max(1, Math.round(dims.width * s.width));
  const h = isLine
    ? Math.max(2, Math.round(dims.width * s.strokeWidth))
    : Math.max(1, Math.round(dims.height * s.height));
  const left = Math.round(s.x * dims.width - w / 2);
  const top = Math.round(s.y * dims.height - h / 2);
  const isSelected = selectedIds?.has(`shape:${s.id}`) ?? false;
  const isOutline = s.fillType === "outline" && !isLine;
  const strokeW = Math.max(1, Math.round(s.strokeWidth * dims.width));

  // Background / fill — solid color or 135° linear gradient.
  const fillCSS = s.colorType === "gradient"
    ? `linear-gradient(135deg, ${s.color1}, ${s.color2})`
    : s.color1;

  const baseStyle: React.CSSProperties = {
    position: "absolute",
    left,
    top,
    width: w,
    height: h,
    zIndex: zOf(`shape:${s.id}`),
    opacity: s.opacity,
    filter: s.blur > 0 ? `blur(${s.blur * dims.width}px)` : undefined,
    transform: s.rotation ? `rotate(${s.rotation}deg)` : undefined,
    transformOrigin: "center center",
    pointerEvents: "none",
    ...(isSelected ? SELECTED_INLINE_OUTLINE : {}),
  };

  const dataAttr: Record<string, string> = { "data-canvas-element": `shape:${s.id}` };
  if (s.locked) dataAttr["data-locked"] = "true";

  // Image-placeholder gets a subtle dashed border so the "drop zone" feel
  // reads even before the Upload button is hovered. Label/icon live on the
  // ShapeDragOverlay button (overlay-only), not in the exported pixels.
  const placeholderBorder = s.imagePlaceholder
    ? `${Math.max(2, Math.round(Math.min(w, h) * 0.012))}px dashed rgba(255,255,255,0.35)`
    : undefined;

  if (s.type === "rectangle") {
    return (
      <div
        key={s.id}
        {...dataAttr}
        style={{
          ...baseStyle,
          background: isOutline ? "transparent" : fillCSS,
          border: placeholderBorder ?? (isOutline ? `${strokeW}px solid ${s.color1}` : undefined),
          borderRadius: radiusCSS(s.borderRadius, w, h),
        }}
      />
    );
  }
  if (s.type === "circle") {
    return (
      <div
        key={s.id}
        {...dataAttr}
        style={{
          ...baseStyle,
          background: isOutline ? "transparent" : fillCSS,
          border: placeholderBorder ?? (isOutline ? `${strokeW}px solid ${s.color1}` : undefined),
          borderRadius: "50%",
        }}
      />
    );
  }
  if (s.type === "line") {
    return (
      <div
        key={s.id}
        {...dataAttr}
        style={{
          ...baseStyle,
          background: fillCSS,
          borderRadius: strokeW / 2,
        }}
      />
    );
  }
  if (s.type === "star") {
    const points = starPath(s.spikes ?? 5, s.innerRadius ?? 0.5, w, h);
    const gradId = `grad-${s.id}`;
    return (
      <svg
        key={s.id}
        {...dataAttr}
        viewBox={`0 0 ${w} ${h}`}
        style={baseStyle}
        preserveAspectRatio="none"
      >
        {s.colorType === "gradient" && (
          <defs>
            <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={s.color1} />
              <stop offset="100%" stopColor={s.color2} />
            </linearGradient>
          </defs>
        )}
        <polygon
          points={points}
          fill={isOutline ? "none" : s.colorType === "gradient" ? `url(#${gradId})` : s.color1}
          stroke={isOutline ? s.color1 : "none"}
          strokeWidth={isOutline ? strokeW : 0}
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  return null;
}

export function DynamicTemplate({
  design,
  format,
  customWidth,
  customHeight,
  canvasImages,
  paused,
  onEditText,
  onTextContentChange,
  onLogoPositionChange,
  editingTextId,
  onOverflowChange,
  onGuidesChange,
  onEditStart,
  onEditEnd,
  selectedIds,
  cropEditingId,
  onCropChange,
  onBeginDrag,
  onMoveBy,
  onEndDrag,
}: DynamicTemplateProps) {
  const canvasRootRef = useRef<HTMLDivElement>(null);
  const editingDivRef = useRef<HTMLDivElement | null>(null);
  const textRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const logoRef = useRef<HTMLDivElement | null>(null);

  // When a text enters inline-edit mode, focus its div and put the cursor at
  // the end. Only runs on edit-state toggle, NOT on every keystroke (we read
  // the value off the DOM directly on blur to avoid disrupting cursor state).
  useEffect(() => {
    if (!editingTextId) return;
    const el = editingDivRef.current;
    if (!el) return;
    el.focus();
    const range = document.createRange();
    const sel = window.getSelection();
    range.selectNodeContents(el);
    range.collapse(false);
    sel?.removeAllRanges();
    sel?.addRange(range);
  }, [editingTextId]);

  // Measure each text layer against the canvas bbox so the host (page.tsx)
  // can show red overflow bars on the canvas edges. Runs after every render
  // via useLayoutEffect; bails before setState/callback if nothing changed.
  const lastOverflowRef = useRef({ left: false, right: false, top: false, bottom: false });
  useLayoutEffect(() => {
    if (!onOverflowChange) return;
    const canvasEl = canvasRootRef.current;
    if (!canvasEl) return;
    const canvasRect = canvasEl.getBoundingClientRect();
    let left = false, right = false, top = false, bottom = false;
    for (const text of design.texts) {
      if (text.hidden) continue;
      const el = textRefs.current.get(text.id);
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      if (rect.left < canvasRect.left - 0.5) left = true;
      if (rect.right > canvasRect.right + 0.5) right = true;
      if (rect.top < canvasRect.top - 0.5) top = true;
      if (rect.bottom > canvasRect.bottom + 0.5) bottom = true;
    }
    const prev = lastOverflowRef.current;
    if (prev.left === left && prev.right === right && prev.top === top && prev.bottom === bottom) return;
    lastOverflowRef.current = { left, right, top, bottom };
    onOverflowChange({ left, right, top, bottom });
  });

  // Format dimensions
  const baseDims = FORMAT_DIMENSIONS[format] || FORMAT_DIMENSIONS.square;
  const dims = format === "custom" && customWidth && customHeight
    ? { width: customWidth, height: customHeight, label: baseDims.label }
    : baseDims;
  const isPortrait = dims.height > dims.width;

  // Compute effective layer stack (bottom→top). Must include shapes — if any
  // id is missing from this array, reconcileLayerOrder strips it from stored
  // order too and zOf returns 0, which sends the element behind everything.
  const defaultOrder = [
    "overlay",
    ...(canvasImages?.map((ci) => `image:${ci.id}`) ?? []),
    ...((design.shapes ?? []).map((s) => `shape:${s.id}`)),
    ...design.texts.map((t) => `text:${t.id}`),
    "tbbqLogo",
  ];
  const effectiveOrder = reconcileLayerOrder(design.layerOrder, defaultOrder);
  const zOf = (id: string) => {
    const idx = effectiveOrder.indexOf(id);
    return idx === -1 ? 0 : (idx + 1) * 10;
  };

  // Visibility helpers
  const showOverlay = !!design.overlayColor && (design.overlayOpacity ?? 0) > 0 && !design.hideOverlay;

  // ---- Click-vs-drag pointer handlers ----
  // 4px movement threshold before a drag commits. Click without drag fires
  // the editor; drag updates the element's manual position.
  const makeTextPointerHandler = (textId: string): React.PointerEventHandler<HTMLDivElement> => (e) => {
    if (!onEditText) return;
    const isLocked = !!design.texts.find((t) => t.id === textId)?.locked;
    e.stopPropagation();
    const elementEl = e.currentTarget;
    const canvasEl = canvasRootRef.current;
    if (!canvasEl) {
      onEditText(textId);
      return;
    }
    const canvasRect = canvasEl.getBoundingClientRect();
    const elementRect = elementEl.getBoundingClientRect();
    const widthFrac = elementRect.width / canvasRect.width;
    const heightFrac = elementRect.height / canvasRect.height;
    const startFracX = (elementRect.left + elementRect.width / 2 - canvasRect.left) / canvasRect.width;
    const startFracY = (elementRect.top + elementRect.height / 2 - canvasRect.top) / canvasRect.height;
    const startClientX = e.clientX;
    const startClientY = e.clientY;
    let dragging = false;

    // Build snap targets from every OTHER visible element on the canvas.
    const otherBboxes: Bbox[] = [];
    for (const ci of canvasImages ?? []) {
      otherBboxes.push({ x: ci.x, y: ci.y, width: ci.width, height: ci.height });
    }
    for (const t of design.texts) {
      if (t.id === textId || t.hidden) continue;
      const ref = textRefs.current.get(t.id);
      if (!ref) continue;
      const r = ref.getBoundingClientRect();
      otherBboxes.push({
        x: (r.left + r.width / 2 - canvasRect.left) / canvasRect.width,
        y: (r.top + r.height / 2 - canvasRect.top) / canvasRect.height,
        width: r.width / canvasRect.width,
        height: r.height / canvasRect.height,
      });
    }
    const snapTargets = computeSnapTargets(otherBboxes);

    const handleMove = (moveE: PointerEvent) => {
      const dx = moveE.clientX - startClientX;
      const dy = moveE.clientY - startClientY;
      if (!dragging && Math.hypot(dx, dy) > 4) {
        if (isLocked) return; // locked text: select-only, no drag
        dragging = true;
        document.body.style.cursor = "grabbing";
        onEditStart?.();
        onBeginDrag?.(`text:${textId}`);
      }
      if (dragging) {
        const rawX = startFracX + dx / canvasRect.width;
        const rawY = startFracY + dy / canvasRect.height;
        const snapped = snapBbox({ x: rawX, y: rawY, width: widthFrac, height: heightFrac }, snapTargets);
        const newX = Math.max(0, Math.min(1, snapped.cx));
        const newY = Math.max(0, Math.min(1, snapped.cy));
        onMoveBy?.(newX - startFracX, newY - startFracY);
        onGuidesChange?.({ x: snapped.guideX, y: snapped.guideY });
      }
    };
    const handleUp = () => {
      document.removeEventListener("pointermove", handleMove);
      document.removeEventListener("pointerup", handleUp);
      document.body.style.cursor = "";
      onGuidesChange?.({ x: null, y: null });
      if (dragging) {
        onEditEnd?.();
        onEndDrag?.();
      }
      if (!dragging) onEditText(textId);
    };
    document.addEventListener("pointermove", handleMove);
    document.addEventListener("pointerup", handleUp);
  };

  // Logo drag — same click-vs-drag pattern, no edit mode. Snaps against every
  // other element on the canvas using the shared snap util.
  const handleLogoPointerDown: React.PointerEventHandler<HTMLDivElement> = (e) => {
    if (!onLogoPositionChange) return;
    e.stopPropagation();
    const elementEl = e.currentTarget;
    const canvasEl = canvasRootRef.current;
    if (!canvasEl) return;
    const canvasRect = canvasEl.getBoundingClientRect();
    const elementRect = elementEl.getBoundingClientRect();
    const widthFrac = elementRect.width / canvasRect.width;
    const heightFrac = elementRect.height / canvasRect.height;
    const startFracX = (elementRect.left + elementRect.width / 2 - canvasRect.left) / canvasRect.width;
    const startFracY = (elementRect.top + elementRect.height / 2 - canvasRect.top) / canvasRect.height;
    const startClientX = e.clientX;
    const startClientY = e.clientY;
    let dragging = false;

    const otherBboxes: Bbox[] = [];
    for (const ci of canvasImages ?? []) {
      otherBboxes.push({ x: ci.x, y: ci.y, width: ci.width, height: ci.height });
    }
    for (const t of design.texts) {
      if (t.hidden) continue;
      const ref = textRefs.current.get(t.id);
      if (!ref) continue;
      const r = ref.getBoundingClientRect();
      otherBboxes.push({
        x: (r.left + r.width / 2 - canvasRect.left) / canvasRect.width,
        y: (r.top + r.height / 2 - canvasRect.top) / canvasRect.height,
        width: r.width / canvasRect.width,
        height: r.height / canvasRect.height,
      });
    }
    const snapTargets = computeSnapTargets(otherBboxes);

    const handleMove = (moveE: PointerEvent) => {
      const dx = moveE.clientX - startClientX;
      const dy = moveE.clientY - startClientY;
      if (!dragging && Math.hypot(dx, dy) > 4) {
        dragging = true;
        document.body.style.cursor = "grabbing";
        onEditStart?.();
      }
      if (dragging) {
        const rawX = startFracX + dx / canvasRect.width;
        const rawY = startFracY + dy / canvasRect.height;
        const snapped = snapBbox({ x: rawX, y: rawY, width: widthFrac, height: heightFrac }, snapTargets);
        onLogoPositionChange({
          x: Math.max(0, Math.min(1, snapped.cx)),
          y: Math.max(0, Math.min(1, snapped.cy)),
        });
        onGuidesChange?.({ x: snapped.guideX, y: snapped.guideY });
      }
    };
    const handleUp = () => {
      document.removeEventListener("pointermove", handleMove);
      document.removeEventListener("pointerup", handleUp);
      document.body.style.cursor = "";
      onGuidesChange?.({ x: null, y: null });
      if (dragging) onEditEnd?.();
    };
    document.addEventListener("pointermove", handleMove);
    document.addEventListener("pointerup", handleUp);
  };

  // ---- Render helpers ----
  const renderTextElement = (text: TextElement) => {
    if (text.hidden) return null;
    const useGradient = text.gradient === true;
    const weight = text.weight ?? 700;
    const isEditing = editingTextId === text.id;
    const isSelected = selectedIds?.has(`text:${text.id}`) ?? false;

    // On blur, parent receives the latest content and clears `editingTextId`.
    const commitEdit = (el: HTMLDivElement) => {
      const newContent = el.innerText;
      onTextContentChange?.(text.id, newContent);
    };

    return (
      <div
        key={text.id}
        ref={(node) => {
          if (node) textRefs.current.set(text.id, node);
          else textRefs.current.delete(text.id);
          if (isEditing) editingDivRef.current = node;
        }}
        data-editable={`text:${text.id}`}
        data-canvas-element={`text:${text.id}`}
        data-locked={text.locked ? "true" : undefined}
        contentEditable={isEditing || undefined}
        suppressContentEditableWarning
        spellCheck={isEditing}
        onPointerDown={onEditText && !isEditing ? makeTextPointerHandler(text.id) : undefined}
        onBlur={isEditing
          ? (e) => commitEdit(e.currentTarget as HTMLDivElement)
          : undefined}
        onKeyDown={isEditing
          ? (e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                (e.currentTarget as HTMLDivElement).blur();
              } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                (e.currentTarget as HTMLDivElement).blur();
              }
            }
          : undefined}
        // Paste PLAIN TEXT only. Without this, the browser inserts the
        // clipboard's rich HTML (fonts, colors, background) into the
        // contentEditable — pasting text copied from a dark source injected a
        // black background and blacked out the block. Strip to text/plain.
        onPaste={isEditing
          ? (e) => {
              e.preventDefault();
              const text = e.clipboardData?.getData("text/plain") ?? "";
              document.execCommand("insertText", false, text);
            }
          : undefined}
        className={`${isEditing ? "cursor-text" : "cursor-move"} ${textEditableHoverClass} ${isEditing ? editingActiveClass : ""}`}
        style={{
          position: "absolute",
          left: `${text.position.x * 100}%`,
          top: `${text.position.y * 100}%`,
          // Anchor follows alignment so x maps to the visible edge users
          // expect: left-aligned text positions by its left edge, right by
          // its right, center by its center.
          transform: `translate(${text.align === "left" ? "0" : text.align === "right" ? "-100%" : "-50%"}, -50%)${text.rotation ? ` rotate(${text.rotation}deg)` : ""}`,
          transformOrigin: text.align === "left" ? "left center" : text.align === "right" ? "right center" : "center center",
          zIndex: zOf(`text:${text.id}`),
          touchAction: "none",
          // Box hugs the content exactly so the click/drag affordance matches
          // what the user sees. NO maxWidth — long text intentionally overflows
          // the canvas; the host renders red bars on overflowing edges as a
          // warning. The canvas itself has `overflow: hidden` so PNG export
          // clips correctly.
          width: "max-content",
          fontFamily: FONTS[text.font ?? "onest"],
          fontWeight: weight,
          fontStyle: text.italic ? "italic" : undefined,
          fontSize: text.fontSize,
          // Fixed at 1.0 globally — keeps the bbox hugging the glyphs as
          // tightly as a font's own metrics allow. `text.lineHeight` is
          // ignored intentionally; the field is preserved on the type for
          // backwards-compat with saved docs but no longer user-editable.
          lineHeight: 1.0,
          textAlign: text.align ?? "center",
          textTransform: text.uppercase ? "uppercase" : undefined,
          letterSpacing: text.letterSpacing,
          opacity: text.opacity,
          filter: text.blur && text.blur > 0 ? `blur(${text.blur * dims.width}px)` : undefined,
          // `pre` preserves explicit `\n` line breaks the user typed and
          // never auto-wraps — long single-line content overflows the canvas
          // which is what we want for the overflow indicator.
          whiteSpace: "pre",
          ...(useGradient
            ? {
                background: GRADIENT_TEXT_CSS,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                color: "transparent",
              }
            : { color: text.color ?? COLORS.text }),
          // Inline style for the multi-select highlight — applied AFTER the
          // utility-driven base outline so it wins regardless of class order.
          ...(isSelected && !isEditing ? SELECTED_INLINE_OUTLINE : {}),
        }}
      >
        {text.content}
      </div>
    );
  };

  return (
    <div
      ref={canvasRootRef}
      style={{
        width: dims.width,
        height: dims.height,
        position: "relative",
        overflow: "hidden",
        fontFamily: FONTS.body,
        background: COLORS.background,
      }}
    >
      {/* Background — liquid metal shader */}
      <CanvasBackground id={design.backgroundId} width={dims.width} height={dims.height} paused={paused} />

      {/* Color overlay */}
      {showOverlay && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: zOf("overlay"),
            backgroundColor: design.overlayColor,
            opacity: design.overlayOpacity,
            mixBlendMode: (design.overlayBlend || "multiply") as React.CSSProperties["mixBlendMode"],
          }}
        />
      )}

      {/* Top bar — thin gradient strip, chrome element above the layer stack */}
      {design.showTopBar && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 4,
            background: GRADIENT_BORDER_CSS,
            zIndex: 9999,
          }}
        />
      )}

      {/* Canvas images (photos placed by user) */}
      {canvasImages?.map((ci) => {
        const imgW = Math.round(dims.width * ci.width);
        const imgH = Math.round(dims.height * ci.height);
        const imgLeft = Math.round(ci.x * dims.width - imgW / 2);
        const imgTop = Math.round(ci.y * dims.height - imgH / 2);
        // Corner radius as % of the SHORTER dimension (not "% of each side"
        // which would produce ellipses on non-square images). 50 = full
        // circle/pill. Fallback for legacy CanvasImage entries that still
        // carry `shape`.
        const radiusPct = ci.cornerRadius ?? (ci.shape === "circle" ? 50 : 10);
        const radius = `${(radiusPct / 100) * Math.min(imgW, imgH)}px`;
        const hasCrop = ci.crop && (ci.crop.width < 1 || ci.crop.height < 1 || ci.crop.x > 0 || ci.crop.y > 0);

        // ── Inline adjust mode — pan the image inside a FIXED frame ──
        // Double-clicking the photo enters this mode. The frame (mask) stays
        // exactly where it is on the canvas; dragging moves the IMAGE within
        // it, changing only which part of the source shows (crop.x / crop.y).
        // The view renders identically to the final output, so it's WYSIWYG.
        if (cropEditingId === ci.id) {
          const cropX = ci.crop?.x ?? 0;
          const cropY = ci.crop?.y ?? 0;
          const cropW = ci.crop?.width ?? 1;
          const cropH = ci.crop?.height ?? 1;

          const handlePan = (e: React.PointerEvent<HTMLDivElement>) => {
            if (ci.locked) return;
            e.stopPropagation();
            e.preventDefault();
            const startX = e.clientX;
            const startY = e.clientY;
            const startCropX = cropX;
            const startCropY = cropY;
            // Frame's on-screen size (accounts for the preview's scale
            // transform). Dragging one frame-width of screen distance moves the
            // image by the whole visible crop region (cropW of the source).
            const canvasRect = canvasRootRef.current?.getBoundingClientRect();
            const frameScreenW = canvasRect ? ci.width * canvasRect.width : imgW;
            const frameScreenH = canvasRect ? ci.height * canvasRect.height : imgH;
            onEditStart?.();
            const move = (moveE: PointerEvent) => {
              // Drag right → image moves right → reveal more of the LEFT of the
              // source → crop.x decreases. Hence the minus sign.
              const dxFrac = ((moveE.clientX - startX) / frameScreenW) * cropW;
              const dyFrac = ((moveE.clientY - startY) / frameScreenH) * cropH;
              const nx = Math.max(0, Math.min(1 - cropW, startCropX - dxFrac));
              const ny = Math.max(0, Math.min(1 - cropH, startCropY - dyFrac));
              onCropChange?.(ci.id, { x: nx, y: ny, width: cropW, height: cropH });
            };
            const up = () => {
              document.removeEventListener("pointermove", move);
              document.removeEventListener("pointerup", up);
              onEditEnd?.();
            };
            document.addEventListener("pointermove", move);
            document.addEventListener("pointerup", up);
          };

          // Corner-drag zoom — scales the image about the FIXED frame's centre.
          // Dragging a corner outward grows the image in the mask (crop shrinks
          // = zoom in); inward shrinks it (crop grows = zoom out). Aspect stays
          // locked to the frame so the image never distorts.
          const handleZoom = (e: React.PointerEvent<HTMLDivElement>) => {
            if (ci.locked) return;
            e.stopPropagation();
            e.preventDefault();
            const canvasRect = canvasRootRef.current?.getBoundingClientRect();
            const s = canvasRect ? canvasRect.width / dims.width : 1;
            const cxScreen = (canvasRect?.left ?? 0) + (imgLeft + imgW / 2) * s;
            const cyScreen = (canvasRect?.top ?? 0) + (imgTop + imgH / 2) * s;
            const startDist = Math.max(1, Math.hypot(e.clientX - cxScreen, e.clientY - cyScreen));
            const startW = cropW;
            const startH = cropH;
            const ratio = startW / startH;
            const centreFx = cropX + cropW / 2;
            const centreFy = cropY + cropH / 2;
            const MIN = 0.08;
            onEditStart?.();
            const move = (moveE: PointerEvent) => {
              const dist = Math.max(1, Math.hypot(moveE.clientX - cxScreen, moveE.clientY - cyScreen));
              const k = startDist / dist; // outward drag -> k < 1 -> zoom in
              let nw = startW * k;
              let nh = nw / ratio;
              if (nw > 1) { nw = 1; nh = nw / ratio; }
              if (nh > 1) { nh = 1; nw = nh * ratio; }
              if (nw < MIN) { nw = MIN; nh = nw / ratio; }
              const nx = Math.max(0, Math.min(1 - nw, centreFx - nw / 2));
              const ny = Math.max(0, Math.min(1 - nh, centreFy - nh / 2));
              onCropChange?.(ci.id, { x: nx, y: ny, width: nw, height: nh });
            };
            const up = () => {
              document.removeEventListener("pointermove", move);
              document.removeEventListener("pointerup", up);
              onEditEnd?.();
            };
            document.addEventListener("pointermove", move);
            document.addEventListener("pointerup", up);
          };

          // Whole-source geometry: position the full image so its crop sub-rect
          // lands exactly on the FIXED frame. The image extends past the frame;
          // those parts render dimmed so the user sees the entire picture and
          // what's inside the mask at the same time.
          const fullW = imgW / cropW;
          const fullH = imgH / cropH;
          const fullLeft = imgLeft - cropX * fullW;
          const fullTop = imgTop - cropY * fullH;
          const oLeft = cropX * 100;
          const oTop = cropY * 100;
          const oW = cropW * 100;
          const oH = cropH * 100;
          const handleSize = 12;
          // Anchors sit on the WHOLE underlying image (the container is sized
          // to the full image), not the crop frame — so scaling grabs the
          // image corners, matching what the user sees.
          const corners = [
            { key: "nw", left: 0, top: 0, cursor: "nwse-resize" },
            { key: "ne", left: 100, top: 0, cursor: "nesw-resize" },
            { key: "sw", left: 0, top: 100, cursor: "nesw-resize" },
            { key: "se", left: 100, top: 100, cursor: "nwse-resize" },
          ] as const;

          return (
            <div
              key={ci.id}
              data-canvas-overlay="crop"
              style={{
                position: "absolute",
                zIndex: zOf(`image:${ci.id}`) + 5,
                left: fullLeft,
                top: fullTop,
                width: fullW,
                height: fullH,
                touchAction: "none",
              }}
            >
              {/* Whole source — drag it to pan the image inside the mask. */}
              <img
                src={ci.src}
                alt=""
                draggable={false}
                onPointerDown={handlePan}
                style={{ width: "100%", height: "100%", display: "block", userSelect: "none", cursor: "move" }}
              />
              {/* Dim everything OUTSIDE the fixed frame (the bright window). */}
              {[
                { left: 0, top: 0, right: 0, height: `${oTop}%` },
                { left: 0, bottom: 0, right: 0, height: `${100 - oTop - oH}%` },
                { left: 0, top: `${oTop}%`, width: `${oLeft}%`, height: `${oH}%` },
                { right: 0, top: `${oTop}%`, width: `${100 - oLeft - oW}%`, height: `${oH}%` },
              ].map((dz, i) => (
                <div key={i} style={{ position: "absolute", background: "rgba(0,0,0,0.5)", pointerEvents: "none", ...dz }} />
              ))}
              {/* Frame outline (the mask stays put). */}
              <div
                style={{
                  position: "absolute",
                  left: `${oLeft}%`,
                  top: `${oTop}%`,
                  width: `${oW}%`,
                  height: `${oH}%`,
                  outline: "2px solid #FF6B00",
                  outlineOffset: -1,
                  borderRadius: radius,
                  boxSizing: "border-box",
                  pointerEvents: "none",
                }}
              />
              {/* Corner handles — drag to resize (zoom) the image in the mask. */}
              {corners.map((c) => (
                <div
                  key={c.key}
                  onPointerDown={handleZoom}
                  style={{
                    position: "absolute",
                    left: `${c.left}%`,
                    top: `${c.top}%`,
                    width: handleSize,
                    height: handleSize,
                    transform: "translate(-50%, -50%)",
                    background: "#FF6B00",
                    border: "2px solid white",
                    borderRadius: 2,
                    cursor: c.cursor,
                    pointerEvents: "auto",
                    boxShadow: "0 0 4px rgba(0,0,0,0.5)",
                  }}
                />
              ))}
            </div>
          );
        }

        {
          const paddingPx = ci.padding ? Math.max(0, Math.round(ci.padding * dims.width)) : 0;
          const blurPx = ci.backdropBlur ? Math.max(0, Math.round(ci.backdropBlur * dims.width)) : 0;
          const blurFilter = blurPx > 0 ? `blur(${blurPx}px)` : undefined;
          // Outer wrapper — no overflow:hidden, no padding. Holds two
          // children: an inner clip-wrapper for the image + backdrop +
          // optional blur, and the border sibling that draws around the
          // OUTER edge unaffected by padding or backdrop-filter.
          return (
            <div
              key={ci.id}
              style={{
                position: "absolute",
                zIndex: zOf(`image:${ci.id}`),
                left: imgLeft,
                top: imgTop,
                width: imgW,
                height: imgH,
                borderRadius: radius,
              }}
            >
              {/* Backdrop layer — solid fill + backdrop-filter blur (frosted
               *  glass). Opacity dims only this layer. The `transform:
               *  translate3d` here forces a compositing layer that makes
               *  backdrop-filter actually sample the canvas content even
               *  when an ancestor has a `transform: scale()` (the preview
               *  wrapper), working around a long-standing Chrome/Safari
               *  bug. */}
              {(ci.backdropColor || blurFilter) && (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: radius,
                    background: ci.backdropColor || undefined,
                    backdropFilter: blurFilter,
                    WebkitBackdropFilter: blurFilter,
                    opacity: ci.opacity ?? 1,
                    pointerEvents: "none",
                    transform: blurFilter ? "translate3d(0,0,0)" : undefined,
                    willChange: blurFilter ? "backdrop-filter" : undefined,
                  }}
                />
              )}
              {/* Inner clip-wrapper — owns the padding + clip so the image
               *  fits the rounded corners. Stays at full opacity so the
               *  logo never fades with the backdrop. */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: radius,
                  overflow: "hidden",
                  padding: paddingPx || undefined,
                  boxSizing: "border-box",
                }}
              >
                <img
                  src={ci.src}
                  alt=""
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: ci.fit ?? "cover",
                    display: "block",
                    ...(hasCrop && ci.crop
                      ? {
                          objectViewBox: `inset(${(ci.crop.y * 100).toFixed(3)}% ${((1 - ci.crop.x - ci.crop.width) * 100).toFixed(3)}% ${((1 - ci.crop.y - ci.crop.height) * 100).toFixed(3)}% ${(ci.crop.x * 100).toFixed(3)}%)`,
                        } as React.CSSProperties
                      : null),
                  }}
                />
              </div>
              {/* Border — sibling of the clip-wrapper so it's not affected
               *  by the clip-wrapper's overflow:hidden, padding, or
               *  backdrop-filter. Draws on the OUTER bbox edge. */}
              {ci.border && (() => {
                const widthPx = Math.max(0, Math.round((ci.borderWidth ?? 2 / 1500) * dims.width));
                if (widthPx === 0) return null;
                if (ci.borderColor) {
                  return (
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        borderRadius: radius,
                        border: `${widthPx}px solid ${ci.borderColor}`,
                        pointerEvents: "none",
                        boxSizing: "border-box",
                      }}
                    />
                  );
                }
                return (
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      borderRadius: radius,
                      border: `${widthPx}px solid transparent`,
                      background: "linear-gradient(135deg, #FFD000, #FF6B00, #FF0028) border-box",
                      WebkitMask: "linear-gradient(#fff 0 0) padding-box, linear-gradient(#fff 0 0)",
                      WebkitMaskComposite: "xor",
                      mask: "linear-gradient(#fff 0 0) padding-box, linear-gradient(#fff 0 0)",
                      maskComposite: "exclude" as never,
                      pointerEvents: "none",
                    }}
                  />
                );
              })()}
            </div>
          );
        }
      })}

      {/* Shape elements (rectangle / circle / line / star). */}
      {design.shapes?.map((s) => renderShapeElement(s, dims, zOf, selectedIds))}

      {/* Text elements — each independently positioned, sized and styled. */}
      {design.texts.map(renderTextElement)}

      {/* TechBBQ logo — preset corner OR dragged custom position. */}
      {design.showLogo && (() => {
        const pos = design.logoPosition || "bottom-center";
        const scale = Math.max(0.3, Math.min(3.0, design.logoScale ?? 1));
        const logoH = isPortrait
          ? Math.round(dims.width * 0.052 * scale)
          : Math.round(dims.height * 0.037 * scale);
        const pad = isPortrait
          ? Math.round(dims.width * 0.055)
          : Math.round(dims.height * 0.05);
        const custom = design.logoCustomPosition;
        const logoPos: React.CSSProperties = custom
          ? {
              position: "absolute",
              zIndex: zOf("tbbqLogo"),
              left: `${custom.x * 100}%`,
              top: `${custom.y * 100}%`,
              transform: "translate(-50%, -50%)",
            }
          : {
              position: "absolute",
              zIndex: zOf("tbbqLogo"),
              ...(pos.startsWith("top") ? { top: pad } : { bottom: pad }),
              ...(pos.endsWith("left")
                ? { left: pad }
                : pos.endsWith("right")
                  ? { right: pad }
                  : { left: "50%", transform: "translateX(-50%)" }),
            };
        const logoSrc =
          design.logoStyle === "gradient" ? "/logo-gradient.svg"
          : design.logoStyle === "red" ? "/logo-red.svg"
          : "/logo-white.svg";

        return (
          <div
            ref={logoRef}
            style={{ ...logoPos, cursor: onLogoPositionChange ? "grab" : undefined, touchAction: "none" }}
            onPointerDown={onLogoPositionChange ? handleLogoPointerDown : undefined}
          >
            <img
              src={logoSrc}
              alt="TechBBQ"
              draggable={false}
              style={{ height: logoH, width: "auto", objectFit: "contain", pointerEvents: "none", userSelect: "none" }}
            />
          </div>
        );
      })()}
    </div>
  );
}
