"use client";

import { useSyncExternalStore } from "react";
import { toast } from "sonner";
import type { Preset } from "@/data/presets";
import type { PresetOverride, SavedTemplate } from "@/types/sharedLibrary";

/**
 * The editor's Templates state, shared across the whole TechBBQ team.
 *
 * One external store rather than a React context, so the five hooks that used
 * to read localStorage (useUserPresets, useTemplates, usePresetOverrides,
 * useHiddenPresets, useFolderOrder) keep their exact signatures and no call
 * site in editor/page.tsx had to change. It also means ONE fetch on mount no
 * matter how many of those hooks are mounted.
 *
 * Writes are optimistic: the UI updates immediately, the request goes out in
 * the background. On failure we refetch instead of restoring a snapshot —
 * restoring would silently undo whatever else changed in the meantime, and the
 * server is the only thing that actually knows the shared truth.
 */
export interface SharedLibraryState {
  /** False until the first GET resolves. Nothing is written before then, so a
   *  slow network can't make an empty list overwrite the team's presets. */
  hydrated: boolean;
  /** Signed in with an @techbbq.org account, so saves will be accepted. */
  canWrite: boolean;
  presets: Preset[];
  templates: SavedTemplate[];
  overrides: Record<string, PresetOverride>;
  hidden: string[];
  folderOrder: string[];
}

const EMPTY: SharedLibraryState = {
  hydrated: false,
  canWrite: false,
  presets: [],
  templates: [],
  overrides: {},
  hidden: [],
  folderOrder: [],
};

let state: SharedLibraryState = EMPTY;
const listeners = new Set<() => void>();

function setState(next: SharedLibraryState) {
  state = next;
  for (const l of listeners) l();
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  ensureLoaded();
  return () => listeners.delete(cb);
}

const getSnapshot = () => state;
/** Server render sees the empty (un-hydrated) state — same as the old
 *  localStorage hooks did, so markup matches on first paint. */
const getServerSnapshot = () => EMPTY;

/**
 * Template thumbnails, keyed by id. They come from a separate endpoint because
 * inlining ~90KB of base64 per template into the main library read would make
 * the editor's first paint download megabytes. Cached at module level so a
 * focus refresh doesn't blank the previews it already has.
 */
const thumbnails = new Map<string, string>();

function withThumbnails(templates: SavedTemplate[]): SavedTemplate[] {
  return templates.map((t) => {
    const thumb = t.thumbnail ?? thumbnails.get(t.id);
    return thumb ? { ...t, thumbnail: thumb } : t;
  });
}

let loadPromise: Promise<void> | null = null;

function ensureLoaded(): Promise<void> {
  loadPromise ??= refresh();
  return loadPromise;
}

/** Pull the shared library from the server and replace local state with it. */
export async function refresh(): Promise<void> {
  try {
    const res = await fetch("/api/editor-library", { cache: "no-store" });
    if (!res.ok) {
      const msg = (await res.json().catch(() => ({}))).error ?? `HTTP ${res.status}`;
      throw new Error(msg);
    }
    const json = await res.json();
    setState({
      hydrated: true,
      canWrite: Boolean(json.canWrite),
      presets: Array.isArray(json.presets) ? (json.presets as Preset[]) : [],
      templates: withThumbnails(Array.isArray(json.templates) ? (json.templates as SavedTemplate[]) : []),
      overrides: json.overrides && typeof json.overrides === "object" ? (json.overrides as Record<string, PresetOverride>) : {},
      hidden: Array.isArray(json.hiddenPresets) ? (json.hiddenPresets as string[]) : [],
      folderOrder: Array.isArray(json.folderOrder) ? (json.folderOrder as string[]) : [],
    });
    if (json.truncated) {
      toast.warning("Showing the 500 most recent shared templates — older ones are hidden");
    }
    void loadThumbnails();
  } catch (e) {
    // Mark hydrated anyway: the editor stays usable with built-in presets, and
    // a permanent un-hydrated state would silently disable every save button.
    setState({ ...state, hydrated: true });
    console.error("[shared-library] load failed", e);
    toast.error("Could not load the team's templates — showing built-ins only");
  }
}

/** Pull previews in the background and fill them into the already-rendered
 *  cards. Fails quietly: a missing thumbnail renders as "No preview", which is
 *  not worth a toast. */
async function loadThumbnails(): Promise<void> {
  // Nothing missing means nothing to fetch — keeps the focus refresh from
  // re-downloading every preview each time the tab is activated.
  if (state.templates.every((t) => t.thumbnail || thumbnails.has(t.id))) return;
  try {
    const res = await fetch("/api/editor-library/thumbnails", { cache: "no-store" });
    if (!res.ok) return;
    const json = await res.json();
    const map = json.thumbnails;
    if (!map || typeof map !== "object") return;
    let changed = false;
    for (const [id, value] of Object.entries(map as Record<string, unknown>)) {
      if (typeof value === "string" && thumbnails.get(id) !== value) {
        thumbnails.set(id, value);
        changed = true;
      }
    }
    if (changed) setState({ ...state, templates: withThumbnails(state.templates) });
  } catch (e) {
    console.error("[shared-library] thumbnails failed", e);
  }
}

/** Re-read when the tab regains focus, so a teammate's save shows up without
 *  a reload. Registered once, on the client only. */
if (typeof window !== "undefined") {
  window.addEventListener("focus", () => {
    if (state.hydrated) void refresh();
  });
}

export function useSharedLibrary(): SharedLibraryState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

type ItemKind = "preset" | "template" | "override";

/** Apply an optimistic local change, then persist it. On failure, refetch.
 *
 *  /editor is open to anyone but writes need an @techbbq.org session, so check
 *  that up front. Without this an anonymous visitor sees the preset appear, get
 *  a 401 toast, then vanish on the next refresh — worse than being told plainly
 *  that saving needs a sign-in. */
function commit(optimistic: SharedLibraryState, send: () => Promise<Response>, what: string): void {
  if (!state.canWrite) {
    toast.error("Sign in with your TechBBQ account to save templates for the team");
    return;
  }
  setState(optimistic);
  void (async () => {
    try {
      const res = await send();
      if (!res.ok) {
        const msg = (await res.json().catch(() => ({}))).error ?? `HTTP ${res.status}`;
        throw new Error(msg);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`${what} was not saved for the team: ${msg}`);
      await refresh();
    }
  })();
}

function putItem(id: string, kind: ItemKind, data: unknown, optimistic: SharedLibraryState, what: string): void {
  commit(optimistic, () =>
    fetch(`/api/editor-library/items/${encodeURIComponent(id)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, data }),
    }), what);
}

function deleteItem(id: string, optimistic: SharedLibraryState, what: string): void {
  commit(optimistic, () =>
    fetch(`/api/editor-library/items/${encodeURIComponent(id)}`, { method: "DELETE" }), what);
}

function putSetting(key: "hiddenPresets" | "folderOrder", data: string[], optimistic: SharedLibraryState, what: string): void {
  commit(optimistic, () =>
    fetch(`/api/editor-library/settings/${key}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data }),
    }), what);
}

// ---- Mutations. Each takes the whole next value for its slice, computes the
// optimistic state, and fires the matching request. ----

export function savePresetItem(preset: Preset, label = "Preset"): void {
  const others = state.presets.filter((p) => p.id !== preset.id);
  putItem(preset.id, "preset", preset, { ...state, presets: [preset, ...others] }, label);
}

export function deletePresetItem(id: string): void {
  deleteItem(id, { ...state, presets: state.presets.filter((p) => p.id !== id) }, "Preset deletion");
}

export function saveTemplateItem(template: SavedTemplate, label = "Template"): void {
  if (template.thumbnail) thumbnails.set(template.id, template.thumbnail);
  const others = state.templates.filter((t) => t.id !== template.id);
  putItem(template.id, "template", template, { ...state, templates: [template, ...others] }, label);
}

export function deleteTemplateItem(id: string): void {
  thumbnails.delete(id);
  deleteItem(id, { ...state, templates: state.templates.filter((t) => t.id !== id) }, "Template deletion");
}

/** Write a built-in preset's override block. An empty block means "no
 *  customisation left" — delete the row so the built-in reads as pristine. */
export function saveOverrideItem(id: string, override: PresetOverride | null): void {
  const next = { ...state.overrides };
  const empty = !override || (!override.name && !override.group && !override.variants);
  if (empty) {
    delete next[id];
    deleteItem(id, { ...state, overrides: next }, "Preset reset");
    return;
  }
  next[id] = override;
  putItem(id, "override", override, { ...state, overrides: next }, "Preset change");
}

export function saveHidden(hidden: string[]): void {
  putSetting("hiddenPresets", hidden, { ...state, hidden }, "Hidden presets");
}

export function saveFolderOrder(folderOrder: string[]): void {
  putSetting("folderOrder", folderOrder, { ...state, folderOrder }, "Folder order");
}

/** Current state without subscribing — for callbacks that need to read the
 *  latest slice at call time rather than at render time. */
export function readSharedLibrary(): SharedLibraryState {
  return state;
}
