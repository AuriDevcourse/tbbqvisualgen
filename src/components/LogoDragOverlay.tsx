"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { DesignConfig } from "@/types/template";
import { computeSnapTargets, snapBbox, type Bbox } from "@/lib/snap";

type DragMode = "move" | "nw" | "ne" | "sw" | "se" | null;

interface LogoDragOverlayProps {
  design: DesignConfig;
  canvasWidth: number;
  canvasHeight: number;
  isPortrait: boolean;
  selected: boolean;
  /** When false, dragging places freeform (no snap-to-guides). */
  snapEnabled: boolean;
  onSelect: () => void;
  onChange: (patch: { logoScale?: number; logoCustomPosition?: { x: number; y: number } | null }) => void;
  onGuidesChange?: (guides: { x: number | null; y: number | null }) => void;
  onEditStart?: () => void;
  onEditEnd?: () => void;
  /** Other element bboxes to snap against when moving the logo. */
  otherBboxes?: Bbox[];
  zIndex?: number;
  /** Group-drag protocol — same as image/shape overlays. When the logo is
   *  part of a multi-selection, page.tsx tracks origins and applies the
   *  delta to every selected element including the logo. */
  onBeginDrag?: (id: string) => void;
  onMoveBy?: (dx: number, dy: number) => void;
  onEndDrag?: () => void;
}

// Cached natural aspect ratios for the three logo files. Loaded on first
// render and reused so we don't need to await every frame.
const aspectCache: Record<string, number> = {};

function loadAspectRatio(src: string, cb: (ar: number) => void) {
  if (aspectCache[src]) {
    cb(aspectCache[src]);
    return;
  }
  const img = new Image();
  img.onload = () => {
    const ar = img.naturalHeight > 0 ? img.naturalWidth / img.naturalHeight : 4;
    aspectCache[src] = ar;
    cb(ar);
  };
  img.src = src;
}

function logoSrc(design: DesignConfig): string {
  return design.logoStyle === "gradient" ? "/logo-gradient.svg"
    : design.logoStyle === "red" ? "/logo-red.svg"
    : "/logo-white.svg";
}

/** Computes the logo's pixel rect on canvas (top-left + width/height) using
 *  the same math DynamicTemplate uses, so the bbox lines up exactly with the
 *  rendered img. */
function computeLogoRect(
  design: DesignConfig,
  canvasWidth: number,
  canvasHeight: number,
  isPortrait: boolean,
  aspectRatio: number,
): { left: number; top: number; width: number; height: number } | null {
  if (!design.showLogo) return null;
  const scale = Math.max(0.3, Math.min(3.0, design.logoScale ?? 1));
  const h = isPortrait
    ? Math.round(canvasWidth * 0.052 * scale)
    : Math.round(canvasHeight * 0.037 * scale);
  const w = Math.round(h * aspectRatio);
  const pad = isPortrait
    ? Math.round(canvasWidth * 0.055)
    : Math.round(canvasHeight * 0.05);

  // logoCustomPosition is fractional CENTER coords.
  if (design.logoCustomPosition) {
    const cx = design.logoCustomPosition.x * canvasWidth;
    const cy = design.logoCustomPosition.y * canvasHeight;
    return { left: Math.round(cx - w / 2), top: Math.round(cy - h / 2), width: w, height: h };
  }

  const pos = design.logoPosition || "bottom-center";
  let left: number;
  let top: number;
  if (pos.endsWith("left")) left = pad;
  else if (pos.endsWith("right")) left = canvasWidth - pad - w;
  else left = Math.round((canvasWidth - w) / 2);

  if (pos.startsWith("top")) top = pad;
  else top = canvasHeight - pad - h;
  return { left, top, width: w, height: h };
}

export function LogoDragOverlay({
  design, canvasWidth, canvasHeight, isPortrait, selected, snapEnabled,
  onSelect, onChange, onGuidesChange, onEditStart, onEditEnd, otherBboxes, zIndex,
  onBeginDrag, onMoveBy, onEndDrag,
}: LogoDragOverlayProps) {
  const [aspectRatio, setAspectRatio] = useState<number>(4);
  const [dragging, setDragging] = useState<DragMode>(null);
  // Ref to the overlay container so we can read its on-screen pixel size
  // (the canvas is scaled to fit the preview area, so screen pixels !=
  // design pixels — we convert at drag time using the overlay's rect).
  const overlayRef = useRef<HTMLDivElement>(null);
  // startRef captures bbox in CANVAS (design) pixels at drag start.
  const startRef = useRef({
    mx: 0, my: 0, scale: 1, cx: 0, cy: 0, w: 0, h: 0,
    left: 0, top: 0,
  });
  // Snap targets captured at drag start. Includes the prop bboxes plus text
  // bboxes measured from the DOM (text width depends on content + font, so
  // we can't get it from doc state alone).
  const dragSnapTargetsRef = useRef<Bbox[]>([]);

  useEffect(() => {
    let cancelled = false;
    loadAspectRatio(logoSrc(design), (ar) => { if (!cancelled) setAspectRatio(ar); });
    return () => { cancelled = true; };
  }, [design]);

  const rect = computeLogoRect(design, canvasWidth, canvasHeight, isPortrait, aspectRatio);
  if (!rect) return null;

  const handleSize = 12;

  const startDrag = useCallback((mode: DragMode, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only replace the selection if the logo isn't already part of it —
    // otherwise we'd wipe out a multi-selection on click-to-drag.
    if (!selected) onSelect();
    onEditStart?.();
    setDragging(mode);
    if (mode === "move") onBeginDrag?.("tbbqLogo");
    const scale = Math.max(0.3, Math.min(3.0, design.logoScale ?? 1));
    // Capture center as fractional (we'll write back to logoCustomPosition
    // in fractional units regardless of starting placement).
    const cx = (rect.left + rect.width / 2) / canvasWidth;
    const cy = (rect.top + rect.height / 2) / canvasHeight;
    startRef.current = {
      mx: e.clientX,
      my: e.clientY,
      scale,
      cx,
      cy,
      w: rect.width,
      h: rect.height,
      left: rect.left,
      top: rect.top,
    };

    // Capture text bboxes from DOM at drag start so the logo can snap to
    // them too. Text width is content/font dependent and only known at
    // render time, so this is the only way to get accurate centers/edges.
    const targets: Bbox[] = [...(otherBboxes ?? [])];
    const overlayRect = overlayRef.current?.getBoundingClientRect();
    if (overlayRect && overlayRect.width > 0 && overlayRect.height > 0) {
      document.querySelectorAll<HTMLElement>('[data-canvas-element^="text:"]').forEach((el) => {
        const r = el.getBoundingClientRect();
        targets.push({
          x: (r.left + r.width / 2 - overlayRect.left) / overlayRect.width,
          y: (r.top + r.height / 2 - overlayRect.top) / overlayRect.height,
          width: r.width / overlayRect.width,
          height: r.height / overlayRect.height,
        });
      });
    }
    dragSnapTargetsRef.current = targets;
  }, [design.logoScale, onSelect, onEditStart, rect, canvasWidth, canvasHeight, selected, onBeginDrag]);

  useEffect(() => {
    if (!dragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      // Convert SCREEN-pixel mouse delta into CANVAS-pixel delta using the
      // overlay's actual on-screen rect. Without this, dragging is off by
      // the preview-area scale factor (the canvas is shrunk to fit the
      // viewport so 1 screen px != 1 design px).
      const screenRect = overlayRef.current?.getBoundingClientRect();
      const screenScale = screenRect && screenRect.width > 0 ? screenRect.width / canvasWidth : 1;
      const dx = (e.clientX - startRef.current.mx) / screenScale;
      const dy = (e.clientY - startRef.current.my) / screenScale;

      if (dragging === "move") {
        const dxFrac = dx / canvasWidth;
        const dyFrac = dy / canvasHeight;
        const widthFrac = startRef.current.w / canvasWidth;
        const heightFrac = startRef.current.h / canvasHeight;
        const rawX = startRef.current.cx + dxFrac;
        const rawY = startRef.current.cy + dyFrac;
        let clampedX: number, clampedY: number;
        if (snapEnabled) {
          const snapped = snapBbox(
            { x: rawX, y: rawY, width: widthFrac, height: heightFrac },
            computeSnapTargets(dragSnapTargetsRef.current),
          );
          onGuidesChange?.({ x: snapped.guideX, y: snapped.guideY });
          clampedX = Math.max(0, Math.min(1, snapped.cx));
          clampedY = Math.max(0, Math.min(1, snapped.cy));
        } else {
          onGuidesChange?.({ x: null, y: null });
          clampedX = Math.max(0, Math.min(1, rawX));
          clampedY = Math.max(0, Math.min(1, rawY));
        }
        // Group-drag protocol when the host wired up onMoveBy. The host
        // applies the same delta to every selected element (including the
        // logo). When no group-drag handler exists, fall back to writing
        // logoCustomPosition directly.
        if (onMoveBy) {
          onMoveBy(clampedX - startRef.current.cx, clampedY - startRef.current.cy);
        } else {
          onChange({ logoCustomPosition: { x: clampedX, y: clampedY } });
        }
        return;
      }

      // Corner resize — opposite corner stays anchored, just like every
      // other element. Aspect ratio is locked (logo is brand-fixed).
      const { left, top, w: w0, h: h0, scale: scale0 } = startRef.current;
      const isW = dragging === "nw" || dragging === "sw";
      const isN = dragging === "nw" || dragging === "ne";
      const fixedX = isW ? left + w0 : left;
      const fixedY = isN ? top + h0 : top;
      const draggedStartX = isW ? left : left + w0;
      const draggedStartY = isN ? top : top + h0;
      const newDraggedX = draggedStartX + dx;
      const newDraggedY = draggedStartY + dy;

      // Pick dominant axis to honour aspect ratio: whichever axis the user
      // pulled harder along (relative to start) wins; the other is derived.
      const candW = Math.abs(newDraggedX - fixedX);
      const candH = Math.abs(newDraggedY - fixedY);
      let newW: number;
      let newH: number;
      if (candW / Math.max(1, w0) >= candH / Math.max(1, h0)) {
        newW = Math.max(20, candW);
        newH = newW / aspectRatio;
      } else {
        newH = Math.max(20, candH);
        newW = newH * aspectRatio;
      }

      const factor = newW / w0;
      const nextScale = Math.max(0.3, Math.min(3.0, scale0 * factor));
      // Clamp newW/newH to the actually-applied scale (so the bbox follows
      // the clamp).
      const clampedFactor = nextScale / scale0;
      newW = w0 * clampedFactor;
      newH = h0 * clampedFactor;

      // Place the rect so that the anchor (opposite corner) stays put.
      const newLeft = isW ? fixedX - newW : fixedX;
      const newTop = isN ? fixedY - newH : fixedY;
      const newCx = (newLeft + newW / 2) / canvasWidth;
      const newCy = (newTop + newH / 2) / canvasHeight;
      onChange({
        logoScale: nextScale,
        logoCustomPosition: {
          x: Math.max(0, Math.min(1, newCx)),
          y: Math.max(0, Math.min(1, newCy)),
        },
      });
    };

    const handleMouseUp = () => {
      const wasMove = dragging === "move";
      setDragging(null);
      onEditEnd?.();
      onGuidesChange?.({ x: null, y: null });
      if (wasMove) onEndDrag?.();
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragging, canvasWidth, canvasHeight, onChange, onGuidesChange, onEditEnd, otherBboxes, onMoveBy, onEndDrag, aspectRatio]);

  const corners: { key: NonNullable<DragMode>; cx: number; cy: number; cursor: string }[] = [
    { key: "nw", cx: rect.left,               cy: rect.top,                cursor: "nwse-resize" },
    { key: "ne", cx: rect.left + rect.width,  cy: rect.top,                cursor: "nesw-resize" },
    { key: "sw", cx: rect.left,               cy: rect.top + rect.height,  cursor: "nesw-resize" },
    { key: "se", cx: rect.left + rect.width,  cy: rect.top + rect.height,  cursor: "nwse-resize" },
  ];

  return (
    <div
      ref={overlayRef}
      data-canvas-overlay="logo"
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: (zIndex ?? 10) + (selected ? 1 : 0),
      }}
    >
      {/* Bbox — click to select, drag to move. Transparent fill, only an
       *  outline when selected. */}
      <div
        data-canvas-element="tbbqLogo"
        onMouseDown={(e) => {
          if (e.button === 2) return;
          e.preventDefault();
          e.stopPropagation();
          startDrag("move", e);
        }}
        style={{
          position: "absolute",
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
          cursor: selected ? (dragging === "move" ? "grabbing" : "grab") : "pointer",
          pointerEvents: "auto",
          boxSizing: "border-box",
          outline: selected ? "2px solid #FF6B00" : "none",
          outlineOffset: 2,
        }}
      />
      {selected && corners.map(({ key, cx, cy, cursor }) => (
        <div
          key={key}
          onMouseDown={(e) => startDrag(key, e)}
          style={{
            position: "absolute",
            left: cx - handleSize / 2,
            top: cy - handleSize / 2,
            width: handleSize,
            height: handleSize,
            background: "#FF6B00",
            border: "2px solid white",
            borderRadius: 2,
            cursor,
            pointerEvents: "auto",
            zIndex: 11,
            boxShadow: "0 0 4px rgba(0,0,0,0.5)",
          }}
        />
      ))}
    </div>
  );
}
