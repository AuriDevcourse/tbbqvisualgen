"use client";

import { useCallback, useRef, useState, useEffect } from "react";
import type { CanvasImage } from "./ImagePlacer";

type DragMode = "move" | "nw" | "ne" | "sw" | "se" | null;

interface ImageDragOverlayProps {
  image: CanvasImage;
  otherImages?: CanvasImage[];
  canvasWidth: number;
  canvasHeight: number;
  selected: boolean;
  onSelect: () => void;
  onDeselect: () => void;
  onChange: (image: CanvasImage) => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
}

// Snap configuration — center + thirds + other images
const SNAP_THRESHOLD = 0.013;
const GUIDE_TARGETS = [0.333, 0.5, 0.667];

function snapAxis(val: number, extraTargets: number[] = []): { value: number; guide: number | null } {
  const allTargets = [...GUIDE_TARGETS, ...extraTargets];
  for (const t of allTargets) {
    if (Math.abs(val - t) < SNAP_THRESHOLD) {
      return { value: t, guide: t };
    }
  }
  return { value: val, guide: null };
}

export function ImageDragOverlay({
  image, otherImages, canvasWidth, canvasHeight, selected, onSelect, onDeselect, onChange, onDelete, onDuplicate,
}: ImageDragOverlayProps) {
  const [dragging, setDragging] = useState<DragMode>(null);
  const [guideX, setGuideX] = useState<number | null>(null);
  const [guideY, setGuideY] = useState<number | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const startRef = useRef({ mx: 0, my: 0, x: 0, y: 0, w: 0, h: 0 });

  const imgW = canvasWidth * image.width;
  const imgH = canvasHeight * image.height;
  const imgLeft = image.x * canvasWidth - imgW / 2;
  const imgTop = image.y * canvasHeight - imgH / 2;

  const handleSize = 24;

  // Snap targets from other images
  const otherSnapX = (otherImages || []).map((img) => img.x);
  const otherSnapY = (otherImages || []).map((img) => img.y);

  // Clear guides when not dragging
  useEffect(() => {
    if (!dragging) {
      setGuideX(null);
      setGuideY(null);
    }
  }, [dragging]);

  // Close context menu on click elsewhere
  useEffect(() => {
    if (!contextMenu) return;
    const handleClick = () => setContextMenu(null);
    window.addEventListener("mousedown", handleClick);
    return () => window.removeEventListener("mousedown", handleClick);
  }, [contextMenu]);

  const startDrag = useCallback((mode: DragMode, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(mode);
    setContextMenu(null);
    startRef.current = {
      mx: e.clientX,
      my: e.clientY,
      x: image.x,
      y: image.y,
      w: image.width,
      h: image.height,
    };
  }, [image.x, image.y, image.width, image.height]);

  // Click on overlay background = deselect
  const handleBgClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget && selected) {
      onDeselect();
      setContextMenu(null);
    }
  }, [selected, onDeselect]);

  // Right-click context menu
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!selected) onSelect();
    const rect = overlayRef.current?.getBoundingClientRect();
    if (rect) {
      setContextMenu({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    }
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

        const sx = snapAxis(rawX, otherSnapX);
        const sy = snapAxis(rawY, otherSnapY);
        setGuideX(sx.guide);
        setGuideY(sy.guide);

        onChange({
          ...image,
          x: Math.max(0, Math.min(1, sx.value)),
          y: Math.max(0, Math.min(1, sy.value)),
        });
        return;
      }

      // Resize — opposite corner stays fixed
      const { x: sx, y: sy, w: sw, h: sh } = startRef.current;
      let newW = sw, newH = sh, newX = sx, newY = sy;

      if (dragging === "se") {
        newW = sw + dx; newH = sh + dy; newX = sx + dx / 2; newY = sy + dy / 2;
      } else if (dragging === "sw") {
        newW = sw - dx; newH = sh + dy; newX = sx + dx / 2; newY = sy + dy / 2;
      } else if (dragging === "ne") {
        newW = sw + dx; newH = sh - dy; newX = sx + dx / 2; newY = sy + dy / 2;
      } else if (dragging === "nw") {
        newW = sw - dx; newH = sh - dy; newX = sx + dx / 2; newY = sy + dy / 2;
      }

      newW = Math.max(0.05, Math.min(0.95, newW));
      newH = Math.max(0.05, Math.min(0.95, newH));
      newX = Math.max(0, Math.min(1, newX));
      newY = Math.max(0, Math.min(1, newY));

      setGuideX(null);
      setGuideY(null);

      onChange({
        ...image,
        x: Math.round(newX * 1000) / 1000,
        y: Math.round(newY * 1000) / 1000,
        width: Math.round(newW * 100) / 100,
        height: Math.round(newH * 100) / 100,
      });
    };

    const handleMouseUp = () => setDragging(null);

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragging, image, onChange, otherSnapX, otherSnapY]);

  const corners: { key: DragMode; cx: number; cy: number; cursor: string }[] = [
    { key: "nw", cx: imgLeft, cy: imgTop, cursor: "nwse-resize" },
    { key: "ne", cx: imgLeft + imgW, cy: imgTop, cursor: "nesw-resize" },
    { key: "sw", cx: imgLeft, cy: imgTop + imgH, cursor: "nesw-resize" },
    { key: "se", cx: imgLeft + imgW, cy: imgTop + imgH, cursor: "nwse-resize" },
  ];

  // Guide line style — distinguish canvas guides from image-snap guides
  const guideStyle = (pos: number): React.CSSProperties => {
    const isCanvasGuide = GUIDE_TARGETS.includes(pos);
    const isCenter = pos === 0.5;
    return {
      pointerEvents: "none",
      zIndex: 12,
      position: "absolute",
      background: isCanvasGuide
        ? (isCenter ? "rgba(255, 0, 120, 0.7)" : "rgba(255, 0, 120, 0.35)")
        : "rgba(0, 180, 255, 0.6)", // blue for image-to-image snap
    };
  };

  return (
    <div
      ref={overlayRef}
      onMouseDown={handleBgClick}
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 10,
        pointerEvents: selected ? "auto" : "none",
        cursor: selected && !dragging ? "default" : undefined,
      }}
    >
      {/* Vertical snap guide */}
      {guideX !== null && (
        <div style={{
          ...guideStyle(guideX),
          left: Math.round(canvasWidth * guideX) - 1,
          top: 0,
          width: 2,
          height: canvasHeight,
        }} />
      )}

      {/* Horizontal snap guide */}
      {guideY !== null && (
        <div style={{
          ...guideStyle(guideY),
          top: Math.round(canvasHeight * guideY) - 1,
          left: 0,
          height: 2,
          width: canvasWidth,
        }} />
      )}

      {/* Image bounding box — always clickable */}
      <div
        onMouseDown={(e) => {
          if (e.button === 2) return; // let contextmenu handle right-click
          e.stopPropagation();
          if (!selected) {
            onSelect();
          } else {
            startDrag("move", e);
          }
        }}
        onContextMenu={handleContextMenu}
        style={{
          position: "absolute",
          left: imgLeft,
          top: imgTop,
          width: imgW,
          height: imgH,
          cursor: selected ? (dragging === "move" ? "grabbing" : "grab") : "pointer",
          border: selected ? "2px solid rgba(255, 0, 40, 0.6)" : "none",
          borderRadius: image.shape === "circle" ? "50%" : 16,
          pointerEvents: "auto",
          boxSizing: "border-box",
          transition: dragging ? "none" : "border 0.15s ease",
        }}
      />

      {/* Corner resize handles — only when selected */}
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
            background: "#FF0028",
            border: "2px solid rgba(255, 255, 255, 0.9)",
            borderRadius: 3,
            cursor,
            pointerEvents: "auto",
            zIndex: 11,
          }}
        />
      ))}

      {/* Right-click context menu */}
      {contextMenu && selected && (
        <div
          onMouseDown={(e) => e.stopPropagation()}
          style={{
            position: "absolute",
            left: contextMenu.x,
            top: contextMenu.y,
            zIndex: 20,
            background: "rgba(0, 0, 0, 0.85)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(255, 255, 255, 0.15)",
            borderRadius: 8,
            padding: 4,
            minWidth: 140,
          }}
        >
          {onDuplicate && (
            <button
              onClick={() => { onDuplicate(); setContextMenu(null); }}
              style={{
                display: "block",
                width: "100%",
                padding: "6px 12px",
                background: "none",
                border: "none",
                color: "rgba(255, 255, 255, 0.8)",
                fontSize: 13,
                textAlign: "left",
                cursor: "pointer",
                borderRadius: 4,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
            >
              Duplicate
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => { onDelete(); setContextMenu(null); }}
              style={{
                display: "block",
                width: "100%",
                padding: "6px 12px",
                background: "none",
                border: "none",
                color: "rgba(255, 80, 80, 0.9)",
                fontSize: 13,
                textAlign: "left",
                cursor: "pointer",
                borderRadius: 4,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255, 0, 40, 0.15)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
            >
              Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
}
