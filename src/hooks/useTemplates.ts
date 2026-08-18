"use client";

import { useCallback } from "react";
import { toPng } from "html-to-image";
import {
  deleteTemplateItem,
  readSharedLibrary,
  saveTemplateItem,
  useSharedLibrary,
} from "@/lib/sharedEditorLibrary";
import type { SavedTemplate } from "@/types/sharedLibrary";

export type { SavedTemplate };

/** Thumbnails are stored inline as data URLs, so keep them small — a full-size
 *  PNG per template would blow the 4MB per-row save cap. */
const THUMBNAIL_MAX_PIXEL_RATIO = 0.18;

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

/**
 * Saved templates — shared with the whole team via /api/editor-library.
 * Was localStorage until 2026-08-18, so a template one person saved was
 * invisible to everyone else.
 */
export function useTemplates() {
  const { templates, hydrated } = useSharedLibrary();

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
    saveTemplateItem(t, `Template "${t.name}"`);
    return t;
  }, []);

  const deleteTemplate = useCallback((id: string) => {
    deleteTemplateItem(id);
  }, []);

  const renameTemplate = useCallback((id: string, name: string) => {
    const existing = readSharedLibrary().templates.find((t) => t.id === id);
    if (!existing) return;
    saveTemplateItem({ ...existing, name: name.trim() || "Untitled template" }, "Rename");
  }, []);

  return { templates, hydrated, saveTemplate, deleteTemplate, renameTemplate };
}
