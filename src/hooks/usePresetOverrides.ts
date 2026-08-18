"use client";

import { useCallback } from "react";
import type { PresetVariant } from "@/data/presets";
import type { PlatformFormat } from "@/types/template";
import { readSharedLibrary, saveOverrideItem, useSharedLibrary } from "@/lib/sharedEditorLibrary";
import type { PresetOverride } from "@/types/sharedLibrary";

export type { PresetOverride };

/**
 * Customisations layered on top of BUILT-IN presets — renames, folder moves,
 * format variants. Built-ins ship in source so we can't mutate them; this map
 * lives beside them, keyed by preset id, and is shared team-wide (was
 * localStorage until 2026-08-18).
 *
 * An override block that goes fully empty is deleted, so a reset restores the
 * built-in exactly rather than leaving a hollow row behind.
 */
export function usePresetOverrides() {
  const { overrides } = useSharedLibrary();

  /** Read-modify-write one override block, reading latest state at call time. */
  const patch = useCallback((id: string, fn: (o: PresetOverride) => PresetOverride | null) => {
    const existing = readSharedLibrary().overrides[id] ?? {};
    saveOverrideItem(id, fn(existing));
  }, []);

  const setName = useCallback((id: string, name: string) => {
    patch(id, (o) => {
      const trimmed = name.trim();
      const out: PresetOverride = { ...o };
      // Empty rename = clear the name override (restore the original).
      if (!trimmed) delete out.name;
      else out.name = trimmed;
      return out;
    });
  }, [patch]);

  const resetOverride = useCallback((id: string) => {
    saveOverrideItem(id, null);
  }, []);

  const getName = useCallback(
    (id: string, defaultName: string) => overrides[id]?.name ?? defaultName,
    [overrides],
  );

  /** Save a snapshot as a format-specific variant under this preset. */
  const setVariant = useCallback((id: string, format: PlatformFormat, variant: PresetVariant) => {
    patch(id, (o) => ({ ...o, variants: { ...(o.variants ?? {}), [format]: variant } }));
  }, [patch]);

  /** Remove a single format variant override (falls back to preset.variants
   *  or default at load time). */
  const removeVariant = useCallback((id: string, format: PlatformFormat) => {
    patch(id, (o) => {
      if (!o.variants?.[format]) return o;
      const nextVariants = { ...o.variants };
      delete nextVariants[format];
      const out: PresetOverride = { ...o };
      if (Object.keys(nextVariants).length === 0) delete out.variants;
      else out.variants = nextVariants;
      return out;
    });
  }, [patch]);

  /** Set the folder/group of a built-in preset. Empty string clears the
   *  override (preset falls back to its source-defined group). */
  const setGroup = useCallback((id: string, group: string) => {
    patch(id, (o) => {
      const trimmed = group.trim();
      const out: PresetOverride = { ...o };
      if (!trimmed) delete out.group;
      else out.group = trimmed;
      return out;
    });
  }, [patch]);

  /** Resolve a preset's currently-displayed group (factoring in overrides). */
  const getGroup = useCallback(
    (id: string, defaultGroup: string | undefined): string | undefined => overrides[id]?.group ?? defaultGroup,
    [overrides],
  );

  return { overrides, setName, resetOverride, getName, setVariant, removeVariant, setGroup, getGroup };
}
