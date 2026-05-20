"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "tbbqvisualgen.folderOrder.v1";

function loadFromStorage(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is string => typeof v === "string");
  } catch {
    return [];
  }
}

function saveToStorage(order: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(order));
  } catch {
    /* quota — ignore */
  }
}

/**
 * Track the user's preferred ordering of preset folders. New folders not
 * yet in the stored order are appended at the end (preserves stability when
 * a new built-in preset introduces a fresh group). Drag handlers in the UI
 * call `setOrder` with the full new sequence.
 */
export function useFolderOrder() {
  const [order, setOrderState] = useState<string[]>([]);

  useEffect(() => {
    setOrderState(loadFromStorage());
  }, []);

  const setOrder = useCallback((next: string[]) => {
    setOrderState(next);
    saveToStorage(next);
  }, []);

  /** Sort the input folders list by the stored order. Unknown folders go
   *  to the end (stable order amongst themselves). */
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
    // Start with sorted current list so we operate against what the user sees.
    const sorted = (() => {
      const indexed = new Map<string, number>();
      order.forEach((name, idx) => indexed.set(name, idx));
      return [...allFolders].sort((a, b) => {
        const ia = indexed.has(a) ? indexed.get(a)! : Number.MAX_SAFE_INTEGER;
        const ib = indexed.has(b) ? indexed.get(b)! : Number.MAX_SAFE_INTEGER;
        return ia - ib;
      });
    })();
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
