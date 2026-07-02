"use client";

import { useEffect, useRef, useState } from "react";
import { X, Plus, Trash2, Check, Save, Pencil, Code, Sparkles, RotateCcw, Star, Folder, GripVertical } from "lucide-react";
import { toast } from "sonner";
import type { SavedTemplate } from "@/hooks/useTemplates";
import type { Preset } from "@/data/presets";
import type { PlatformFormat } from "@/types/template";

const FORMAT_BADGES: Record<PlatformFormat, string> = {
  square: "1:1",
  presentation: "16:9",
  story: "9:16",
  custom: "Custom",
};

function presetFormats(preset: Preset): PlatformFormat[] {
  const set = new Set<PlatformFormat>([preset.format]);
  if (preset.variants) {
    for (const key of Object.keys(preset.variants) as PlatformFormat[]) {
      set.add(key);
    }
  }
  return Array.from(set);
}

interface TemplatesModalProps {
  open: boolean;
  onClose: () => void;
  templates: SavedTemplate[];
  onSave: (name: string) => Promise<void> | void;
  onLoad: (template: SavedTemplate) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, name: string) => void;
  /** Dev convenience — serializes the current doc as a TypeScript Preset
   *  literal and copies to the clipboard. */
  onCopyAsPreset?: (name: string) => string;
  /** Built-in presets shown above the user-saved templates. */
  presets?: Preset[];
  /** Canvas's current format — used to highlight which preset variant will
   *  be loaded if the user clicks. */
  currentFormat?: PlatformFormat;
  /** Load a built-in preset (replaces canvas state). */
  onLoadPreset?: (preset: Preset) => void;
  /** "Delete" a preset — hides it from the list (built-ins can't actually be
   *  deleted from source). */
  onHidePreset?: (id: string) => void;
  /** Restore all hidden presets. Shown in footer when any are hidden. */
  hiddenPresetCount?: number;
  onRestoreHidden?: () => void;
  /** Save the current canvas as a NEW user preset (localStorage). */
  onSaveAsPreset?: (name: string) => void;
  /** Predicate: is this preset a user (localStorage) preset, vs built-in? */
  isUserPreset?: (preset: Preset) => boolean;
  /** Override a built-in preset's display name (stored in localStorage). */
  onRenamePreset?: (id: string, name: string) => void;
  /** Resolve a preset's currently-displayed name (factoring in overrides). */
  presetDisplayName?: (preset: Preset) => string;
  /** Resolve a preset's currently-displayed group (factoring in overrides). */
  presetDisplayGroup?: (preset: Preset) => string;
  /** Move a preset to a different folder (group). Empty group restores
   *  the default folder. */
  onMovePreset?: (id: string, group: string) => void;
  /** Reorder folders. Receives the new sequence. */
  onReorderFolders?: (nextOrder: string[]) => void;
  /** Sort folders into this order before rendering (unknown folders go to
   *  the end). */
  folderOrder?: string[];
  /** Id of the most recently loaded preset (used to label the
   *  "Save back to..." button). */
  currentPresetId?: string | null;
  /** Save the canvas's current doc as a variant under the named preset,
   *  scoped to currentFormat. */
  onSaveVariant?: (presetId: string) => void;
  /** Per-format variant indicators: returns the set of formats this preset
   *  has user-saved (localStorage) variants for. Used to render a small
   *  override dot on format badges. */
  presetCustomVariants?: (preset: Preset) => Set<PlatformFormat>;
  /** Reset a single localStorage variant override for this preset/format. */
  onResetVariant?: (presetId: string, format: PlatformFormat) => void;
}

export function TemplatesModal({
  open, onClose, templates, onSave, onLoad, onDelete, onRename, onCopyAsPreset,
  presets, currentFormat, onLoadPreset, onHidePreset, hiddenPresetCount, onRestoreHidden,
  onRenamePreset, presetDisplayName, onSaveAsPreset, isUserPreset,
  currentPresetId, onSaveVariant, presetCustomVariants, onResetVariant,
  presetDisplayGroup, onMovePreset, onReorderFolders, folderOrder,
}: TemplatesModalProps) {
  const [movingPresetId, setMovingPresetId] = useState<string | null>(null);
  const [newFolderDraft, setNewFolderDraft] = useState("");
  const [draggingFolder, setDraggingFolder] = useState<string | null>(null);
  const [dropTargetFolder, setDropTargetFolder] = useState<string | null>(null);
  const currentPreset = currentPresetId && presets
    ? presets.find((p) => p.id === currentPresetId) ?? null
    : null;
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
  const [presetDraft, setPresetDraft] = useState("");
  const presetEditInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingPresetId && presetEditInputRef.current) {
      presetEditInputRef.current.focus();
      presetEditInputRef.current.select();
    }
  }, [editingPresetId]);

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  const startRename = (t: SavedTemplate) => {
    setEditingId(t.id);
    setEditingDraft(t.name);
  };
  const commitRename = () => {
    if (!editingId) return;
    onRename(editingId, editingDraft);
    setEditingId(null);
  };
  const cancelRename = () => {
    setEditingId(null);
  };

  if (!open) return null;

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await onSave(name.trim() || `Template ${templates.length + 1}`);
      setName("");
      toast.success("Template saved");
    } catch {
      toast.error("Couldn't save template");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center p-6 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative flex flex-col max-h-[80vh] w-full max-w-2xl rounded-2xl border border-white/10 bg-[#15110e]/95 backdrop-blur-2xl shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/10">
          <h2 className="text-sm font-medium text-white/85">
            Templates
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1 rounded text-white/50 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Save current */}
        <div className="px-5 py-3 border-b border-white/10 flex items-center gap-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name this template (optional)"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
            }}
            className="flex-1 bg-white/5 border border-white/10 rounded-md px-3 py-1.5 text-xs text-white placeholder:text-white/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B00]/70 focus:border-[#FF6B00]/40"
          />
          <button
            onClick={handleSave}
            disabled={saving}
            aria-label="Save template"
            title="Save template — stores the current canvas locally (no multi-format variants)"
            className="flex items-center justify-center w-8 h-8 rounded-md bg-white/5 border border-white/10 text-white/80 hover:bg-white/10 hover:text-white transition-colors disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
          </button>
          {onSaveAsPreset && (
            <button
              onClick={() => onSaveAsPreset(name.trim() || `My preset ${templates.length + 1}`)}
              aria-label="Save as preset"
              title="Save as preset — stores locally with multi-format variants"
              className="flex items-center justify-center w-8 h-8 rounded-md bg-gradient-to-r from-[#FF6B00] to-[#FF0028] text-white hover:from-[#FF7A1A] hover:to-[#E00224] transition-all shadow-[0_3px_12px_-4px_rgba(255,0,40,0.5)]"
            >
              <Star className="w-3.5 h-3.5" />
            </button>
          )}
          {onCopyAsPreset && (
            <button
              onClick={async () => {
                const code = onCopyAsPreset(name.trim() || `Preset ${templates.length + 1}`);
                try {
                  await navigator.clipboard.writeText(code);
                  toast.success("Preset code copied — paste into src/data/presets.ts");
                } catch {
                  toast.error("Couldn't copy to clipboard");
                }
              }}
              aria-label="Copy preset code"
              title="Copy preset code — TypeScript to ship this template in the app"
              className="flex items-center justify-center w-8 h-8 rounded-md bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 hover:text-white transition-colors"
            >
              <Code className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Templates list */}
        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
          {/* Presets — grouped by their `group` field (with overrides) into
           *  folders. The resolved group factors in user-side overrides via
           *  `presetDisplayGroup`. */}
          {presets && presets.length > 0 && onLoadPreset && (() => {
            const groupOf = (p: Preset) => {
              const resolved = presetDisplayGroup ? presetDisplayGroup(p) : p.group;
              return resolved || (isUserPreset?.(p) ? "My presets" : "Other");
            };
            const groups = new Map<string, Preset[]>();
            for (const p of presets) {
              const key = groupOf(p);
              const arr = groups.get(key);
              if (arr) arr.push(p);
              else groups.set(key, [p]);
            }
            // Sort folder entries by the saved folderOrder; unknown folders
            // go to the end stably.
            const orderIndex = new Map<string, number>();
            (folderOrder ?? []).forEach((name, i) => orderIndex.set(name, i));
            const sortedEntries = Array.from(groups.entries()).sort(([a], [b]) => {
              const ai = orderIndex.has(a) ? orderIndex.get(a)! : Number.MAX_SAFE_INTEGER;
              const bi = orderIndex.has(b) ? orderIndex.get(b)! : Number.MAX_SAFE_INTEGER;
              return ai - bi;
            });
            const sortedFolderNames = sortedEntries.map(([k]) => k);
            return (
              <section className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-medium text-white/65 uppercase tracking-[0.18em]">
                    Presets ({presets.length})
                  </span>
                  {onReorderFolders && sortedFolderNames.length > 1 && (
                    <span className="text-[9px] text-white/60">Drag folder name to reorder</span>
                  )}
                </div>
                {sortedEntries.map(([groupLabel, items]) => (
                  <div key={groupLabel} className="flex flex-col gap-1.5">
                    <div
                      draggable={!!onReorderFolders}
                      onDragStart={(e) => {
                        if (!onReorderFolders) return;
                        setDraggingFolder(groupLabel);
                        e.dataTransfer.effectAllowed = "move";
                        e.dataTransfer.setData("text/plain", groupLabel);
                      }}
                      onDragOver={(e) => {
                        if (!onReorderFolders || !draggingFolder || draggingFolder === groupLabel) return;
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "move";
                        setDropTargetFolder(groupLabel);
                      }}
                      onDragLeave={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) {
                          if (dropTargetFolder === groupLabel) setDropTargetFolder(null);
                        }
                      }}
                      onDrop={(e) => {
                        if (!onReorderFolders || !draggingFolder) return;
                        e.preventDefault();
                        const fromIdx = sortedFolderNames.indexOf(draggingFolder);
                        const toIdx = sortedFolderNames.indexOf(groupLabel);
                        if (fromIdx < 0 || toIdx < 0) {
                          setDraggingFolder(null);
                          setDropTargetFolder(null);
                          return;
                        }
                        const next = [...sortedFolderNames];
                        next.splice(fromIdx, 1);
                        next.splice(toIdx, 0, draggingFolder);
                        onReorderFolders(next);
                        setDraggingFolder(null);
                        setDropTargetFolder(null);
                      }}
                      onDragEnd={() => { setDraggingFolder(null); setDropTargetFolder(null); }}
                      className={`relative flex items-center gap-2 px-0.5 transition-opacity ${
                        draggingFolder === groupLabel ? "opacity-40" : ""
                      } ${
                        dropTargetFolder === groupLabel
                          ? "before:absolute before:left-0 before:right-0 before:-top-1 before:h-0.5 before:bg-[#FF6B00] before:rounded-full"
                          : ""
                      } ${onReorderFolders ? "cursor-grab active:cursor-grabbing" : ""}`}
                    >
                      {onReorderFolders && (
                        <GripVertical className="w-3 h-3 text-white/60 hover:text-white/60" />
                      )}
                      <span className="text-[9px] font-semibold text-white/55 uppercase tracking-[0.14em]">
                        {groupLabel}
                      </span>
                      <span className="text-[9px] text-white/60">{items.length}</span>
                      <div className="flex-1 h-px bg-white/5" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {items.map((p) => {
                  const builtInFormats = presetFormats(p);
                  const customSet = presetCustomVariants ? presetCustomVariants(p) : new Set<PlatformFormat>();
                  // Merge built-in formats + any custom ones so badges include
                  // user-only saved formats.
                  const formats = Array.from(new Set<PlatformFormat>([...builtInFormats, ...customSet]));
                  const confirming = confirmDeleteId === p.id;
                  const isEditingThis = editingPresetId === p.id;
                  const hasCurrent = currentFormat ? formats.includes(currentFormat) : true;
                  const displayName = presetDisplayName ? presetDisplayName(p) : p.name;
                  const commitPresetRename = () => {
                    if (onRenamePreset) onRenamePreset(p.id, presetDraft);
                    setEditingPresetId(null);
                  };
                  return (
                    <div
                      key={p.id}
                      className="group flex flex-col rounded-lg bg-white/5 border border-white/10 hover:border-[#FF6B00]/40 overflow-hidden transition-colors"
                    >
                      <button
                        onClick={() => { if (!isEditingThis) { onLoadPreset(p); onClose(); } }}
                        disabled={isEditingThis}
                        className="relative aspect-[4/3] w-full bg-gradient-to-br from-[#2a1410]/80 to-[#15110e]/95 flex flex-col items-center justify-center gap-1 px-2"
                      >
                        <Sparkles className="w-5 h-5 text-[#FF6B00] opacity-80" />
                        <p className="text-[11px] font-semibold text-white/85 text-center leading-tight">{displayName}</p>
                        <p className="text-[9px] text-white/45 text-center leading-tight px-2 line-clamp-2">{p.description}</p>
                        {/* Format chips overlaid on thumbnail (top-right) so they're prominent.
                         *  A green dot indicates the format has a user-saved (localStorage)
                         *  variant on top of (or replacing) what ships in source. */}
                        <div className="absolute top-1.5 right-1.5 flex items-center gap-1">
                          {formats.map((f) => {
                            const isCustom = customSet.has(f);
                            return (
                              <span
                                key={f}
                                className={`relative text-[9px] font-mono px-1.5 py-px rounded border backdrop-blur-sm ${
                                  currentFormat === f
                                    ? "border-[#FF6B00]/80 bg-[#FF6B00]/30 text-white"
                                    : "border-white/20 bg-black/40 text-white/70"
                                }`}
                                title={[
                                  currentFormat === f ? `Tuned for current canvas (${FORMAT_BADGES[f]})` : `${FORMAT_BADGES[f]} variant available`,
                                  isCustom ? "Includes your saved customizations" : null,
                                ].filter(Boolean).join(" · ")}
                              >
                                {FORMAT_BADGES[f]}
                                {isCustom && (
                                  <span
                                    className="absolute -top-1 -right-1 w-1.5 h-1.5 rounded-full bg-emerald-400 ring-1 ring-emerald-900/40"
                                    aria-label="Has saved customizations"
                                  />
                                )}
                              </span>
                            );
                          })}
                        </div>
                        {!isEditingThis && (
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <span className="px-2 py-1 rounded-md bg-[#FF0028] text-white text-[11px] font-medium">Load</span>
                          </div>
                        )}
                      </button>
                      <div className="flex items-center gap-1.5 p-2 border-t border-white/5">
                        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                          {isEditingThis ? (
                            <input
                              ref={presetEditInputRef}
                              type="text"
                              value={presetDraft}
                              onChange={(e) => setPresetDraft(e.target.value)}
                              onBlur={commitPresetRename}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") { e.preventDefault(); commitPresetRename(); }
                                else if (e.key === "Escape") { e.preventDefault(); setEditingPresetId(null); }
                              }}
                              maxLength={60}
                              aria-label="Preset name"
                              className="w-full bg-white/10 border border-[#FF6B00]/40 rounded px-1.5 py-0.5 text-[11px] text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B00]/70"
                            />
                          ) : onRenamePreset ? (
                            <button
                              onClick={() => { setEditingPresetId(p.id); setPresetDraft(displayName); }}
                              title="Click to rename"
                              className="text-left w-full group/name"
                            >
                              <p className="text-[11px] text-white/85 truncate flex items-center gap-1">
                                {displayName}
                                <Pencil className="w-2.5 h-2.5 text-white/60 opacity-0 group-hover/name:opacity-100 transition-opacity shrink-0" />
                              </p>
                              <p className={`text-[8.5px] uppercase tracking-wider font-semibold ${isUserPreset?.(p) ? "text-emerald-300/85" : "text-[#FF6B00]/80"}`}>
                                {isUserPreset?.(p) ? "Yours" : "Built-in"}
                              </p>
                            </button>
                          ) : (
                            <>
                              <p className="text-[11px] text-white/85 truncate">{displayName}</p>
                              <p className={`text-[8.5px] uppercase tracking-wider font-semibold ${isUserPreset?.(p) ? "text-emerald-300/85" : "text-[#FF6B00]/80"}`}>
                                {isUserPreset?.(p) ? "Yours" : "Built-in"}
                              </p>
                            </>
                          )}
                        </div>
                        {/* Move-to-folder button + popover. Lists existing
                         *  folder names + lets you type a new one. */}
                        {onMovePreset && !isEditingThis && (
                          <div className="relative">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setMovingPresetId(movingPresetId === p.id ? null : p.id);
                                setNewFolderDraft("");
                              }}
                              aria-label="Move to folder"
                              title="Move to folder"
                              className="p-1 rounded text-white/65 hover:text-white hover:bg-white/10 transition-colors"
                            >
                              <Folder className="w-3.5 h-3.5" />
                            </button>
                            {movingPresetId === p.id && (
                              <>
                                {/* Backdrop closes the popover on outside click. */}
                                <div
                                  className="fixed inset-0 z-[310]"
                                  onClick={() => setMovingPresetId(null)}
                                />
                                <div
                                  onClick={(e) => e.stopPropagation()}
                                  className="absolute right-0 top-full mt-1 z-[311] w-44 rounded-lg border border-white/15 bg-[#15110e]/95 backdrop-blur-xl shadow-2xl p-1 flex flex-col"
                                >
                                  <div className="text-[9px] uppercase tracking-wider text-white/45 px-2 py-1">Move to folder</div>
                                  {Array.from(groups.keys()).map((folderName) => {
                                    const isCurrent = folderName === groupOf(p);
                                    return (
                                      <button
                                        key={folderName}
                                        onClick={() => {
                                          if (!isCurrent) onMovePreset(p.id, folderName);
                                          setMovingPresetId(null);
                                        }}
                                        className={`flex items-center gap-1.5 px-2 py-1 text-[11px] text-left rounded transition-colors ${
                                          isCurrent
                                            ? "bg-[#FF6B00]/15 text-[#FF8A1F]"
                                            : "text-white/80 hover:bg-white/10 hover:text-white"
                                        }`}
                                      >
                                        <Folder className="w-3 h-3 shrink-0" />
                                        <span className="truncate">{folderName}</span>
                                        {isCurrent && <Check className="w-3 h-3 ml-auto" />}
                                      </button>
                                    );
                                  })}
                                  <div className="h-px bg-white/10 my-1" />
                                  <div className="flex items-center gap-1 px-1 py-1">
                                    <Plus className="w-3 h-3 text-white/65 shrink-0" />
                                    <input
                                      type="text"
                                      value={newFolderDraft}
                                      onChange={(e) => setNewFolderDraft(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter" && newFolderDraft.trim()) {
                                          onMovePreset(p.id, newFolderDraft.trim());
                                          setMovingPresetId(null);
                                        } else if (e.key === "Escape") {
                                          setMovingPresetId(null);
                                        }
                                      }}
                                      placeholder="New folder…"
                                      maxLength={40}
                                      autoFocus
                                      className="flex-1 min-w-0 bg-transparent text-[11px] text-white placeholder:text-white/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B00]/70"
                                    />
                                  </div>
                                </div>
                              </>
                            )}
                          </div>
                        )}
                        {onHidePreset && !isEditingThis && (
                          confirming ? (
                            <>
                              <button
                                onClick={() => { onHidePreset(p.id); setConfirmDeleteId(null); }}
                                aria-label="Confirm hide"
                                title="Hide this preset"
                                className="p-1 rounded text-[#FF6677] hover:bg-[#FF0028]/15 transition-colors"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setConfirmDeleteId(null)}
                                aria-label="Cancel"
                                className="p-1 rounded text-white/50 hover:bg-white/10 transition-colors"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => setConfirmDeleteId(p.id)}
                              aria-label="Hide preset"
                              title="Hide this preset"
                              className="p-1 rounded text-white/65 hover:text-[#FF0028] hover:bg-[#FF0028]/10 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  );
                })}
                    </div>
                  </div>
                ))}
              </section>
            );
          })()}

          {/* User-saved templates */}
          <section className="flex flex-col gap-2">
            {templates.length > 0 && (
              <span className="text-[10px] font-medium text-white/65 uppercase tracking-[0.18em]">
                Your templates ({templates.length})
              </span>
            )}
          {templates.length === 0 && (!presets || presets.length === 0) && (
            <div className="text-center text-[12px] text-white/65 py-10">
              No templates saved yet. Build a design, give it a name, hit Save current.
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            {templates.map((t) => {
              const confirming = confirmDeleteId === t.id;
              return (
                <div
                  key={t.id}
                  className="group flex flex-col rounded-lg bg-white/5 border border-white/10 hover:border-[#FF6B00]/30 overflow-hidden transition-colors"
                >
                  {/* Thumbnail */}
                  <button
                    onClick={() => onLoad(t)}
                    className="relative aspect-[4/3] w-full bg-neutral-900/60 overflow-hidden"
                  >
                    {t.thumbnail ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={t.thumbnail}
                        alt={t.name}
                        className="w-full h-full object-cover"
                        draggable={false}
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-[10px] text-white/60">
                        No preview
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="px-2 py-1 rounded-md bg-[#FF0028] text-white text-[11px] font-medium">Load</span>
                    </div>
                  </button>

                  {/* Footer */}
                  <div className="flex items-center gap-1.5 p-2">
                    <div className="flex-1 min-w-0">
                      {editingId === t.id ? (
                        <input
                          ref={editInputRef}
                          type="text"
                          value={editingDraft}
                          onChange={(e) => setEditingDraft(e.target.value)}
                          onBlur={commitRename}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") { e.preventDefault(); commitRename(); }
                            else if (e.key === "Escape") { e.preventDefault(); cancelRename(); }
                          }}
                          maxLength={60}
                          aria-label="Template name"
                          className="w-full bg-white/10 border border-[#FF6B00]/40 rounded px-1.5 py-0.5 text-[11px] text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B00]/70"
                        />
                      ) : (
                        <button
                          onClick={() => startRename(t)}
                          title="Click to rename"
                          className="text-left w-full group/name"
                        >
                          <p className="text-[11px] text-white/85 truncate flex items-center gap-1">
                            {t.name}
                            <Pencil className="w-2.5 h-2.5 text-white/60 opacity-0 group-hover/name:opacity-100 transition-opacity shrink-0" />
                          </p>
                          <p className="text-[9px] text-white/65">{new Date(t.createdAt).toLocaleDateString()}</p>
                        </button>
                      )}
                    </div>
                    {confirming ? (
                      <>
                        <button
                          onClick={() => { onDelete(t.id); setConfirmDeleteId(null); }}
                          aria-label="Confirm delete"
                          className="p-1 rounded text-[#FF6677] hover:bg-[#FF0028]/15 transition-colors"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          aria-label="Cancel delete"
                          className="p-1 rounded text-white/50 hover:bg-white/10 transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteId(t.id)}
                        aria-label="Delete template"
                        className="p-1 rounded text-white/65 hover:text-[#FF0028] hover:bg-[#FF0028]/10 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          </section>
        </div>

        <div className="px-5 py-2 border-t border-white/10 flex items-center justify-between gap-2">
          <span className="text-[10px] text-white/60">
            Saved locally in this browser. Built-in presets hide rather than delete.
          </span>
          {onRestoreHidden && hiddenPresetCount !== undefined && hiddenPresetCount > 0 && (
            <button
              onClick={() => {
                onRestoreHidden();
                toast.success(`Restored ${hiddenPresetCount} hidden preset${hiddenPresetCount === 1 ? "" : "s"}`);
              }}
              className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] text-white/60 hover:text-white hover:bg-white/10 transition-colors"
              title="Show all hidden built-in presets again"
            >
              <RotateCcw className="w-3 h-3" />
              Restore {hiddenPresetCount} hidden
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
