"use client";

import { useCallback, useRef, useState, useEffect } from "react";
import type { CanvasImage } from "./ImagePlacer";
import { computeSnapTargets, snapBbox, type Bbox } from "@/lib/snap";

type DragMode = "move" | "nw" | "ne" | "sw" | "se" | null;

interface ImageDragOverlayProps {
  image: CanvasImage;
  otherImages?: CanvasImage[];
  /** Extra bboxes (e.g. text layers) to snap against, in fractional coords. */
  extraSnapBboxes?: Bbox[];
  canvasWidth: number;
  canvasHeight: number;
  selected: boolean;
  /** When true, show the corner resize handles. Defaults to `selected`. Set
   *  to false when the image is part of a multi-selection so the canvas isn't
   *  cluttered with handles across every selected image. */
  resizable?: boolean;
  /** z-index for the overlay — should match the image's layer z so clicks
   *  land on the bbox correctly relative to other layered elements. */
  zIndex?: number;
  onSelect: () => void;
  onDeselect: () => void;
  onChange: (image: CanvasImage) => void;
  /** Report active snap-guide positions (fractional) to the parent so the
   *  parent can render unified orange guide lines outside the export root. */
  onGuidesChange?: (guides: { x: number | null; y: number | null }) => void;
  /** Called on drag-start so the host can open a history transaction. */
  onEditStart?: () => void;
  /** Called on drag-end so the host can close the history transaction. */
  onEditEnd?: () => void;
  /** Called when a move-drag starts so the host can snapshot pre-drag
   *  positions of every selected element for group translation. */
  onBeginDrag?: (id: string) => void;
  /** Called per move tick with (dx, dy) in fractional canvas coords. The host
   *  applies this delta to every snapshotted element. */
  onMoveBy?: (dx: number, dy: number) => void;
  /** Called on move-drag end. */
  onEndDrag?: () => void;
  /** Double-click on the image bbox — Google Slides–style enter-crop. */
  onEnterCrop?: () => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
}

export function ImageDragOverlay({
  image, otherImages, extraSnapBboxes, canvasWidth, canvasHeight, selected, resizable = selected, zIndex, onSelect, onDeselect, onChange, onGuidesChange, onEditStart, onEditEnd, onBeginDrag, onMoveBy, onEndDrag, onEnterCrop, onDelete, onDuplicate,
}: ImageDragOverlayProps) {
  const [dragging, setDragging] = useState<DragMode>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const startRef = useRef({ mx: 0, my: 0, x: 0, y: 0, w: 0, h: 0 });

  const imgW = canvasWidth * image.width;
  const imgH = canvasHeight * image.height;
  const imgLeft = image.x * canvasWidth - imgW / 2;
  const imgTop = image.y * canvasHeight - imgH / 2;

  const handleSize = 24;

  // Clear guides when not dragging
  useEffect(() => {
    if (!dragging) {
      onGuidesChange?.({ x: null, y: null });
    }
  }, [dragging, onGuidesChange]);

  const startDrag = useCallback((mode: DragMode, e: React.MouseEvent) => {
    if (image.locked) return;
    e.preventDefault();
    e.stopPropagation();
    setDragging(mode);
    onEditStart?.();
    // Group-drag snapshot — only for move. Resize stays single-element.
    if (mode === "move") onBeginDrag?.(`image:${image.id}`);
    startRef.current = {
      mx: e.clientX,
      my: e.clientY,
      x: image.x,
      y: image.y,
      w: image.width,
      h: image.height,
    };
  }, [image.id, image.x, image.y, image.width, image.height, image.locked, onEditStart, onBeginDrag]);

  // Click on overlay background = deselect
  const handleBgClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget && selected) onDeselect();
  }, [selected, onDeselect]);

  // Window-level deselect: click outside the image bbox while selected
  useEffect(() => {
    if (!selected) return;
    const handleWindowMouseDown = (e: MouseEvent) => {
      const rect = overlayRef.current?.getBoundingClientRect();
      if (!rect) return;
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      // Outside canvas entirely — leave selection alone (user clicked sidebar)
      if (px < 0 || py < 0 || px > rect.width || py > rect.height) return;
      // Inside canvas: deselect if outside the image bbox + handle margin
      const margin = handleSize;
      const insideBbox =
        px >= imgLeft - margin && px <= imgLeft + imgW + margin &&
        py >= imgTop - margin && py <= imgTop + imgH + margin;
      if (!insideBbox) onDeselect();
    };
    window.addEventListener("mousedown", handleWindowMouseDown);
    return () => window.removeEventListener("mousedown", handleWindowMouseDown);
  }, [selected, imgLeft, imgTop, imgW, imgH, handleSize, onDeselect]);

  // Right-click on the image selects it (if not already) and then lets the
  // event bubble up to the page-level context menu. We don't prevent default
  // — the unified menu in page.tsx handles the actual menu UI.
  const handleContextMenu = useCallback((_e: React.MouseEvent) => {
    if (!selected) onSelect();
  }, [selected, onSelect]);

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

        // Build snap targets from other images' edges/center + any extra
        // bboxes passed in (e.g. text layers). Shared util handles edge-to-edge
        // alignment, not just center-to-center.
        const otherBboxes: Bbox[] = [
          ...(otherImages || []).map((o) => ({
            x: o.x, y: o.y, width: o.width, height: o.height,
          })),
          ...(extraSnapBboxes || []),
        ];
        const targets = computeSnapTargets(otherBboxes);
        const result = snapBbox(
          { x: rawX, y: rawY, width: image.width, height: image.height },
          targets,
        );
        onGuidesChange?.({ x: result.guideX, y: result.guideY });

        // Emit delta from the pre-drag position; host applies it to all
        // selected elements (so group-drag works).
        const newX = Math.max(0, Math.min(1, result.cx));
        const newY = Math.max(0, Math.min(1, result.cy));
        onMoveBy?.(newX - startRef.current.x, newY - startRef.current.y);
        return;
      }

      // ── Resize — Photoshop-style: the OPPOSITE corner stays exactly fixed
      //    while the dragged corner follows the cursor. Modifiers:
      //      Shift → lock aspect to the original ratio
      //      Alt   → scale from CENTER instead of opposite corner
      //      Shift + Alt → both
      const { x: sx, y: sy, w: sw, h: sh } = startRef.current;
      const isW = dragging === "nw" || dragging === "sw";
      const isN = dragging === "nw" || dragging === "ne";

      const fromCenter = e.altKey;
      const lockAspect = e.shiftKey;

      // Fixed point is the OPPOSITE corner (default) or the CENTER (Alt).
      const fixedX = fromCenter ? sx : (isW ? sx + sw / 2 : sx - sw / 2);
      const fixedY = fromCenter ? sy : (isN ? sy + sh / 2 : sy - sh / 2);
      const draggedStartX = isW ? sx - sw / 2 : sx + sw / 2;
      const draggedStartY = isN ? sy - sh / 2 : sy + sh / 2;

      let newDraggedX = draggedStartX + dx;
      let newDraggedY = draggedStartY + dy;

      if (lockAspect) {
        // Pick the dominant axis (largest proportional change) and project
        // the other dimension onto the original aspect ratio.
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

      const MIN = 0.05;
      if (isW) newDraggedX = Math.max(0, Math.min(fixedX - MIN, newDraggedX));
      else     newDraggedX = Math.min(1, Math.max(fixedX + MIN, newDraggedX));
      if (isN) newDraggedY = Math.max(0, Math.min(fixedY - MIN, newDraggedY));
      else     newDraggedY = Math.min(1, Math.max(fixedY + MIN, newDraggedY));

      // Build bounds — for from-center, mirror across the center.
      let newLeft: number, newRight: number, newTop: number, newBottom: number;
      if (fromCenter) {
        const halfW = Math.abs(newDraggedX - sx);
        const halfH = Math.abs(newDraggedY - sy);
        newLeft = sx - halfW;
        newRight = sx + halfW;
        newTop = sy - halfH;
        newBottom = sy + halfH;
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
        ...image,
        x: Math.round(newX * 1000) / 1000,
        y: Math.round(newY * 1000) / 1000,
        width: Math.round(newW * 100) / 100,
        height: Math.round(newH * 100) / 100,
      });
    };

    const handleMouseUp = () => {
      const wasMove = dragging === "move";
      setDragging(null);
      onEditEnd?.();
      // Always clear snap guides on release — last drag value would
      // otherwise stay visible on canvas.
      onGuidesChange?.({ x: null, y: null });
      if (wasMove) onEndDrag?.();
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragging, image, onChange, otherImages, extraSnapBboxes, onGuidesChange, onEditEnd, onMoveBy, onEndDrag]);

  const corners: { key: DragMode; cx: number; cy: number; cursor: string }[] = [
    { key: "nw", cx: imgLeft, cy: imgTop, cursor: "nwse-resize" },
    { key: "ne", cx: imgLeft + imgW, cy: imgTop, cursor: "nesw-resize" },
    { key: "sw", cx: imgLeft, cy: imgTop + imgH, cursor: "nesw-resize" },
    { key: "se", cx: imgLeft + imgW, cy: imgTop + imgH, cursor: "nwse-resize" },
  ];

  return (
    <div
      ref={overlayRef}
      onMouseDown={handleBgClick}
      data-canvas-overlay="image"
      style={{
        position: "absolute",
        inset: 0,
        // Container itself must not capture pointer events — otherwise it
        // blocks clicks on other ImageDragOverlay siblings. Only the visible
        // bounding-box and handles below opt back in via pointerEvents: "auto".
        pointerEvents: "none",
        // Track the image's actual layer z so the overlay's bbox sits just
        // above the image (catches clicks) but still below higher-layer text
        // when the user has put text on top of the photo.
        zIndex: (zIndex ?? 10) + (selected ? 1 : 0),
        cursor: selected && !dragging ? "default" : undefined,
      }}
    >
      {/* Image bounding box — always clickable */}
      <div
        data-canvas-element={`image:${image.id}`}
        data-locked={image.locked ? "true" : undefined}
        onMouseDown={(e) => {
          if (e.button === 2) return; // let contextmenu handle right-click
          e.preventDefault();
          e.stopPropagation();
          // Locked images are still selectable on click — just no drag.
          if (image.locked) {
            if (!selected) onSelect();
            return;
          }
          if (!selected) onSelect();
          startDrag("move", e);
        }}
        onContextMenu={handleContextMenu}
        onDoubleClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onEnterCrop?.();
        }}
        style={{
          position: "absolute",
          left: imgLeft,
          top: imgTop,
          width: imgW,
          height: imgH,
          cursor: image.locked ? "default" : selected ? (dragging === "move" ? "grabbing" : "grab") : "pointer",
          // Outline (not border) — outline doesn't affect layout, sits OUTSIDE
          // the box, and accepts dashed style. Solid for single-select (the
          // resize-handle case), dashed for multi-select to match text.
          outline: selected
            ? resizable
              ? "3px solid #FF6B00"
              : "4px dashed #FF6B00"
            : "none",
          outlineOffset: selected ? 4 : 0,
          boxShadow: selected && !resizable ? "0 0 0 2px rgba(255, 107, 0, 0.25)" : "none",
          borderRadius: `${((image.cornerRadius ?? (image.shape === "circle" ? 50 : 4)) / 100) * Math.min(imgW, imgH)}px`,
          pointerEvents: "auto",
          boxSizing: "border-box",
          transition: dragging ? "none" : "outline 0.15s ease, box-shadow 0.15s ease",
        }}
      />

      {/* Corner resize handles — only when this image is the sole selection */}
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
            background: "#FF0028",
            border: "2px solid rgba(255, 255, 255, 0.9)",
            borderRadius: 3,
            cursor,
            pointerEvents: "auto",
            zIndex: 11,
          }}
        />
      ))}

    </div>
  );
}
