"use client";

import { useCallback } from "react";
import { saveFolderOrder, useSharedLibrary } from "@/lib/sharedEditorLibrary";

/**
 * The team's preferred ordering of preset folders (localStorage until
 * 2026-08-18, now shared). Folders not yet in the stored order are appended at
 * the end, which keeps things stable when a new preset introduces a fresh
 * group. Drag handlers call `setOrder` with the full new sequence.
 */
export function useFolderOrder() {
  const { folderOrder: order } = useSharedLibrary();

  const setOrder = useCallback((next: string[]) => {
    saveFolderOrder(next);
  }, []);

  /** Sort the input folders list by the stored order. Unknown folders go to the
   *  end (stable order amongst themselves). */
  const sortFolders = useCallback((folders: string[]): string[] => {
    const indexed = new Map<string, number>();
    order.forEach((name, idx) => indexed.set(name, idx));
    return [...folders].sort((a, b) => {
      const ia = indexed.has(a) ? indexed.get(a)! : Number.MAX_SAFE_INTEGER;
      const ib = indexed.has(b) ? indexed.get(b)! : Number.MAX_SAFE_INTEGER;
      if (ia !== ib) return ia - ib;
      return 0;
    });
  }, [order]);

  /** Move a folder to a new index. Useful for drag-to-reorder. */
  const moveFolder = useCallback((from: string, toIndex: number, allFolders: string[]) => {
    // Start with the sorted current list so we operate against what the user sees.
    const indexed = new Map<string, number>();
    order.forEach((name, idx) => indexed.set(name, idx));
    const sorted = [...allFolders].sort((a, b) => {
      const ia = indexed.has(a) ? indexed.get(a)! : Number.MAX_SAFE_INTEGER;
      const ib = indexed.has(b) ? indexed.get(b)! : Number.MAX_SAFE_INTEGER;
      return ia - ib;
    });
    const fromIdx = sorted.indexOf(from);
    if (fromIdx < 0) return;
    const next = [...sorted];
    next.splice(fromIdx, 1);
    const clamped = Math.max(0, Math.min(next.length, toIndex));
    next.splice(clamped, 0, from);
    setOrder(next);
  }, [order, setOrder]);

  return { order, setOrder, sortFolders, moveFolder };
}
