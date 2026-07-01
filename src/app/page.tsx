"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Pause, Play, X, RotateCcw, Layers as LayersIcon, Download, LayoutTemplate, Type, Image as ImageIcon, Shapes, Undo2, Redo2, Lock, Unlock, Trash2, Copy, LibraryBig, AlignStartVertical, AlignCenterVertical, AlignEndVertical, AlignStartHorizontal, AlignCenterHorizontal, AlignEndHorizontal, AlignHorizontalDistributeCenter, AlignVerticalDistributeCenter, Grid3x3, Group, Ungroup, ChevronUp, ChevronDown, ChevronsUp, ChevronsDown } from "lucide-react";
import * as Popover from "@radix-ui/react-popover";
import { toast } from "sonner";
import { AnimatedGradient } from "@/components/AnimatedGradient";
import { GlassCard } from "@/components/GlassCard";
import type { CanvasImage } from "@/components/ImagePlacer";
import { ImageDragOverlay } from "@/components/ImageDragOverlay";
import { ShapeDragOverlay } from "@/components/ShapeDragOverlay";
import { LogoDragOverlay } from "@/components/LogoDragOverlay";
import type { Bbox } from "@/lib/snap";
import { DynamicTemplate } from "@/components/templates/DynamicTemplate";
import { useExport, type ExportFormat } from "@/hooks/useExport";
import { useUndoableDoc } from "@/hooks/useUndoableDoc";
import { FORMAT_DIMENSIONS, DEFAULT_DESIGN, reconcileLayerOrder } from "@/types/template";
import type { PlatformFormat, DesignConfig } from "@/types/template";
import { FeedbackButton } from "@/components/FeedbackButton";
import { Stepper } from "@/components/Stepper";
import type { StepDef } from "@/components/Stepper";
import { StepNavigator } from "@/components/StepNavigator";
import { StepCanvas } from "@/components/steps/StepCanvas";
import { StepText } from "@/components/steps/StepText";
import { StepImages } from "@/components/steps/StepImages";
import { StepElements } from "@/components/steps/StepElements";
import { LayersPanel } from "@/components/LayersPanel";
import { TemplatesModal } from "@/components/TemplatesModal";
import { PresetEditingBar } from "@/components/PresetEditingBar";
import { serializeAsPreset } from "@/lib/presetExport";
import { PRESETS, resolvePresetForFormat, type Preset } from "@/data/presets";
import { useHiddenPresets } from "@/hooks/useHiddenPresets";
import { usePresetOverrides } from "@/hooks/usePresetOverrides";
import { useUserPresets } from "@/hooks/useUserPresets";
import { useFolderOrder } from "@/hooks/useFolderOrder";
import { buildPresetFromDoc } from "@/lib/presetExport";
import { useTemplates, type SavedTemplate } from "@/hooks/useTemplates";

// Bumped storage key because the design schema changed (partnerLogo removed).
const STORAGE_KEY = "tbbqvisualgen.session.v4";

// Single icon-button used inside the align popover.
function AlignBtn({ icon: Icon, label, onClick }: { icon: typeof AlignStartVertical; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className="flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-md text-muted hover:bg-white/10 hover:text-foreground transition-colors"
    >
      <Icon className="w-3.5 h-3.5" strokeWidth={1.5} />
      <span className="text-[9px] uppercase tracking-wider">{label}</span>
    </button>
  );
}

const STEPS: StepDef[] = [
  { id: 1, label: "Canvas", icon: LayoutTemplate },
  { id: 2, label: "Text", icon: Type },
  { id: 3, label: "Images", icon: ImageIcon },
  { id: 4, label: "Shapes", icon: Shapes },
];

// Logo color options for the floating toolbar that appears when the logo is
// selected on canvas. Swatches mirror the three TechBBQ logo PNGs.
const LOGO_COLORS: { id: NonNullable<DesignConfig["logoStyle"]>; label: string; swatch: React.CSSProperties }[] = [
  { id: "white", label: "White", swatch: { background: "#f2f2f2" } },
  { id: "red", label: "Red", swatch: { background: "#ce0f2e" } },
  { id: "gradient", label: "Gradient", swatch: { background: "linear-gradient(120deg, #fa7000 0%, #ff2600 45%, #ce0f2e 100%)" } },
];

interface DocSnapshot {
  format: PlatformFormat;
  customSize: { width: number; height: number };
  design: DesignConfig;
  canvasImages: CanvasImage[];
}

const INITIAL_DOC: DocSnapshot = {
  format: "square",
  customSize: { width: 1080, height: 1080 },
  design: DEFAULT_DESIGN,
  canvasImages: [],
};

export default function Home() {
  const { doc, set: setDoc, beginTransaction, endTransaction, undo, redo, replaceAll: replaceDoc, canUndo, canRedo } = useUndoableDoc<DocSnapshot>(INITIAL_DOC);
  const { format, customSize, design, canvasImages } = doc;
  const setFormat = useCallback((next: PlatformFormat | ((prev: PlatformFormat) => PlatformFormat)) => {
    setDoc((prev) => ({ ...prev, format: typeof next === "function" ? next(prev.format) : next }));
  }, [setDoc]);
  const setCustomSize = useCallback((next: { width: number; height: number } | ((prev: { width: number; height: number }) => { width: number; height: number })) => {
    setDoc((prev) => ({ ...prev, customSize: typeof next === "function" ? next(prev.customSize) : next }));
  }, [setDoc]);
  const setDesign = useCallback((next: DesignConfig | ((prev: DesignConfig) => DesignConfig)) => {
    setDoc((prev) => ({ ...prev, design: typeof next === "function" ? next(prev.design) : next }));
  }, [setDoc]);
  const setCanvasImages = useCallback((next: CanvasImage[] | ((prev: CanvasImage[]) => CanvasImage[])) => {
    setDoc((prev) => ({ ...prev, canvasImages: typeof next === "function" ? next(prev.canvasImages) : next }));
  }, [setDoc]);
  // Unified selection — IDs in layer format: "text:xyz" / "image:abc".
  const [selectedIds, setSelectedIdsRaw] = useState<Set<string>>(new Set());
  const setSelectedIds = useCallback((next: Set<string> | ((prev: Set<string>) => Set<string>)) => {
    setSelectedIdsRaw((prev) => (typeof next === "function" ? next(prev) : next));
  }, []);
  // Compat shim for components that still expect a single image id.
  const selectedImageId = (() => {
    if (selectedIds.size !== 1) return null;
    const only = selectedIds.values().next().value;
    return typeof only === "string" && only.startsWith("image:") ? only.slice(6) : null;
  })();
  const setSelectedImageId = useCallback((id: string | null) => {
    setSelectedIds(id ? new Set([`image:${id}`]) : new Set());
  }, [setSelectedIds]);

  const [bgPaused, setBgPaused] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [overflow, setOverflow] = useState({ left: false, right: false, top: false, bottom: false });
  const [guides, setGuides] = useState<{ x: number | null; y: number | null }>({ x: null, y: null });
  const [showEditTip, setShowEditTip] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [showLayers, setShowLayers] = useState(false);
  const layersPanelRef = useRef<HTMLDivElement>(null);
  const layersToggleRef = useRef<HTMLButtonElement>(null);
  const [exportFormat, setExportFormat] = useState<ExportFormat>("png");

  const { exportRef, isExporting, isExportingVideo, exportImage } = useExport();
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const canvasWrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.4);

  // Marquee selection — rectangle in canvas-fractional coords (0–1).
  const [marquee, setMarquee] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);

  // Inline crop editor — image id currently in "Google Slides–style" crop
  // mode. When set, the matching image renders with its full source visible
  // (dimmed outside the frame) and the user can pan to choose what's shown.
  const [cropEditingId, setCropEditingId] = useState<string | null>(null);

  // Right-click context menu coordinates (screen-space). When set the menu
  // is shown at this position; null hides it.
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  // Compositional grid overlay. Pure visual aid — never exports. 10×10 fine
  // grid + bold lines at the rule-of-thirds positions (33% / 67%).
  const [showGrid, setShowGrid] = useState(false);

  // Saved-templates (localStorage) — open via the header button.
  const { templates, saveTemplate, deleteTemplate, renameTemplate } = useTemplates();
  const { hidden: hiddenPresets, hide: hidePreset, restoreAll: restoreHiddenPresets } = useHiddenPresets();
  const {
    overrides: presetOverrides,
    setName: setPresetOverrideName,
    getName: getPresetName,
    setVariant: setPresetVariant,
    removeVariant: removePresetVariant,
    setGroup: setPresetOverrideGroup,
    getGroup: getPresetGroup,
  } = usePresetOverrides();
  const { order: folderOrder, setOrder: setFolderOrder } = useFolderOrder();
  const {
    presets: userPresets,
    add: addUserPreset,
    remove: removeUserPreset,
    updateName: updateUserPresetName,
    updateGroup: updateUserPresetGroup,
    setVariant: setUserPresetVariant,
    removeVariant: removeUserPresetVariant,
    has: isUserPresetId,
  } = useUserPresets();
  const visibleBuiltIns: Preset[] = PRESETS.filter((p) => !hiddenPresets.has(p.id));
  const visiblePresets: Preset[] = [...visibleBuiltIns, ...userPresets];
  // For user presets, the name lives directly on the preset (we mutate it in
  // localStorage). For built-ins, we layer renames via the override system.
  const presetDisplayName = useCallback(
    (p: Preset) => (isUserPresetId(p.id) ? p.name : getPresetName(p.id, p.name)),
    [getPresetName, isUserPresetId],
  );
  // Group resolver — user presets read directly from preset.group (we
  // mutate it in localStorage); built-ins layer overrides on top.
  const presetDisplayGroup = useCallback(
    (p: Preset) => (isUserPresetId(p.id) ? (p.group ?? "") : (getPresetGroup(p.id, p.group) ?? "")),
    [getPresetGroup, isUserPresetId],
  );
  const [lastLoadedPresetId, setLastLoadedPresetId] = useState<string | null>(null);
  const lastLoadedPreset: Preset | null = lastLoadedPresetId
    ? visiblePresets.find((p) => p.id === lastLoadedPresetId) ?? null
    : null;
  // Format sets used by the editing bar's chips. For user presets, "saved
  // by you" = the variants stored directly on the preset; "built-in" is
  // empty since they ship nothing from source. For built-ins, "saved by
  // you" = the override variants; "built-in" = the preset's own variants.
  const customFormatsForCurrentPreset: Set<PlatformFormat> = lastLoadedPreset
    ? isUserPresetId(lastLoadedPreset.id)
      ? new Set([
          lastLoadedPreset.format,
          ...(Object.keys(lastLoadedPreset.variants ?? {}) as PlatformFormat[]),
        ])
      : new Set(Object.keys(presetOverrides[lastLoadedPreset.id]?.variants ?? {}) as PlatformFormat[])
    : new Set();
  const builtInFormatsForCurrentPreset: Set<PlatformFormat> = lastLoadedPreset
    ? isUserPresetId(lastLoadedPreset.id)
      ? new Set()
      : new Set([
          lastLoadedPreset.format,
          ...(Object.keys(lastLoadedPreset.variants ?? {}) as PlatformFormat[]),
        ])
    : new Set();

  // Shared callback for loading a preset at a chosen format. When `atFormat`
  // is provided it overrides the canvas's current format (used by the
  // editing bar's chips to switch variants). The doc is replaced atomically
  // so we don't read stale state between setFormat + setDoc.
  const handleLoadPresetAtFormat = useCallback((preset: Preset, atFormat?: PlatformFormat) => {
    const targetFormat = atFormat ?? format;
    // User presets store everything on the Preset itself; built-ins use the
    // override layer for user customizations.
    const ovVariants = isUserPresetId(preset.id) ? undefined : presetOverrides[preset.id]?.variants;
    const resolved = resolvePresetForFormat(preset, targetFormat, ovVariants);
    setDoc({
      format: resolved.format,
      customSize: resolved.customSize,
      design: resolved.design,
      canvasImages: resolved.canvasImages,
    });
    setSelectedIdsRaw(new Set());
    setCropEditingId(null);
    setLastLoadedPresetId(preset.id);
    const overrideUsed = ovVariants?.[targetFormat];
    const variantUsed = preset.variants?.[targetFormat];
    toast.success(
      overrideUsed
        ? `Loaded "${preset.name}" (your ${targetFormat} variant)`
        : variantUsed
          ? `Loaded "${preset.name}" (${targetFormat} variant)`
          : preset.variants || ovVariants
            ? `Loaded "${preset.name}" — no ${targetFormat} variant yet`
            : `Loaded "${preset.name}"`,
    );
  }, [format, setDoc, presetOverrides, isUserPresetId]);
  const handleLoadPreset = useCallback((preset: Preset) => handleLoadPresetAtFormat(preset), [handleLoadPresetAtFormat]);
  const [templatesOpen, setTemplatesOpen] = useState(false);

  // In-memory clipboard for canvas elements — Cmd/Ctrl+C copies the current
  // selection, Cmd/Ctrl+V pastes copies with a small offset. Not the OS
  // clipboard so it doesn't fight with text/input copy/paste.
  const clipboardRef = useRef<{
    texts: typeof design.texts;
    shapes: NonNullable<typeof design.shapes>;
    images: CanvasImage[];
  } | null>(null);

  // Debounced transaction handle for arrow-key nudging. The first arrow press
  // opens a transaction; further presses inside `NUDGE_IDLE_MS` extend it;
  // after the user stops, the transaction closes and the whole streak
  // collapses into a single undo step.
  const nudgeTransactionOpenRef = useRef(false);
  const nudgeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Origin snapshot for the in-flight group drag. Each selected element's
  // pre-drag center position is captured here on drag start; each move tick
  // applies the same delta to every snapshotted element.
  const dragOriginsRef = useRef<Map<string, { x: number; y: number }> | null>(null);

  const dims = format === "custom"
    ? { width: customSize.width, height: customSize.height, label: `Custom (${customSize.width}×${customSize.height})` }
    : FORMAT_DIMENSIONS[format] || FORMAT_DIMENSIONS.square;

  // ---- One-time "click any text to edit" tip ----
  useEffect(() => {
    try {
      const dismissed = localStorage.getItem("tbbqvisualgen.editTipDismissed");
      if (!dismissed) setShowEditTip(true);
    } catch {
      // Defensive: localStorage unavailable in some embed contexts.
    }
  }, []);

  const dismissEditTip = useCallback(() => {
    setShowEditTip(false);
    try { localStorage.setItem("tbbqvisualgen.editTipDismissed", "1"); } catch {}
  }, []);

  // ---- Persistence: hydrate from sessionStorage on mount ----
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        const hydrated: DocSnapshot = {
          format: saved.format && FORMAT_DIMENSIONS[saved.format as PlatformFormat] ? saved.format : INITIAL_DOC.format,
          customSize: saved.customSize ?? INITIAL_DOC.customSize,
          design: saved.design ? { ...DEFAULT_DESIGN, ...saved.design } : INITIAL_DOC.design,
          canvasImages: saved.canvasImages ?? INITIAL_DOC.canvasImages,
        };
        replaceDoc(hydrated);
        if (typeof saved.currentStep === "number" && saved.currentStep >= 1 && saved.currentStep <= STEPS.length) {
          setCurrentStep(saved.currentStep);
        }
      }
    } catch {
      // ignore — start fresh
    }
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist on changes (after initial hydration)
  useEffect(() => {
    if (!hydrated) return;
    try {
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ format, customSize, design, canvasImages, currentStep })
      );
    } catch {
      // quota exceeded — skip
    }
  }, [hydrated, format, customSize, design, canvasImages, currentStep]);

  // When the user single-selects an element on canvas, jump to the matching
  // wizard step + focus its row in the control panel so they can immediately
  // tweak it.
  useEffect(() => {
    if (selectedIds.size !== 1) return;
    const only = selectedIds.values().next().value;
    if (typeof only !== "string") return;
    if (only.startsWith("text:")) setCurrentStep(2);
    else if (only.startsWith("image:")) setCurrentStep(3);
    else if (only.startsWith("shape:")) setCurrentStep(4);
    else if (only === "tbbqLogo") setCurrentStep(1); // logo controls live in Canvas
  }, [selectedIds]);

  // Derive the focused id per category so step components can expand the
  // matching row. Returns the raw id (without prefix) when exactly one element
  // of that kind is selected, otherwise null.
  const onlySelectedId = selectedIds.size === 1 ? (selectedIds.values().next().value as string | undefined) : undefined;
  const focusedTextId = onlySelectedId?.startsWith("text:") ? onlySelectedId.slice(5) : null;
  const focusedShapeId = onlySelectedId?.startsWith("shape:") ? onlySelectedId.slice(6) : null;

  // Prune dead IDs from selection — runs after texts/images/shapes change.
  useEffect(() => {
    setSelectedIdsRaw((prev) => {
      if (prev.size === 0) return prev;
      const liveTextIds = new Set(design.texts.map((t) => `text:${t.id}`));
      const liveImageIds = new Set(canvasImages.map((c) => `image:${c.id}`));
      const liveShapeIds = new Set((design.shapes ?? []).map((s) => `shape:${s.id}`));
      let changed = false;
      const next = new Set<string>();
      for (const id of prev) {
        if (liveTextIds.has(id) || liveImageIds.has(id) || liveShapeIds.has(id)) next.add(id);
        else changed = true;
      }
      return changed ? next : prev;
    });
  }, [design.texts, design.shapes, canvasImages]);

  // ---- Group drag (multi-select translate) ----
  // beginGroupDrag: snapshot pre-drag center positions for every currently-
  // selected element. If the dragged element isn't already in the selection,
  // auto-select just that one (single-element drag behavior).
  const beginGroupDrag = useCallback((draggedId: string) => {
    // Exit crop-edit mode if any drag starts elsewhere (Google Slides parity).
    setCropEditingId((prev) => (prev && `image:${prev}` !== draggedId ? null : prev));
    setSelectedIdsRaw((prev) => {
      const sel = prev.has(draggedId) ? prev : new Set([draggedId]);
      // Build snapshot from the latest doc state.
      const origins = new Map<string, { x: number; y: number }>();
      for (const id of sel) {
        // Locked elements stay put even when group-dragged.
        if (id.startsWith("text:")) {
          const t = design.texts.find((t) => `text:${t.id}` === id);
          if (t && !t.locked) origins.set(id, { x: t.position.x, y: t.position.y });
        } else if (id.startsWith("image:")) {
          const img = canvasImages.find((ci) => `image:${ci.id}` === id);
          if (img && !img.locked) origins.set(id, { x: img.x, y: img.y });
        } else if (id.startsWith("shape:")) {
          const sh = (design.shapes ?? []).find((s) => `shape:${s.id}` === id);
          if (sh && !sh.locked) origins.set(id, { x: sh.x, y: sh.y });
        } else if (id === "tbbqLogo" && design.showLogo) {
          // Logo origin: prefer the custom position if the user has dragged
          // it before; otherwise compute the center from the corner anchor +
          // padding (same math as DynamicTemplate / LogoDragOverlay).
          if (design.logoCustomPosition) {
            origins.set("tbbqLogo", {
              x: design.logoCustomPosition.x,
              y: design.logoCustomPosition.y,
            });
          } else {
            const pos = design.logoPosition || "bottom-center";
            const isPortrait = dims.height > dims.width;
            const scale = Math.max(0.3, Math.min(3.0, design.logoScale ?? 1));
            const logoH = isPortrait
              ? Math.round(dims.width * 0.052 * scale)
              : Math.round(dims.height * 0.037 * scale);
            const pad = isPortrait
              ? Math.round(dims.width * 0.055)
              : Math.round(dims.height * 0.05);
            // Approximate width for centering using the default 4:1
            // aspect — gets overwritten by real natural ratio elsewhere but
            // is close enough for the origin snapshot.
            const logoW = Math.round(logoH * 4);
            let cx: number;
            let cy: number;
            if (pos.endsWith("left")) cx = (pad + logoW / 2) / dims.width;
            else if (pos.endsWith("right")) cx = (dims.width - pad - logoW / 2) / dims.width;
            else cx = 0.5;
            if (pos.startsWith("top")) cy = (pad + logoH / 2) / dims.height;
            else cy = (dims.height - pad - logoH / 2) / dims.height;
            origins.set("tbbqLogo", { x: cx, y: cy });
          }
        }
      }
      dragOriginsRef.current = origins;
      return sel;
    });
  }, [design, canvasImages, dims.width, dims.height]);

  // groupDragMoveBy: apply a (dx, dy) delta to every snapshotted element.
  // The same delta is added to each origin so the whole selection translates
  // rigidly. Clamp to [0,1] so elements stay on-canvas.
  const groupDragMoveBy = useCallback((dx: number, dy: number) => {
    const origins = dragOriginsRef.current;
    if (!origins) return;
    const clamp = (v: number) => Math.max(0, Math.min(1, v));
    const logoOrigin = origins.get("tbbqLogo");
    setDoc((prev) => ({
      ...prev,
      design: {
        ...prev.design,
        texts: prev.design.texts.map((t) => {
          const o = origins.get(`text:${t.id}`);
          return o ? { ...t, position: { x: clamp(o.x + dx), y: clamp(o.y + dy) } } : t;
        }),
        shapes: (prev.design.shapes ?? []).map((s) => {
          const o = origins.get(`shape:${s.id}`);
          return o ? { ...s, x: clamp(o.x + dx), y: clamp(o.y + dy) } : s;
        }),
        ...(logoOrigin
          ? {
              logoCustomPosition: {
                x: clamp(logoOrigin.x + dx),
                y: clamp(logoOrigin.y + dy),
              },
            }
          : {}),
      },
      canvasImages: prev.canvasImages.map((img) => {
        const o = origins.get(`image:${img.id}`);
        return o ? { ...img, x: clamp(o.x + dx), y: clamp(o.y + dy) } : img;
      }),
    }));
  }, [setDoc]);

  const endGroupDrag = useCallback(() => {
    dragOriginsRef.current = null;
  }, []);

  // ---- Marquee selection — pointer handler attached to canvas wrapper ----
  // ---- Group helpers (declared before handlers that close over them) ----
  const getGroupId = useCallback((layerId: string): string | undefined => {
    if (layerId.startsWith("text:")) return design.texts.find((t) => `text:${t.id}` === layerId)?.groupId;
    if (layerId.startsWith("shape:")) return (design.shapes ?? []).find((s) => `shape:${s.id}` === layerId)?.groupId;
    if (layerId.startsWith("image:")) return canvasImages.find((ci) => `image:${ci.id}` === layerId)?.groupId;
    return undefined;
  }, [design.texts, design.shapes, canvasImages]);

  const getAllInGroup = useCallback((groupId: string): string[] => {
    const ids: string[] = [];
    for (const t of design.texts) if (t.groupId === groupId) ids.push(`text:${t.id}`);
    for (const s of (design.shapes ?? [])) if (s.groupId === groupId) ids.push(`shape:${s.id}`);
    for (const ci of canvasImages) if (ci.groupId === groupId) ids.push(`image:${ci.id}`);
    return ids;
  }, [design.texts, design.shapes, canvasImages]);

  // Expand a selection so any element in a group brings ALL its siblings.
  const expandToGroups = useCallback((ids: Set<string>): Set<string> => {
    const groupIds = new Set<string>();
    for (const id of ids) {
      const gid = getGroupId(id);
      if (gid) groupIds.add(gid);
    }
    if (groupIds.size === 0) return ids;
    const result = new Set(ids);
    for (const gid of groupIds) for (const m of getAllInGroup(gid)) result.add(m);
    return result;
  }, [getGroupId, getAllInGroup]);

  // Click an element → expand to its whole group if it has one.
  const selectWithGroup = useCallback((layerId: string) => {
    const gid = getGroupId(layerId);
    if (gid) setSelectedIdsRaw(new Set(getAllInGroup(gid)));
    else setSelectedIdsRaw(new Set([layerId]));
  }, [getGroupId, getAllInGroup]);

  const handleCanvasPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    // If the click landed on a canvas element (text/image bbox) or a
    // resize-handle inside an image overlay, let that element handle it.
    // Marquee only starts when the user clicks empty canvas.
    const target = e.target as HTMLElement;
    if (target.closest("[data-canvas-element], [data-canvas-overlay]")) return;
    const wrap = canvasWrapRef.current;
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    const toFrac = (clientX: number, clientY: number) => ({
      x: Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (clientY - rect.top) / rect.height)),
    });
    const start = toFrac(e.clientX, e.clientY);
    setMarquee({ x1: start.x, y1: start.y, x2: start.x, y2: start.y });
    // Clear any existing selection on a fresh marquee; also exits crop-edit
    // mode (Google Slides parity).
    setSelectedIdsRaw(new Set());
    setCropEditingId(null);

    const handleMove = (moveE: PointerEvent) => {
      const p = toFrac(moveE.clientX, moveE.clientY);
      setMarquee({ x1: start.x, y1: start.y, x2: p.x, y2: p.y });
    };
    const handleUp = (upE: PointerEvent) => {
      document.removeEventListener("pointermove", handleMove);
      document.removeEventListener("pointerup", handleUp);
      const p = toFrac(upE.clientX, upE.clientY);
      const x1 = Math.min(start.x, p.x);
      const y1 = Math.min(start.y, p.y);
      const x2 = Math.max(start.x, p.x);
      const y2 = Math.max(start.y, p.y);
      // Compute intersection against every element on the canvas.
      const next = new Set<string>();
      // Tiny marquee (just a click on empty area) clears selection without
      // searching — useful when the user clicks somewhere empty to deselect.
      if (x2 - x1 > 0.005 || y2 - y1 > 0.005) {
        document.querySelectorAll<HTMLElement>("[data-canvas-element]").forEach((el) => {
          const id = el.dataset.canvasElement;
          if (!id) return;
          const er = el.getBoundingClientRect();
          const ex1 = (er.left - rect.left) / rect.width;
          const ey1 = (er.top - rect.top) / rect.height;
          const ex2 = (er.right - rect.left) / rect.width;
          const ey2 = (er.bottom - rect.top) / rect.height;
          // AABB intersection.
          if (ex1 < x2 && ex2 > x1 && ey1 < y2 && ey2 > y1) {
            next.add(id);
          }
        });
      }
      setSelectedIdsRaw(expandToGroups(next));
      setMarquee(null);
    };
    document.addEventListener("pointermove", handleMove);
    document.addEventListener("pointerup", handleUp);
  }, [expandToGroups]);

  // Canvas image helpers
  const addCanvasImage = useCallback((img: CanvasImage) => {
    setCanvasImages((prev) => [...prev, img]);
    setSelectedImageId(img.id);
  }, []);

  const updateCanvasImage = useCallback((id: string, patch: Partial<CanvasImage>) => {
    setCanvasImages((prev) => prev.map((img) => (img.id === id ? { ...img, ...patch } : img)));
  }, []);

  const removeCanvasImage = useCallback((id: string) => {
    setCanvasImages((prev) => prev.filter((img) => img.id !== id));
    setSelectedIdsRaw((prev) => {
      if (!prev.has(`image:${id}`)) return prev;
      const next = new Set(prev);
      next.delete(`image:${id}`);
      return next;
    });
  }, []);

  // Replace an image-placeholder shape with a CanvasImage at the same
  // x/y/width/height. Called by ShapeDragOverlay after the user picks a file
  // from the placeholder's "Upload photo" button.
  const replacePlaceholderWithImage = useCallback((
    shapeId: string,
    dataUrl: string,
    naturalWidth: number,
    naturalHeight: number,
  ) => {
    setDoc((prev) => {
      const shape = (prev.design.shapes ?? []).find((s) => s.id === shapeId);
      if (!shape) return prev;
      const newImageId = `img-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const newImage: CanvasImage = {
        id: newImageId,
        src: dataUrl,
        x: shape.x,
        y: shape.y,
        width: shape.width,
        height: shape.height,
        border: false,
        cornerRadius: shape.type === "circle"
          ? 50
          : typeof shape.borderRadius === "number"
            ? Math.min(50, shape.borderRadius * 50)
            : 0,
        groupId: shape.groupId,
        naturalWidth,
        naturalHeight,
        // Carry the placeholder's fit mode forward so logo slots stay
        // contain-fit (no crop) after the actual file is uploaded.
        ...(shape.imagePlaceholder?.mode ? { fit: shape.imagePlaceholder.mode } : {}),
      };
      const nextShapes = (prev.design.shapes ?? []).filter((s) => s.id !== shapeId);
      const nextLayerOrder = prev.design.layerOrder
        ? prev.design.layerOrder.map((l) => (l === `shape:${shapeId}` ? `image:${newImageId}` : l))
        : prev.design.layerOrder;
      return {
        ...prev,
        design: { ...prev.design, shapes: nextShapes, layerOrder: nextLayerOrder },
        canvasImages: [...prev.canvasImages, newImage],
      };
    });
    setSelectedIdsRaw(new Set());
    toast.success("Photo added");
  }, [setDoc]);

  const calculateScale = useCallback(() => {
    if (!previewContainerRef.current) return;
    const container = previewContainerRef.current;
    const padding = 40;
    const availW = container.clientWidth - padding * 2;
    const availH = container.clientHeight - padding * 2;
    const scaleX = availW / dims.width;
    const scaleY = availH / dims.height;
    setScale(Math.min(scaleX, scaleY, 1));
  }, [dims.width, dims.height]);

  useEffect(() => {
    calculateScale();
    window.addEventListener("resize", calculateScale);
    return () => window.removeEventListener("resize", calculateScale);
  }, [calculateScale]);

  const handleExport = useCallback((formatOverride?: ExportFormat) => {
    const fmt = formatOverride ?? exportFormat;
    setBgPaused(true);
    setTimeout(() => {
      const date = new Date();
      const stamp = `${date.toISOString().slice(0, 10)}-${String(date.getHours()).padStart(2, "0")}${String(date.getMinutes()).padStart(2, "0")}`;
      const ext = fmt === "jpeg" ? "jpg" : "png";
      const filename = `techbbq-visual-${format}-${dims.width}x${dims.height}-${stamp}.${ext}`;
      exportImage(filename, fmt).finally(() => setBgPaused(false));
    }, 100);
  }, [format, dims.width, dims.height, exportFormat, exportImage]);

  const handleReset = useCallback(() => {
    if (canvasImages.length === 0 && design.texts.length === 0) return;
    const ok = window.confirm("Start over? This clears the design, text, and images.");
    if (!ok) return;
    setDoc((prev) => ({ ...prev, design: DEFAULT_DESIGN, canvasImages: [] }));
    setSelectedImageId(null);
    setCurrentStep(1);
    try { sessionStorage.removeItem(STORAGE_KEY); } catch {}
    toast.success("Reset — ready for a new visual");
  }, [canvasImages.length, design.texts.length, setDoc]);

  // ---- Click outside the floating Layers panel closes it ----
  useEffect(() => {
    if (!showLayers) return;
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      const panel = layersPanelRef.current;
      const toggle = layersToggleRef.current;
      if (panel && panel.contains(target)) return;
      if (toggle && toggle.contains(target)) return;
      setShowLayers(false);
    };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, [showLayers]);

  // ---- Click outside canvas exits crop-edit mode ----
  // Marquee handles empty-canvas clicks; this catches everything ELSE outside
  // the canvas (sidebar, header, etc.) so the user can commit the crop by
  // just clicking away anywhere off the canvas.
  useEffect(() => {
    if (!cropEditingId) return;
    const onDown = (e: PointerEvent) => {
      const wrap = canvasWrapRef.current;
      const target = e.target as Node | null;
      if (!wrap || !target) return;
      if (!wrap.contains(target)) setCropEditingId(null);
    };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, [cropEditingId]);

  // ---- Slider / color-picker transactions ----
  // Native <input type="range"> emits onChange per tick. Native <input
  // type="color"> can also emit live onChange while the user drags through
  // the OS picker on some browsers. Wrap the whole interaction
  // (pointerdown → pointerup) in one history transaction so the result is one
  // undoable step instead of dozens.
  useEffect(() => {
    let active = false;
    const isTransactional = (el: EventTarget | null): el is HTMLInputElement => {
      if (!el || !(el as HTMLElement).tagName) return false;
      const t = el as HTMLInputElement;
      return t.tagName === "INPUT" && (t.type === "range" || t.type === "color");
    };
    const onDown = (e: PointerEvent) => {
      // Close any dangling transaction — e.g. a native color picker that ate
      // the pointerup inside its OS dialog — before starting a new one.
      if (active) {
        active = false;
        endTransaction();
      }
      if (isTransactional(e.target)) {
        active = true;
        beginTransaction();
      }
    };
    const onUp = () => {
      if (active) {
        active = false;
        endTransaction();
      }
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [beginTransaction, endTransaction]);

  // ---- Z-order ----
  // Reorder the selected layers in design.layerOrder. The stack is stored
  // bottom→top, so "forward" means +1 index. Selected blocks move TOGETHER:
  // a contiguous run of selected ids is treated as one chunk so they don't
  // shuffle past each other.
  const reorderSelection = useCallback((op: "forward" | "backward" | "front" | "back") => {
    if (selectedIds.size === 0) return;
    const ids = selectedIds;
    setDoc((prevDoc) => {
      const prev = prevDoc.design;
      // Build the canonical bottom→top order at the moment of the action.
      const defaultOrder = [
        "overlay",
        ...prevDoc.canvasImages.map((ci) => `image:${ci.id}`),
        ...(prev.shapes ?? []).map((s) => `shape:${s.id}`),
        ...prev.texts.map((t) => `text:${t.id}`),
        "tbbqLogo",
      ];
      const order = reconcileLayerOrder(prev.layerOrder, defaultOrder);
      let next: string[];
      if (op === "forward") {
        next = [...order];
        for (let i = next.length - 2; i >= 0; i--) {
          if (!ids.has(next[i])) continue;
          if (ids.has(next[i + 1])) continue;
          [next[i], next[i + 1]] = [next[i + 1], next[i]];
        }
      } else if (op === "backward") {
        next = [...order];
        for (let i = 1; i < next.length; i++) {
          if (!ids.has(next[i])) continue;
          if (ids.has(next[i - 1])) continue;
          [next[i], next[i - 1]] = [next[i - 1], next[i]];
        }
      } else if (op === "front") {
        const others = order.filter((id) => !ids.has(id));
        const sel = order.filter((id) => ids.has(id));
        next = [...others, ...sel];
      } else {
        const others = order.filter((id) => !ids.has(id));
        const sel = order.filter((id) => ids.has(id));
        next = [...sel, ...others];
      }
      return { ...prevDoc, design: { ...prev, layerOrder: next } };
    });
  }, [selectedIds, setDoc]);

  // ---- Right-click context menu ----
  // Selection-aware lock/unlock + delete. The menu is rendered absolutely
  // positioned at the cursor; clicking outside closes it.
  const allSelectedLocked = (() => {
    if (selectedIds.size === 0) return false;
    for (const id of selectedIds) {
      if (id.startsWith("text:")) {
        const t = design.texts.find((tt) => `text:${tt.id}` === id);
        if (!t?.locked) return false;
      } else if (id.startsWith("image:")) {
        const im = canvasImages.find((ci) => `image:${ci.id}` === id);
        if (!im?.locked) return false;
      } else if (id.startsWith("shape:")) {
        const sh = (design.shapes ?? []).find((s) => `shape:${s.id}` === id);
        if (!sh?.locked) return false;
      }
    }
    return true;
  })();

  const toggleLockSelection = useCallback(() => {
    if (selectedIds.size === 0) return;
    const ids = selectedIds;
    // If everything in the selection is already locked → unlock all.
    // Otherwise → lock all. Standard toggle behavior.
    const target = !allSelectedLocked;
    setDoc((prev) => ({
      ...prev,
      design: {
        ...prev.design,
        texts: prev.design.texts.map((t) => (ids.has(`text:${t.id}`) ? { ...t, locked: target } : t)),
        shapes: (prev.design.shapes ?? []).map((s) => (ids.has(`shape:${s.id}`) ? { ...s, locked: target } : s)),
      },
      canvasImages: prev.canvasImages.map((ci) => (ids.has(`image:${ci.id}`) ? { ...ci, locked: target } : ci)),
    }));
    toast.success(`${target ? "Locked" : "Unlocked"} ${ids.size} layer${ids.size === 1 ? "" : "s"}`);
  }, [allSelectedLocked, selectedIds, setDoc]);

  const deleteSelection = useCallback(() => {
    if (selectedIds.size === 0) return;
    const ids = selectedIds;
    setDoc((prev) => ({
      ...prev,
      design: {
        ...prev.design,
        texts: prev.design.texts.filter((t) => !(ids.has(`text:${t.id}`) && !t.locked)),
        shapes: (prev.design.shapes ?? []).filter((s) => !(ids.has(`shape:${s.id}`) && !s.locked)),
      },
      canvasImages: prev.canvasImages.filter((ci) => !(ids.has(`image:${ci.id}`) && !ci.locked)),
    }));
    setSelectedIdsRaw(new Set());
  }, [selectedIds, setDoc]);

  // Cmd+G — bind the current 2+ selection into a new group.
  const groupSelection = useCallback(() => {
    if (selectedIds.size < 2) return;
    const ids = selectedIds;
    const newGroupId = `group-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setDoc((prev) => ({
      ...prev,
      design: {
        ...prev.design,
        texts: prev.design.texts.map((t) => (ids.has(`text:${t.id}`) ? { ...t, groupId: newGroupId } : t)),
        shapes: (prev.design.shapes ?? []).map((s) => (ids.has(`shape:${s.id}`) ? { ...s, groupId: newGroupId } : s)),
      },
      canvasImages: prev.canvasImages.map((ci) => (ids.has(`image:${ci.id}`) ? { ...ci, groupId: newGroupId } : ci)),
    }));
  }, [selectedIds, setDoc]);

  // Cmd+Shift+G — strip groupId from every selected element. Other group
  // members keep their shared id; only what you explicitly selected leaves.
  const ungroupSelection = useCallback(() => {
    if (selectedIds.size === 0) return;
    const ids = selectedIds;
    setDoc((prev) => ({
      ...prev,
      design: {
        ...prev.design,
        texts: prev.design.texts.map((t) => (ids.has(`text:${t.id}`) ? { ...t, groupId: undefined } : t)),
        shapes: (prev.design.shapes ?? []).map((s) => (ids.has(`shape:${s.id}`) ? { ...s, groupId: undefined } : s)),
      },
      canvasImages: prev.canvasImages.map((ci) => (ids.has(`image:${ci.id}`) ? { ...ci, groupId: undefined } : ci)),
    }));
  }, [selectedIds, setDoc]);

  // ---- Copy / paste / duplicate ----
  const copySelection = useCallback(() => {
    if (selectedIds.size === 0) return;
    const ids = selectedIds;
    clipboardRef.current = {
      texts: design.texts.filter((t) => ids.has(`text:${t.id}`)),
      shapes: (design.shapes ?? []).filter((s) => ids.has(`shape:${s.id}`)),
      images: canvasImages.filter((ci) => ids.has(`image:${ci.id}`)),
    };
  }, [selectedIds, design.texts, design.shapes, canvasImages]);

  // Insert duplicates of the supplied elements with a small offset and
  // select the new copies. Used by both Cmd+V (clipboard) and the "Duplicate"
  // action in the Layers panel.
  const insertDuplicates = useCallback((src: NonNullable<typeof clipboardRef.current>) => {
    if (!src) return;
    const offset = 0.04;
    const clamp = (v: number) => Math.max(0, Math.min(1, v));
    const stamp = Date.now();
    const rand = () => Math.random().toString(36).slice(2, 6);
    const newTexts = src.texts.map((t) => ({
      ...t,
      id: `text-${stamp}-${rand()}`,
      position: { x: clamp(t.position.x + offset), y: clamp(t.position.y + offset) },
    }));
    const newShapes = src.shapes.map((s) => ({
      ...s,
      id: `shape-${stamp}-${rand()}`,
      x: clamp(s.x + offset),
      y: clamp(s.y + offset),
    }));
    const newImages = src.images.map((img) => ({
      ...img,
      id: `img-${stamp}-${rand()}`,
      x: clamp(img.x + offset),
      y: clamp(img.y + offset),
    }));
    if (!newTexts.length && !newShapes.length && !newImages.length) return;
    setDoc((prev) => ({
      ...prev,
      design: {
        ...prev.design,
        texts: [...prev.design.texts, ...newTexts],
        shapes: [...(prev.design.shapes ?? []), ...newShapes],
      },
      canvasImages: [...prev.canvasImages, ...newImages],
    }));
    const next = new Set<string>();
    for (const t of newTexts) next.add(`text:${t.id}`);
    for (const s of newShapes) next.add(`shape:${s.id}`);
    for (const i of newImages) next.add(`image:${i.id}`);
    setSelectedIdsRaw(next);
  }, [setDoc]);

  const pasteFromClipboard = useCallback(() => {
    if (clipboardRef.current) insertDuplicates(clipboardRef.current);
  }, [insertDuplicates]);

  const duplicateSelection = useCallback(() => {
    if (selectedIds.size === 0) return;
    const ids = selectedIds;
    insertDuplicates({
      texts: design.texts.filter((t) => ids.has(`text:${t.id}`)),
      shapes: (design.shapes ?? []).filter((s) => ids.has(`shape:${s.id}`)),
      images: canvasImages.filter((ci) => ids.has(`image:${ci.id}`)),
    });
  }, [selectedIds, design.texts, design.shapes, canvasImages, insertDuplicates]);

  // ---- Alignment / distribute ----
  // Measure each selected element's bbox from the DOM (in canvas-fractional
  // coords) and shift it so its edge/center aligns with the target rect.
  // Single-selection → align to canvas; multi → align to the selection bbox.
  type AlignOp = "left" | "center-h" | "right" | "top" | "middle-v" | "bottom" | "distribute-h" | "distribute-v";

  const alignSelection = useCallback((op: AlignOp) => {
    if (selectedIds.size === 0) return;
    const wrap = canvasWrapRef.current;
    if (!wrap) return;
    const cr = wrap.getBoundingClientRect();
    if (cr.width === 0 || cr.height === 0) return;

    interface Bx { x1: number; y1: number; x2: number; y2: number }
    const bboxes = new Map<string, Bx>();
    for (const id of selectedIds) {
      const el = document.querySelector<HTMLElement>(`[data-canvas-element="${id}"]`);
      if (!el) continue;
      // Skip locked elements — alignment shouldn't shove them around.
      if (el.dataset.locked === "true") continue;
      const er = el.getBoundingClientRect();
      bboxes.set(id, {
        x1: (er.left - cr.left) / cr.width,
        y1: (er.top - cr.top) / cr.height,
        x2: (er.right - cr.left) / cr.width,
        y2: (er.bottom - cr.top) / cr.height,
      });
    }
    if (bboxes.size === 0) return;
    // Distribute needs at least 3 elements to space between.
    if ((op === "distribute-h" || op === "distribute-v") && bboxes.size < 3) return;

    // Target: canvas for single, selection bbox for multi (except distribute,
    // which always uses first/last in the sort as anchors).
    const xs1 = Array.from(bboxes.values()).map((b) => b.x1);
    const xs2 = Array.from(bboxes.values()).map((b) => b.x2);
    const ys1 = Array.from(bboxes.values()).map((b) => b.y1);
    const ys2 = Array.from(bboxes.values()).map((b) => b.y2);
    const isMulti = bboxes.size > 1;
    const target = isMulti
      ? { x1: Math.min(...xs1), x2: Math.max(...xs2), y1: Math.min(...ys1), y2: Math.max(...ys2) }
      : { x1: 0, x2: 1, y1: 0, y2: 1 };

    const deltas = new Map<string, { dx: number; dy: number }>();

    if (op === "distribute-h" || op === "distribute-v") {
      const horiz = op === "distribute-h";
      const sorted = Array.from(bboxes.entries()).sort(([, a], [, b]) => {
        const aCenter = horiz ? (a.x1 + a.x2) / 2 : (a.y1 + a.y2) / 2;
        const bCenter = horiz ? (b.x1 + b.x2) / 2 : (b.y1 + b.y2) / 2;
        return aCenter - bCenter;
      });
      const center = (b: Bx) => (horiz ? (b.x1 + b.x2) / 2 : (b.y1 + b.y2) / 2);
      const firstC = center(sorted[0][1]);
      const lastC = center(sorted[sorted.length - 1][1]);
      const step = (lastC - firstC) / (sorted.length - 1);
      for (let i = 1; i < sorted.length - 1; i++) {
        const [id, b] = sorted[i];
        const targetC = firstC + step * i;
        const delta = targetC - center(b);
        deltas.set(id, horiz ? { dx: delta, dy: 0 } : { dx: 0, dy: delta });
      }
    } else {
      for (const [id, b] of bboxes) {
        let dx = 0, dy = 0;
        if (op === "left") dx = target.x1 - b.x1;
        else if (op === "center-h") dx = (target.x1 + target.x2) / 2 - (b.x1 + b.x2) / 2;
        else if (op === "right") dx = target.x2 - b.x2;
        else if (op === "top") dy = target.y1 - b.y1;
        else if (op === "middle-v") dy = (target.y1 + target.y2) / 2 - (b.y1 + b.y2) / 2;
        else if (op === "bottom") dy = target.y2 - b.y2;
        if (dx !== 0 || dy !== 0) deltas.set(id, { dx, dy });
      }
    }
    if (deltas.size === 0) return;

    setDoc((prev) => ({
      ...prev,
      design: {
        ...prev.design,
        texts: prev.design.texts.map((t) => {
          const d = deltas.get(`text:${t.id}`);
          return d ? { ...t, position: { x: t.position.x + d.dx, y: t.position.y + d.dy } } : t;
        }),
        shapes: (prev.design.shapes ?? []).map((s) => {
          const d = deltas.get(`shape:${s.id}`);
          return d ? { ...s, x: s.x + d.dx, y: s.y + d.dy } : s;
        }),
      },
      canvasImages: prev.canvasImages.map((ci) => {
        const d = deltas.get(`image:${ci.id}`);
        return d ? { ...ci, x: ci.x + d.dx, y: ci.y + d.dy } : ci;
      }),
    }));
  }, [selectedIds, setDoc]);

  // Nudge every (unlocked) selected element by a fractional delta. Opens a
  // history transaction on the first call and auto-closes it after 400ms of
  // no further nudges, so a streak of arrow presses is one undo step.
  const nudgeSelectionBy = useCallback((dx: number, dy: number) => {
    if (selectedIds.size === 0) return;
    const ids = selectedIds;
    const clamp = (v: number) => Math.max(0, Math.min(1, v));
    if (!nudgeTransactionOpenRef.current) {
      beginTransaction();
      nudgeTransactionOpenRef.current = true;
    }
    setDoc((prev) => ({
      ...prev,
      design: {
        ...prev.design,
        texts: prev.design.texts.map((t) =>
          ids.has(`text:${t.id}`) && !t.locked
            ? { ...t, position: { x: clamp(t.position.x + dx), y: clamp(t.position.y + dy) } }
            : t,
        ),
        shapes: (prev.design.shapes ?? []).map((s) =>
          ids.has(`shape:${s.id}`) && !s.locked
            ? { ...s, x: clamp(s.x + dx), y: clamp(s.y + dy) }
            : s,
        ),
      },
      canvasImages: prev.canvasImages.map((ci) =>
        ids.has(`image:${ci.id}`) && !ci.locked
          ? { ...ci, x: clamp(ci.x + dx), y: clamp(ci.y + dy) }
          : ci,
      ),
    }));
    if (nudgeTimerRef.current) clearTimeout(nudgeTimerRef.current);
    nudgeTimerRef.current = setTimeout(() => {
      if (nudgeTransactionOpenRef.current) {
        endTransaction();
        nudgeTransactionOpenRef.current = false;
      }
    }, 400);
  }, [selectedIds, setDoc, beginTransaction, endTransaction]);

  const handleCanvasContextMenu = useCallback((e: React.MouseEvent) => {
    // Read the target's data-canvas-element synchronously so we don't depend
    // on stale `selectedIds` from React's batched render. If the click hit a
    // canvas element, select it (and its group) before opening the menu —
    // otherwise the menu would operate on whatever was selected previously.
    const target = e.target as HTMLElement;
    const hitElement = target.closest?.<HTMLElement>("[data-canvas-element]");
    if (hitElement) {
      const id = hitElement.dataset.canvasElement;
      if (id) {
        e.preventDefault();
        if (!selectedIds.has(id)) {
          const gid = getGroupId(id);
          setSelectedIdsRaw(gid ? new Set(getAllInGroup(gid)) : new Set([id]));
        }
        setContextMenu({ x: e.clientX, y: e.clientY });
        return;
      }
    }
    // Empty-canvas right-click: open only if there's already a selection.
    if (selectedIds.size > 0) {
      e.preventDefault();
      setContextMenu({ x: e.clientX, y: e.clientY });
    }
  }, [selectedIds, getGroupId, getAllInGroup]);

  // Close the context menu on any click outside it (covered by a backdrop
  // div rendered below; nothing extra to wire here).

  // ---- Keyboard shortcuts ----
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      // Skip when the user is typing in a real input — let the browser/inline
      // editor handle its own undo/redo and other shortcuts.
      const target = e.target as HTMLElement | null;
      const isEditableTarget = !!target && (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      );
      if (meta && e.key.toLowerCase() === "e") {
        e.preventDefault();
        if (!isExporting && !isExportingVideo) handleExport();
        return;
      }
      if (!isEditableTarget && meta && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      }
      // Copy / paste canvas elements (in-memory clipboard).
      if (!isEditableTarget && meta && e.key.toLowerCase() === "c" && selectedIds.size > 0) {
        e.preventDefault();
        copySelection();
      }
      if (!isEditableTarget && meta && e.key.toLowerCase() === "v" && clipboardRef.current) {
        e.preventDefault();
        pasteFromClipboard();
      }
      // Cmd/Ctrl+D — quick "duplicate selection in place".
      if (!isEditableTarget && meta && e.key.toLowerCase() === "d" && selectedIds.size > 0) {
        e.preventDefault();
        duplicateSelection();
      }
      // Cmd/Ctrl+G — group selected; Cmd/Ctrl+Shift+G — ungroup.
      if (!isEditableTarget && meta && e.key.toLowerCase() === "g") {
        e.preventDefault();
        if (e.shiftKey) ungroupSelection();
        else groupSelection();
      }
      // Z-order — Photoshop conventions:
      //   ⌘]         bring forward
      //   ⌘[         send backward
      //   ⌘⇧]        bring to front
      //   ⌘⇧[        send to back
      if (!isEditableTarget && meta && (e.key === "]" || e.key === "[") && selectedIds.size > 0) {
        e.preventDefault();
        if (e.key === "]") reorderSelection(e.shiftKey ? "front" : "forward");
        else reorderSelection(e.shiftKey ? "back" : "backward");
      }
      // Arrow-key nudge — 1px per press, 10px with Shift. Skipped while
      // typing in inputs so caret movement still works there.
      if (!isEditableTarget && selectedIds.size > 0) {
        let dx = 0, dy = 0;
        if (e.key === "ArrowLeft") dx = -1;
        else if (e.key === "ArrowRight") dx = 1;
        else if (e.key === "ArrowUp") dy = -1;
        else if (e.key === "ArrowDown") dy = 1;
        if (dx !== 0 || dy !== 0) {
          e.preventDefault();
          const step = e.shiftKey ? 10 : 1;
          nudgeSelectionBy((dx * step) / dims.width, (dy * step) / dims.height);
        }
      }
      // Esc clears canvas selection (or exits crop-edit mode if active).
      if (!isEditableTarget && e.key === "Escape") {
        if (cropEditingId) {
          e.preventDefault();
          setCropEditingId(null);
        } else if (selectedIds.size > 0) {
          e.preventDefault();
          setSelectedIdsRaw(new Set());
        }
      }
      // Backspace / Delete removes every selected element (text + image).
      // Skipped when typing in inputs / contentEditable so the user can
      // still delete characters while editing a text inline.
      if (!isEditableTarget && (e.key === "Backspace" || e.key === "Delete") && selectedIds.size > 0) {
        e.preventDefault();
        const ids = selectedIds;
        // Locked elements survive deletion — user has to explicitly unlock
        // them first via the Layers panel or the right-click menu.
        setDoc((prev) => ({
          ...prev,
          design: {
            ...prev.design,
            texts: prev.design.texts.filter((t) => !(ids.has(`text:${t.id}`) && !t.locked)),
            shapes: (prev.design.shapes ?? []).filter((s) => !(ids.has(`shape:${s.id}`) && !s.locked)),
          },
          canvasImages: prev.canvasImages.filter((ci) => !(ids.has(`image:${ci.id}`) && !ci.locked)),
        }));
        setSelectedIdsRaw(new Set());
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isExporting, isExportingVideo, handleExport, undo, redo, selectedIds, cropEditingId, setDoc, copySelection, pasteFromClipboard, duplicateSelection, nudgeSelectionBy, dims.width, dims.height, groupSelection, ungroupSelection, reorderSelection]);

  const goToStep = useCallback((next: number) => {
    setCurrentStep(Math.max(1, Math.min(STEPS.length, next)));
  }, []);

  const canvasIsEmpty = design.texts.length === 0 && canvasImages.length === 0;

  // Compute the effective canvas-layer stack so the ImageDragOverlay's
  // z-index matches the actual rendered z of its image. Without this the
  // overlay sits below the image and never receives clicks.
  const effectiveLayerOrder = (() => {
    const defaultOrder = [
      "overlay",
      ...canvasImages.map((ci) => `image:${ci.id}`),
      ...(design.shapes ?? []).map((s) => `shape:${s.id}`),
      ...design.texts.map((t) => `text:${t.id}`),
      "tbbqLogo",
    ];
    return reconcileLayerOrder(design.layerOrder, defaultOrder);
  })();
  const layerZ = (id: string) => {
    const idx = effectiveLayerOrder.indexOf(id);
    return idx === -1 ? 0 : (idx + 1) * 10;
  };

  return (
    <div className="h-screen relative overflow-hidden">
      <AnimatedGradient />

      <div className="relative z-10 flex flex-col h-screen overflow-hidden">
        {/* Header */}
        <div className="px-8 py-5 flex items-center gap-4">
          <img src="/TechBBQ Logo Red.png" alt="TechBBQ" className="h-8" />
          <div>
            <h1 className="text-lg font-medium tracking-tight">
              Visual <span className="text-tbbq-gradient font-semibold">Generator</span>
            </h1>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => setTemplatesOpen(true)}
              aria-label="Templates"
              title="Saved templates"
              className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-medium border border-surface/40 bg-transparent text-foreground hover:border-surface hover:bg-white/5 transition-colors"
            >
              <LibraryBig className="w-3.5 h-3.5" strokeWidth={1.5} />
              Templates
              {templates.length > 0 && (
                <span className="ml-0.5 px-1.5 py-0.5 text-[9px] font-bold rounded-full bg-red text-surface leading-none">
                  {templates.length}
                </span>
              )}
            </button>
            <button
              onClick={handleReset}
              aria-label="Start over"
              title="Start over"
              className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-medium border border-surface/40 bg-transparent text-foreground hover:border-surface hover:bg-white/5 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" strokeWidth={1.5} />
              New
            </button>
            <FeedbackButton />
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 flex min-h-0 px-6 pb-6 gap-6">
          {/* Left: Stepper + active step content + navigator */}
          <div className="w-[400px] shrink-0 flex flex-col gap-3 max-h-full min-h-0">
            <Stepper steps={STEPS} current={currentStep} onChange={goToStep} />

            <GlassCard className="flex-1 min-h-0 p-4 overflow-y-auto">
              {currentStep === 1 && (
                <StepCanvas
                  format={format}
                  setFormat={setFormat}
                  customSize={customSize}
                  setCustomSize={setCustomSize}
                  design={design}
                  setDesign={setDesign}
                  presets={visiblePresets}
                  presetDisplayName={presetDisplayName}
                  presetCustomVariants={(p) => {
                    if (isUserPresetId(p.id)) {
                      return new Set<PlatformFormat>([
                        p.format,
                        ...((Object.keys(p.variants ?? {}) as PlatformFormat[])),
                      ]);
                    }
                    const v = presetOverrides[p.id]?.variants;
                    if (!v) return new Set<PlatformFormat>();
                    return new Set(Object.keys(v) as PlatformFormat[]);
                  }}
                  onLoadPreset={handleLoadPreset}
                />
              )}
              {currentStep === 2 && (
                <StepText design={design} setDesign={setDesign} focusedId={focusedTextId} />
              )}
              {currentStep === 3 && (
                <StepImages
                  canvasImages={canvasImages}
                  selectedImageId={selectedImageId}
                  setSelectedImageId={setSelectedImageId}
                  addCanvasImage={addCanvasImage}
                  updateCanvasImage={updateCanvasImage}
                  removeCanvasImage={removeCanvasImage}
                />
              )}
              {currentStep === 4 && (
                <StepElements
                  design={design}
                  setDesign={setDesign}
                  selectedShapeId={(() => {
                    if (selectedIds.size !== 1) return null;
                    const only = selectedIds.values().next().value;
                    return typeof only === "string" && only.startsWith("shape:") ? only.slice(6) : null;
                  })()}
                  onSelectShape={(id) => setSelectedIds(id ? new Set([`shape:${id}`]) : new Set())}
                />
              )}
            </GlassCard>

            <StepNavigator
              current={currentStep}
              total={STEPS.length}
              onBack={() => goToStep(currentStep - 1)}
              onNext={() => goToStep(currentStep + 1)}
              onFinish={handleExport}
              isFinishing={isExporting}
              exportFormat={exportFormat}
              onExportFormatChange={setExportFormat}
            />
          </div>

          {/* Right: Controls bar + Preview */}
          <div className="flex-1 flex flex-col min-h-0 min-w-0 gap-3">
            {/* Canvas controls strip — sits above the preview */}
            <div className="shrink-0 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-[10px] font-medium text-muted uppercase tracking-[0.18em]">
                <span className="inline-block size-1.5 rounded-full bg-red" />
                {dims.label} · {Math.round(scale * 100)}%
              </div>
              {showEditTip && !editingTextId && !canvasIsEmpty && (
                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-orange/10 border border-orange/30 text-[11px] text-amber">
                  <span>Tip: click any text on the canvas to edit it</span>
                  <button
                    onClick={dismissEditTip}
                    aria-label="Dismiss tip"
                    className="text-amber/70 hover:text-amber transition-colors"
                  >
                    <X className="w-3 h-3" strokeWidth={1.5} />
                  </button>
                </div>
              )}
              <div className="flex items-center gap-2">
                <div className="flex items-center rounded-lg bg-card-2 p-0.5">
                  <button
                    onClick={undo}
                    disabled={!canUndo}
                    aria-label="Undo"
                    title="Undo (⌘Z)"
                    className="flex items-center justify-center w-7 h-7 rounded-md text-muted hover:bg-white/10 hover:text-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                  >
                    <Undo2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                  </button>
                  <button
                    onClick={redo}
                    disabled={!canRedo}
                    aria-label="Redo"
                    title="Redo (⇧⌘Z)"
                    className="flex items-center justify-center w-7 h-7 rounded-md text-muted hover:bg-white/10 hover:text-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                  >
                    <Redo2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                  </button>
                </div>
                <button
                  onClick={() => setShowGrid(!showGrid)}
                  aria-label="Toggle compositional grid"
                  aria-pressed={showGrid}
                  title="Show / hide grid"
                  className={`flex items-center justify-center w-8 h-8 rounded-lg transition-colors ${
                    showGrid
                      ? "bg-red/20 text-orange border border-red/40"
                      : "border border-surface/40 bg-transparent text-muted hover:bg-white/5 hover:text-foreground"
                  }`}
                >
                  <Grid3x3 className="w-3.5 h-3.5" />
                </button>
                {/* Align popover */}
                <Popover.Root>
                  <Popover.Trigger asChild>
                    <button
                      disabled={selectedIds.size === 0}
                      aria-label="Align selection"
                      title={selectedIds.size === 0 ? "Select something to align" : selectedIds.size === 1 ? "Align to canvas" : "Align to selection"}
                      className="flex items-center justify-center w-8 h-8 rounded-lg border border-surface/40 bg-transparent text-muted hover:bg-white/5 hover:text-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <AlignCenterHorizontal className="w-3.5 h-3.5" />
                    </button>
                  </Popover.Trigger>
                  <Popover.Portal>
                    <Popover.Content
                      side="bottom"
                      align="end"
                      sideOffset={6}
                      className="z-50 rounded-lg bg-card-2 shadow-2xl p-2"
                    >
                      <div className="text-[9px] uppercase tracking-wider text-muted px-1 pb-1.5">
                        {selectedIds.size === 1 ? "Align to canvas" : `Align ${selectedIds.size} items`}
                      </div>
                      <div className="grid grid-cols-3 gap-1">
                        <AlignBtn icon={AlignStartVertical}    label="Left"   onClick={() => alignSelection("left")} />
                        <AlignBtn icon={AlignCenterVertical}   label="Center" onClick={() => alignSelection("center-h")} />
                        <AlignBtn icon={AlignEndVertical}      label="Right"  onClick={() => alignSelection("right")} />
                        <AlignBtn icon={AlignStartHorizontal}  label="Top"    onClick={() => alignSelection("top")} />
                        <AlignBtn icon={AlignCenterHorizontal} label="Middle" onClick={() => alignSelection("middle-v")} />
                        <AlignBtn icon={AlignEndHorizontal}    label="Bottom" onClick={() => alignSelection("bottom")} />
                      </div>
                      {selectedIds.size >= 3 && (
                        <>
                          <div className="text-[9px] uppercase tracking-wider text-muted px-1 pt-2 pb-1.5">Distribute</div>
                          <div className="grid grid-cols-2 gap-1">
                            <AlignBtn icon={AlignHorizontalDistributeCenter} label="Horiz." onClick={() => alignSelection("distribute-h")} />
                            <AlignBtn icon={AlignVerticalDistributeCenter}   label="Vert."  onClick={() => alignSelection("distribute-v")} />
                          </div>
                        </>
                      )}
                    </Popover.Content>
                  </Popover.Portal>
                </Popover.Root>
                <button
                  onClick={() => handleExport("jpeg")}
                  disabled={isExporting || canvasIsEmpty}
                  aria-label="Save as JPG"
                  title="Save as JPG (Instagram-ready)"
                  className="flex items-center justify-center w-8 h-8 rounded-lg border border-surface/40 bg-transparent text-muted hover:bg-white/5 hover:text-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
                <button
                  ref={layersToggleRef}
                  onClick={() => setShowLayers(!showLayers)}
                  aria-label="Toggle layers panel"
                  aria-pressed={showLayers}
                  title="Layers"
                  className={`flex items-center justify-center w-8 h-8 rounded-lg transition-colors ${
                    showLayers
                      ? "bg-red/20 text-orange border border-red/40"
                      : "border border-surface/40 bg-transparent text-muted hover:bg-white/5 hover:text-foreground"
                  }`}
                >
                  <LayersIcon className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setBgPaused(!bgPaused)}
                  aria-label={bgPaused ? "Resume animation" : "Pause animation"}
                  aria-pressed={bgPaused}
                  title={bgPaused ? "Resume animation" : "Pause animation"}
                  className={`flex items-center justify-center w-8 h-8 rounded-lg transition-colors ${
                    bgPaused
                      ? "bg-red/20 text-orange border border-red/40"
                      : "border border-surface/40 bg-transparent text-muted hover:bg-white/5 hover:text-foreground"
                  }`}
                >
                  {bgPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

          {lastLoadedPreset && (
            <div className="mb-2">
              <PresetEditingBar
                preset={lastLoadedPreset}
                displayName={presetDisplayName(lastLoadedPreset)}
                currentFormat={format}
                customFormats={customFormatsForCurrentPreset}
                builtInFormats={builtInFormatsForCurrentPreset}
                onSaveVariant={() => {
                  const isUser = isUserPresetId(lastLoadedPreset.id);
                  if (isUser) {
                    setUserPresetVariant(lastLoadedPreset.id, format, { customSize, design, canvasImages });
                  } else {
                    setPresetVariant(lastLoadedPreset.id, format, { customSize, design, canvasImages });
                  }
                  toast.success(`Saved ${format} variant of "${presetDisplayName(lastLoadedPreset)}"`);
                }}
                onResetVariant={
                  customFormatsForCurrentPreset.has(format)
                    ? () => {
                        const isUser = isUserPresetId(lastLoadedPreset.id);
                        if (isUser) removeUserPresetVariant(lastLoadedPreset.id, format);
                        else removePresetVariant(lastLoadedPreset.id, format);
                        toast.success(`Reset ${format} variant`);
                      }
                    : undefined
                }
                onDismiss={() => setLastLoadedPresetId(null)}
                onSelectFormat={(f) => handleLoadPresetAtFormat(lastLoadedPreset, f)}
              />
            </div>
          )}

          <div
            ref={previewContainerRef}
            className="flex-1 min-h-0 min-w-0 flex items-center justify-center overflow-hidden rounded-2xl bg-card relative"
          >
            {canvasIsEmpty && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                <div className="text-center text-muted">
                  <p className="text-base">Your visual will appear here</p>
                  <p className="text-xs mt-1 text-muted/70">Use the steps on the left to design it</p>
                </div>
              </div>
            )}
            {/* Floating logo toolbar — appears when the TechBBQ logo is
                selected. Lives outside the scaled canvas so it stays readable. */}
            {selectedIds.has("tbbqLogo") && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 rounded-full bg-black/85 backdrop-blur-md border border-white/10 px-3 py-2 shadow-xl">
                <span className="text-[11px] font-medium text-white/60 pl-0.5">Logo color</span>
                {LOGO_COLORS.map(({ id, label, swatch }) => {
                  const active = (design.logoStyle ?? "white") === id;
                  return (
                    <button
                      key={id}
                      onClick={() => setDesign((d) => ({ ...d, logoStyle: id }))}
                      title={label}
                      aria-label={`Logo color: ${label}`}
                      aria-pressed={active}
                      className={`w-6 h-6 rounded-full border-2 transition-all ${
                        active ? "border-[#FF6B00] scale-110" : "border-white/25 hover:border-white/50"
                      }`}
                      style={swatch}
                    />
                  );
                })}
              </div>
            )}
            <div
              style={{
                transform: `scale(${scale})`,
                transformOrigin: "center center",
              }}
            >
              <div
                ref={canvasWrapRef}
                onPointerDown={handleCanvasPointerDown}
                onContextMenu={handleCanvasContextMenu}
                style={{ position: "relative", width: dims.width, height: dims.height }}
              >
                <div ref={exportRef}>
                  <DynamicTemplate
                    design={design}
                    format={format}
                    customWidth={format === "custom" ? customSize.width : undefined}
                    customHeight={format === "custom" ? customSize.height : undefined}
                    canvasImages={canvasImages}
                    paused={bgPaused}
                    onEditText={(textId) => {
                      const t = design.texts.find((tt) => tt.id === textId);
                      if (t?.locked) {
                        // Locked text — select-only, never enters inline edit.
                        setSelectedIdsRaw(new Set([`text:${textId}`]));
                        setCropEditingId(null);
                        return;
                      }
                      const gid = t?.groupId;
                      if (gid) {
                        // Grouped text — selecting the group, not entering
                        // inline edit. Ungroup first to type into it.
                        setSelectedIdsRaw(new Set(getAllInGroup(gid)));
                      } else {
                        setEditingTextId(textId);
                        setSelectedIdsRaw(new Set([`text:${textId}`]));
                      }
                      setCropEditingId(null);
                      if (showEditTip) dismissEditTip();
                    }}
                    onTextContentChange={(textId, content) => {
                      setDesign((prev) => ({
                        ...prev,
                        texts: prev.texts.map((t) => (t.id === textId ? { ...t, content } : t)),
                      }));
                      setEditingTextId(null);
                    }}
                    // Logo drag is owned by the LogoDragOverlay now; passing
                    // undefined makes the in-canvas img non-interactive so
                    // the overlay captures all clicks.
                    selectedIds={selectedIds}
                    cropEditingId={cropEditingId}
                    onCropChange={(imageId, crop) => {
                      setCanvasImages((prev) =>
                        prev.map((ci) => (ci.id === imageId ? { ...ci, crop } : ci)),
                      );
                    }}
                    onBeginDrag={beginGroupDrag}
                    onMoveBy={groupDragMoveBy}
                    onEndDrag={endGroupDrag}
                    editingTextId={editingTextId}
                    onOverflowChange={(next) => {
                      setOverflow((prev) =>
                        prev.left === next.left && prev.right === next.right &&
                        prev.top === next.top && prev.bottom === next.bottom
                          ? prev
                          : next,
                      );
                    }}
                    onGuidesChange={setGuides}
                    onEditStart={beginTransaction}
                    onEditEnd={endTransaction}
                  />
                </div>
                {/* Red overflow bars — sit OUTSIDE exportRef so they appear in the
                    editor but never in PNG exports. Positioned along the canvas
                    edges; thickness scales with canvas dims for visibility. */}
                {(overflow.left || overflow.right || overflow.top || overflow.bottom) && (() => {
                  // 1px at canvas resolution stays roughly 1 device px on screen
                  // once the preview scale is applied — invert by 1/scale so it
                  // measures 1px after CSS transform: scale.
                  const barThickness = Math.max(1, Math.round(1 / scale));
                  const barStyle: React.CSSProperties = {
                    position: "absolute",
                    backgroundColor: "#ce0f2e",
                    zIndex: 100,
                    pointerEvents: "none",
                  };
                  return (
                    <>
                      {overflow.left && <div style={{ ...barStyle, left: 0, top: 0, bottom: 0, width: barThickness }} />}
                      {overflow.right && <div style={{ ...barStyle, right: 0, top: 0, bottom: 0, width: barThickness }} />}
                      {overflow.top && <div style={{ ...barStyle, left: 0, right: 0, top: 0, height: barThickness }} />}
                      {overflow.bottom && <div style={{ ...barStyle, left: 0, right: 0, bottom: 0, height: barThickness }} />}
                    </>
                  );
                })()}

                {/* Snap guide lines — orange. Live during drag, gone on release.
                    Inverse-scale thickness so they stay 1 device pixel on screen
                    regardless of preview zoom. */}
                {(guides.x !== null || guides.y !== null) && (() => {
                  const lineThickness = Math.max(1, Math.round(1 / scale));
                  const lineStyle: React.CSSProperties = {
                    position: "absolute",
                    backgroundColor: "#fa7000",
                    zIndex: 90,
                    pointerEvents: "none",
                  };
                  return (
                    <>
                      {guides.x !== null && (
                        <div
                          style={{
                            ...lineStyle,
                            left: `${guides.x * 100}%`,
                            top: 0,
                            bottom: 0,
                            width: lineThickness,
                            transform: `translateX(-${lineThickness / 2}px)`,
                          }}
                        />
                      )}
                      {guides.y !== null && (
                        <div
                          style={{
                            ...lineStyle,
                            top: `${guides.y * 100}%`,
                            left: 0,
                            right: 0,
                            height: lineThickness,
                            transform: `translateY(-${lineThickness / 2}px)`,
                          }}
                        />
                      )}
                    </>
                  );
                })()}

                {/* Compositional grid overlay — visual only, never exports. */}
                {showGrid && (
                  <svg
                    width="100%"
                    height="100%"
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                    style={{
                      position: "absolute",
                      inset: 0,
                      pointerEvents: "none",
                      zIndex: 95,
                    }}
                  >
                    {/* 100×100 fine grid */}
                    {Array.from({ length: 99 }).map((_, i) => (
                      <line key={`v-${i}`} x1={i + 1} y1={0} x2={i + 1} y2={100} stroke="white" strokeOpacity={0.08} strokeWidth={Math.max(0.03, 0.05 / scale)} />
                    ))}
                    {Array.from({ length: 99 }).map((_, i) => (
                      <line key={`h-${i}`} x1={0} y1={i + 1} x2={100} y2={i + 1} stroke="white" strokeOpacity={0.08} strokeWidth={Math.max(0.03, 0.05 / scale)} />
                    ))}
                  </svg>
                )}

                {/* Marquee selection rectangle — rendered while user drags an
                    empty-canvas area. Sits OUTSIDE exportRef so it never appears
                    in PNG output. */}
                {marquee && (() => {
                  const x = Math.min(marquee.x1, marquee.x2);
                  const y = Math.min(marquee.y1, marquee.y2);
                  const w = Math.abs(marquee.x2 - marquee.x1);
                  const h = Math.abs(marquee.y2 - marquee.y1);
                  return (
                    <div
                      style={{
                        position: "absolute",
                        left: `${x * 100}%`,
                        top: `${y * 100}%`,
                        width: `${w * 100}%`,
                        height: `${h * 100}%`,
                        border: `${Math.max(1, Math.round(1 / scale))}px solid #fa7000`,
                        background: "rgba(250, 112, 0, 0.08)",
                        pointerEvents: "none",
                        zIndex: 150,
                      }}
                    />
                  );
                })()}

                {/* Lock badges — small 🔒 icon on every locked element so the
                    user has a visible cue. Lives outside exportRef so it
                    never appears in PNG/JPG output. */}
                {[
                  ...canvasImages.filter((ci) => ci.locked).map((ci) => ({
                    key: `lock-img-${ci.id}`,
                    x: ci.x, y: ci.y, w: ci.width, h: ci.height,
                  })),
                  ...(design.shapes ?? []).filter((s) => s.locked && !s.hidden).map((s) => ({
                    key: `lock-shape-${s.id}`,
                    x: s.x, y: s.y, w: s.width, h: s.height,
                  })),
                  ...design.texts.filter((t) => t.locked && !t.hidden).map((t) => ({
                    key: `lock-text-${t.id}`,
                    x: t.position.x, y: t.position.y, w: 0, h: 0,
                  })),
                ].map((b) => (
                  <div
                    key={b.key}
                    title="Locked layer"
                    style={{
                      position: "absolute",
                      left: `${(b.x + b.w / 2) * 100}%`,
                      top: `${(b.y - b.h / 2) * 100}%`,
                      transform: "translate(-100%, 0)",
                      pointerEvents: "none",
                      zIndex: 80,
                    }}
                  >
                    <div
                      style={{
                        background: "rgba(250, 112, 0, 0.9)",
                        color: "white",
                        padding: `${Math.max(3, Math.round(3 / scale))}px ${Math.max(4, Math.round(4 / scale))}px`,
                        borderRadius: Math.max(2, Math.round(3 / scale)),
                        margin: Math.max(2, Math.round(4 / scale)),
                        fontSize: Math.max(8, Math.round(11 / scale)),
                        display: "flex",
                        alignItems: "center",
                        lineHeight: 1,
                      }}
                    >
                      <Lock style={{ width: Math.max(8, Math.round(11 / scale)), height: Math.max(8, Math.round(11 / scale)) }} />
                    </div>
                  </div>
                ))}

                {/* Drag overlays — one per canvas image, outside exportRef */}
                {canvasImages.map((img) => (
                  // Suppress the drag/resize overlay while THIS image is in
                  // crop-edit mode — the in-template crop UI takes pointer
                  // events for panning, and we don't want the bbox/handles to
                  // intercept clicks.
                  cropEditingId === img.id ? null :
                  <ImageDragOverlay
                    key={img.id}
                    image={img}
                    otherImages={canvasImages.filter((ci) => ci.id !== img.id)}
                    canvasWidth={dims.width}
                    canvasHeight={dims.height}
                    selected={selectedIds.has(`image:${img.id}`)}
                    resizable={selectedImageId === img.id}
                    zIndex={layerZ(`image:${img.id}`)}
                    onSelect={() => selectWithGroup(`image:${img.id}`)}
                    onDeselect={() => setSelectedImageId(null)}
                    onChange={(updated) => setCanvasImages((prev) =>
                      prev.map((ci) => (ci.id === updated.id ? updated : ci))
                    )}
                    onGuidesChange={setGuides}
                    onEditStart={beginTransaction}
                    onEditEnd={endTransaction}
                    onBeginDrag={beginGroupDrag}
                    onMoveBy={groupDragMoveBy}
                    onEndDrag={endGroupDrag}
                    onEnterCrop={async () => {
                      // Make sure we know the source's natural dimensions —
                      // load them on demand for legacy images that don't
                      // have them stored yet.
                      let nW = img.naturalWidth;
                      let nH = img.naturalHeight;
                      if (!nW || !nH) {
                        try {
                          const dims = await new Promise<{ w: number; h: number }>((resolve, reject) => {
                            const el = new Image();
                            el.onload = () => resolve({ w: el.naturalWidth, h: el.naturalHeight });
                            el.onerror = reject;
                            el.src = img.src;
                          });
                          nW = dims.w;
                          nH = dims.h;
                        } catch {
                          // Fall through with no normalization.
                        }
                      }
                      setCanvasImages((prev) => prev.map((ci) => {
                        if (ci.id !== img.id) return ci;
                        const cur = ci.crop ?? { x: 0, y: 0, width: 1, height: 1 };
                        // If we lack natural dims, fall back to the legacy
                        // 80% seed (may still squish — graceful degradation).
                        if (!nW || !nH) {
                          if (cur.width < 1 || cur.height < 1) return ci;
                          return { ...ci, crop: { x: 0.1, y: 0.1, width: 0.8, height: 0.8 } };
                        }
                        // Normalize the crop's source-fraction aspect to
                        // (frame aspect / source aspect). This is the ratio
                        // that makes the crop window's RENDERED pixels match
                        // the frame's aspect — without it the inline crop
                        // editor (which assumes uniform scale) squishes.
                        const frameAspect = ci.width / ci.height;
                        const sourceAspect = nW / nH;
                        const targetFracAspect = frameAspect / sourceAspect;
                        let cw = cur.width;
                        let ch = cur.height;
                        // Prefer growing the shorter dimension over shrinking
                        // the longer one — otherwise repeated frame-resize +
                        // crop cycles monotonically shrink the crop, which
                        // makes the in-canvas crop preview balloon
                        // (fullW = frameW / cropW grows unboundedly).
                        if (cw / ch > targetFracAspect) {
                          const tryCh = cw / targetFracAspect;
                          if (tryCh <= 1) {
                            ch = tryCh;
                          } else {
                            ch = 1;
                            cw = ch * targetFracAspect;
                          }
                        } else {
                          const tryCw = ch * targetFracAspect;
                          if (tryCw <= 1) {
                            cw = tryCw;
                          } else {
                            cw = 1;
                            ch = cw / targetFracAspect;
                          }
                        }
                        const centerX = cur.x + cur.width / 2;
                        const centerY = cur.y + cur.height / 2;
                        const cx = Math.max(0, Math.min(1 - cw, centerX - cw / 2));
                        const cy = Math.max(0, Math.min(1 - ch, centerY - ch / 2));
                        return {
                          ...ci,
                          naturalWidth: nW,
                          naturalHeight: nH,
                          crop: { x: cx, y: cy, width: cw, height: ch },
                        };
                      }));
                      setCropEditingId(img.id);
                    }}
                    onDelete={() => removeCanvasImage(img.id)}
                    onDuplicate={() => {
                      const dup: CanvasImage = {
                        ...img,
                        id: `img-${Date.now()}`,
                        x: Math.min(img.x + 0.05, 1),
                        y: Math.min(img.y + 0.05, 1),
                      };
                      addCanvasImage(dup);
                    }}
                  />
                ))}

                {/* Drag overlays — one per visible shape, outside exportRef.
                    Hidden shapes don't render either the shape body or its
                    overlay (otherwise there'd be an invisible-but-clickable
                    bbox blocking the canvas). */}
                {(design.shapes ?? []).filter((sh) => !sh.hidden).map((sh) => {
                  // Other-element bboxes for snap targets (other shapes,
                  // images, and text bboxes computed on the fly via
                  // measurement would be ideal — for now we snap to other
                  // shapes and images only).
                  const otherBboxes: Bbox[] = [
                    ...(design.shapes ?? []).filter((o) => o.id !== sh.id).map((o) => ({
                      x: o.x, y: o.y, width: o.width, height: o.height,
                    })),
                    ...canvasImages.map((ci) => ({
                      x: ci.x, y: ci.y, width: ci.width, height: ci.height,
                    })),
                  ];
                  return (
                    <ShapeDragOverlay
                      key={sh.id}
                      shape={sh}
                      otherBboxes={otherBboxes}
                      canvasWidth={dims.width}
                      canvasHeight={dims.height}
                      selected={selectedIds.has(`shape:${sh.id}`)}
                      resizable={selectedIds.size === 1 && selectedIds.has(`shape:${sh.id}`)}
                      zIndex={layerZ(`shape:${sh.id}`)}
                      onSelect={() => selectWithGroup(`shape:${sh.id}`)}
                      onChange={(updated) =>
                        setDesign((prev) => ({
                          ...prev,
                          shapes: (prev.shapes ?? []).map((s) => (s.id === updated.id ? updated : s)),
                        }))
                      }
                      onGuidesChange={setGuides}
                      onEditStart={beginTransaction}
                      onEditEnd={endTransaction}
                      onBeginDrag={beginGroupDrag}
                      onMoveBy={groupDragMoveBy}
                      onEndDrag={endGroupDrag}
                      onPlaceholderUpload={replacePlaceholderWithImage}
                    />
                  );
                })}

                {/* TechBBQ logo — overlay handles selection + move + resize.
                 *  Uses fractional canvas coords just like every other element. */}
                {design.showLogo && (
                  <LogoDragOverlay
                    design={design}
                    canvasWidth={dims.width}
                    canvasHeight={dims.height}
                    isPortrait={dims.height > dims.width}
                    selected={selectedIds.has("tbbqLogo")}
                    zIndex={layerZ("tbbqLogo")}
                    onSelect={() => setSelectedIds(new Set(["tbbqLogo"]))}
                    onChange={(patch) =>
                      setDesign((prev) => {
                        const next = { ...prev } as DesignConfig;
                        if (patch.logoScale !== undefined) next.logoScale = patch.logoScale;
                        if (patch.logoCustomPosition !== undefined) {
                          if (patch.logoCustomPosition === null) {
                            delete next.logoCustomPosition;
                          } else {
                            next.logoCustomPosition = patch.logoCustomPosition;
                          }
                        }
                        return next;
                      })
                    }
                    onGuidesChange={setGuides}
                    onEditStart={beginTransaction}
                    onEditEnd={endTransaction}
                    onBeginDrag={beginGroupDrag}
                    onMoveBy={groupDragMoveBy}
                    onEndDrag={endGroupDrag}
                    otherBboxes={[
                      ...canvasImages.map((ci) => ({ x: ci.x, y: ci.y, width: ci.width, height: ci.height })),
                      ...(design.shapes ?? []).map((s) => ({ x: s.x, y: s.y, width: s.width, height: s.height })),
                    ]}
                  />
                )}
              </div>
            </div>

            {/* Floating Layers panel — toggled from the controls strip.
                Docks to the opposite corner from the TechBBQ logo so it
                doesn't hide what the user is styling. */}
            {showLayers && (
              <div ref={layersPanelRef} className={`absolute top-4 z-30 w-72 max-h-[calc(100%-2rem)] flex flex-col bg-card-2 border border-border rounded-xl shadow-2xl overflow-hidden ${design.logoPosition?.endsWith("right") ? "left-4" : "right-4"}`}>
                <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
                  <span className="text-[10px] font-medium text-orange uppercase tracking-[0.18em]">
                    <LayersIcon className="w-3 h-3 inline-block mr-1.5 -mt-0.5" strokeWidth={1.5} />
                    Layers
                  </span>
                  <button
                    onClick={() => setShowLayers(false)}
                    aria-label="Close layers panel"
                    className="p-1 rounded text-muted hover:text-foreground hover:bg-white/10 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" strokeWidth={1.5} />
                  </button>
                </div>
                <div className="overflow-y-auto p-3">
                  <LayersPanel
                    design={design}
                    setDesign={setDesign}
                    canvasImages={canvasImages}
                    setCanvasImages={setCanvasImages}
                    selectedImageId={selectedImageId}
                    setSelectedImageId={setSelectedImageId}
                    removeCanvasImage={removeCanvasImage}
                    onEditText={(textId) => {
                      setEditingTextId(textId);
                      setSelectedIdsRaw(new Set([`text:${textId}`]));
                    }}
                    onSelectShape={(shapeId) => setSelectedIds(new Set([`shape:${shapeId}`]))}
                    onDuplicateRow={(layerId) => {
                      const src: NonNullable<typeof clipboardRef.current> = { texts: [], shapes: [], images: [] };
                      if (layerId.startsWith("text:")) {
                        const t = design.texts.find((tt) => `text:${tt.id}` === layerId);
                        if (t) src.texts.push(t);
                      } else if (layerId.startsWith("shape:")) {
                        const sh = (design.shapes ?? []).find((s) => `shape:${s.id}` === layerId);
                        if (sh) src.shapes.push(sh);
                      } else if (layerId.startsWith("image:")) {
                        const im = canvasImages.find((ci) => `image:${ci.id}` === layerId);
                        if (im) src.images.push(im);
                      }
                      insertDuplicates(src);
                    }}
                  />
                </div>
              </div>
            )}

            {/* Inline text editing happens on the canvas itself (contentEditable). */}
          </div>
          </div>
        </div>
      </div>

      {/* Templates modal (save / load / delete). */}
      <TemplatesModal
        open={templatesOpen}
        onClose={() => setTemplatesOpen(false)}
        templates={templates}
        onSave={async (name) => {
          await saveTemplate({ name, doc, thumbnailNode: exportRef.current });
        }}
        onLoad={(t: SavedTemplate) => {
          // Use setDoc (not replaceDoc) so the previous state is pushed onto
          // the undo stack — Cmd/Ctrl+Z restores what the user was working on.
          setDoc(t.doc);
          setSelectedIdsRaw(new Set());
          setCropEditingId(null);
          setTemplatesOpen(false);
          toast.success(`Loaded "${t.name}"`);
        }}
        onDelete={deleteTemplate}
        onRename={renameTemplate}
        presets={visiblePresets}
        currentFormat={format}
        onLoadPreset={(preset) => {
          handleLoadPreset(preset);
          setTemplatesOpen(false);
        }}
        onHidePreset={(id) => {
          if (isUserPresetId(id)) {
            removeUserPreset(id);
            toast.success("Preset deleted");
          } else {
            hidePreset(id);
            toast.success("Preset hidden — restore from the modal footer");
          }
        }}
        hiddenPresetCount={hiddenPresets.size}
        onRestoreHidden={restoreHiddenPresets}
        onRenamePreset={(id, n) => {
          if (isUserPresetId(id)) {
            updateUserPresetName(id, n);
            if (n.trim()) toast.success(`Renamed to "${n.trim()}"`);
          } else {
            setPresetOverrideName(id, n);
            if (n.trim()) toast.success(`Renamed to "${n.trim()}"`);
            else toast.success("Restored original preset name");
          }
        }}
        presetDisplayName={presetDisplayName}
        isUserPreset={(p) => isUserPresetId(p.id)}
        onSaveAsPreset={(name) => {
          const id = `user-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
          const preset = buildPresetFromDoc(doc, {
            id,
            name,
            description: `Custom layout · ${doc.canvasImages.length} image(s) converted to placeholders.`,
            category: "event",
          });
          addUserPreset(preset);
          setLastLoadedPresetId(id);
          toast.success(`Saved "${name}" as a preset — find it under "Built-in presets"`);
        }}
        currentPresetId={lastLoadedPresetId}
        onSaveVariant={(presetId) => {
          const variant = { customSize, design, canvasImages };
          if (isUserPresetId(presetId)) setUserPresetVariant(presetId, format, variant);
          else setPresetVariant(presetId, format, variant);
          const p = visiblePresets.find((x) => x.id === presetId);
          toast.success(`Saved current canvas as ${format} variant of "${p?.name ?? presetId}"`);
        }}
        presetCustomVariants={(p) => {
          if (isUserPresetId(p.id)) {
            // For user presets, "your" variants are the ones stored on the
            // preset itself (default format + any variants).
            return new Set<PlatformFormat>([p.format, ...((Object.keys(p.variants ?? {}) as PlatformFormat[]))]);
          }
          const v = presetOverrides[p.id]?.variants;
          if (!v) return new Set();
          return new Set(Object.keys(v) as PlatformFormat[]);
        }}
        onResetVariant={(id, f) => {
          if (isUserPresetId(id)) removeUserPresetVariant(id, f);
          else removePresetVariant(id, f);
          toast.success(`Reset ${f} variant`);
        }}
        presetDisplayGroup={presetDisplayGroup}
        onMovePreset={(id, group) => {
          if (isUserPresetId(id)) updateUserPresetGroup(id, group);
          else setPresetOverrideGroup(id, group);
          if (group.trim()) toast.success(`Moved to "${group}"`);
          else toast.success("Reset folder");
        }}
        folderOrder={folderOrder}
        onReorderFolders={(next) => setFolderOrder(next)}
        onCopyAsPreset={(name) => {
          const id = name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "") || `preset-${Date.now()}`;
          return serializeAsPreset(doc, {
            id,
            name,
            description: `Custom layout — ${doc.canvasImages.length} image(s) converted to placeholders.`,
            category: "event",
          });
        }}
      />

      {/* Right-click context menu for the canvas selection. */}
      {contextMenu && (
        <>
          <div
            onClick={() => setContextMenu(null)}
            onContextMenu={(e) => { e.preventDefault(); setContextMenu(null); }}
            className="fixed inset-0 z-[200]"
            style={{ background: "transparent" }}
          />
          <div
            className="fixed z-[201] min-w-[160px] rounded-lg border border-border bg-card-2 shadow-2xl p-1"
            style={{ left: Math.min(contextMenu.x, window.innerWidth - 180), top: Math.min(contextMenu.y, window.innerHeight - 100) }}
          >
            <button
              onClick={() => { duplicateSelection(); setContextMenu(null); }}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[11px] text-white/85 hover:bg-white/10 transition-colors"
            >
              <Copy className="w-3.5 h-3.5 text-white/60" />
              <span>Duplicate</span>
              <span className="ml-auto text-[10px] text-white/30">⌘D</span>
            </button>

            {/* Z-order */}
            <div className="my-1 border-t border-white/10" />
            <button
              onClick={() => { reorderSelection("forward"); setContextMenu(null); }}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[11px] text-white/85 hover:bg-white/10 transition-colors"
            >
              <ChevronUp className="w-3.5 h-3.5 text-white/60" />
              <span>Bring forward</span>
              <span className="ml-auto text-[10px] text-white/30">⌘]</span>
            </button>
            <button
              onClick={() => { reorderSelection("front"); setContextMenu(null); }}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[11px] text-white/85 hover:bg-white/10 transition-colors"
            >
              <ChevronsUp className="w-3.5 h-3.5 text-white/60" />
              <span>Bring to front</span>
              <span className="ml-auto text-[10px] text-white/30">⇧⌘]</span>
            </button>
            <button
              onClick={() => { reorderSelection("backward"); setContextMenu(null); }}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[11px] text-white/85 hover:bg-white/10 transition-colors"
            >
              <ChevronDown className="w-3.5 h-3.5 text-white/60" />
              <span>Send backward</span>
              <span className="ml-auto text-[10px] text-white/30">⌘[</span>
            </button>
            <button
              onClick={() => { reorderSelection("back"); setContextMenu(null); }}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[11px] text-white/85 hover:bg-white/10 transition-colors"
            >
              <ChevronsDown className="w-3.5 h-3.5 text-white/60" />
              <span>Send to back</span>
              <span className="ml-auto text-[10px] text-white/30">⇧⌘[</span>
            </button>

            {/* Group / Ungroup */}
            {(selectedIds.size >= 2 || Array.from(selectedIds).some((id) => getGroupId(id))) && (
              <div className="my-1 border-t border-white/10" />
            )}
            {selectedIds.size >= 2 && (
              <button
                onClick={() => { groupSelection(); setContextMenu(null); }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[11px] text-white/85 hover:bg-white/10 transition-colors"
              >
                <Group className="w-3.5 h-3.5 text-white/60" />
                <span>Group</span>
                <span className="ml-auto text-[10px] text-white/30">⌘G</span>
              </button>
            )}
            {Array.from(selectedIds).some((id) => getGroupId(id)) && (
              <button
                onClick={() => { ungroupSelection(); setContextMenu(null); }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[11px] text-white/85 hover:bg-white/10 transition-colors"
              >
                <Ungroup className="w-3.5 h-3.5 text-white/60" />
                <span>Ungroup</span>
                <span className="ml-auto text-[10px] text-white/30">⇧⌘G</span>
              </button>
            )}

            {/* Lock + Delete */}
            <div className="my-1 border-t border-white/10" />
            <button
              onClick={() => { toggleLockSelection(); setContextMenu(null); }}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[11px] text-white/85 hover:bg-white/10 transition-colors"
            >
              {allSelectedLocked ? <Unlock className="w-3.5 h-3.5 text-orange" strokeWidth={1.5} /> : <Lock className="w-3.5 h-3.5 text-white/60" strokeWidth={1.5} />}
              <span>{allSelectedLocked ? "Unlock" : "Lock"}</span>
            </button>
            <button
              onClick={() => { deleteSelection(); setContextMenu(null); }}
              disabled={allSelectedLocked}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[11px] text-red hover:bg-red/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
