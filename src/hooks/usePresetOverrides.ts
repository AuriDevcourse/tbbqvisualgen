"use client";

import { useCallback, useEffect, useState } from "react";
import type { PresetVariant } from "@/data/presets";
import type { PlatformFormat } from "@/types/template";

const STORAGE_KEY = "tbbqvisualgen.presetOverrides.v1";

/** Per-preset overrides the user has made via the UI. Built-in presets ship
 *  in code, so we can't mutate them — instead we layer this map on top. */
export interface PresetOverride {
  name?: string;
  /** User-saved format-specific layouts. Layered on top of (and winning over)
   *  the preset's own `variants` map at load time. */
  variants?: Partial<Record<PlatformFormat, PresetVariant>>;
  /** Override for the preset's folder/group. Used when the user moves a
   *  built-in preset to a different folder via the UI. */
  group?: string;
}

type Overrides = Record<string, PresetOverride>;

function loadFromStorage(): Overrides {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed as Overrides;
  } catch {
    return {};
  }
}

function saveToStorage(overrides: Overrides) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
  } catch {
    // quota exceeded — ignore.
  }
}

export function usePresetOverrides() {
  const [overrides, setOverrides] = useState<Overrides>({});

  useEffect(() => {
    setOverrides(loadFromStorage());
  }, []);

  const setName = useCallback((id: string, name: string) => {
    setOverrides((prev) => {
      const trimmed = name.trim();
      const next = { ...prev };
      if (!trimmed) {
        // Empty rename = clear override (restore original).
        if (next[id]) {
          const { name: _omit, ...rest } = next[id];
          if (Object.keys(rest).length === 0) delete next[id];
          else next[id] = rest;
        }
      } else {
        next[id] = { ...(next[id] ?? {}), name: trimmed };
      }
      saveToStorage(next);
      return next;
    });
  }, []);

  const resetOverride = useCallback((id: string) => {
    setOverrides((prev) => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      saveToStorage(next);
      return next;
    });
  }, []);

  const getName = useCallback((id: string, defaultName: string) => {
    return overrides[id]?.name ?? defaultName;
  }, [overrides]);

  /** Save a snapshot as a format-specific variant under this preset. */
  const setVariant = useCallback((id: string, format: PlatformFormat, variant: PresetVariant) => {
    setOverrides((prev) => {
      const existing = prev[id] ?? {};
      const next = {
        ...prev,
        [id]: {
          ...existing,
          variants: { ...(existing.variants ?? {}), [format]: variant },
        },
      };
      saveToStorage(next);
      return next;
    });
  }, []);

  /** Remove a single format variant override (falls back to preset.variants
   *  or default at load time). */
  const removeVariant = useCallback((id: string, format: PlatformFormat) => {
    setOverrides((prev) => {
      const existing = prev[id];
      if (!existing?.variants?.[format]) return prev;
      const nextVariants = { ...existing.variants };
      delete nextVariants[format];
      const nextEntry: PresetOverride = { ...existing };
      if (Object.keys(nextVariants).length === 0) delete nextEntry.variants;
      else nextEntry.variants = nextVariants;
      const next = { ...prev };
      if (!nextEntry.name && !nextEntry.variants) delete next[id];
      else next[id] = nextEntry;
      saveToStorage(next);
      return next;
    });
  }, []);

  /** Set the folder/group of a built-in preset. Empty string clears the
   *  override (preset falls back to its source-defined group). */
  const setGroup = useCallback((id: string, group: string) => {
    setOverrides((prev) => {
      const trimmed = group.trim();
      const existing = prev[id] ?? {};
      const next = { ...prev };
      if (!trimmed) {
        const { group: _drop, ...rest } = existing;
        if (Object.keys(rest).length === 0) delete next[id];
        else next[id] = rest;
      } else {
        next[id] = { ...existing, group: trimmed };
      }
      saveToStorage(next);
      return next;
    });
  }, []);

  /** Resolve a preset's currently-displayed group (factoring in overrides). */
  const getGroup = useCallback((id: string, defaultGroup: string | undefined): string | undefined => {
    return overrides[id]?.group ?? defaultGroup;
  }, [overrides]);

  return { overrides, setName, resetOverride, getName, setVariant, removeVariant, setGroup, getGroup };
}
