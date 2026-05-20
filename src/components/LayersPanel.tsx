"use client";

import { useState } from "react";
import { Eye, EyeOff, Trash2, GripVertical, Type, ImageIcon, Layers as LayersIcon, Square, ImagePlus, Paintbrush, Lock, Unlock, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DesignConfig } from "@/types/template";
import { BACKGROUND_OPTIONS, reconcileLayerOrder } from "@/types/template";
import type { CanvasImage } from "./ImagePlacer";

interface LayersPanelProps {
  design: DesignConfig;
  setDesign: (next: DesignConfig | ((prev: DesignConfig) => DesignConfig)) => void;
  canvasImages: CanvasImage[];
  setCanvasImages: (next: CanvasImage[]) => void;
  selectedImageId: string | null;
  setSelectedImageId: (id: string | null) => void;
  removeCanvasImage: (id: string) => void;
  /** Optional callback to open the text editor for a given text-element id. */
  onEditText?: (textId: string) => void;
  /** Optional callback fired when the user clicks a shape row — host sets
   *  selection to that shape so its handles + editor panel surface. */
  onSelectShape?: (shapeId: string) => void;
  /** Duplicate a single canvas element (text / image / shape) by layer id. */
  onDuplicateRow?: (layerId: string) => void;
}

type RowType = "background" | "overlay" | "image" | "text" | "shape" | "tbbqLogo";

interface Row {
  id: string;
  type: RowType;
  name: string;
  hidden?: boolean;
  locked?: boolean;
  hasContent: boolean;
  /** Stable layer-stack id used by the reorder system. */
  layerId?: string;
}

export function LayersPanel({
  design, setDesign,
  canvasImages, setCanvasImages,
  selectedImageId, setSelectedImageId,
  removeCanvasImage, onEditText, onSelectShape, onDuplicateRow,
}: LayersPanelProps) {

  // Compute the effective layer stack (bottom → top).
  const defaultStack = [
    "overlay",
    ...canvasImages.map((ci) => `image:${ci.id}`),
    ...(design.shapes ?? []).map((s) => `shape:${s.id}`),
    ...design.texts.map((t) => `text:${t.id}`),
    "tbbqLogo",
  ];
  const stack = reconcileLayerOrder(design.layerOrder, defaultStack);
  const stackTopDown = [...stack].reverse();

  const bgLabel = BACKGROUND_OPTIONS.find((b) => b.id === design.backgroundId)?.label ?? design.backgroundId;

  // Build display rows from the stack order. Only push rows for layers that
  // currently exist (have content).
  const rows: Row[] = [];
  for (const layerId of stackTopDown) {
    if (layerId === "tbbqLogo") {
      rows.push({ id: "tbbqLogo", type: "tbbqLogo", name: "TechBBQ logo", hidden: !design.showLogo, hasContent: true, layerId: "tbbqLogo" });
    } else if (layerId.startsWith("text:")) {
      const textId = layerId.slice("text:".length);
      const t = design.texts.find((tt) => tt.id === textId);
      if (t) {
        const preview = t.content.trim().slice(0, 24) || "Empty text";
        rows.push({ id: t.id, type: "text", name: preview, hidden: t.hidden, locked: t.locked, hasContent: true, layerId });
      }
    } else if (layerId.startsWith("image:")) {
      const imgId = layerId.slice("image:".length);
      const img = canvasImages.find((ci) => ci.id === imgId);
      if (img) {
        rows.push({ id: img.id, type: "image", name: `Photo · ${img.id.slice(-4)}${img.crop ? " (cropped)" : ""}`, locked: img.locked, hasContent: true, layerId });
      }
    } else if (layerId.startsWith("shape:")) {
      const shapeId = layerId.slice("shape:".length);
      const sh = (design.shapes ?? []).find((s) => s.id === shapeId);
      if (sh) {
        const labelTitle = sh.type[0].toUpperCase() + sh.type.slice(1);
        rows.push({ id: sh.id, type: "shape", name: `${labelTitle} · ${sh.id.slice(-4)}`, hidden: sh.hidden, locked: sh.locked, hasContent: true, layerId });
      }
    } else if (layerId === "overlay") {
      if (design.overlayColor && (design.overlayOpacity ?? 0) > 0) {
        rows.push({ id: "overlay", type: "overlay", name: "Color overlay", hidden: design.hideOverlay, hasContent: true, layerId: "overlay" });
      }
    }
  }
  rows.push({ id: "background", type: "background", name: `Background · ${bgLabel}`, hasContent: true });

  // ---- Drag-and-drop reorder ----
  const [draggingLayerId, setDraggingLayerId] = useState<string | null>(null);
  const [dragOverLayerId, setDragOverLayerId] = useState<string | null>(null);
  const [dragOverPos, setDragOverPos] = useState<"above" | "below" | null>(null);

  const moveLayerInDisplay = (draggedId: string, targetId: string, dropAbove: boolean) => {
    if (draggedId === targetId) return;
    const display = [...stackTopDown];
    const filtered = display.filter((id) => id !== draggedId);
    const targetIdx = filtered.indexOf(targetId);
    if (targetIdx === -1) return;
    const insertAt = dropAbove ? targetIdx : targetIdx + 1;
    filtered.splice(insertAt, 0, draggedId);
    const newStack = [...filtered].reverse();
    setDesign((d) => ({ ...d, layerOrder: newStack }));
  };

  const resetDrag = () => {
    setDraggingLayerId(null);
    setDragOverLayerId(null);
    setDragOverPos(null);
  };

  // ---- Row actions ----
  const toggleLock = (row: Row) => {
    const next = !row.locked;
    if (row.type === "text") {
      setDesign((d) => ({
        ...d,
        texts: d.texts.map((t) => (t.id === row.id ? { ...t, locked: next } : t)),
      }));
    } else if (row.type === "shape") {
      setDesign((d) => ({
        ...d,
        shapes: (d.shapes ?? []).map((s) => (s.id === row.id ? { ...s, locked: next } : s)),
      }));
    } else if (row.type === "image") {
      setCanvasImages(canvasImages.map((ci) => (ci.id === row.id ? { ...ci, locked: next } : ci)));
    }
  };

  const toggleVisibility = (row: Row) => {
    switch (row.type) {
      case "text":
        setDesign((d) => ({
          ...d,
          texts: d.texts.map((t) => (t.id === row.id ? { ...t, hidden: !t.hidden } : t)),
        }));
        return;
      case "shape":
        setDesign((d) => ({
          ...d,
          shapes: (d.shapes ?? []).map((s) => (s.id === row.id ? { ...s, hidden: !s.hidden } : s)),
        }));
        return;
      case "tbbqLogo": setDesign((d) => ({ ...d, showLogo: !(d.showLogo ?? false) })); return;
      case "overlay": setDesign((d) => ({ ...d, hideOverlay: !d.hideOverlay })); return;
    }
  };

  const selectRow = (row: Row) => {
    if (row.type === "image") {
      setSelectedImageId(row.id === selectedImageId ? null : row.id);
      return;
    }
    if (row.type === "shape" && onSelectShape) {
      // Auto-unhide so the user immediately sees what they selected.
      if (row.hidden) {
        setDesign((d) => ({
          ...d,
          shapes: (d.shapes ?? []).map((s) => (s.id === row.id ? { ...s, hidden: false } : s)),
        }));
      }
      onSelectShape(row.id);
      return;
    }
    if (row.type === "text" && onEditText) {
      // Auto-unhide on edit so typing isn't invisible.
      if (row.hidden) {
        setDesign((d) => ({
          ...d,
          texts: d.texts.map((t) => (t.id === row.id ? { ...t, hidden: false } : t)),
        }));
      }
      onEditText(row.id);
    }
  };

  const deleteRow = (row: Row) => {
    switch (row.type) {
      case "image": removeCanvasImage(row.id); return;
      case "text":
        setDesign((d) => ({ ...d, texts: d.texts.filter((t) => t.id !== row.id) }));
        return;
      case "shape":
        setDesign((d) => ({ ...d, shapes: (d.shapes ?? []).filter((s) => s.id !== row.id) }));
        return;
      case "overlay": setDesign((d) => ({ ...d, overlayColor: undefined, overlayOpacity: 0 })); return;
    }
  };

  const iconFor = (type: RowType) => {
    switch (type) {
      case "image": return ImagePlus;
      case "text": return Type;
      case "shape": return Square;
      case "tbbqLogo": return ImageIcon;
      case "overlay": return Paintbrush;
      case "background": return LayersIcon;
      default: return Square;
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      {rows.map((row) => {
        const Icon = iconFor(row.type);
        const isImage = row.type === "image";
        const isSelected = isImage && row.id === selectedImageId;
        const visuallyHidden = row.hidden ?? false;

        const clickable = row.type === "image" || row.type === "text";
        const titleHint = row.type === "image"
          ? "Click to select on canvas · drag to reorder"
          : row.type === "text"
            ? "Click to edit text · drag to reorder"
            : undefined;

        const draggable = !!row.layerId && row.hasContent;
        const isBeingDragged = draggable && draggingLayerId === row.layerId;
        const isDropTarget = draggable && dragOverLayerId === row.layerId && draggingLayerId !== null && draggingLayerId !== row.layerId;

        return (
          <div
            key={row.id}
            onClick={() => clickable && selectRow(row)}
            title={clickable ? titleHint : undefined}
            draggable={draggable}
            onDragStart={(e) => {
              if (!draggable || !row.layerId) return;
              e.dataTransfer.effectAllowed = "move";
              e.dataTransfer.setData("text/plain", row.layerId);
              setDraggingLayerId(row.layerId);
            }}
            onDragOver={(e) => {
              if (!draggable || !row.layerId || !draggingLayerId) return;
              if (draggingLayerId === row.layerId) {
                if (dragOverLayerId !== null) { setDragOverLayerId(null); setDragOverPos(null); }
                return;
              }
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              const rect = e.currentTarget.getBoundingClientRect();
              const midpoint = rect.top + rect.height / 2;
              setDragOverLayerId(row.layerId);
              setDragOverPos(e.clientY < midpoint ? "above" : "below");
            }}
            onDragLeave={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              if (e.clientY < rect.top || e.clientY > rect.bottom || e.clientX < rect.left || e.clientX > rect.right) {
                if (dragOverLayerId === row.layerId) setDragOverLayerId(null);
              }
            }}
            onDrop={(e) => {
              if (!row.layerId || !draggingLayerId) return;
              e.preventDefault();
              moveLayerInDisplay(draggingLayerId, row.layerId, dragOverPos === "above");
              resetDrag();
            }}
            onDragEnd={resetDrag}
            className={cn(
              "relative flex items-center gap-2 px-2 py-1.5 rounded-md border transition-colors group",
              isSelected
                ? "bg-[#FF0028]/15 border-[#FF0028]/40"
                : "bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20",
              isBeingDragged && "opacity-30",
              clickable && "cursor-pointer",
              isDropTarget && dragOverPos === "above" && "before:absolute before:left-0 before:right-0 before:-top-0.5 before:h-0.5 before:bg-[#FF6B00] before:rounded-full before:pointer-events-none",
              isDropTarget && dragOverPos === "below" && "after:absolute after:left-0 after:right-0 after:-bottom-0.5 after:h-0.5 after:bg-[#FF6B00] after:rounded-full after:pointer-events-none",
            )}
          >
            {draggable && (
              <GripVertical className="w-3 h-3 text-white/30 group-hover:text-white/60 shrink-0 cursor-grab active:cursor-grabbing" />
            )}
            <Icon className={cn("w-3.5 h-3.5 shrink-0", visuallyHidden ? "text-white/30" : "text-white/60")} />
            <span className={cn("flex-1 truncate text-[11px]", visuallyHidden ? "text-white/40 line-through" : "text-white/85")}>
              {row.name}
            </span>

            {(row.type === "text" || row.type === "image" || row.type === "shape") && onDuplicateRow && row.layerId && (
              <button
                onClick={(e) => { e.stopPropagation(); onDuplicateRow(row.layerId!); }}
                aria-label="Duplicate layer"
                title="Duplicate layer"
                className="p-0.5 rounded text-white/40 hover:text-white hover:bg-white/10 transition-colors"
              >
                <Copy className="w-3 h-3" />
              </button>
            )}

            {(row.type === "text" || row.type === "image" || row.type === "shape") && (
              <button
                onClick={(e) => { e.stopPropagation(); toggleLock(row); }}
                aria-label={row.locked ? "Unlock layer" : "Lock layer"}
                title={row.locked ? "Unlock layer" : "Lock layer"}
                aria-pressed={row.locked}
                className={cn(
                  "p-0.5 rounded transition-colors",
                  row.locked
                    ? "text-[#FF6B00] bg-[#FF6B00]/10 hover:bg-[#FF6B00]/20"
                    : "text-white/40 hover:text-white hover:bg-white/10",
                )}
              >
                {row.locked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
              </button>
            )}

            {row.type !== "background" && row.type !== "image" && (
              <button
                onClick={(e) => { e.stopPropagation(); toggleVisibility(row); }}
                aria-label={visuallyHidden ? "Show layer" : "Hide layer"}
                title={visuallyHidden ? "Show layer" : "Hide layer"}
                className="p-0.5 rounded text-white/50 hover:text-white hover:bg-white/10 transition-colors"
              >
                {visuallyHidden ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
              </button>
            )}

            {row.type !== "background" && row.type !== "tbbqLogo" && (
              <button
                onClick={(e) => { e.stopPropagation(); deleteRow(row); }}
                aria-label="Delete layer"
                title="Delete this layer"
                className="p-0.5 rounded text-white/40 hover:text-[#FF0028] hover:bg-[#FF0028]/10 transition-colors"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
        );
      })}

      <p className="text-[10px] text-white/30 mt-2">Drag to reorder · top of list = top of canvas stack</p>
    </div>
  );
}
