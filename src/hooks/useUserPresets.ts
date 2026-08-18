"use client";

import { useCallback } from "react";
import type { Preset, PresetVariant } from "@/data/presets";
import type { PlatformFormat } from "@/types/template";
import {
  deletePresetItem,
  readSharedLibrary,
  savePresetItem,
  useSharedLibrary,
} from "@/lib/sharedEditorLibrary";

/**
 * Team-saved presets, stored server-side and shared with everyone (was
 * localStorage until 2026-08-18). Treated as first-class Preset objects so
 * they merge cleanly with the built-in PRESETS list everywhere (Templates
 * modal, Step 1 picker, editing bar).
 *
 * Every mutation is "write this preset's whole current state" — the API is an
 * upsert keyed on the preset id, so a rename and a variant save use the same
 * path and can't half-apply.
 */
export function useUserPresets() {
  const { presets, hydrated } = useSharedLibrary();

  /** Read-modify-write one preset. Reads from the store at call time, not from
   *  render-time props, so two quick edits don't clobber each other. */
  const patch = useCallback((id: string, fn: (p: Preset) => Preset, label: string) => {
    const existing = readSharedLibrary().presets.find((p) => p.id === id);
    if (!existing) return;
    savePresetItem(fn(existing), label);
  }, []);

  const add = useCallback((preset: Preset): Preset => {
    savePresetItem(preset, `Preset "${preset.name}"`);
    return preset;
  }, []);

  const remove = useCallback((id: string) => {
    deletePresetItem(id);
  }, []);

  const updateName = useCallback((id: string, name: string) => {
    patch(id, (p) => ({ ...p, name: name.trim() || p.name }), "Rename");
  }, [patch]);

  /** Change the folder/group of a team preset. Empty string clears the field
   *  so the preset falls back to "My presets". */
  const updateGroup = useCallback((id: string, group: string) => {
    patch(id, (p) => {
      const trimmed = group.trim();
      const out: Preset = { ...p };
      if (trimmed) out.group = trimmed;
      else delete out.group;
      return out;
    }, "Folder move");
  }, [patch]);

  const setVariant = useCallback((id: string, format: PlatformFormat, variant: PresetVariant) => {
    patch(id, (p) => ({ ...p, variants: { ...(p.variants ?? {}), [format]: variant } }), "Variant");
  }, [patch]);

  const removeVariant = useCallback((id: string, format: PlatformFormat) => {
    patch(id, (p) => {
      if (!p.variants?.[format]) return p;
      const nextVariants = { ...p.variants };
      delete nextVariants[format];
      const out: Preset = { ...p };
      if (Object.keys(nextVariants).length === 0) delete out.variants;
      else out.variants = nextVariants;
      return out;
    }, "Variant reset");
  }, [patch]);

  const has = useCallback((id: string) => presets.some((p) => p.id === id), [presets]);

  return { presets, hydrated, add, remove, updateName, updateGroup, setVariant, removeVariant, has };
}
