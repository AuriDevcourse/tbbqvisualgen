"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "tbbqvisualgen.hiddenPresets.v1";

function loadFromStorage(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((v): v is string => typeof v === "string"));
  } catch {
    return new Set();
  }
}

function saveToStorage(ids: Set<string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(ids)));
  } catch {
    // quota exceeded — ignore.
  }
}

/**
 * Track which built-in presets the user has "deleted" from their Templates
 * list. We can't remove entries from the source file via the UI, so we hide
 * them via a localStorage set. Use `isHidden(id)` to filter and `hide(id)`,
 * `restoreAll()` to mutate.
 */
export function useHiddenPresets() {
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  useEffect(() => {
    setHidden(loadFromStorage());
  }, []);

  const hide = useCallback((id: string) => {
    setHidden((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      saveToStorage(next);
      return next;
    });
  }, []);

  const restoreAll = useCallback(() => {
    setHidden(() => {
      const empty = new Set<string>();
      saveToStorage(empty);
      return empty;
    });
  }, []);

  const isHidden = useCallback((id: string) => hidden.has(id), [hidden]);

  return { hidden, hide, restoreAll, isHidden };
}
