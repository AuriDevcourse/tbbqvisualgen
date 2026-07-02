"use client";

import { useCallback, useRef, useState, useEffect } from "react";
import { Upload } from "lucide-react";
import type { ShapeElement } from "@/types/template";
import { computeSnapTargets, snapBbox, type Bbox } from "@/lib/snap";

type DragMode = "move" | "nw" | "ne" | "sw" | "se" | null;

interface ShapeDragOverlayProps {
  shape: ShapeElement;
  /** Other element bboxes to snap against (other shapes, images, texts). */
  otherBboxes?: Bbox[];
  canvasWidth: number;
  canvasHeight: number;
  selected: boolean;
  /** When false, dragging places freeform (no snap-to-guides). */
  snapEnabled: boolean;
  resizable?: boolean;
  zIndex?: number;
  onSelect: () => void;
  onChange: (next: ShapeElement) => void;
  onGuidesChange?: (guides: { x: number | null; y: number | null }) => void;
  onEditStart?: () => void;
  onEditEnd?: () => void;
  onBeginDrag?: (id: string) => void;
  onMoveBy?: (dx: number, dy: number) => void;
  onEndDrag?: () => void;
  /** When shape.imagePlaceholder is set, called with file metadata after the
   *  user picks an image. Host should replace the shape with a CanvasImage at
   *  the same position/size. */
  onPlaceholderUpload?: (
    shapeId: string,
    dataUrl: string,
    naturalWidth: number,
    naturalHeight: number,
  ) => void;
}

export function ShapeDragOverlay({
  shape, otherBboxes, canvasWidth, canvasHeight, selected, snapEnabled, resizable = selected,
  zIndex, onSelect, onChange, onGuidesChange,
  onEditStart, onEditEnd, onBeginDrag, onMoveBy, onEndDrag,
  onPlaceholderUpload,
}: ShapeDragOverlayProps) {
  const [dragging, setDragging] = useState<DragMode>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const startRef = useRef({ mx: 0, my: 0, x: 0, y: 0, w: 0, h: 0 });

  const handlePlaceholderFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !onPlaceholderUpload) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      if (typeof dataUrl !== "string") return;
      const img = new Image();
      img.onload = () => {
        onPlaceholderUpload(shape.id, dataUrl, img.naturalWidth, img.naturalHeight);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  }, [shape.id, onPlaceholderUpload]);

  // Shapes are positioned the same way as images: center (x, y) + width/height
  // in fractional canvas coords. Lines render with a fixed strokeWidth height
  // for visual fidelity, but the drag bbox uses the stored height so the user
  // can still grab and move it.
  const isLine = shape.type === "line";
  const visualH = isLine
    ? Math.max(2, Math.round(canvasWidth * shape.strokeWidth))
    : Math.round(canvasHeight * shape.height);
  const bboxH = Math.max(visualH, 14); // ensure clickable area for thin lines
  const shapeW = Math.round(canvasWidth * shape.width);
  const shapeLeft = Math.round(shape.x * canvasWidth - shapeW / 2);
  const shapeTop = Math.round(shape.y * canvasHeight - bboxH / 2);
  const handleSize = 14;

  const startDrag = useCallback((mode: DragMode, e: React.MouseEvent) => {
    if (shape.locked) return;
    e.preventDefault();
    e.stopPropagation();
    setDragging(mode);
    onEditStart?.();
    if (mode === "move") onBeginDrag?.(`shape:${shape.id}`);
    startRef.current = {
      mx: e.clientX,
      my: e.clientY,
      x: shape.x,
      y: shape.y,
      w: shape.width,
      h: shape.height,
    };
  }, [shape.id, shape.x, shape.y, shape.width, shape.height, shape.locked, onEditStart, onBeginDrag]);

  useEffect(() => {
    if (!dragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = overlayRef.current?.getBoundingClientRect();
      if (!rect) return;
      const dx = (e.clientX - startRef.current.mx) / rect.width;
      const dy = (e.clientY - startRef.current.my) / rect.height;

      if (dragging === "move") {
        const rawX = startRef.current.x + dx;
        const rawY = startRef.current.y + dy;
        let newX: number, newY: number;
        if (snapEnabled) {
          const targets = computeSnapTargets(otherBboxes || []);
          const result = snapBbox(
            { x: rawX, y: rawY, width: shape.width, height: shape.height },
            targets,
          );
          onGuidesChange?.({ x: result.guideX, y: result.guideY });
          newX = Math.max(0, Math.min(1, result.cx));
          newY = Math.max(0, Math.min(1, result.cy));
        } else {
          onGuidesChange?.({ x: null, y: null });
          newX = Math.max(0, Math.min(1, rawX));
          newY = Math.max(0, Math.min(1, rawY));
        }
        onMoveBy?.(newX - startRef.current.x, newY - startRef.current.y);
        return;
      }

      // Resize — Shift locks aspect, Alt scales from center.
      const { x: sx, y: sy, w: sw, h: sh } = startRef.current;
      const isW = dragging === "nw" || dragging === "sw";
      const isN = dragging === "nw" || dragging === "ne";
      const fromCenter = e.altKey;
      const lockAspect = e.shiftKey;
      const fixedX = fromCenter ? sx : (isW ? sx + sw / 2 : sx - sw / 2);
      const fixedY = fromCenter ? sy : (isN ? sy + sh / 2 : sy - sh / 2);
      const draggedStartX = isW ? sx - sw / 2 : sx + sw / 2;
      const draggedStartY = isN ? sy - sh / 2 : sy + sh / 2;

      let newDraggedX = draggedStartX + dx;
      let newDraggedY = draggedStartY + dy;

      if (lockAspect) {
        const aspect = sw / sh;
        const candW = Math.abs(newDraggedX - fixedX) * (fromCenter ? 2 : 1);
        const candH = Math.abs(newDraggedY - fixedY) * (fromCenter ? 2 : 1);
        if (candW / sw >= candH / sh) {
          const newH = candW / aspect;
          newDraggedY = fixedY + (isN ? -newH / (fromCenter ? 2 : 1) : newH / (fromCenter ? 2 : 1));
        } else {
          const newW = candH * aspect;
          newDraggedX = fixedX + (isW ? -newW / (fromCenter ? 2 : 1) : newW / (fromCenter ? 2 : 1));
        }
      }

      const MIN = 0.02;
      if (isW) newDraggedX = Math.max(0, Math.min(fixedX - MIN, newDraggedX));
      else     newDraggedX = Math.min(1, Math.max(fixedX + MIN, newDraggedX));
      if (isN) newDraggedY = Math.max(0, Math.min(fixedY - MIN, newDraggedY));
      else     newDraggedY = Math.min(1, Math.max(fixedY + MIN, newDraggedY));

      let newLeft: number, newRight: number, newTop: number, newBottom: number;
      if (fromCenter) {
        const halfW = Math.abs(newDraggedX - sx);
        const halfH = Math.abs(newDraggedY - sy);
        newLeft = sx - halfW; newRight = sx + halfW;
        newTop = sy - halfH;  newBottom = sy + halfH;
      } else {
        newLeft = Math.min(fixedX, newDraggedX);
        newRight = Math.max(fixedX, newDraggedX);
        newTop = Math.min(fixedY, newDraggedY);
        newBottom = Math.max(fixedY, newDraggedY);
      }

      const newW = newRight - newLeft;
      const newH = newBottom - newTop;
      const newX = (newLeft + newRight) / 2;
      const newY = (newTop + newBottom) / 2;

      onGuidesChange?.({ x: null, y: null });

      onChange({
        ...shape,
        x: Math.round(newX * 1000) / 1000,
        y: Math.round(newY * 1000) / 1000,
        width: Math.round(newW * 1000) / 1000,
        height: Math.round(newH * 1000) / 1000,
      });
    };

    const handleMouseUp = () => {
      const wasMove = dragging === "move";
      setDragging(null);
      onEditEnd?.();
      // Always clear snap guides when the user releases — the last guide
      // values would otherwise stay visible on canvas.
      onGuidesChange?.({ x: null, y: null });
      if (wasMove) onEndDrag?.();
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragging, shape, onChange, otherBboxes, onGuidesChange, onEditEnd, onMoveBy, onEndDrag]);

  const corners: { key: DragMode; cx: number; cy: number; cursor: string }[] = [
    { key: "nw", cx: shapeLeft,         cy: shapeTop,         cursor: "nwse-resize" },
    { key: "ne", cx: shapeLeft + shapeW, cy: shapeTop,         cursor: "nesw-resize" },
    { key: "sw", cx: shapeLeft,         cy: shapeTop + bboxH, cursor: "nesw-resize" },
    { key: "se", cx: shapeLeft + shapeW, cy: shapeTop + bboxH, cursor: "nwse-resize" },
  ];

  return (
    <div
      ref={overlayRef}
      data-canvas-overlay="shape"
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: (zIndex ?? 10) + (selected ? 1 : 0),
      }}
    >
      {/* Clickable bbox. For filled shapes the whole rect catches clicks; for
       *  outline-only rect/circle we use an SVG with `pointer-events: stroke`
       *  so the hollow interior is click-through to whatever's underneath. */}
      {(() => {
        const isOutline = shape.fillType === "outline";
        const strokePx = Math.max(8, Math.round(shape.strokeWidth * canvasWidth));
        const handleDown = (e: React.MouseEvent | React.PointerEvent) => {
          if ((e as React.MouseEvent).button === 2) return;
          e.preventDefault();
          e.stopPropagation();
          if (shape.locked) {
            if (!selected) onSelect();
            return;
          }
          if (!selected) onSelect();
          startDrag("move", e as React.MouseEvent);
        };
        const cursor = shape.locked
          ? "default"
          : selected
            ? (dragging === "move" ? "grabbing" : "grab")
            : "pointer";

        // Outline rect / circle → SVG stroke hit-test.
        if (isOutline && (shape.type === "rectangle" || shape.type === "circle")) {
          return (
            <svg
              data-canvas-element={`shape:${shape.id}`}
              data-locked={shape.locked ? "true" : undefined}
              style={{
                position: "absolute",
                left: shapeLeft,
                top: shapeTop,
                width: shapeW,
                height: bboxH,
                pointerEvents: "none",
                cursor,
              }}
              viewBox={`0 0 ${shapeW} ${bboxH}`}
              preserveAspectRatio="none"
            >
              {shape.type === "rectangle" ? (
                <rect
                  x={strokePx / 2}
                  y={strokePx / 2}
                  width={Math.max(0, shapeW - strokePx)}
                  height={Math.max(0, bboxH - strokePx)}
                  fill="transparent"
                  stroke="rgba(0,0,0,0)"
                  strokeWidth={strokePx}
                  onMouseDown={handleDown}
                  style={{ pointerEvents: "stroke", cursor }}
                />
              ) : (
                <ellipse
                  cx={shapeW / 2}
                  cy={bboxH / 2}
                  rx={Math.max(0, (shapeW - strokePx) / 2)}
                  ry={Math.max(0, (bboxH - strokePx) / 2)}
                  fill="transparent"
                  stroke="rgba(0,0,0,0)"
                  strokeWidth={strokePx}
                  onMouseDown={handleDown}
                  style={{ pointerEvents: "stroke", cursor }}
                />
              )}
            </svg>
          );
        }

        // Filled / line / star → plain rect bbox.
        return (
          <div
            data-canvas-element={`shape:${shape.id}`}
            data-locked={shape.locked ? "true" : undefined}
            onMouseDown={handleDown}
            style={{
              position: "absolute",
              left: shapeLeft,
              top: shapeTop,
              width: shapeW,
              height: bboxH,
              cursor,
              pointerEvents: "auto",
              boxSizing: "border-box",
            }}
          />
        );
      })()}
      {/* Placeholder upload affordance — only renders when shape is an
       *  image-placeholder. Hidden file input + small floating button. */}
      {shape.imagePlaceholder && (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handlePlaceholderFile}
            style={{ display: "none" }}
          />
          <button
            type="button"
            onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); }}
            onClick={(e) => {
              e.stopPropagation();
              fileInputRef.current?.click();
            }}
            className="placeholder-upload-btn"
            style={{
              position: "absolute",
              left: shapeLeft + shapeW / 2,
              top: shapeTop + bboxH / 2,
              transform: "translate(-50%, -50%)",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "12px 18px",
              borderRadius: 999,
              background: "linear-gradient(135deg, #FF8A1F, #FF0028)",
              color: "white",
              fontSize: 14,
              fontWeight: 700,
              letterSpacing: "0.03em",
              border: "2px solid rgba(255,255,255,0.95)",
              boxShadow:
                "0 0 0 4px rgba(255,107,0,0.25), 0 12px 28px -6px rgba(255,0,40,0.7), 0 4px 10px -2px rgba(0,0,0,0.45)",
              cursor: "pointer",
              pointerEvents: "auto",
              zIndex: 12,
              whiteSpace: "nowrap",
              animation: "tbbq-upload-pulse 1.6s ease-in-out infinite",
            }}
          >
            <Upload size={16} strokeWidth={2.8} />
            {shape.imagePlaceholder?.mode === "contain" ? "Upload logo" : "Upload photo"}
          </button>
          <style jsx>{`
            @keyframes tbbq-upload-pulse {
              0%, 100% {
                box-shadow:
                  0 0 0 4px rgba(255, 107, 0, 0.25),
                  0 12px 28px -6px rgba(255, 0, 40, 0.7),
                  0 4px 10px -2px rgba(0, 0, 0, 0.45);
              }
              50% {
                box-shadow:
                  0 0 0 8px rgba(255, 107, 0, 0.15),
                  0 14px 32px -4px rgba(255, 0, 40, 0.85),
                  0 4px 10px -2px rgba(0, 0, 0, 0.45);
              }
            }
            .placeholder-upload-btn:hover {
              transform: translate(-50%, -50%) scale(1.05);
              transition: transform 120ms ease;
            }
          `}</style>
        </>
      )}
      {resizable && corners.map(({ key, cx, cy, cursor }) => (
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
