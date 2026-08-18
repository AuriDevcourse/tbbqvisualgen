"use client";

import { useCallback, useMemo } from "react";
import { readSharedLibrary, saveHidden, useSharedLibrary } from "@/lib/sharedEditorLibrary";

/**
 * Which built-in presets the team has "deleted" from the Templates list. We
 * can't remove entries from the source file via the UI, so we hide them via a
 * shared id list (localStorage until 2026-08-18).
 *
 * Shared means hiding is a team-wide action: the footer's "restore hidden"
 * brings them back for everyone.
 */
export function useHiddenPresets() {
  const { hidden: hiddenList } = useSharedLibrary();
  const hidden = useMemo(() => new Set(hiddenList), [hiddenList]);

  const hide = useCallback((id: string) => {
    const current = readSharedLibrary().hidden;
    if (current.includes(id)) return;
    saveHidden([...current, id]);
  }, []);

  const restoreAll = useCallback(() => {
    saveHidden([]);
  }, []);

  const isHidden = useCallback((id: string) => hidden.has(id), [hidden]);

  return { hidden, hide, restoreAll, isHidden };
}
