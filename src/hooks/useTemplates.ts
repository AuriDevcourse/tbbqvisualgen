"use client";

import { useCallback, useEffect, useState } from "react";
import { toPng } from "html-to-image";
import type { DesignConfig, PlatformFormat } from "@/types/template";
import type { CanvasImage } from "@/components/ImagePlacer";

/** A saved template — full document snapshot + a thumbnail dataURL. */
export interface SavedTemplate {
  id: string;
  name: string;
  /** ms since epoch. */
  createdAt: number;
  thumbnail?: string;
  doc: {
    format: PlatformFormat;
    customSize: { width: number; height: number };
    design: DesignConfig;
    canvasImages: CanvasImage[];
  };
}

const STORAGE_KEY = "tbbqvisualgen.templates.v1";
/** Local storage cap is ~5MB per origin. Keep templates trim to fit ~30+. */
const THUMBNAIL_MAX_PIXEL_RATIO = 0.18;

function loadFromStorage(): SavedTemplate[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

function saveToStorage(templates: SavedTemplate[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
  } catch {
    // quota exceeded — ignore. The in-memory copy is still authoritative
    // for this session.
  }
}

/**
 * Capture a small PNG of the canvas (whatever is inside `node`) for use as a
 * template thumbnail. Fails-soft: returns undefined if capture errors.
 */
async function captureThumbnail(node: HTMLElement | null): Promise<string | undefined> {
  if (!node) return undefined;
  try {
    await document.fonts.ready;
    return await toPng(node, {
      width: node.offsetWidth,
      height: node.offsetHeight,
      pixelRatio: THUMBNAIL_MAX_PIXEL_RATIO,
      cacheBust: true,
    });
  } catch {
    return undefined;
  }
}

export function useTemplates() {
  const [templates, setTemplates] = useState<SavedTemplate[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setTemplates(loadFromStorage());
    setHydrated(true);
  }, []);

  const saveTemplate = useCallback(async (params: {
    name: string;
    doc: SavedTemplate["doc"];
    thumbnailNode?: HTMLElement | null;
  }): Promise<SavedTemplate> => {
    const thumbnail = await captureThumbnail(params.thumbnailNode ?? null);
    const t: SavedTemplate = {
      id: `tmpl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: params.name.trim() || "Untitled template",
      createdAt: Date.now(),
      thumbnail,
      doc: params.doc,
    };
    setTemplates((prev) => {
      const next = [t, ...prev];
      saveToStorage(next);
      return next;
    });
    return t;
  }, []);

  const deleteTemplate = useCallback((id: string) => {
    setTemplates((prev) => {
      const next = prev.filter((t) => t.id !== id);
      saveToStorage(next);
      return next;
    });
  }, []);

  const renameTemplate = useCallback((id: string, name: string) => {
    setTemplates((prev) => {
      const next = prev.map((t) => (t.id === id ? { ...t, name: name.trim() || "Untitled template" } : t));
      saveToStorage(next);
      return next;
    });
  }, []);

  return { templates, hydrated, saveTemplate, deleteTemplate, renameTemplate };
}
