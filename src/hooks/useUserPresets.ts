"use client";

import { useCallback, useEffect, useState } from "react";
import type { Preset, PresetVariant } from "@/data/presets";
import type { PlatformFormat } from "@/types/template";

const STORAGE_KEY = "tbbqvisualgen.userPresets.v1";

function loadFromStorage(): Preset[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as Preset[];
  } catch {
    return [];
  }
}

function saveToStorage(presets: Preset[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
  } catch {
    // quota — drop silently. In-memory copy still authoritative for this
    // session.
  }
}

/**
 * User-saved presets, stored in localStorage. Treated as first-class Preset
 * objects so they merge cleanly with the built-in PRESETS list everywhere
 * (Templates modal, Step 1 picker, editing bar). Mutations (rename, save
 * variant, delete) update localStorage directly — no override layer needed.
 */
export function useUserPresets() {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setPresets(loadFromStorage());
    setHydrated(true);
  }, []);

  const add = useCallback((preset: Preset): Preset => {
    setPresets((prev) => {
      const next = [preset, ...prev];
      saveToStorage(next);
      return next;
    });
    return preset;
  }, []);

  const remove = useCallback((id: string) => {
    setPresets((prev) => {
      const next = prev.filter((p) => p.id !== id);
      saveToStorage(next);
      return next;
    });
  }, []);

  const updateName = useCallback((id: string, name: string) => {
    setPresets((prev) => {
      const next = prev.map((p) => (p.id === id ? { ...p, name: name.trim() || p.name } : p));
      saveToStorage(next);
      return next;
    });
  }, []);

  /** Change the folder/group of a user preset. Empty string clears
   *  the field so the preset falls back to "My presets". */
  const updateGroup = useCallback((id: string, group: string) => {
    setPresets((prev) => {
      const trimmed = group.trim();
      const next = prev.map((p) => {
        if (p.id !== id) return p;
        const out: Preset = { ...p };
        if (trimmed) out.group = trimmed;
        else delete out.group;
        return out;
      });
      saveToStorage(next);
      return next;
    });
  }, []);

  const setVariant = useCallback((id: string, format: PlatformFormat, variant: PresetVariant) => {
    setPresets((prev) => {
      const next = prev.map((p) =>
        p.id === id ? { ...p, variants: { ...(p.variants ?? {}), [format]: variant } } : p,
      );
      saveToStorage(next);
      return next;
    });
  }, []);

  const removeVariant = useCallback((id: string, format: PlatformFormat) => {
    setPresets((prev) => {
      const next = prev.map((p) => {
        if (p.id !== id || !p.variants?.[format]) return p;
        const nextVariants = { ...p.variants };
        delete nextVariants[format];
        const out: Preset = { ...p };
        if (Object.keys(nextVariants).length === 0) delete out.variants;
        else out.variants = nextVariants;
        return out;
      });
      saveToStorage(next);
      return next;
    });
  }, []);

  const has = useCallback((id: string) => presets.some((p) => p.id === id), [presets]);

  return { presets, hydrated, add, remove, updateName, updateGroup, setVariant, removeVariant, has };
}
