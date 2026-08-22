"use client";

import { useRef, useState } from "react";
import { Eye, EyeOff, Trash2, GripVertical, Type, ImageIcon, Layers as LayersIcon, Square, ImagePlus, Paintbrush, Lock, Unlock, Copy, Folder, ChevronDown, ChevronRight, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { SELECTION_COLOR } from "@/lib/selectionStyle";
import type { DesignConfig } from "@/types/template";
import { BACKGROUND_OPTIONS, reconcileLayerOrder, splitImageLayerIds } from "@/types/template";
import type { CanvasImage } from "./ImagePlacer";

interface LayersPanelProps {
  design: DesignConfig;
  setDesign: (next: DesignConfig | ((prev: DesignConfig) => DesignConfig)) => void;
  canvasImages: CanvasImage[];
  setCanvasImages: (next: CanvasImage[]) => void;
  /** `selectedImageId` is gone: it existed only so an image row could toggle
   *  its own selection off, which item 8 removed as an inconsistency. */
  setSelectedImageId: (id: string | null) => void;
  removeCanvasImage: (id: string) => void;
  /** Optional callback to open the text editor for a given text-element id. */
  /** Clicking a text row SELECTS it. It used to open the inline caret, which
   *  put the panel and the canvas on different rules for the same click. */
  onSelectText?: (textId: string) => void;
  /**
   * The whole canvas selection, so a row can show that it is selected.
   *
   * The panel used to receive only `selectedImageId` — a compat shim that
   * returns an id ONLY when exactly one image is selected — and highlighted
   * with `isImage && row.id === selectedImageId`. So selecting a text or a
   * shape lit nothing, and a multi-selection was invisible: the list and the
   * canvas disagreed about what was selected, on a stack where five rows can
   * read "Name Surname". Every row already carries the `layerId` this needs.
   */
  selectedIds?: Set<string>;
  /** Optional callback fired when the user clicks a shape row — host sets
   *  selection to that shape so its handles + editor panel surface. */
  onSelectShape?: (shapeId: string) => void;
  /** Duplicate a single canvas element (text / image / shape) by layer id. */
  onDuplicateRow?: (layerId: string) => void;
  /**
   * Cmd/Ctrl-click a row — TOGGLE this layer in the selection.
   *
   * Wired to the host's `selectWithGroup(id, true)`, the exact call the canvas
   * makes for Shift-click, so the two can't drift: a whole group toggles
   * together and a group never ends up half-selected.
   */
  onToggleLayer?: (layerId: string) => void;
  /** Shift-click a row — replace the selection with this range of layers. */
  onSelectLayerRange?: (layerIds: string[]) => void;
  /**
   * Select EXACTLY this layer, with no expansion to its group.
   *
   * Every other selection path deliberately expands a grouped member to the
   * whole group, which is right on the canvas — you click a shape you can see
   * and get the thing it belongs to. It is wrong for a child row in the tree:
   * once the members are listed individually, clicking one has to select that
   * one, and the PARENT row is how you take the whole group. Figma splits it
   * the same way.
   */
  onSelectLayerExact?: (layerId: string) => void;
  /** Cmd/Ctrl-click a group CHILD — toggle exactly that layer, no expansion.
   *  Without this the toggle contradicted the plain click, which selects just
   *  the child. */
  onToggleLayerExact?: (layerId: string) => void;
}

type RowType = "background" | "overlay" | "image" | "text" | "shape" | "tbbqLogo" | "group";

/**
 * Row-action hit box. 24px is the WCAG 2.2 AA 2.5.8 floor and CLAUDE.md r9
 * makes it a defect rather than a preference — these buttons were 16px, the
 * same call the canvas already made with `HANDLE_HIT_PX = 20`. The icon stays
 * small; only the target grows.
 */
const ACTION_BTN = "flex h-6 w-6 shrink-0 items-center justify-center rounded transition-colors";

/**
 * How much of a text layer's content stands in for its name when the layer
 * has no name of its own.
 *
 * This was 24, chosen when the label had 74px to live in because the row's
 * four always-on buttons ate the rest. Hover-reveal gave the label 182px, at
 * which point the 24-char cut was the ONLY thing still truncating names —
 * "Draft note — do not expo" with room to spare. 48 fills the width the row
 * now has; `truncate` handles anything longer.
 */
const CONTENT_LABEL_CHARS = 48;

interface Row {
  id: string;
  type: RowType;
  /** What the row displays: the user's `name` when set, else `derivedName`. */
  name: string;
  /** The generated label, kept so a cleared rename can fall back to it and so
   *  the rename input can show it as placeholder rather than as content. */
  derivedName?: string;
  /** True when the user has typed a name for this layer. */
  isRenamed?: boolean;
  hidden?: boolean;
  locked?: boolean;
  hasContent: boolean;
  /** Stable layer-stack id used by the reorder system. */
  layerId?: string;
  /** Shared group tag, when this element is in a group. */
  groupId?: string;
  /** Indent level. 0 for a top-level row, 1 for a row inside a group. */
  depth?: number;
  /** Image rows only: the full-bleed photo background. It is a canvas-level
   *  choice managed from the Canvas step, not a layer you stamp copies of. */
  isBackdrop?: boolean;
  /** Group rows only: the member layer ids, and one member to select through. */
  memberLayerIds?: string[];
  firstMember?: Row;
  collapsed?: boolean;
}

export function LayersPanel({
  design, setDesign,
  canvasImages, setCanvasImages,
  setSelectedImageId,
  removeCanvasImage, onSelectText, onSelectShape, onDuplicateRow, selectedIds,
  onToggleLayer, onSelectLayerRange, onSelectLayerExact, onToggleLayerExact,
}: LayersPanelProps) {

  // Compute the effective layer stack (bottom → top).
  const imageIds = splitImageLayerIds(canvasImages);
  const defaultStack = [
    ...imageIds.backdrops,
    "overlay",
    ...imageIds.photos,
    ...(design.shapes ?? []).map((s) => `shape:${s.id}`),
    ...design.texts.map((t) => `text:${t.id}`),
    "tbbqLogo",
  ];
  const stack = reconcileLayerOrder(design.layerOrder, defaultStack);
  const stackTopDown = [...stack].reverse();

  const bgLabel = BACKGROUND_OPTIONS.find((b) => b.id === design.backgroundId)?.label ?? design.backgroundId;

  // Build display rows from the stack order. Only push rows for layers that
  // currently exist (have content).
  const rows: Row[] = [];
  for (const layerId of stackTopDown) {
    if (layerId === "tbbqLogo") {
      rows.push({ id: "tbbqLogo", type: "tbbqLogo", name: "TechBBQ logo", hidden: !design.showLogo, hasContent: true, layerId: "tbbqLogo" });
    } else if (layerId.startsWith("text:")) {
      const textId = layerId.slice("text:".length);
      const t = design.texts.find((tt) => tt.id === textId);
      if (t) {
        const derivedName = t.content.trim().slice(0, CONTENT_LABEL_CHARS) || "Empty text";
        const custom = t.name?.trim();
        rows.push({ id: t.id, type: "text", name: custom || derivedName, derivedName, isRenamed: !!custom, hidden: t.hidden, locked: t.locked, hasContent: true, layerId, groupId: t.groupId });
      }
    } else if (layerId.startsWith("image:")) {
      const imgId = layerId.slice("image:".length);
      const img = canvasImages.find((ci) => ci.id === imgId);
      if (img) {
        // The full-bleed photo background says what it is — people look for it
        // by name when text ends up hidden behind it.
        const derivedName = img.isBackdrop
          ? "Photo background"
          : `Photo · ${img.id.slice(-4)}${img.crop ? " (cropped)" : ""}`;
        const custom = img.name?.trim();
        rows.push({ id: img.id, type: "image", name: custom || derivedName, derivedName, isRenamed: !!custom, hidden: img.hidden, locked: img.locked, isBackdrop: img.isBackdrop, hasContent: true, layerId, groupId: img.groupId });
      }
    } else if (layerId.startsWith("shape:")) {
      const shapeId = layerId.slice("shape:".length);
      const sh = (design.shapes ?? []).find((s) => s.id === shapeId);
      if (sh) {
        const labelTitle = sh.type[0].toUpperCase() + sh.type.slice(1);
        // The investor accents are the one shape set a user goes looking for by
        // name ("move the bubble"), so they say what they are instead of
        // "Circle · a3f9".
        const accent = /^accent\.(\d+)\.(bubble|ring)$/.exec(sh.simpleRole ?? "");
        const derivedName = accent
          ? `Accent ${accent[2]} ${Number(accent[1]) + 1}`
          : `${labelTitle} · ${sh.id.slice(-4)}`;
        const custom = sh.name?.trim();
        rows.push({ id: sh.id, type: "shape", name: custom || derivedName, derivedName, isRenamed: !!custom, hidden: sh.hidden, locked: sh.locked, hasContent: true, layerId, groupId: sh.groupId });
      }
    } else if (layerId === "overlay") {
      if (design.overlayColor && (design.overlayOpacity ?? 0) > 0) {
        rows.push({ id: "overlay", type: "overlay", name: "Color overlay", hidden: design.hideOverlay, hasContent: true, layerId: "overlay" });
      }
    }
  }
  // The background is NOT pushed as a row. It has no layerId, is not
  // draggable, is not clickable, has no controls, and cannot be reordered
  // because it is always behind everything — it was a status line pretending
  // to be a layer, and it scrolled out of view like one, so you could not see
  // which background was set. It lives in the fixed footer now.

  /**
   * Row filter. Matching is on the DISPLAYED name, so it searches the names
   * you chose (item 4) and not only generated labels.
   *
   * Groups: a matching CHILD pulls its parent in as context, a matching PARENT
   * brings all its children, and `collapsedGroupIds` is ignored while
   * filtering — a match must never be hidden inside a collapsed group.
   */
  const [filter, setFilter] = useState("");
  const query = filter.trim().toLowerCase();
  const filtering = query.length > 0;
  const hit = (name: string) => name.toLowerCase().includes(query);

  // ---- Group nesting ----
  const [collapsedGroupIds, setCollapsedGroupIds] = useState<Set<string>>(new Set());

  /**
   * Collapse each run of adjacent same-group rows under one parent row.
   *
   * Runs, not "every row carrying this groupId". `Cmd+G` collects members into
   * one contiguous run in the stack, so a group made in this build is always a
   * single run. Docs saved BEFORE that change can hold a scattered group, and
   * a parent row spanning non-adjacent members would be a lie about paint
   * order — so a stray member renders flat, exactly as it did before, rather
   * than being pulled somewhere it does not sit. Regrouping it fixes it.
   *
   * A run of one is not a group worth a parent row either.
   */
  const displayRows: Row[] = [];
  for (let i = 0; i < rows.length; i++) {
    const gid = rows[i].groupId;
    if (!gid) {
      if (!filtering || hit(rows[i].name)) displayRows.push(rows[i]);
      continue;
    }
    let end = i;
    while (end + 1 < rows.length && rows[end + 1].groupId === gid) end++;
    const run = rows.slice(i, end + 1);
    if (run.length < 2) {
      if (!filtering || hit(rows[i].name)) displayRows.push(rows[i]);
      i = end;
      continue;
    }
    const derivedName = `Group (${run.length})`;
    const custom = design.groupNames?.[gid]?.trim();
    const groupName = custom || derivedName;

    // While filtering, a group is shown if its own name matches (bringing all
    // members) or if any member matches (bringing just those, with the parent
    // as context) — and it is always expanded, so the match is visible.
    const parentHit = filtering && hit(groupName);
    const shownMembers = !filtering ? run : parentHit ? run : run.filter((r) => hit(r.name));
    if (filtering && !parentHit && shownMembers.length === 0) { i = end; continue; }

    const collapsed = !filtering && collapsedGroupIds.has(gid);
    displayRows.push({
      id: gid,
      type: "group",
      name: groupName,
      derivedName,
      isRenamed: !!custom,
      hasContent: true,
      groupId: gid,
      // The whole membership, not just the shown subset: this drives "is the
      // group selected" and "select the group", which must not change with a
      // filter.
      memberLayerIds: run.map((r) => r.layerId).filter((x): x is string => !!x),
      firstMember: run[0],
      collapsed,
    });
    if (!collapsed) for (const member of shownMembers) displayRows.push({ ...member, depth: 1 });
    i = end;
  }

  /** Real content layers. The logo, colour overlay and background are canvas
   *  furniture, not layers you added, and this total is stable regardless of
   *  collapse or filter state. */
  const layerCount = design.texts.length + (design.shapes?.length ?? 0) + canvasImages.length;

  // ---- Drag-and-drop reorder ----
  const [draggingLayerId, setDraggingLayerId] = useState<string | null>(null);
  const [dragOverLayerId, setDragOverLayerId] = useState<string | null>(null);
  const [dragOverPos, setDragOverPos] = useState<"above" | "below" | null>(null);

  /**
   * Which row the pointer is over — the row actions are revealed for that row
   * only.
   *
   * This is React state rather than a CSS `group-hover:` rule on purpose. The
   * point of hover-reveal here is to give the LABEL its width back, and an
   * `opacity-0` button still occupies its box: measured on a 19-row document,
   * the four-button cluster was 88px wide while the label had 74px to live in,
   * so "Name Surname" (80px) clipped. Unmounting the buttons is what actually
   * returns the space; fading them does not.
   */
  const [hoveredLayerId, setHoveredLayerId] = useState<string | null>(null);

  /**
   * Range anchor for Shift-click, i.e. the last row picked with a plain click.
   *
   * Shift in the LIST selects a range; Cmd/Ctrl toggles one row. Note that
   * Shift on the CANVAS toggles instead — that asymmetry is deliberate and is
   * what Figma, Illustrator and every file manager do, because a flat list has
   * an order to range over and a canvas does not.
   *
   * A REF, not state, and that is load-bearing. Nothing in the render reads the
   * anchor, so as state it bought nothing and cost a re-render on every plain
   * click — and that extra render landed in the same batch as the host's
   * selection update and ATE THE FIRST CLICK after every page load. The symptom
   * was "the first layer I click does not select, the second does", which read
   * as flaky selection and was really this.
   */
  const rangeAnchorRef = useRef<string | null>(null);

  // ---- Rename ----
  const [renamingLayerId, setRenamingLayerId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const startRename = (row: Row) => {
    const key = row.layerId ?? (row.type === "group" ? row.id : undefined);
    if (!key) return;
    setRenamingLayerId(key);
    // Seed with the user's own name only. Seeding with the derived label would
    // turn every rename into a delete-this-first chore, and would silently
    // freeze a content preview into a real name the moment you pressed Enter.
    setDraft(row.isRenamed ? row.name : "");
  };

  const cancelRename = () => {
    setRenamingLayerId(null);
    setDraft("");
  };

  /**
   * Commit the draft. An empty draft CLEARS the name rather than storing "",
   * so the row falls back to its derived label — that is the only way back
   * once you have renamed something.
   */
  const commitRename = (row: Row) => {
    const next = draft.trim() || undefined;
    switch (row.type) {
      case "text":
        setDesign((d) => ({ ...d, texts: d.texts.map((t) => (t.id === row.id ? { ...t, name: next } : t)) }));
        break;
      case "shape":
        setDesign((d) => ({ ...d, shapes: (d.shapes ?? []).map((s) => (s.id === row.id ? { ...s, name: next } : s)) }));
        break;
      case "image":
        setCanvasImages(canvasImages.map((ci) => (ci.id === row.id ? { ...ci, name: next } : ci)));
        break;
      case "group":
        // Groups have no object of their own, so the name lives in a map on
        // the design keyed by groupId. Clearing DELETES the key rather than
        // storing "", so the row falls back to `Group (N)`.
        setDesign((d) => {
          const names = { ...(d.groupNames ?? {}) };
          if (next) names[row.id] = next; else delete names[row.id];
          return { ...d, groupNames: Object.keys(names).length ? names : undefined };
        });
        break;
    }
    cancelRename();
  };

  const moveLayerInDisplay = (draggedId: string, targetId: string, dropAbove: boolean) => {
    if (draggedId === targetId) return;
    const display = [...stackTopDown];
    const filtered = display.filter((id) => id !== draggedId);
    const targetIdx = filtered.indexOf(targetId);
    if (targetIdx === -1) return;
    const insertAt = dropAbove ? targetIdx : targetIdx + 1;
    filtered.splice(insertAt, 0, draggedId);
    const newStack = [...filtered].reverse();
    setDesign((d) => ({ ...d, layerOrder: newStack }));
  };

  const resetDrag = () => {
    setDraggingLayerId(null);
    setDragOverLayerId(null);
    setDragOverPos(null);
  };

  // ---- Row actions ----
  const toggleLock = (row: Row) => {
    const next = !row.locked;
    if (row.type === "text") {
      setDesign((d) => ({
        ...d,
        texts: d.texts.map((t) => (t.id === row.id ? { ...t, locked: next } : t)),
      }));
    } else if (row.type === "shape") {
      setDesign((d) => ({
        ...d,
        shapes: (d.shapes ?? []).map((s) => (s.id === row.id ? { ...s, locked: next } : s)),
      }));
    } else if (row.type === "image") {
      setCanvasImages(canvasImages.map((ci) => (ci.id === row.id ? { ...ci, locked: next } : ci)));
    }
  };

  const toggleVisibility = (row: Row) => {
    switch (row.type) {
      case "text":
        setDesign((d) => ({
          ...d,
          texts: d.texts.map((t) => (t.id === row.id ? { ...t, hidden: !t.hidden } : t)),
        }));
        return;
      case "shape":
        setDesign((d) => ({
          ...d,
          shapes: (d.shapes ?? []).map((s) => (s.id === row.id ? { ...s, hidden: !s.hidden } : s)),
        }));
        return;
      case "image":
        setCanvasImages(canvasImages.map((ci) => (ci.id === row.id ? { ...ci, hidden: !ci.hidden } : ci)));
        return;
      case "tbbqLogo": setDesign((d) => ({ ...d, showLogo: !(d.showLogo ?? false) })); return;
      case "overlay": setDesign((d) => ({ ...d, hideOverlay: !d.hideOverlay })); return;
    }
  };

  const selectRow = (row: Row) => {
    // Selecting a group means selecting one member and letting the host's
    // existing group expansion do the rest — clicking any member already
    // selects every member, on the canvas and in this list. No new prop, and
    // one code path, so the group row can never disagree with a member row.
    if (row.type === "group") {
      if (row.firstMember) selectRow(row.firstMember);
      return;
    }
    // A row nested under a group parent selects ONLY itself. `row.depth` is
    // set exactly on rows rendered as group children, so this cannot catch a
    // top-level row of any type — which also makes the three per-type paths
    // below behave identically inside a group, instead of image rows toggling
    // and text/shape rows expanding.
    if (row.depth && row.layerId && onSelectLayerExact) {
      if (row.hidden) {
        if (row.type === "text") {
          setDesign((d) => ({ ...d, texts: d.texts.map((t) => (t.id === row.id ? { ...t, hidden: false } : t)) }));
        } else if (row.type === "shape") {
          setDesign((d) => ({ ...d, shapes: (d.shapes ?? []).map((sh) => (sh.id === row.id ? { ...sh, hidden: false } : sh)) }));
        }
      }
      onSelectLayerExact(row.layerId);
      return;
    }
    if (row.type === "image") {
      // Plain select, NOT a toggle. Clicking an already-selected image row used
      // to deselect it, while text and shape rows stayed selected — the same
      // gesture doing two different things depending on the layer type. Click
      // elsewhere, or Escape, to clear a selection.
      setSelectedImageId(row.id);
      return;
    }
    if (row.type === "shape" && onSelectShape) {
      // Auto-unhide so the user immediately sees what they selected.
      if (row.hidden) {
        setDesign((d) => ({
          ...d,
          shapes: (d.shapes ?? []).map((s) => (s.id === row.id ? { ...s, hidden: false } : s)),
        }));
      }
      onSelectShape(row.id);
      return;
    }
    if (row.type === "text" && onSelectText) {
      // Auto-unhide on select so the user sees what they just picked.
      if (row.hidden) {
        setDesign((d) => ({
          ...d,
          texts: d.texts.map((t) => (t.id === row.id ? { ...t, hidden: false } : t)),
        }));
      }
      onSelectText(row.id);
    }
  };

  /** Every layer a row stands for: itself, or a group row's whole membership. */
  const layerIdsOf = (row: Row): string[] =>
    row.type === "group" ? (row.memberLayerIds ?? []) : row.layerId ? [row.layerId] : [];

  /**
   * A click on a row, with modifiers.
   *
   * - plain: select (existing behaviour), and become the range anchor
   * - Cmd / Ctrl: toggle this row in the selection
   * - Shift: select every row between the anchor and this one
   *
   * The range walks `displayRows`, i.e. what is on screen — so a collapsed
   * group inside the range contributes all its members, and rows hidden inside
   * a collapsed group are never silently swept in.
   */
  const handleRowClick = (row: Row, e: React.MouseEvent) => {
    const ids = layerIdsOf(row);
    const anchorKey = row.layerId ?? row.id;

    if (e.shiftKey && rangeAnchorRef.current && onSelectLayerRange) {
      const keyOf = (r: Row) => r.layerId ?? r.id;
      const from = displayRows.findIndex((r) => keyOf(r) === rangeAnchorRef.current);
      const to = displayRows.findIndex((r) => keyOf(r) === anchorKey);
      if (from !== -1 && to !== -1) {
        const [lo, hi] = from <= to ? [from, to] : [to, from];
        const range = displayRows.slice(lo, hi + 1).flatMap(layerIdsOf);
        if (range.length) { onSelectLayerRange(range); return; }
      }
    }

    if (e.metaKey || e.ctrlKey) {
      // A group CHILD toggles only itself, matching what a plain click on it
      // now does. Anything else toggles its whole group, matching the canvas.
      if (row.depth && row.layerId && onToggleLayerExact) {
        onToggleLayerExact(row.layerId);
        rangeAnchorRef.current = anchorKey;
        return;
      }
      if (onToggleLayer && ids.length) {
        onToggleLayer(ids[0]);
        rangeAnchorRef.current = anchorKey;
        return;
      }
    }

    selectRow(row);
    rangeAnchorRef.current = anchorKey;
  };

  const deleteRow = (row: Row) => {
    switch (row.type) {
      case "image": removeCanvasImage(row.id); return;
      case "text":
        setDesign((d) => ({ ...d, texts: d.texts.filter((t) => t.id !== row.id) }));
        return;
      case "shape":
        setDesign((d) => ({ ...d, shapes: (d.shapes ?? []).filter((s) => s.id !== row.id) }));
        return;
      case "overlay": setDesign((d) => ({ ...d, overlayColor: undefined, overlayOpacity: 0 })); return;
    }
  };

  const iconFor = (type: RowType) => {
    switch (type) {
      case "image": return ImagePlus;
      case "text": return Type;
      case "shape": return Square;
      case "tbbqLogo": return ImageIcon;
      case "overlay": return Paintbrush;
      case "background": return LayersIcon;
      case "group": return Folder;
      default: return Square;
    }
  };

  return (
    // The panel owns its own scrolling now. It used to be one big scroller in
    // the editor, which is why the background status line and the drag hint
    // scrolled away with the layers: there was nowhere fixed to put them.
    <div className="flex flex-col min-h-0 flex-1">
      {/* ---- Header: count + filter ---- */}
      <div className="shrink-0 px-3 pt-3 pb-2 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-wider text-white/40">
            {filtering ? `${displayRows.filter((r) => r.type !== "group").length} of ${layerCount}` : `${layerCount} layer${layerCount === 1 ? "" : "s"}`}
          </span>
          {filtering && (
            <button
              onClick={() => setFilter("")}
              aria-label="Clear filter"
              className="text-[10px] text-white/50 hover:text-white transition-colors"
            >
              Clear
            </button>
          )}
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-white/35" />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            onKeyDown={(e) => {
              // Escape clears the filter rather than bubbling to the editor,
              // where it would clear the canvas selection instead.
              if (e.key === "Escape" && filter) { e.stopPropagation(); setFilter(""); }
            }}
            placeholder="Filter layers"
            aria-label="Filter layers"
            className="w-full rounded bg-black/30 pl-7 pr-2 py-1 text-[11px] text-white outline-none ring-1 ring-white/10 focus:ring-white/25 placeholder:text-white/35 transition-shadow"
          />
        </div>
      </div>

      {/* ---- The layers themselves. No gap between rows: a layer list is N
              alike things, so the rows read as one continuous list. ---- */}
      <div className="flex-1 min-h-0 overflow-y-auto px-3">
      <div className="flex flex-col">
      {displayRows.map((row) => {
        const Icon = iconFor(row.type);
        // Highlight from the real selection set, for every row type, including
        // each member of a multi-selection.
        const isSelected = row.type === "group"
          ? !!row.memberLayerIds?.length && row.memberLayerIds.every((id) => selectedIds?.has(id))
          : row.layerId ? (selectedIds?.has(row.layerId) ?? false) : false;
        const visuallyHidden = row.hidden ?? false;

        const clickable = row.type === "image" || row.type === "text" || row.type === "shape" || row.type === "group";
        // "Click to edit text" was true until a click on a text row opened the
        // caret. It selects now, so the hint says so.
        const titleHint = row.type === "group"
          ? "Click to select the whole group"
          : clickable ? "Click to select on canvas · drag to reorder" : undefined;

        const draggable = !!row.layerId && row.hasContent;
        const isBeingDragged = draggable && draggingLayerId === row.layerId;
        const isDropTarget = draggable && dragOverLayerId === row.layerId && draggingLayerId !== null && draggingLayerId !== row.layerId;

        // Row actions show on the hovered row, and a toggle that is currently
        // ON stays visible on every row — a locked or hidden layer has to be
        // findable without sweeping the pointer down the list.
        // Hover and rename are keyed on `rowKey`, not `layerId`: a group row has
        // no layerId (that is what keeps it out of the drag system) but still
        // has to be hoverable and renameable.
        const rowKey = row.layerId ?? (row.type === "group" ? row.id : undefined);
        const revealed = !!rowKey && hoveredLayerId === rowKey;
        const isElementRow = row.type === "text" || row.type === "image" || row.type === "shape";
        const canRename = isElementRow || row.type === "group";
        const isRenaming = !!rowKey && renamingLayerId === rowKey;

        return (
          <div
            key={row.id}
            onClick={(e) => { if (clickable) handleRowClick(row, e); }}
            onMouseEnter={() => setHoveredLayerId(rowKey ?? null)}
            onMouseLeave={() => setHoveredLayerId((cur) => (cur === rowKey ? null : cur))}
            title={clickable ? titleHint : undefined}
            draggable={draggable && !isRenaming}
            onDragStart={(e) => {
              if (!draggable || !row.layerId) return;
              e.dataTransfer.effectAllowed = "move";
              e.dataTransfer.setData("text/plain", row.layerId);
              setDraggingLayerId(row.layerId);
            }}
            onDragOver={(e) => {
              if (!draggable || !row.layerId || !draggingLayerId) return;
              if (draggingLayerId === row.layerId) {
                if (dragOverLayerId !== null) { setDragOverLayerId(null); setDragOverPos(null); }
                return;
              }
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              const rect = e.currentTarget.getBoundingClientRect();
              const midpoint = rect.top + rect.height / 2;
              setDragOverLayerId(row.layerId);
              setDragOverPos(e.clientY < midpoint ? "above" : "below");
            }}
            onDragLeave={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              if (e.clientY < rect.top || e.clientY > rect.bottom || e.clientX < rect.left || e.clientX > rect.right) {
                if (dragOverLayerId === row.layerId) setDragOverLayerId(null);
              }
            }}
            onDrop={(e) => {
              if (!row.layerId || !draggingLayerId) return;
              e.preventDefault();
              moveLayerInDisplay(draggingLayerId, row.layerId, dragOverPos === "above");
              resetDrag();
            }}
            onDragEnd={resetDrag}
            className={cn(
              // Flat row, Figma / Illustrator style: no per-row border,
              // background or radius. Borders separate UNLIKE things, and a
              // layer list is 19 alike things, so the 19 bordered cards
              // competed with the one signal that matters — which row is
              // selected. Hover and selection are now the only things painted.
              // `rounded-md` paints a rounded hover / selection box. This is not
              // the per-row card that item 1 removed: that was a border plus a
              // background painted on all 19 rows at rest, which is what made
              // them compete. A radius on the ONE row being pointed at or
              // selected reads as a highlight, which is what Figma does too.
              "relative flex items-center gap-1.5 h-8 pr-1 rounded-md transition-colors",
              // One indent level is all the model can express: an element has
              // at most one groupId, and groups do not nest.
              row.depth ? "pl-5" : "pl-1.5",
              // Selection is painted from SELECTION_COLOR via `style` below, so
              // the panel and the canvas cannot drift apart. It was #FF0028
              // here and #2C7BE5 on canvas: two colours for one idea, and the
              // brand red also reads as artwork rather than as chrome.
              !isSelected && "hover:bg-white/[0.06]",
              isBeingDragged && "opacity-30",
              clickable && "cursor-pointer",
              isDropTarget && dragOverPos === "above" && "before:absolute before:left-0 before:right-0 before:top-0 before:h-0.5 before:bg-[#FF6B00] before:rounded-full before:pointer-events-none",
              isDropTarget && dragOverPos === "below" && "after:absolute after:left-0 after:right-0 after:bottom-0 after:h-0.5 after:bg-[#FF6B00] after:rounded-full after:pointer-events-none",
            )}
            style={isSelected ? { backgroundColor: `${SELECTION_COLOR}33` } : undefined}
          >
            {row.type === "group" && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setCollapsedGroupIds((prev) => {
                    const next = new Set(prev);
                    if (next.has(row.id)) next.delete(row.id); else next.add(row.id);
                    return next;
                  });
                }}
                aria-label={row.collapsed ? "Expand group" : "Collapse group"}
                aria-expanded={!row.collapsed}
                title={row.collapsed ? "Expand group" : "Collapse group"}
                className={cn(ACTION_BTN, "-ml-1 text-white/60 hover:text-white hover:bg-white/10")}
              >
                {row.collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            )}
            {draggable && (
              <GripVertical className={cn("w-3 h-3 shrink-0 cursor-grab active:cursor-grabbing transition-colors", revealed ? "text-white/60" : "text-white/25")} />
            )}
            <Icon className="w-3.5 h-3.5 shrink-0 text-white/60" />
            {isRenaming ? (
              <input
                autoFocus
                value={draft}
                placeholder={row.derivedName}
                onChange={(e) => setDraft(e.target.value)}
                // The row is a click target and a drag source; neither should
                // fire while the pointer is being used to place a caret.
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                onFocus={(e) => e.currentTarget.select()}
                onBlur={() => commitRename(row)}
                onKeyDown={(e) => {
                  // The editor's global handler treats an INPUT as an editable
                  // target, so Delete / Backspace / nudge / undo already stay
                  // out of the way. Stopping propagation keeps it that way
                  // even if that guard ever changes.
                  e.stopPropagation();
                  if (e.key === "Enter") commitRename(row);
                  else if (e.key === "Escape") cancelRename();
                }}
                className="flex-1 min-w-0 rounded bg-black/40 px-1 py-0.5 text-[11px] text-white outline-none ring-1 ring-[#FF6B00]/70 placeholder:text-white/40"
              />
            ) : (
              /* Names still clip in a 230px column, so the full one is on
                 hover. Double-click to rename, Illustrator / Figma style. */
              <span
                title={canRename ? `${row.name} · double-click to rename` : row.name}
                onDoubleClick={(e) => { e.stopPropagation(); if (canRename) startRename(row); }}
                className={cn("flex-1 truncate text-[11px]", visuallyHidden ? "text-white/65 line-through" : "text-white/85")}
              >
                {row.name}
              </span>
            )}

            {isElementRow && !row.isBackdrop && onDuplicateRow && row.layerId && revealed && (
              <button
                onClick={(e) => { e.stopPropagation(); onDuplicateRow(row.layerId!); }}
                aria-label="Duplicate layer"
                title="Duplicate layer"
                className={cn(ACTION_BTN, "text-white/65 hover:text-white hover:bg-white/10")}
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            )}

            {isElementRow && (revealed || row.locked) && (
              <button
                onClick={(e) => { e.stopPropagation(); toggleLock(row); }}
                aria-label={row.locked ? "Unlock layer" : "Lock layer"}
                title={row.locked ? "Unlock layer" : "Lock layer"}
                aria-pressed={row.locked}
                className={cn(
                  ACTION_BTN,
                  row.locked
                    ? "text-[#FF6B00] bg-[#FF6B00]/10 hover:bg-[#FF6B00]/20"
                    : "text-white/65 hover:text-white hover:bg-white/10",
                )}
              >
                {row.locked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
              </button>
            )}

            {/* Group rows are excluded: `toggleVisibility` has no group case, so
                the eye rendered here did nothing at all. Group-level hide (and
                lock) is worth having and is not built — until it is, no dead
                button. */}
            {row.type !== "background" && row.type !== "group" && (revealed || visuallyHidden) && (
              <button
                onClick={(e) => { e.stopPropagation(); toggleVisibility(row); }}
                aria-label={visuallyHidden ? "Show layer" : "Hide layer"}
                title={visuallyHidden ? "Show layer" : "Hide layer"}
                aria-pressed={visuallyHidden}
                className={cn(ACTION_BTN, visuallyHidden ? "text-white/80 bg-white/10 hover:bg-white/20" : "text-white/65 hover:text-white hover:bg-white/10")}
              >
                {visuallyHidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            )}

            {/* Delete survives on the colour overlay ONLY. Every other row is a
                selectable element, so Backspace / Delete on the canvas already
                removes it — verified from a panel-only selection. The overlay
                is not selectable, so taking its button away would leave the
                panel with no way to clear it. 17 always-armed Delete buttons at
                16px, 8px from Lock, become one on a row nothing else can
                reach. */}
            {row.type === "overlay" && revealed && (
              <button
                onClick={(e) => { e.stopPropagation(); deleteRow(row); }}
                aria-label="Delete layer"
                title="Remove the colour overlay"
                className={cn(ACTION_BTN, "text-white/65 hover:text-[#FF0028] hover:bg-[#FF0028]/10")}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        );
      })}

      {filtering && displayRows.length === 0 && (
        <p className="px-1.5 py-3 text-[11px] text-white/45">No layer matches “{filter.trim()}”.</p>
      )}
      </div>
      </div>

      {/* ---- Fixed footer: the background, and the things that are not layers ---- */}
      <div className="shrink-0 border-t border-border px-3 py-2 space-y-1.5">
        <div className="flex items-center gap-1.5" title={`Background · ${bgLabel} — set in the Canvas step`}>
          <LayersIcon className="w-3.5 h-3.5 shrink-0 text-white/45" />
          <span className="flex-1 truncate text-[11px] text-white/60">Background · {bgLabel}</span>
        </div>
        {/* Two short lines rather than one long one: at 10px in a 230px column
            the single sentence overflowed and the aside's `overflow-hidden`
            clipped it mid-word. */}
        <p className="text-[10px] text-white/40 leading-snug">Top of list = front of canvas</p>
        <p className="text-[10px] text-white/40 leading-snug">Drag to reorder · Delete to remove</p>
      </div>
    </div>
  );
}
