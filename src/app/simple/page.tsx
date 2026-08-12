"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Check, ChevronDown, Download, Film, GripVertical, Loader2, Plus, Minus, Trash2, ImagePlus, X, Square, Presentation, Smartphone, PencilRuler, Users, Handshake, HeartHandshake, Columns2, LayoutGrid, ChevronLeft, ChevronRight, Library, Save, Shuffle, Ticket, Timer, BadgePercent, SkipForward } from "lucide-react";
import { Popover } from "radix-ui";
import { TeamLibrary, type LibraryLoadedItem } from "@/components/TeamLibrary";
import { AuthChip } from "@/components/AuthChip";
import { AnimatedGradient } from "@/components/AnimatedGradient";
import { DynamicTemplate } from "@/components/templates/DynamicTemplate";
import { BackgroundPicker } from "@/components/BackgroundPicker";
import { useExport, VIDEO_MAX_SECONDS, VIDEO_MIN_SECONDS, VIDEO_PRESETS, type ExportFormat } from "@/hooks/useExport";
import { isAnimatedBackground } from "@/components/CanvasBackground";
import { AccentThumbnail } from "@/components/CanvasAccents";
import { ACCENT_OPTIONS } from "@/lib/accents";
import { LogoLibraryPicker, asUploadedImage } from "@/components/LogoLibraryPicker";
import { PARTNER_PROJECTS, type PartnerSet } from "@/data/partnerSets";
import { PartnerSetBrowser } from "@/components/PartnerSetBrowser";
import { isSvgDataUrl, tintSvgDataUrl } from "@/lib/svgTint";
import { ColorPicker } from "@/components/ColorPicker";
import type { PlatformFormat } from "@/types/template";
import { buildSimpleDesign, buildNextDesign, buildPartnerDesign, buildSalesDesign, bundleCoverage, docKindOf, emptyForm, emptyNextForm, emptyPartnerForm, emptyPerson, emptySalesForm, formsFromDoc, isBlankPerson, isNextDoc, isPartnerDoc, mergePersonDescription, migrateLegacyPanelDoc, NEXT_MAX_SPEAKERS, panelShapeKey, parkDoc, partnerLayoutOf, retargetPartnerLayout, retargetSalesLayout, retargetTunedDoc, salesLayoutOf, sampleFourthSpeaker, shuffleWallLogos, simpleExportName, stripFormsForSave, syncNextChrome, syncPanelChrome, syncPartnerChrome, THANKS_MAX_LOGOS, THANKS_MIN_LOGOS, THANKS_SCRIM_MAX, type NextForm, type SimpleForm, type PartnerForm, type PartnerLogo, type SalesForm, type SimplePerson, type SimpleDoc, type TemplateCoverage } from "@/lib/simpleLayout";

type TemplateKind = "panel" | "partner" | "sales" | "next";

/** What the Save button produces: a still image, or a 3-second MP4 of the
 *  animated background. */
type SaveFormat = ExportFormat | "mp4";
const isVideoFormat = (f: SaveFormat): f is "mp4" => f === "mp4";
/** The video row's label carries the chosen length, since that is the thing
 *  worth seeing before you commit 30 seconds to a recording. */
const saveLabel = (f: SaveFormat, seconds: number): string =>
  f === "mp4" ? `MP4 · ${seconds}s video` : f === "jpeg" ? "JPG" : "PNG";

const TEMPLATES: { id: TemplateKind; label: string; icon: typeof Users }[] = [
  { id: "panel", label: "Panel", icon: Users },
  { id: "next", label: "Next Session", icon: SkipForward },
  { id: "partner", label: "Partner", icon: Handshake },
  { id: "sales", label: "Sale", icon: Ticket },
];

// The sales template's two compositions — the countdown post and the discount
// post. Same form, like the partner template's One/Two/Four.
const SALES_LAYOUTS: { id: SalesForm["layout"]; label: string; icon: typeof Square }[] = [
  { id: "countdown", label: "Countdown", icon: Timer },
  { id: "discount", label: "Discount", icon: BadgePercent },
];

const FORMATS: { id: PlatformFormat; label: string; sub: string; icon: typeof Square }[] = [
  { id: "presentation", label: "16:9", sub: "Full HD", icon: Presentation },
  { id: "square", label: "1:1", sub: "Square", icon: Square },
  { id: "story", label: "9:16", sub: "Story", icon: Smartphone },
];

// Read a File into a data-URL plus its natural dimensions.
function readImage(file: File): Promise<{ src: string; w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const src = reader.result as string;
      const img = new Image();
      img.onload = () => resolve({ src, w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = reject;
      img.src = src;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Small labelled text input. `multiline` renders a textarea so titles can span
// several lines (Enter inserts a line break) — a broken headline renders bigger.
function Field({ label, value, onChange, placeholder, multiline, hint }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; multiline?: boolean; hint?: string }) {
  const cls = "w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B00]/70 focus:border-[#FF6B00]/40";
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-medium text-white/65 uppercase tracking-[0.16em]">
        {label}
        {hint && <span className="ml-1.5 normal-case tracking-normal text-white/35">{hint}</span>}
      </span>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={2}
          className={`${cls} resize-none leading-snug`}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={cls}
        />
      )}
    </label>
  );
}

// One person block (moderator or a speaker): photo + name + description.
function PersonEditor({
  person, onChange, onRemove, roleLabel, showPhoto = true,
}: {
  person: SimplePerson;
  onChange: (patch: Partial<SimplePerson>) => void;
  onRemove?: () => void;
  roleLabel: string;
  /** Hides the upload for a board that renders no headshots. Both templates
   *  show photos now — the Next board gained its photo row on 2026-08-12 — so
   *  nothing passes false today; kept for the next text-only board. */
  showPhoto?: boolean;
}) {
  return (
    <div className="flex gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] p-2.5">
      {/* Photo */}
      {showPhoto && (
      <div className="relative shrink-0">
        <label className="relative flex items-center justify-center w-14 h-14 rounded-xl overflow-hidden border border-white/15 bg-white/5 cursor-pointer hover:border-[#FF6B00]/60 transition-colors group">
          {person.photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={person.photo} alt="" className="w-full h-full object-cover" />
          ) : (
            <ImagePlus className="w-5 h-5 text-white/40 group-hover:text-white/70" />
          )}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              try {
                const { src, w, h } = await readImage(file);
                onChange({ photo: src, naturalWidth: w, naturalHeight: h });
              } catch {
                toast.error("Couldn't read that image");
              }
              e.target.value = "";
            }}
          />
        </label>
        {person.photo && (
          <button
            onClick={() => onChange({ photo: "", naturalWidth: undefined, naturalHeight: undefined })}
            aria-label="Remove photo"
            title="Remove photo"
            className="absolute -top-1.5 -right-1.5 w-5 h-5 flex items-center justify-center rounded-full bg-black/75 border border-white/20 text-white/80 hover:bg-black hover:text-white transition-colors"
          >
            <X className="w-2.5 h-2.5" strokeWidth={2.5} />
          </button>
        )}
      </div>
      )}
      {/* Fields */}
      <div className="flex-1 flex flex-col gap-1.5 min-w-0">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold text-orange uppercase tracking-[0.16em]">{roleLabel}</span>
          {onRemove && (
            <button onClick={onRemove} aria-label="Remove speaker" title="Remove speaker" className="p-0.5 rounded text-white/50 hover:text-white hover:bg-white/10 transition-colors">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <input type="text" value={person.name} onChange={(e) => onChange({ name: e.target.value })} placeholder="Full name"
          className="w-full px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm font-medium text-white placeholder:text-white/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B00]/70 focus:border-[#FF6B00]/40" />
        <input type="text" value={person.title} onChange={(e) => onChange({ title: e.target.value })} placeholder="Job title, company" aria-label="Description"
          className="w-full px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white placeholder:text-white/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B00]/70 focus:border-[#FF6B00]/40" />
      </div>
    </div>
  );
}

/** Swatches for logo recolouring. White and black lead: a knockout is the
 *  common case on the dark canvas, brand colours come after. */
const LOGO_SWATCHES = [
  { value: "#FFFFFF", label: "White" },
  { value: "#15110E", label: "Black" },
  { value: "#FF0028", label: "TechBBQ red" },
  { value: "#FF6B00", label: "Orange" },
  { value: "#FFD000", label: "Gold" },
];

/**
 * Recolour control for a filled logo slot — one swatch button that opens the
 * standard colour popover (brand row, recents, hex input), with clear = back to
 * the original artwork. SVG only: a raster has no colours to rewrite, so nothing
 * renders for a PNG. Multi-colour marks flatten to a single colour, which is the
 * point when you need a knockout, hence "original" is always one click away.
 */
function LogoTintRow({ tint, onTint }: { tint?: string; onTint: (colour: string | null) => void }) {
  return (
    <div className="flex items-center gap-1.5 pt-1">
      <ColorPicker
        compact
        allowClear
        color={tint}
        defaultColor="#FFFFFF"
        ariaLabel="Recolour this logo"
        swatches={LOGO_SWATCHES}
        onChange={(c) => onTint(c ?? null)}
      />
      <span className="text-[10px] leading-tight text-white/45">
        {tint ? "Recoloured" : "Recolour"}
      </span>
    </div>
  );
}

// One partner-logo upload slot: dropzone → contain-fit preview + remove.
// A logo file can be DROPPED straight onto any slot. Moving a logo between
// slots is a POINTER drag with a click-vs-drag threshold (same pattern as the
// editor canvas): press and hold anywhere on the logo, move past ~5px, drop
// on another slot. A sub-threshold press stays a plain click and opens the
// file picker. HTML5 drag-and-drop is NOT used for the reorder — a draggable
// container hijacked plain clicks, and a grip handle demanded pixel-precise
// aim; both live-failed. The ‹ › buttons remain the keyboard path.
function LogoSlot({ logo, onChange, small, onSwapPrev, onSwapNext, index, onReorder, onTint, emptyLabel = "Upload the partner's logo" }: { logo: PartnerLogo | null; onChange: (l: PartnerLogo | null) => void; small?: boolean; onSwapPrev?: () => void; onSwapNext?: () => void; index?: number; onReorder?: (from: number, to: number) => void; onTint?: (colour: string | null) => void; emptyLabel?: string }) {
  const [dragOver, setDragOver] = useState(false);
  const [dragging, setDragging] = useState(false);
  // Pointer-drag bookkeeping: where the press started, and whether the
  // threshold was crossed (=> the following click must not open the picker).
  const pressRef = useRef<{ x: number; y: number } | null>(null);
  const draggedRef = useRef(false);
  const reorderable = index !== undefined && Boolean(onReorder);

  const slotIndexAt = (x: number, y: number): number | null => {
    const el = document.elementFromPoint(x, y)?.closest("[data-logo-slot]");
    const raw = el?.getAttribute("data-logo-slot");
    return raw == null ? null : Number(raw);
  };

  return (
    <div
      data-logo-slot={reorderable ? index : undefined}
      className="relative select-none"
      onDragOver={(e) => {
        // External image files can still be dropped straight onto a slot.
        if (e.dataTransfer.types.includes("Files")) {
          e.preventDefault();
          setDragOver(true);
        }
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={async (e) => {
        setDragOver(false);
        const file = e.dataTransfer.files?.[0];
        if (file && file.type.startsWith("image/")) {
          e.preventDefault();
          try {
            const { src, w, h } = await readImage(file);
            onChange({ src, naturalWidth: w, naturalHeight: h });
          } catch {
            toast.error("Couldn't read that image");
          }
        }
      }}
    >
      <label
        onPointerDown={(e) => {
          if (!reorderable || !logo?.src || e.button !== 0) return;
          pressRef.current = { x: e.clientX, y: e.clientY };
          draggedRef.current = false;
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!pressRef.current) return;
          const dx = e.clientX - pressRef.current.x;
          const dy = e.clientY - pressRef.current.y;
          if (!draggedRef.current && Math.hypot(dx, dy) > 5) {
            draggedRef.current = true;
            setDragging(true);
            window.getSelection()?.removeAllRanges();
          }
          if (draggedRef.current) e.preventDefault(); // no text-selection rectangle
        }}
        onPointerUp={(e) => {
          if (!pressRef.current) return;
          pressRef.current = null;
          if (!draggedRef.current) return; // plain click — the label opens the picker
          setDragging(false);
          const to = slotIndexAt(e.clientX, e.clientY);
          if (to !== null && to !== index) onReorder!(index as number, to);
        }}
        onPointerCancel={() => { pressRef.current = null; draggedRef.current = false; setDragging(false); }}
        onClickCapture={(e) => {
          // A drag ends with a click on the label — swallow it so the file
          // picker doesn't open on top of the reorder.
          if (draggedRef.current) { e.preventDefault(); e.stopPropagation(); draggedRef.current = false; }
        }}
        className={`relative flex items-center justify-center ${small ? "h-20" : "h-28"} rounded-xl overflow-hidden border transition-colors group ${dragging ? "opacity-60 cursor-grabbing border-[#FF6B00]" : "cursor-pointer"} ${dragOver ? "border-[#FF6B00] bg-[#FF6B00]/10" : logo?.src ? "border-white/15 bg-white/5" : "border-dashed border-white/15 bg-white/[0.03] hover:border-[#FF6B00]/60"}`}
        style={{ touchAction: "none" }}
      >
        {logo?.src ? (
          // draggable={false}: the browser's native image drag would fight
          // both the label click and the handle's reorder payload.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo.src} alt="" draggable={false} className="max-w-[85%] max-h-[80%] object-contain" />
        ) : (
          <span className="flex flex-col items-center gap-1.5 text-white/40 group-hover:text-white/70 transition-colors">
            <ImagePlus className={small ? "w-5 h-5" : "w-6 h-6"} />
            {!small && <span className="text-xs">{emptyLabel}</span>}
          </span>
        )}
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            try {
              const { src, w, h } = await readImage(file);
              onChange({ src, naturalWidth: w, naturalHeight: h });
            } catch {
              toast.error("Couldn't read that image");
            }
            e.target.value = "";
          }}
        />
      </label>
      {logo?.src && (
        <button
          onClick={() => onChange(null)}
          aria-label="Remove logo"
          title="Remove logo"
          className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded-full bg-black/75 border border-white/20 text-white/80 hover:bg-black hover:text-white transition-colors"
        >
          <X className="w-3 h-3" strokeWidth={2.5} />
        </button>
      )}
      {logo?.src && reorderable && (
        // Pure affordance — the drag itself works from anywhere on the logo
        // (pointer handlers on the label above), so this must not eat events.
        <span
          aria-hidden
          title="Hold and drag to move this logo to another slot"
          className="absolute top-2 left-2 w-6 h-6 flex items-center justify-center rounded-full bg-black/75 border border-white/20 text-white/60 pointer-events-none"
        >
          <GripVertical className="w-3.5 h-3.5" strokeWidth={2} />
        </span>
      )}
      {/* Recolour: SVG logos only (see LogoTintRow). */}
      {onTint && isSvgDataUrl(logo?.originalSrc ?? logo?.src) && (
        <LogoTintRow tint={logo?.tint} onTint={onTint} />
      )}
      {logo?.src && onSwapPrev && (
        <button
          onClick={onSwapPrev}
          aria-label="Move logo to previous position"
          title="Move to previous position"
          className="absolute bottom-2 left-2 w-6 h-6 flex items-center justify-center rounded-full bg-black/75 border border-white/20 text-white/80 hover:bg-black hover:text-white transition-colors"
        >
          <ChevronLeft className="w-3.5 h-3.5" strokeWidth={2.5} />
        </button>
      )}
      {logo?.src && onSwapNext && (
        <button
          onClick={onSwapNext}
          aria-label="Move logo to next position"
          title="Move to next position"
          className="absolute bottom-2 right-2 w-6 h-6 flex items-center justify-center rounded-full bg-black/75 border border-white/20 text-white/80 hover:bg-black hover:text-white transition-colors"
        >
          <ChevronRight className="w-3.5 h-3.5" strokeWidth={2.5} />
        </button>
      )}
    </div>
  );
}

// sessionStorage keys for the round-trip with the advanced editor.
const ADVANCED_STORAGE_KEY = "tbbqvisualgen.session.v4"; // the editor hydrates from this
const HANDOFF_FLAG_KEY = "tbbqvisualgen.simple.handoff"; // set when we hand off, so we re-adopt on return
const CUSTOM_KEY = "tbbqvisualgen.simple.custom.v2"; // the fine-tuned doc — localStorage, so it outlives the tab
// localStorage (not session) so a closed tab doesn't cost you the panel.
const FORM_KEY = "tbbqvisualgen.simpleForm.v1";
// Tuned designs for setups you are not currently on (e.g. the 3-speaker one
// while you are temporarily on 2), so stepping back restores them.
const PARKED_KEY = "tbbqvisualgen.simple.parked.v1";
// Which library id this tab has already applied from the URL — makes the
// ?load= deep link one-shot per tab, so refreshes keep local edits.
const DEEPLINK_DONE_KEY = "tbbqvisualgen.simple.deeplink.done";
// The "Official Host" library item — hosts cap at 2, unlike panels.
const HOST_ITEM_ID = "e3fce4c3-8afc-4d87-9dd5-3ddc5425b993";
// The library item the current design belongs to ({id, name, kind, coverage}
// JSON) — drives the header "Update <name>" button and the sidebar's
// set-up-for hints. Session-scoped like the marker.
const LOADED_ITEM_KEY = "tbbqvisualgen.simple.loadedItem";

interface PersistedForm {
  form: SimpleForm;
  format: PlatformFormat;
  stash: SimplePerson[];
  template?: TemplateKind;
  partner?: PartnerForm;
  sales?: SalesForm;
  next?: NextForm;
}

/** Drop dataURL photos — the fallback when the full form busts the quota. */
function withoutPhotos({ form, format, stash, template, partner, sales, next }: PersistedForm): PersistedForm {
  const strip = (p: SimplePerson): SimplePerson => ({ ...p, photo: "", naturalWidth: undefined, naturalHeight: undefined });
  return {
    format,
    template,
    partner: partner ? { ...partner, logos: [] } : undefined,
    sales: sales ? { ...sales, photo: null } : undefined,
    // The Next board carries headshots too since its photo row landed
    // (2026-08-12), and they are dataURLs like the panel's — same treatment.
    next: next ? { ...next, moderator: strip(next.moderator), speakers: next.speakers.map(strip) } : undefined,
    form: { ...form, moderator: strip(form.moderator), speakers: form.speakers.map(strip) },
    stash: stash.map(strip),
  };
}

/**
 * Uploaded photos are dataURLs, so a panel of headshots can approach the ~5MB
 * per-origin cap. Rather than lose everything, fall back to saving the form
 * without images so the typed details still survive a refresh.
 */
function persistForm(state: PersistedForm): void {
  try {
    localStorage.setItem(FORM_KEY, JSON.stringify(state));
  } catch {
    try {
      localStorage.setItem(FORM_KEY, JSON.stringify(withoutPhotos(state)));
    } catch { /* out of room entirely — keep working in memory */ }
  }
}

/** Is there actually a design here? A doc with no text, no shapes and no
 *  photos renders as a blank canvas — never worth adopting or restoring. */
function hasContent(doc: SimpleDoc): boolean {
  return (doc.design?.texts?.length ?? 0) > 0
    || (doc.design?.shapes?.length ?? 0) > 0
    || (doc.canvasImages?.length ?? 0) > 0;
}

/** How many tuned-but-inactive designs to keep on the shelf. The chrome sync
 *  parks a doc for EVERY layout the user visits (3 formats × 3 partner
 *  layouts = 9 reachable keys, plus label-cleared shapes and panel docs), so
 *  this must cover a whole tour — the quota catch in persistTuned is the
 *  real storage backstop. The trim drops the least-recently-TOUCHED entries
 *  first (parkDoc re-inserts at the end), so the design the user keeps
 *  returning to is never the one evicted. */
const MAX_PARKED = 16;

/**
 * Save the active tuned design plus the parked ones. The active design matters
 * most, so it's written first and on its own — a shelf too big for the quota
 * must never cost you the panel you're actually looking at.
 */
function persistTuned(active: SimpleDoc | null, parked: Record<string, SimpleDoc>): void {
  try {
    if (active) localStorage.setItem(CUSTOM_KEY, JSON.stringify(active));
    else localStorage.removeItem(CUSTOM_KEY);
  } catch { /* over quota — it stays in memory for this session */ }

  // Keep as many of the most-recently-touched entries as fit: a shelf too
  // big for the quota sheds its stalest docs first (halving until it fits)
  // instead of vanishing wholesale.
  for (let keep = Math.min(Object.keys(parked).length, MAX_PARKED); keep > 0; keep = Math.floor(keep / 2)) {
    try {
      localStorage.setItem(PARKED_KEY, JSON.stringify(Object.fromEntries(Object.entries(parked).slice(-keep))));
      return;
    } catch { /* try fewer */ }
  }
  try { localStorage.removeItem(PARKED_KEY); } catch { /* ignore */ }
}

export default function SimplePage() {
  const [form, setForm] = useState<SimpleForm>(emptyForm);
  const [template, setTemplate] = useState<TemplateKind>("panel");
  const [partner, setPartner] = useState<PartnerForm>(emptyPartnerForm);
  const [sales, setSales] = useState<SalesForm>(emptySalesForm);
  const [next, setNext] = useState<NextForm>(emptyNextForm);
  const [format, setFormat] = useState<PlatformFormat>("square");
  // Gates the persist + override-drop effects until the one-time hydrate has
  // landed, so restoring a saved form doesn't read as "the user edited it".
  const [hydrated, setHydrated] = useState(false);
  // People parked by lowering the speaker count — popped back in order when
  // the count goes up again, so a mis-click doesn't cost you their details.
  const [stash, setStash] = useState<SimplePerson[]>([]);
  // "mp4" is a save format alongside the two image ones — offered only when
  // the background actually animates (see canAnimate below).
  const [exportFormat, setExportFormat] = useState<SaveFormat>("jpeg");
  // How long an MP4 records for. Real time, so this is also how long the user
  // has to sit and watch it — hence a visible number rather than a hidden
  // constant.
  const [videoSeconds, setVideoSeconds] = useState(3);
  // What the length field shows while it is being typed into — see the input.
  const [videoSecondsDraft, setVideoSecondsDraft] = useState("3");
  const [paused, setPaused] = useState(false);
  // When the user fine-tunes in the advanced editor, we adopt their edited doc
  // here and render THAT instead of the form-generated layout — so coming back
  // to the simple panel shows exactly what they saved. Any form/format edit
  // drops the override (rebuilds from the form).
  const [custom, setCustom] = useState<SimpleDoc | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  // Tuned designs for shapes we are not on right now, keyed by panelShapeKey.
  const [parked, setParked] = useState<Record<string, SimpleDoc>>({});
  // Which library item the design on screen belongs to — set by loading or
  // saving, cleared by Revert. Drives the header "Update <name>" button.
  const [loadedItem, setLoadedItem] = useState<{ id: string; name: string; kind: TemplateKind } | null>(null);
  const [updatingItem, setUpdatingItem] = useState(false);
  // What the loaded template consists of — its (format × layout) combos.
  // Shown as dots on the Format / logo-layout buttons plus a "set up for /
  // not set up for" line, so nobody has to discover by clicking around that
  // a template only exists in 1:1.
  const [coverage, setCoverage] = useState<TemplateCoverage[] | null>(null);

  const { exportRef, isExporting, isExportingVideo, videoProgress, exportImage, exportMp4 } = useExport();
  const genDoc = useMemo(
    () => (template === "partner" ? buildPartnerDesign(partner, format)
      : template === "sales" ? buildSalesDesign(sales, format)
      : template === "next" ? buildNextDesign(next, format)
      : buildSimpleDesign(form, format)),
    [template, partner, sales, next, form, format],
  );
  const doc = custom ?? genDoc;
  const { width: W, height: H } = doc.customSize;

  // On mount: adopt the fine-tuned doc when returning from the editor (or a
  // previously-kept one on refresh).
  useEffect(() => {
    try {
      if (sessionStorage.getItem(HANDOFF_FLAG_KEY)) {
        const raw = sessionStorage.getItem(ADVANCED_STORAGE_KEY);
        if (raw) {
          const s = JSON.parse(raw);
          const adopted = migrateLegacyPanelDoc({ format: s.format, customSize: s.customSize, design: s.design, canvasImages: s.canvasImages ?? [] } as SimpleDoc);
          // Only adopt a design with something in it. An empty editor doc used
          // to be a transient annoyance you could close the tab on; now that
          // tuning is saved, adopting one would strand you on a blank panel.
          if (hasContent(adopted)) {
            setCustom(adopted);
            // Persist the adopted doc NOW, not in the debounced persist effect.
            // This effect runs twice in dev (StrictMode): run 1 adopts and
            // consumes the handoff flag, so run 2 falls into the else branch
            // and restores CUSTOM_KEY — which still held the PREVIOUS tuning
            // and silently overwrote the fresh one (every second fine-tune
            // "reverted"). Writing it here makes the re-run read the fresh doc.
            try { localStorage.setItem(CUSTOM_KEY, JSON.stringify(adopted)); } catch { /* quota — keep it in memory */ }
          }
        }
        sessionStorage.removeItem(HANDOFF_FLAG_KEY);
      } else {
        const rawCustom = localStorage.getItem(CUSTOM_KEY);
        if (rawCustom) {
          const saved = migrateLegacyPanelDoc(JSON.parse(rawCustom) as SimpleDoc);
          // Same guard on the way back in — never restore someone onto a blank
          // canvas, and clear the bad entry so it stops haunting them.
          if (hasContent(saved)) setCustom(saved);
          else localStorage.removeItem(CUSTOM_KEY);
        }
      }
      const rawParked = localStorage.getItem(PARKED_KEY);
      if (rawParked) {
        // Migrate + RE-KEY: a role-less parked doc sits under a key no rebuild
        // can reproduce, so its tuning would never revive. Order (= touch
        // recency) is preserved by the map.
        const shelf = JSON.parse(rawParked) as Record<string, SimpleDoc>;
        setParked(Object.fromEntries(Object.values(shelf).map((d) => {
          const m = migrateLegacyPanelDoc(d);
          return [panelShapeKey(m), m];
        })));
      }
      const rawLoaded = sessionStorage.getItem(LOADED_ITEM_KEY);
      if (rawLoaded) {
        const li = JSON.parse(rawLoaded);
        setLoadedItem({ id: li.id, name: li.name, kind: li.kind });
        if (Array.isArray(li.coverage)) setCoverage(li.coverage);
      }
    } catch { /* start fresh */ }

    // Restore the last panel. Done here rather than in a useState initializer
    // so the prerendered HTML and the first client render still agree.
    try {
      const rawForm = localStorage.getItem(FORM_KEY);
      if (rawForm) {
        const saved = JSON.parse(rawForm) as Partial<PersistedForm>;
        if (saved?.form?.speakers) {
          // Old saved forms carry two-field people — fold company into the
          // single description field (no-op on current forms).
          setForm({
            ...saved.form,
            moderator: mergePersonDescription(saved.form.moderator),
            speakers: saved.form.speakers.map(mergePersonDescription),
          });
          if (saved.format) setFormat(saved.format);
          setStash((saved.stash ?? []).map(mergePersonDescription));
          if (saved.template) setTemplate(saved.template);
          if (saved.sales) setSales({ ...emptySalesForm(), ...saved.sales });
          // Merged over the defaults so a form saved before a field existed
          // still hydrates with that field defined.
          if (saved.next) setNext({ ...emptyNextForm(), ...saved.next });
          if (saved.partner) {
            // Migrate the short-lived single-`logo` shape (2026-07-21 morning)
            // to the slot-array shape.
            // Forms saved before the thank-you wall existed have no headline or
            // logoCount — the defaults fill those in.
            const p = saved.partner as PartnerForm & { logo?: string; naturalWidth?: number; naturalHeight?: number };
            setPartner(Array.isArray(p.logos) ? { ...emptyPartnerForm(), ...p } : {
              ...emptyPartnerForm(),
              label: p.label,
              layout: "single",
              logos: p.logo ? [{ src: p.logo, naturalWidth: p.naturalWidth, naturalHeight: p.naturalHeight }] : [],
              backgroundId: p.backgroundId,
            });
          }
        }
      }
    } catch { /* start fresh */ }
    setHydrated(true);
  }, []);

  // Save on every change, once hydrated — the guard stops the initial sample
  // form from overwriting a saved panel before it has been read back.
  useEffect(() => {
    if (!hydrated) return;
    persistForm({ form, format, stash, template, partner, sales, next });
  }, [hydrated, form, format, stash, template, partner, sales, next]);

  // A form edit used to bin the fine-tuned design outright. Now the words are
  // re-pointed at the tuned layers instead, so retyping a title costs you
  // nothing. Only an edit that changes WHICH layers exist — a new speaker, a
  // cleared field, a different format — forces a rebuild, because the tuned
  // design has no layer to carry the change.
  const baselineRef = useRef<string>("");
  useEffect(() => {
    // Wait for the hydrate, else restoring a saved form looks like an edit and
    // needlessly bins the fine-tuned override.
    if (!hydrated) return;
    const key = JSON.stringify([template, form, partner, sales, next, format]);
    // A custom doc of the WRONG KIND for this template — a panel doc on the
    // canvas while the partner form is up (Auri's screenshot: Host design
    // under the Partner Announcement sidebar) — must never survive, however
    // the state was reached (effect races on fast template/flavour clicks,
    // or a corrupted tab persisted to localStorage). It bypasses the baseline
    // early-returns, so the mismatch heals even when the form is unchanged
    // and even on the first run after hydrate; the normal flow below then
    // parks the doc (recoverable) and revives/builds the right kind.
    const kindMismatch = Boolean(custom && docKindOf(custom) !== template);
    if (!kindMismatch) {
      if (baselineRef.current === "") { baselineRef.current = key; return; }
      if (key === baselineRef.current) return;
    }
    baselineRef.current = key;

    const rebuilt = template === "partner" ? buildPartnerDesign(partner, format)
      : template === "sales" ? buildSalesDesign(sales, format)
      : template === "next" ? buildNextDesign(next, format)
      : buildSimpleDesign(form, format);

    if (custom) {
      // Same shape → carry the tuning across, only the words change. For a
      // partner doc, a slot gaining/losing its logo changes the shape but not
      // the layout — reconcile the slots instead of binning the tuning.
      const retargeted = retargetTunedDoc(custom, rebuilt)
        ?? (template === "partner" ? retargetPartnerLayout(custom, rebuilt, partner.layout)
          : template === "sales" ? retargetSalesLayout(custom, rebuilt, sales.layout)
          : null);
      if (retargeted) {
        setCustom(retargeted);
        return;
      }
      // Different shape → park it (touch-recency insert, see parkDoc).
      // Stepping 3 → 2 → 3, or flipping format and back, must not cost the
      // tuning just because it can't apply right now.
      setParked((p) => parkDoc(p, custom));
    }

    // Coming back to a shape we've tuned before? Put it back. Exact shape
    // first; else, for partner docs, any parked design of the same logo
    // layout — a saved Two-logo variant must revive even when the number of
    // uploaded logos differs from when it was tuned. (Scan order is reversed
    // insertion order — any same-layout match is equally valid, retarget
    // re-checks format/size/roles itself.)
    // Named `revivedNext`, not `next`: the Next Session form owns `next` in
    // this component, and a local of that name would shadow it — including in
    // the `buildNextDesign(next, …)` call above, which sits in the same scope.
    const revived = parked[panelShapeKey(rebuilt)];
    let revivedNext = revived ? retargetTunedDoc(revived, rebuilt) : null;
    if (!revivedNext && template === "partner") {
      for (const d of Object.values(parked).reverse()) {
        revivedNext = retargetPartnerLayout(d, rebuilt, partner.layout);
        if (revivedNext) break;
      }
    }
    // Same fallback for the sales template: a tuned countdown/discount design
    // must revive even when its photo slot is filled differently than when it
    // was parked (uploading the photo changes the shape, not the composition).
    if (!revivedNext && template === "sales") {
      for (const d of Object.values(parked).reverse()) {
        revivedNext = retargetSalesLayout(d, rebuilt, sales.layout);
        if (revivedNext) break;
      }
    }
    // Same format, different layout: the chrome (label position, hand-drawn
    // lines, TechBBQ logo) follows the user across One/Two/Four — tune it
    // once, it stays put in every layout of this format. Applies to a revived
    // variant AND to the generic rebuild of a not-yet-tuned layout.
    // isPartnerDoc(custom): on a TEMPLATE switch `custom` is still the doc of
    // the template being left — panel chrome must never flow into a partner
    // doc (or the reverse; the panel branch below has the mirror guard).
    if (template === "partner" && custom && isPartnerDoc(custom)
      && custom.format === rebuilt.format
      && custom.customSize.width === rebuilt.customSize.width
      && custom.customSize.height === rebuilt.customSize.height) {
      revivedNext = syncPartnerChrome(custom, revivedNext ?? rebuilt);
    }
    // Same idea for panels: a speaker-count change must not move the header
    // or the moderator card, so both are carried from the design being left.
    // Gated like the partner block — the sync returns its target UNCHANGED on
    // a guard bail, which would still wrongly promote a generic rebuild to a
    // "custom" doc if called cross-format or with a partner doc as source.
    // docKindOf, not !isPartnerDoc: a Next board also passes the partner check,
    // and panel chrome flowing into one would drag its banner geometry onto a
    // panel header (and vice versa).
    if (template === "panel" && custom && docKindOf(custom) === "panel"
      && custom.format === rebuilt.format
      && custom.customSize.width === rebuilt.customSize.width
      && custom.customSize.height === rebuilt.customSize.height) {
      revivedNext = syncPanelChrome(custom, revivedNext ?? rebuilt);
    }
    // Same contract for the Next board: the banner, chip and title hold still
    // while speakers come and go. Guarded identically.
    if (template === "next" && custom && isNextDoc(custom)
      && custom.format === rebuilt.format
      && custom.customSize.width === rebuilt.customSize.width
      && custom.customSize.height === rebuilt.customSize.height) {
      revivedNext = syncNextChrome(custom, revivedNext ?? rebuilt);
    }
    setCustom(revivedNext);
  }, [hydrated, template, form, partner, sales, next, format, custom, parked]);

  // Keep the tuned designs across tab closes — they were session-only, so
  // shutting the tab silently threw the fine-tuning away.
  useEffect(() => {
    if (!hydrated) return;
    persistTuned(custom, parked);
  }, [hydrated, custom, parked]);

  // Load a team-library design: adopt its doc as the active custom design AND
  // sync the whole sidebar to it — template toggle (a partner doc must not sit
  // behind a Panel form), format, and the form fields themselves (from the
  // snapshot saved with the doc, or reconstructed from role-tagged layers for
  // older items). The rebuild baseline is synced too, so restoring the form
  // doesn't read as an edit and retarget (or bin) the doc we just loaded.
  // Adopt a library item as "what I'm working on": header Update button, the
  // re-copyable ?load= URL, and the applied-marker so a refresh keeps edits.
  const adoptLibraryIdentity = (id: string, name: string, kind: TemplateKind, cov: TemplateCoverage[]) => {
    setLoadedItem({ id, name, kind });
    setCoverage(cov);
    try {
      window.history.replaceState(null, "", `${window.location.pathname}?load=${id}`);
      sessionStorage.setItem(DEEPLINK_DONE_KEY, id);
      sessionStorage.setItem(LOADED_ITEM_KEY, JSON.stringify({ id, name, kind, coverage: cov }));
    } catch { /* URL cosmetics only */ }
  };

  const handleLibraryLoad = (item: LibraryLoadedItem) => {
    const { simpleForms, simpleVariants: rawVariants, ...rawDoc } = item.doc;
    // Items saved before photo roles existed can't rehydrate their sidebar
    // photos or ever shape-match a rebuild, and pre-description-merge items
    // carry separate company layers — migrate both on the way in.
    const doc = migrateLegacyPanelDoc(rawDoc);
    const simpleVariants = rawVariants?.map(migrateLegacyPanelDoc);
    const restored = formsFromDoc(item.kind, doc, simpleForms);
    const nextForm = restored.form ?? form;
    const nextPartner = restored.partner ?? partner;
    const nextSales = restored.sales ?? sales;
    const nextNext = restored.next ?? next;
    setTemplate(restored.template);
    setForm(nextForm);
    setPartner(nextPartner);
    setSales(nextSales);
    setNext(nextNext);
    setFormat(doc.format);
    setCustom(doc);
    // The loaded item becomes the source of truth for its template: purge the
    // local parked leftovers of the same kind, THEN install the item's own
    // layout variants so the One/Two/Four picker revives exactly those. The
    // purge matters even without variants — stale parked docs otherwise
    // resurface later when an upload makes the shape key match again (Auri
    // hit this: adding a second logo revived an old tuned duo experiment).
    setParked((p) => ({
      ...Object.fromEntries(Object.entries(p).filter(([, d]) => docKindOf(d) !== restored.template)),
      ...Object.fromEntries((simpleVariants ?? []).map((d) => [panelShapeKey(d), d])),
    }));
    baselineRef.current = JSON.stringify([restored.template, nextForm, nextPartner, nextSales, nextNext, doc.format]);
    adoptLibraryIdentity(item.id, item.name, restored.template, bundleCoverage([doc, ...(simpleVariants ?? [])]));
  };

  // Deep link: /simple?load=<library-id> opens with that team design active —
  // for sharing a template with a colleague. The param stays in the address
  // bar (re-copyable from there); the per-tab DEEPLINK_DONE marker makes it
  // one-shot instead, so a refresh or an editor round-trip keeps your edits
  // rather than resetting to the template. A fresh tab has no marker and
  // loads clean. On a 401 nothing is marked, because the sign-in round-trip
  // returns to this URL and must retry the load.
  const deepLinkTried = useRef(false);
  useEffect(() => {
    if (!hydrated || deepLinkTried.current) return;
    deepLinkTried.current = true;
    const id = new URLSearchParams(window.location.search).get("load");
    if (!id) return;
    try { if (sessionStorage.getItem(DEEPLINK_DONE_KEY) === id) return; } catch { /* fall through — worst case the design reloads */ }
    (async () => {
      try {
        const res = await fetch(`/api/library/${id}`);
        if (res.status === 401) {
          toast.info("Sign in with your TechBBQ account to open this design");
          setLibraryOpen(true);
          return;
        }
        const data = await res.json();
        if (!res.ok) {
          toast.error(data.error ?? "Couldn't open the linked design");
          try { sessionStorage.setItem(DEEPLINK_DONE_KEY, id); } catch { /* ignore */ }
          return;
        }
        // handleLibraryLoad sets the URL + applied-marker itself.
        handleLibraryLoad({ id, name: data.item.name, kind: data.item.kind, doc: data.item.doc });
        toast.success(`Loaded "${data.item.name}"`);
      } catch {
        toast.error("Couldn't reach the team library");
      }
    })();
  });

  // The team's canonical templates — the Template toggle is a door into these
  // library items, not into the built-in generic layouts. Pressing Panel opens
  // "Official Panel Discussions", Partner Announcement opens "Official
  // Partner" — unless the user already has work of that kind (an active tuned
  // design, a loaded item, parked tuning, or a pending ?load= deep link).
  // One-shot per kind per tab; silent on failure (signed out, item deleted):
  // the generic layout is the fallback, not an error.
  const DEFAULT_ITEM_IDS = {
    panel: "c20fddbb-d4c5-455d-ac10-3c802ea7a3d6",
    partner: "7583298d-759b-4f97-9d33-fc2e10776e97",
    // The team has no official Sale item yet: the built-in countdown/discount
    // layouts ARE the template until someone saves one.
    sales: undefined,
    // Same for the Next Session board — the built-in layout IS the template
    // until someone saves an official one to the team library.
    next: undefined,
  } as const satisfies Record<TemplateKind, string | undefined>;
  // Each template's flavours, offered as a picker above Format. Every button
  // is a door into its team-library item.
  const FLAVOURS: Partial<Record<TemplateKind, { heading: string; options: readonly { key: string; label: string; itemId: string }[] }>> = {
    panel: {
      heading: "Panel type",
      options: [
        { key: "discussion", label: "Panel Discussion", itemId: DEFAULT_ITEM_IDS.panel },
        { key: "host", label: "Host", itemId: HOST_ITEM_ID },
      ],
    },
    partner: {
      heading: "Announcement",
      options: [
        { key: "official", label: "Official Announcement", itemId: DEFAULT_ITEM_IDS.partner },
        { key: "community", label: "Community Announcement", itemId: "431c22ac-a5a2-46a4-aec7-ad39923eae7d" },
      ],
    },
    // Sales has no library flavours yet — the layout picker below is its
    // equivalent, so the section simply does not render.
  };
  // All official templates are PREFETCHED into memory right after mount, so
  // pressing an Announcement button (or switching Template) applies instantly
  // — the network round-trip happens once in the background, never on the
  // click. `null` marks a fetch that failed (signed out/offline); the click
  // path then falls back to a live fetch with the sign-in prompt.
  const itemCache = useRef(new Map<string, LibraryLoadedItem | null>());
  const fetchLibraryItem = useCallback(async (id: string): Promise<LibraryLoadedItem | null> => {
    const cached = itemCache.current.get(id);
    if (cached) return cached;
    try {
      const res = await fetch(`/api/library/${id}`);
      if (!res.ok) { itemCache.current.set(id, null); return null; }
      const data = await res.json();
      const item: LibraryLoadedItem = { id, name: data.item.name, kind: data.item.kind, doc: data.item.doc };
      itemCache.current.set(id, item);
      return item;
    } catch {
      itemCache.current.set(id, null);
      return null;
    }
  }, []);
  const prefetchTried = useRef(false);
  useEffect(() => {
    if (!hydrated || prefetchTried.current) return;
    prefetchTried.current = true;
    for (const id of Object.values(FLAVOURS).flatMap((f) => f.options.map((o) => o.itemId))) void fetchLibraryItem(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  const defaultLoadTried = useRef<Partial<Record<TemplateKind, boolean>>>({});
  useEffect(() => {
    if (!hydrated) return;
    const kind = template;
    if (defaultLoadTried.current[kind]) return;
    // No official item for this template yet (sales) — the built-in layout IS
    // the template until the team saves one.
    const defaultId = DEFAULT_ITEM_IDS[kind];
    if (!defaultId) { defaultLoadTried.current[kind] = true; return; }
    // Anything of the user's own FOR THIS KIND wins over the default. Work of
    // the other kinds doesn't block — switching templates should still land on
    // that template's official design.
    if (custom && docKindOf(custom) === kind) return;
    if (loadedItem?.kind === kind) return;
    if (Object.values(parked).some((d) => docKindOf(d) === kind)) return;
    // A deep link that hasn't been applied yet owns the first load; once its
    // marker is set the param is just address-bar residue.
    const pending = new URLSearchParams(window.location.search).get("load");
    try { if (pending && sessionStorage.getItem(DEEPLINK_DONE_KEY) !== pending) return; } catch { /* treat as applied */ }
    defaultLoadTried.current[kind] = true;
    (async () => {
      const item = await fetchLibraryItem(defaultId);
      if (!item) return; // signed out/offline — the generic layout is the fallback
      handleLibraryLoad(item);
      toast.info(`Loaded the team template "${item.name}"`);
    })();
  });

  // Explicit load of a library item (announcement picker). Cache hit =
  // synchronous apply, no spinner needed; miss = one live fetch with the
  // deep link's sign-in fallback.
  const loadItemById = async (id: string) => {
    const cached = itemCache.current.get(id);
    if (cached) {
      handleLibraryLoad(cached);
      toast.success(`Loaded "${cached.name}"`);
      return;
    }
    try {
      const res = await fetch(`/api/library/${id}`);
      if (res.status === 401) {
        toast.info("Sign in with your TechBBQ account to open the team templates");
        setLibraryOpen(true);
        return;
      }
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Couldn't open the template"); return; }
      const item: LibraryLoadedItem = { id, name: data.item.name, kind: data.item.kind, doc: data.item.doc };
      itemCache.current.set(id, item);
      handleLibraryLoad(item);
      toast.success(`Loaded "${item.name}"`);
    } catch {
      toast.error("Couldn't reach the team library");
    }
  };

  const revertCustom = () => {
    setCustom(null);
    // Forget the parked copy for this shape too — otherwise Revert would undo
    // the tuning only until the next round-trip brought it back. For partner
    // docs that means every parked doc of the CURRENT layout, not just the
    // exact shape: the rebuild effect's layout-family fallback would happily
    // revive a sibling variant on the next form edit, bringing back the
    // tuning the user just discarded.
    setParked((p) => {
      const next: typeof p = {};
      for (const [k, d] of Object.entries(p)) {
        if (custom && k === panelShapeKey(custom)) continue;
        if (template === "partner" && isPartnerDoc(d) && partnerLayoutOf(d) === partner.layout) continue;
        if (template === "sales" && salesLayoutOf(d) === sales.layout) continue;
        next[k] = d;
      }
      return next;
    });
    // The address bar and Update button stop claiming a library design we no
    // longer show.
    setLoadedItem(null);
    setCoverage(null);
    try {
      window.history.replaceState(null, "", window.location.pathname);
      sessionStorage.removeItem(DEEPLINK_DONE_KEY);
      sessionStorage.removeItem(LOADED_ITEM_KEY);
    } catch { /* cosmetics only */ }
  };

  // Scale the canvas to fit the preview column.
  const previewRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.4);
  const calcScale = useCallback(() => {
    const c = previewRef.current;
    if (!c) return;
    const pad = 32;
    const s = Math.min((c.clientWidth - pad * 2) / W, (c.clientHeight - pad * 2) / H, 1);
    setScale(s > 0 ? s : 0.1);
  }, [W, H]);
  useEffect(() => {
    const c = previewRef.current;
    if (!c) return;
    // ResizeObserver fires once on observe, which does the initial measure —
    // so we never call setState directly in the effect body.
    const ro = new ResizeObserver(() => calcScale());
    ro.observe(c);
    window.addEventListener("resize", calcScale);
    return () => { window.removeEventListener("resize", calcScale); ro.disconnect(); };
  }, [calcScale]);

  // Form mutators.
  const setModerator = (patch: Partial<SimplePerson>) => setForm((f) => ({ ...f, moderator: { ...f.moderator, ...patch } }));
  const setSpeaker = (i: number, patch: Partial<SimplePerson>) =>
    setForm((f) => ({ ...f, speakers: f.speakers.map((s, idx) => (idx === i ? { ...s, ...patch } : s)) }));
  const addSpeaker = () => setSpeakerCount(form.speakers.length + 1);
  const removeSpeaker = (i: number) => {
    const dropped = form.speakers[i];
    if (dropped && !isBlankPerson(dropped)) setStash((s) => [dropped, ...s]);
    setForm((f) => ({ ...f, speakers: f.speakers.filter((_, idx) => idx !== i) }));
  };
  // The Host flavour: people are "hosts" (max 2, no moderator concept) — the
  // sidebar renames itself and hides the moderator toggle.
  const hostMode = loadedItem?.id === HOST_ITEM_ID;
  const MAX_SPEAKERS = hostMode ? 2 : 9;
  const personNoun = hostMode ? "Host" : "Speaker";
  // Lowering the count parks the dropped people in `stash` instead of binning
  // them, so stepping 3 -> 2 -> 3 gives back the same panel rather than a
  // blank card. Only filled-in people are worth keeping.
  const setSpeakerCount = (n: number) => {
    const count = Math.max(1, Math.min(MAX_SPEAKERS, n));
    const current = form.speakers.length;
    if (count === current) return;

    if (count < current) {
      const dropped = form.speakers.slice(count).filter((p) => !isBlankPerson(p));
      if (dropped.length) setStash((s) => [...dropped, ...s]);
      setForm((f) => ({ ...f, speakers: f.speakers.slice(0, count) }));
      return;
    }

    const needed = count - current;
    const restored = stash.slice(0, needed);
    if (restored.length) setStash((s) => s.slice(restored.length));
    setForm((f) => ({
      ...f,
      speakers: [
        ...f.speakers,
        ...restored,
        // A brand-new 4th slot starts as the sample speaker (photo + name)
        // instead of an empty frame; further slots stay blank.
        ...Array.from({ length: needed - restored.length }, (_, k) =>
          current + restored.length + k === 3 ? sampleFourthSpeaker() : emptyPerson()),
      ],
    }));
  };

  const setPartnerLogo = (i: number, logo: PartnerLogo | null) =>
    setPartner((p) => {
      const logos = [...p.logos];
      logos[i] = logo;
      return { ...p, logos };
    });

  /**
   * Drop a ready-made partner set into the wall: fetch each library file as a
   * data URL (the shape an upload produces, so a rename can never break a saved
   * design), then size the grid and the lead tier to what actually loaded.
   * Replaces the slots outright — it's a "start from this set" button, and undo
   * is one Revert or one re-pick away. The headline comes with the set, since
   * an investor wall shouldn't arrive saying "our partners".
   */
  const [fillingSet, setFillingSet] = useState<string | null>(null);
  const fillPartnerSet = async (set: PartnerSet) => {
    if (fillingSet) return;
    setFillingSet(set.id);
    try {
      const loaded = await Promise.all(set.logos.map(async (p) => {
        try { return await asUploadedImage(p.src); } catch { return null; }
      }));
      // A logo that failed to fetch is DROPPED, not left as a hole: an empty
      // lead cell in a published wall is worse than a tighter grid. The count
      // that failed goes in the toast so it can't pass unnoticed.
      const kept = loaded.map((l, i) => ({ logo: l, lead: i < set.featuredCount })).filter((x) => x.logo);
      if (!kept.length) { toast.error("Couldn't load those logos"); return; }
      setPartner((p) => ({
        ...p,
        layout: "thanks",
        logos: kept.map((x) => x.logo as PartnerLogo),
        logoCount: Math.min(THANKS_MAX_LOGOS, kept.length),
        featuredCount: kept.filter((x) => x.lead).length,
        headline: set.headline,
      }));
      const failed = set.logos.length - kept.length;
      toast.success(failed
        ? `${kept.length} ${set.name} logos added · ${failed} could not be loaded`
        : `${kept.length} ${set.name} logos added`);
    } finally {
      setFillingSet(null);
    }
  };

  /**
   * Resize the thank-you wall. Logos beyond the new count are KEPT in the slot
   * array (stepping 12 → 8 → 12 gets them back), the same forgiveness the
   * speaker stepper gives — they just stop rendering.
   */
  const setThanksCount = (n: number) =>
    setPartner((p) => {
      const logoCount = Math.max(THANKS_MIN_LOGOS, Math.min(THANKS_MAX_LOGOS, n));
      // The lead tier can never outgrow the grid it sits in.
      return { ...p, logoCount, featuredCount: Math.min(p.featuredCount, logoCount) };
    });

  // ── Next Session people ─────────────────────────────────────────────────
  // Deliberately simpler than the panel's stepper: the Next board has no
  // photos, so a removed row costs only a name and a title, and the panel's
  // parked-people stash would be more machinery than the loss justifies.
  const setNextSpeaker = (i: number, patch: Partial<SimplePerson>) =>
    setNext((n) => ({ ...n, speakers: n.speakers.map((s, j) => (j === i ? { ...s, ...patch } : s)) }));
  const removeNextSpeaker = (i: number) =>
    setNext((n) => (n.speakers.length <= 1 ? n : { ...n, speakers: n.speakers.filter((_, j) => j !== i) }));
  const setNextSpeakerCount = (count: number) =>
    setNext((n) => {
      const target = Math.max(1, Math.min(NEXT_MAX_SPEAKERS, count));
      if (target === n.speakers.length) return n;
      if (target < n.speakers.length) return { ...n, speakers: n.speakers.slice(0, target) };
      return {
        ...n,
        speakers: [...n.speakers, ...Array.from({ length: target - n.speakers.length }, emptyPerson)],
      };
    });

  // The accent choice belongs to whichever template is on screen, like the
  // background — a panel about LP Forum wants it just as much as a partner wall.
  const accentId = template === "partner" ? partner.accentId
    : template === "sales" ? sales.accentId
    : template === "next" ? next.accentId
    : form.accentId;
  const setAccent = (id: string | undefined) => {
    if (template === "partner") setPartner((p) => ({ ...p, accentId: id }));
    else if (template === "sales") setSales((p) => ({ ...p, accentId: id }));
    else if (template === "next") setNext((p) => ({ ...p, accentId: id }));
    else setForm((f) => ({ ...f, accentId: id }));
  };

  /** Resize the lead (bigger) tier — the first N cells of the wall. */
  const setFeaturedCount = (n: number) =>
    setPartner((p) => ({ ...p, featuredCount: Math.max(0, Math.min(p.logoCount, n)) }));

  /**
   * Darken the background behind the wall. Stepped in 10s rather than given a
   * free slider so it matches the two steppers above it, and because the useful
   * range is small — 20–30% is usually enough to lift a white logo off a pale
   * patch. Rounded on the way in: floats accumulate drift across steps and the
   * label would start reading "30.000000000000004%".
   */
  const SCRIM_STEP = 0.1;
  const setScrim = (n: number) =>
    setPartner((p) => ({ ...p, scrim: Math.round(Math.max(0, Math.min(THANKS_SCRIM_MAX, n)) * 100) / 100 }));

  /** Randomise the wall. Rules and reasoning live with the function. */
  const shuffleWall = () => setPartner((p) => ({ ...p, logos: shuffleWallLogos(p) }));

  // A library pick needs a destination. First empty slot of the current
  // layout, falling back to the last one when they are all filled — so
  // clicking is predictable and the hint can say where it goes.
  const partnerSlotCount = partner.layout === "thanks" ? partner.logoCount
    : partner.layout === "quad" ? 4
    : partner.layout === "duo" ? 2
    : 1;
  const nextLogoSlot = (() => {
    for (let i = 0; i < partnerSlotCount; i++) if (!partner.logos[i]?.src) return i;
    return partnerSlotCount - 1;
  })();

  /**
   * Restain a slot's logo. Always derived from `originalSrc` so switching
   * colours never compounds, and `null` puts the original artwork back.
   */
  const setPartnerLogoTint = (i: number, colour: string | null) => {
    const logo = partner.logos[i];
    if (!logo?.src) return;
    const base = logo.originalSrc ?? logo.src;
    if (!colour) {
      setPartnerLogo(i, { src: base, naturalWidth: logo.naturalWidth, naturalHeight: logo.naturalHeight });
      return;
    }
    const tinted = tintSvgDataUrl(base, colour);
    if (!tinted) {
      toast.error("Only SVG logos can be recoloured — this one is a bitmap.");
      return;
    }
    setPartnerLogo(i, { ...logo, src: tinted, originalSrc: base, tint: colour });
  };

  // Swap two quad cells — works with an empty neighbour too, which reads as
  // "move the logo there".
  const swapLogos = (i: number, j: number) =>
    setPartner((p) => {
      const logos = [...p.logos];
      [logos[i], logos[j]] = [logos[j] ?? null, logos[i] ?? null];
      return { ...p, logos };
    });

  // The full save payload for the team library: active doc + sidebar snapshot
  // + the tuned docs of this template's other layouts (from the parked shelf).
  const currentBundle = useMemo(() => ({
    ...doc,
    simpleForms: stripFormsForSave(template, form, partner, sales, next),
    simpleVariants: Object.values(parked).filter((d) => docKindOf(d) === template),
  }), [doc, template, form, partner, sales, next, parked]);

  // Header shortcut: overwrite the loaded library item with everything on
  // screen — same id, so its shared link keeps working.
  const updateLoadedItem = async () => {
    if (!loadedItem || updatingItem) return;
    if (!window.confirm(`Overwrite "${loadedItem.name}" for everyone with the current design (all layouts included)?`)) return;
    setUpdatingItem(true);
    // The prefetched copy is now stale — the next explicit load refetches.
    itemCache.current.delete(loadedItem.id);
    try {
      const res = await fetch(`/api/library/${loadedItem.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: loadedItem.name, kind: template, doc: currentBundle }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Update failed"); return; }
      toast.success(`"${loadedItem.name}" updated — its link now opens this design`);
      // The template now consists of what was just saved — refresh the
      // set-up-for hints (a newly added format/layout gets its dot).
      adoptLibraryIdentity(loadedItem.id, loadedItem.name, template, bundleCoverage([currentBundle, ...currentBundle.simpleVariants]));
    } catch {
      toast.error("Update failed — could not reach the library");
    } finally {
      setUpdatingItem(false);
    }
  };

  // Coverage hints only apply while the sidebar shows the loaded template's
  // kind — on the other template the buttons are plain.
  const activeCoverage = loadedItem && template === loadedItem.kind ? coverage : null;
  const coveredFormats = useMemo(() => new Set((activeCoverage ?? []).map((c) => c.format)), [activeCoverage]);
  const LAYOUT_NAMES = { single: "One", duo: "Two", quad: "Four", thanks: "Thank you", countdown: "Countdown", discount: "Discount" } as const;
  // The layout a covered combo must match for THIS template — partner logo
  // layout, sales composition, or nothing at all for a panel.
  const activeLayout = template === "partner" ? partner.layout : template === "sales" ? sales.layout : null;
  const currentCovered = !activeCoverage || activeCoverage.some((c) =>
    c.format === format && (activeLayout === null || c.layout === activeLayout));
  // "1:1 (One, Two, Four) · 16:9" — what the loaded template consists of.
  const coverageSummary = FORMATS
    .filter((f) => (activeCoverage ?? []).some((c) => c.format === f.id))
    .map((f) => {
      const layouts = (activeCoverage ?? []).filter((c) => c.format === f.id && c.layout).map((c) => LAYOUT_NAMES[c.layout!]);
      return layouts.length ? `${f.label} (${layouts.join(", ")})` : f.label;
    })
    .join(" · ");

  const isEmpty = template === "partner"
    ? !custom && !(partner.layout === "thanks" ? partner.headline : partner.label).trim() && !partner.logos.some((l) => l?.src)
    : template === "sales"
      ? !custom && !sales.value.trim() && !sales.caption.trim() && !sales.headline.trim() && !sales.photo?.src
      : !custom && !form.headline.trim() && !form.label.trim() && form.speakers.every((s) => !s.name.trim()) && !form.moderator.name.trim();

  // Only an animated background has anything to record; a static season/stage
  // JPG would give a 3-second video of a still frame.
  const canAnimate = isAnimatedBackground(doc.design.backgroundId);
  const saveFormats: SaveFormat[] = canAnimate ? ["png", "jpeg", "mp4"] : ["png", "jpeg"];
  // A background switch can strand the choice on a video format — fall back to JPG.
  const effectiveFormat: SaveFormat = isVideoFormat(exportFormat) && !canAnimate ? "jpeg" : exportFormat;

  const handleExport = () => {
    const salesLabel = [sales.value, sales.caption].map((t) => t.trim()).filter(Boolean).join(" ");
    // The Next board is named by its own title, not the panel form's headline.
    const headline = template === "next" ? next.title : form.headline;
    const base = simpleExportName(template, format, headline, salesLabel, partner.layout);
    if (isVideoFormat(effectiveFormat)) {
      // The animation has to be RUNNING for the capture, so resume instead of
      // pausing (the shader is paused while a still export is in flight).
      setPaused(false);
      void exportMp4(`${base}.mp4`, () => setPaused(false), videoSeconds);
      return;
    }
    setPaused(true);
    // Narrowed by the video branch above returning, but TypeScript can't see
    // that through the lookup table.
    const still: ExportFormat = effectiveFormat === "jpeg" ? "jpeg" : "png";
    setTimeout(() => {
      exportImage(`${base}.${still === "jpeg" ? "jpg" : "png"}`, still).finally(() => setPaused(false));
    }, 100);
  };

  // Hand the current composition to the full editor: the advanced editor
  // hydrates from this exact sessionStorage key, so it opens with everything
  // in place, ready to drag/tweak freely. The handoff flag makes the simple
  // panel re-adopt whatever they saved when they navigate back here.
  const handleOpenAdvanced = () => {
    try {
      sessionStorage.setItem(
        ADVANCED_STORAGE_KEY,
        JSON.stringify({ format: doc.format, customSize: doc.customSize, design: doc.design, canvasImages: doc.canvasImages }),
      );
      sessionStorage.setItem(HANDOFF_FLAG_KEY, "1");
    } catch {
      // ignore — the editor will just open with its own last session
    }
  };

  return (
    <div className="h-screen relative overflow-hidden">
      <TeamLibrary
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        currentKind={template}
        currentBundle={currentBundle}
        onLoad={handleLibraryLoad}
        onSaved={({ id, name, kind }) => {
          itemCache.current.delete(id); // saved over — the prefetched copy is stale
          adoptLibraryIdentity(id, name, kind, bundleCoverage([currentBundle, ...currentBundle.simpleVariants]));
        }}
      />
      <AnimatedGradient />
      <div className="relative z-10 flex flex-col h-screen overflow-hidden">
        {/* Header */}
        <header className="px-4 sm:px-8 py-4 sm:py-5 flex flex-wrap items-center gap-x-4 gap-y-3 shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-red.svg" alt="TechBBQ" className="h-8" />
          <h1 className="text-lg font-medium tracking-tight">
            Quick <span className="text-tbbq-gradient font-semibold">Templates</span>
          </h1>
          {/* Fine-tuned indicator — in the header so it never covers the
              canvas. Full explanation in the tooltip. */}
          {custom && (
            <div
              className="flex items-center gap-2 rounded-full border border-[#FF6B00]/40 bg-[#FF6B00]/10 pl-3 pr-1.5 py-1"
              title={template === "partner"
                ? "Text edits and logo swaps keep this layout. Switching layout or format shows the design saved for it, when there is one."
                : template === "sales"
                  ? "Text edits and photo swaps keep this layout. Switching sale type or format shows the design saved for it, when there is one."
                  : "Text edits and photo swaps keep this layout. Switching format shows the design saved for it; changing the speaker count or moderator rebuilds."}
            >
              <span className="text-[11px] font-medium text-[#FF8A3D] whitespace-nowrap">Custom design active · saved</span>
              <button
                onClick={revertCustom}
                className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-white/10 text-white hover:bg-white/20 transition-colors"
              >
                Revert
              </button>
            </div>
          )}
          <div className="ml-auto flex items-center gap-2">
            <AuthChip />
            {loadedItem && template === loadedItem.kind && (
              <button
                onClick={() => void updateLoadedItem()}
                disabled={updatingItem}
                title={`Save the current design — all layouts included — into "${loadedItem.name}". Its link keeps working.`}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-medium border border-[#FF6B00]/50 text-[#FF8A3D] hover:bg-[#FF6B00]/10 transition-colors disabled:opacity-50"
              >
                {updatingItem ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" strokeWidth={1.5} />}
                Update <span className="max-w-[140px] truncate">&ldquo;{loadedItem.name}&rdquo;</span>
              </button>
            )}
            <button
              onClick={() => setLibraryOpen(true)}
              title="Team library — designs shared with the whole team"
              className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-medium border border-surface/40 text-foreground hover:bg-white/5 transition-colors"
            >
              <Library className="w-3.5 h-3.5" strokeWidth={1.5} />
              Team library
            </button>
            <Link href="/editor" onClick={handleOpenAdvanced} title="Open this panel in the full editor to drag & fine-tune, then save" className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-medium border border-surface/40 text-foreground hover:bg-white/5 transition-colors">
              <PencilRuler className="w-3.5 h-3.5" strokeWidth={1.5} />
              Edit &amp; fine-tune
            </Link>
            {/* Save split-button: the main half exports with the current
                format; the chevron opens the PNG/JPG choice. The always-on
                radiogroup this replaces read as header noise. */}
            <div className="flex items-stretch rounded-full bg-surface text-ink overflow-hidden">
              <button
                onClick={handleExport}
                disabled={isExporting || isExportingVideo}
                aria-label={isVideoFormat(effectiveFormat) ? "Save video" : "Save image"}
                title={isEmpty
                  ? `Nothing filled in — this saves the background (plus the TechBBQ mark) as ${saveLabel(effectiveFormat, videoSeconds)}. For a completely bare background use Edit & fine-tune and untick the logo.`
                  : `Save as ${saveLabel(effectiveFormat, videoSeconds)}`}
                className="flex items-center gap-1.5 pl-5 pr-3.5 py-2 text-xs font-semibold tracking-wide hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isExporting || isExportingVideo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : isVideoFormat(effectiveFormat) ? <Film className="w-3.5 h-3.5" strokeWidth={1.5} /> : <Download className="w-3.5 h-3.5" strokeWidth={1.5} />}
                {isExportingVideo ? `Recording… ${videoProgress}%` : isExporting ? "Exporting…" : isVideoFormat(effectiveFormat) ? "Save video" : "Save image"}
              </button>
              <Popover.Root>
                <Popover.Trigger asChild>
                  <button
                    aria-label="Choose save format"
                    title={`Format: ${saveLabel(effectiveFormat, videoSeconds)}`}
                    className="flex items-center pl-2 pr-3 py-2 border-l border-black/15 hover:bg-white transition-colors"
                  >
                    <ChevronDown className="w-3.5 h-3.5" strokeWidth={2} />
                  </button>
                </Popover.Trigger>
                <Popover.Portal>
                  <Popover.Content align="end" sideOffset={8} role="radiogroup" aria-label="Save format" className="z-50 min-w-[180px] rounded-xl border border-white/10 bg-[#15110e] p-1 shadow-xl">
                    {saveFormats.map((fmt) => (
                      <Popover.Close asChild key={fmt}>
                        <button
                          role="radio"
                          aria-checked={effectiveFormat === fmt}
                          onClick={() => setExportFormat(fmt)}
                          className="w-full flex items-center justify-between gap-6 px-3 py-2 rounded-lg text-xs text-white/85 hover:bg-white/10 transition-colors"
                        >
                          <span className="font-medium">{saveLabel(fmt, videoSeconds)}</span>
                          {effectiveFormat === fmt && <Check className="w-3.5 h-3.5 text-[#FF6B00]" strokeWidth={2.5} />}
                        </button>
                      </Popover.Close>
                    ))}
                    {/* Video length. Not wrapped in Popover.Close: picking a
                        length is an adjustment, so the menu stays open until you
                        are happy with it. Choosing one also switches the format
                        to MP4, so it's one click from "JPG" to "15s video". */}
                    {canAnimate && (
                      <div className="mt-1 border-t border-white/10 pt-2 px-3 pb-1.5">
                        <span className="text-[10px] font-medium text-white/50 uppercase tracking-[0.16em]">Video length</span>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1">
                          {VIDEO_PRESETS.map((s) => (
                            <button
                              key={s}
                              onClick={() => { setVideoSeconds(s); setVideoSecondsDraft(String(s)); setExportFormat("mp4"); }}
                              aria-pressed={exportFormat === "mp4" && videoSeconds === s}
                              className={`px-2 py-1 rounded-md text-[11px] font-medium tabular-nums transition-colors ${
                                exportFormat === "mp4" && videoSeconds === s
                                  ? "bg-[#FF0028] text-white"
                                  : "bg-white/5 text-white/70 hover:bg-white/10"
                              }`}
                            >
                              {s}s
                            </button>
                          ))}
                          <label className="ml-auto flex items-center gap-1 text-[11px] text-white/60">
                            {/* Draft string, not the number — clamping every
                                keystroke made backspacing "3" to type "60"
                                snap back to the 1s minimum. Clamp on blur. */}
                            <input
                              type="number"
                              min={VIDEO_MIN_SECONDS}
                              max={VIDEO_MAX_SECONDS}
                              value={videoSecondsDraft}
                              aria-label={`Video length in seconds (${VIDEO_MIN_SECONDS}–${VIDEO_MAX_SECONDS})`}
                              onChange={(e) => {
                                setVideoSecondsDraft(e.target.value);
                                setExportFormat("mp4");
                                const n = Number(e.target.value);
                                if (e.target.value !== "" && Number.isFinite(n)
                                  && n >= VIDEO_MIN_SECONDS && n <= VIDEO_MAX_SECONDS) {
                                  setVideoSeconds(Math.round(n));
                                }
                              }}
                              onBlur={() => {
                                const n = Number(videoSecondsDraft);
                                const next = videoSecondsDraft === "" || !Number.isFinite(n)
                                  ? videoSeconds
                                  : Math.min(VIDEO_MAX_SECONDS, Math.max(VIDEO_MIN_SECONDS, Math.round(n)));
                                setVideoSeconds(next);
                                setVideoSecondsDraft(String(next));
                              }}
                              className="w-12 px-1.5 py-1 rounded-md bg-white/5 border border-white/10 text-[11px] tabular-nums text-white text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B00]/70"
                            />
                            s
                          </label>
                        </div>
                        <p className="mt-1.5 text-[10px] leading-snug text-white/40">
                          Records in real time · keep this tab in front for {videoSeconds}s.
                        </p>
                      </div>
                    )}
                    {/* Says WHY there is no video option, instead of just hiding it. */}
                    {!canAnimate && (
                      <p className="px-3 py-2 text-[11px] leading-snug text-white/45">
                        MP4 needs a moving background · pick a Liquid metal or orb one.
                      </p>
                    )}
                  </Popover.Content>
                </Popover.Portal>
              </Popover.Root>
            </div>
          </div>
        </header>

        <div className="flex-1 flex flex-col lg:flex-row min-h-0 px-4 sm:px-6 pb-4 sm:pb-6 gap-4 sm:gap-6 overflow-y-auto lg:overflow-hidden">
          {/* Form */}
          <aside className="w-full lg:w-[420px] shrink-0 flex flex-col gap-4 lg:max-h-full lg:overflow-y-auto lg:pr-1">
            {/* Template — which quick template this form builds */}
            <section className="flex flex-col gap-2">
              <span className="text-[10px] font-medium text-white/65 uppercase tracking-[0.16em]">Template</span>
              <div className="flex gap-1.5">
                {TEMPLATES.map((t) => {
                  const active = template === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setTemplate(t.id)}
                      aria-pressed={active}
                      className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-xs transition-all ${active ? "bg-[#FF0028] text-white" : "bg-white/5 border border-white/10 text-white/70 hover:bg-white/10"}`}
                    >
                      <t.icon className="w-3.5 h-3.5" />
                      <span className="font-medium">{t.label}</span>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Template flavour — each button opens its team-library item, so
                the official designs are one press away (prefetched). Templates
                without official items yet (Sale) skip this section. */}
            {FLAVOURS[template] && (
            <section className="flex flex-col gap-2">
              <span className="text-[10px] font-medium text-white/65 uppercase tracking-[0.16em]">{FLAVOURS[template]!.heading}</span>
              <div className="flex gap-1.5">
                {FLAVOURS[template]!.options.map((a) => {
                  const active = loadedItem?.id === a.itemId;
                  return (
                    <button
                      key={a.key}
                      onClick={() => { if (!active) void loadItemById(a.itemId); }}
                      aria-pressed={active}
                      className={`flex-1 px-2 py-2 rounded-lg text-xs font-medium transition-all ${active ? "bg-[#FF0028] text-white" : "bg-white/5 border border-white/10 text-white/70 hover:bg-white/10"}`}
                    >
                      {a.label}
                    </button>
                  );
                })}
              </div>
            </section>
            )}

            {/* Format. Switching parks the current tuned design and revives
                the one saved for the target format, when the template has
                one — it no longer discards the loaded template identity. */}
            <section className="flex flex-col gap-2">
              <span className="text-[10px] font-medium text-white/65 uppercase tracking-[0.16em]">Format</span>
              <div className="flex gap-1.5">
                {FORMATS.map((f) => {
                  const active = doc.format === f.id;
                  const isSet = coveredFormats.has(f.id);
                  return (
                    <button
                      key={f.id}
                      onClick={() => setFormat(f.id)}
                      aria-pressed={active}
                      title={activeCoverage ? (isSet ? `"${loadedItem!.name}" has a ${f.label} design` : `"${loadedItem!.name}" has no ${f.label} design yet`) : undefined}
                      className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-xs transition-all ${active ? "bg-[#FF0028] text-white" : "bg-white/5 border border-white/10 text-white/70 hover:bg-white/10"}`}
                    >
                      <f.icon className="w-3.5 h-3.5" />
                      <span className="font-medium">{f.label}</span>
                      {isSet && <span aria-hidden className={`w-1.5 h-1.5 rounded-full ${active ? "bg-white" : "bg-[#FF6B00]"}`} />}
                    </button>
                  );
                })}
              </div>
              {activeCoverage && (
                currentCovered ? (
                  <p className="text-[11px] leading-snug text-white/45">
                    &ldquo;{loadedItem!.name}&rdquo; is set up for {coverageSummary}.
                  </p>
                ) : (
                  <div className="rounded-lg border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-xs leading-snug text-amber-100/90">
                    <span className="font-semibold">
                      &ldquo;{loadedItem!.name}&rdquo; isn&apos;t set up for {FORMATS.find((f) => f.id === format)?.label}
                      {template === "partner"
                        ? partner.layout === "thanks"
                          ? " · Thank you"
                          : ` · ${LAYOUT_NAMES[partner.layout]} logo${partner.layout === "single" ? "" : "s"}`
                        : ""}
                      {template === "sales" ? ` · ${LAYOUT_NAMES[sales.layout]}` : ""} yet.
                    </span>{" "}
                    This is the automatic layout. Fine-tune it and press Update to add it to the template.
                  </div>
                )
              )}
            </section>

            {template === "partner" && (<>
            {/* Partner announcement: the label up top + the partner's logo.
                The thank-you wall leads with its own headline instead. */}
            <section className="flex flex-col gap-3">
              {partner.layout === "thanks" ? (
                <Field label="Headline" hint="Enter = new line" multiline value={partner.headline} onChange={(v) => setPartner((p) => ({ ...p, headline: v }))} placeholder="Thank you to our partners" />
              ) : (
                <Field label="Label" value={partner.label} onChange={(v) => setPartner((p) => ({ ...p, label: v }))} placeholder="Partner Announcement" />
              )}
            </section>
            <section className="flex flex-col gap-2">
              <span className="text-[10px] font-medium text-white/65 uppercase tracking-[0.16em]">Partner logos</span>
              <div className="flex gap-1.5">
                {([
                  { id: "single" as const, label: "One", icon: Square },
                  { id: "duo" as const, label: "Two", icon: Columns2 },
                  { id: "quad" as const, label: "Four", icon: LayoutGrid },
                  { id: "thanks" as const, label: "Thank you", icon: HeartHandshake },
                ]).map((opt) => {
                  const active = partner.layout === opt.id;
                  const isSet = (activeCoverage ?? []).some((c) => c.format === format && c.layout === opt.id);
                  return (
                    <button
                      key={opt.id}
                      onClick={() => setPartner((p) => ({ ...p, layout: opt.id }))}
                      aria-pressed={active}
                      title={activeCoverage ? (isSet ? `"${loadedItem!.name}" has this layout in this format` : `"${loadedItem!.name}" has no ${opt.label}-logo design in this format yet`) : undefined}
                      className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-xs transition-all ${active ? "bg-[#FF0028] text-white" : "bg-white/5 border border-white/10 text-white/70 hover:bg-white/10"}`}
                    >
                      <opt.icon className="w-3.5 h-3.5" />
                      <span className="font-medium">{opt.label}</span>
                      {isSet && <span aria-hidden className={`w-1.5 h-1.5 rounded-full ${active ? "bg-white" : "bg-[#FF6B00]"}`} />}
                    </button>
                  );
                })}
              </div>
              {/* Fixed-height slot area: One (112px), Two (80px) and Four
                  (168px) reserve the tallest so switching layouts doesn't
                  reflow everything below — the jump made the whole sidebar
                  shake. */}
              {/* Ready-made sets, so a recurring wall isn't 20 searches. Each
                  brings its own headline and tier split. Filed in project
                  folders that open to their rosters: which projects we hold
                  logos for is a question the sidebar answers on its own now,
                  without filling a wall to find out. */}
              {partner.layout === "thanks" && (
                <PartnerSetBrowser
                  projects={PARTNER_PROJECTS}
                  fillingSet={fillingSet}
                  onFill={(set) => void fillPartnerSet(set)}
                />
              )}
              {/* The wall's size is a choice, not a consequence of how many
                  logos you have dropped in — pick the grid, then fill it. */}
              {partner.layout === "thanks" && (
                <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                  <span className="text-sm text-white/85">Logos</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setThanksCount(partner.logoCount - 1)}
                      disabled={partner.logoCount <= THANKS_MIN_LOGOS}
                      aria-label="Fewer logos"
                      className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/5 border border-white/10 text-white/80 hover:bg-white/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-6 text-center text-sm font-semibold tabular-nums text-white">{partner.logoCount}</span>
                    <button
                      onClick={() => setThanksCount(partner.logoCount + 1)}
                      disabled={partner.logoCount >= THANKS_MAX_LOGOS}
                      aria-label="More logos"
                      className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/5 border border-white/10 text-white/80 hover:bg-white/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
              {/* The lead tier: main partners bigger, support partners below.
                  0 = one flat grid. */}
              {partner.layout === "thanks" && (
                <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                  <span className="text-sm text-white/85">
                    Bigger first
                    <span className="ml-1.5 text-[11px] text-white/45">{partner.featuredCount ? "main partners" : "off"}</span>
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setFeaturedCount(partner.featuredCount - 1)}
                      disabled={partner.featuredCount <= 0}
                      aria-label="Fewer big logos"
                      className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/5 border border-white/10 text-white/80 hover:bg-white/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-6 text-center text-sm font-semibold tabular-nums text-white">{partner.featuredCount}</span>
                    <button
                      onClick={() => setFeaturedCount(partner.featuredCount + 1)}
                      disabled={partner.featuredCount >= partner.logoCount}
                      aria-label="More big logos"
                      className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/5 border border-white/10 text-white/80 hover:bg-white/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
              {/* Alphabetical order reads like a ranking. One click makes the
                  wall look like a wall of peers. */}
              {partner.layout === "thanks" && (
                <button
                  onClick={shuffleWall}
                  disabled={!partner.logos.slice(0, partner.logoCount).some(Boolean)}
                  title={partner.featuredCount
                    ? "Shuffle the logos. The bigger first row shuffles within itself, so main partners stay in front."
                    : "Shuffle the logos into a random order."}
                  className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs font-medium text-white/85 hover:bg-white/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Shuffle className="w-3.5 h-3.5" strokeWidth={1.5} />
                  Shuffle order
                </button>
              )}
              {/* Some backgrounds have pale patches that swallow a white logo.
                  Dimming is the fix that keeps the background you picked. */}
              {partner.layout === "thanks" && (
                <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                  <span className="text-sm text-white/85">
                    Dim background
                    <span className="ml-1.5 text-[11px] text-white/45">
                      {(partner.scrim ?? 0) > 0 ? "helps pale backgrounds" : "off"}
                    </span>
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setScrim((partner.scrim ?? 0) - SCRIM_STEP)}
                      disabled={(partner.scrim ?? 0) <= 0}
                      aria-label="Less dimming"
                      className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/5 border border-white/10 text-white/80 hover:bg-white/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-9 text-center text-sm font-semibold tabular-nums text-white">
                      {Math.round((partner.scrim ?? 0) * 100)}%
                    </span>
                    <button
                      onClick={() => setScrim((partner.scrim ?? 0) + SCRIM_STEP)}
                      disabled={(partner.scrim ?? 0) >= THANKS_SCRIM_MAX}
                      aria-label="More dimming"
                      className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/5 border border-white/10 text-white/80 hover:bg-white/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
              <div className="min-h-[168px]">
                {partner.layout === "thanks" ? (
                  // Every cell of the wall as a small slot, in grid order, so
                  // the sidebar reads like the canvas. Capped in height because
                  // 30 slots would push the background picker off the screen.
                  <div className="grid grid-cols-3 gap-2 max-h-[320px] overflow-y-auto pr-1">
                    {Array.from({ length: partner.logoCount }, (_, i) => (
                      <LogoSlot
                        key={i}
                        small
                        index={i}
                        onReorder={swapLogos}
                        logo={partner.logos[i] ?? null}
                        onChange={(l) => setPartnerLogo(i, l)}
                        onTint={(c) => setPartnerLogoTint(i, c)}
                        onSwapPrev={i > 0 ? () => swapLogos(i, i - 1) : undefined}
                        onSwapNext={i < partner.logoCount - 1 ? () => swapLogos(i, i + 1) : undefined}
                      />
                    ))}
                  </div>
                ) : partner.layout === "quad" ? (
                  <div className="grid grid-cols-2 gap-2">
                    {[0, 1, 2, 3].map((i) => (
                      <LogoSlot
                        key={i}
                        small
                        index={i}
                        onReorder={swapLogos}
                        logo={partner.logos[i] ?? null}
                        onChange={(l) => setPartnerLogo(i, l)}
                        onTint={(c) => setPartnerLogoTint(i, c)}
                        onSwapPrev={i > 0 ? () => swapLogos(i, i - 1) : undefined}
                        onSwapNext={i < 3 ? () => swapLogos(i, i + 1) : undefined}
                      />
                    ))}
                  </div>
                ) : partner.layout === "duo" ? (
                  <div className="grid grid-cols-2 gap-2">
                    {[0, 1].map((i) => (
                      <LogoSlot
                        key={i}
                        small
                        index={i}
                        onReorder={swapLogos}
                        logo={partner.logos[i] ?? null}
                        onChange={(l) => setPartnerLogo(i, l)}
                        onTint={(c) => setPartnerLogoTint(i, c)}
                        onSwapPrev={i === 1 ? () => swapLogos(1, 0) : undefined}
                        onSwapNext={i === 0 ? () => swapLogos(0, 1) : undefined}
                      />
                    ))}
                  </div>
                ) : (
                  <LogoSlot logo={partner.logos[0] ?? null} onChange={(l) => setPartnerLogo(0, l)} onTint={(c) => setPartnerLogoTint(0, c)} />
                )}
              </div>
              {/* Saved logos — search the ones committed under public/logos
                  instead of going to find the company's logo on the web. */}
              <span className="mt-1 text-[10px] font-medium text-white/65 uppercase tracking-[0.16em]">Logo Library</span>
              <LogoLibraryPicker
                onPick={(logo) => setPartnerLogo(nextLogoSlot, logo)}
                targetHint={partnerSlotCount > 1 ? `slot ${nextLogoSlot + 1}` : undefined}
              />
            </section>
            </>)}

            {template === "sales" && (<>
            {/* Sale composition — countdown post or discount post. Each keeps
                its own tuned design per format, like the partner layouts. */}
            <section className="flex flex-col gap-2">
              <span className="text-[10px] font-medium text-white/65 uppercase tracking-[0.16em]">Sale type</span>
              <div className="flex gap-1.5">
                {SALES_LAYOUTS.map((opt) => {
                  const active = sales.layout === opt.id;
                  const isSet = (activeCoverage ?? []).some((c) => c.format === format && c.layout === opt.id);
                  return (
                    <button
                      key={opt.id}
                      onClick={() => setSales((p) => ({ ...p, layout: opt.id }))}
                      aria-pressed={active}
                      title={activeCoverage ? (isSet ? `"${loadedItem!.name}" has this sale type in this format` : `"${loadedItem!.name}" has no ${opt.label} design in this format yet`) : undefined}
                      className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-xs transition-all ${active ? "bg-[#FF0028] text-white" : "bg-white/5 border border-white/10 text-white/70 hover:bg-white/10"}`}
                    >
                      <opt.icon className="w-3.5 h-3.5" />
                      <span className="font-medium">{opt.label}</span>
                      {isSet && <span aria-hidden className={`w-1.5 h-1.5 rounded-full ${active ? "bg-white" : "bg-[#FF6B00]"}`} />}
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="flex flex-col gap-3">
              {/* The discount post opens with a sentence; the countdown post
                  leads with the figure itself. */}
              {sales.layout === "discount" && (
                <Field label="Headline" hint="Enter = new line" multiline value={sales.headline} onChange={(v) => setSales((p) => ({ ...p, headline: v }))} placeholder={"Less than 2 weeks\nleft to save"} />
              )}
              <Field label="Big figure" value={sales.value} onChange={(v) => setSales((p) => ({ ...p, value: v }))} placeholder={sales.layout === "countdown" ? "48" : "10%"} />
              <Field label="Caption" value={sales.caption} onChange={(v) => setSales((p) => ({ ...p, caption: v }))} placeholder={sales.layout === "countdown" ? "days left" : "off your ticket"} />
              {sales.layout === "discount" && (<>
                <Field label="Button" hint="empty = no button" value={sales.cta} onChange={(v) => setSales((p) => ({ ...p, cta: v }))} placeholder="BOOK NOW" />
                <Field label="Footer line" value={sales.footer} onChange={(v) => setSales((p) => ({ ...p, footer: v }))} placeholder="COPENHAGEN  |  26-27 AUGUST 2026" />
              </>)}
              <Field label="Corner ribbon" hint="empty = no ribbon" value={sales.ribbon} onChange={(v) => setSales((p) => ({ ...p, ribbon: v }))} placeholder="DISCOUNT ENDS 23 JULY" />
            </section>

            <section className="flex flex-col gap-2">
              <span className="text-[10px] font-medium text-white/65 uppercase tracking-[0.16em]">Photo</span>
              <LogoSlot
                logo={sales.photo}
                onChange={(l) => setSales((p) => ({ ...p, photo: l }))}
                emptyLabel="Upload the photo"
              />
            </section>
            </>)}

            {template === "panel" && (<>
            {/* Setup — panel composition: moderator + how many speakers */}
            <section className="flex flex-col gap-2">
              <span className="text-[10px] font-medium text-white/65 uppercase tracking-[0.16em]">Setup</span>
              <div className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                {/* Hosts have no moderator — the toggle only exists for panels. */}
                {!hostMode && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white/85">Moderator</span>
                  <button
                    role="switch"
                    aria-checked={form.includeModerator}
                    aria-label="Include a moderator"
                    onClick={() => setForm((f) => ({ ...f, includeModerator: !f.includeModerator }))}
                    className={`relative w-10 h-6 rounded-full transition-colors ${form.includeModerator ? "bg-[#FF6B00]" : "bg-white/15"}`}
                  >
                    <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${form.includeModerator ? "left-[18px]" : "left-0.5"}`} />
                  </button>
                </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white/85">{hostMode ? "Hosts" : "Speakers"}</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setSpeakerCount(form.speakers.length - 1)}
                      disabled={form.speakers.length <= 1}
                      aria-label="Fewer speakers"
                      className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/5 border border-white/10 text-white/80 hover:bg-white/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-6 text-center text-sm font-semibold tabular-nums text-white">{form.speakers.length}</span>
                    <button
                      onClick={() => setSpeakerCount(form.speakers.length + 1)}
                      disabled={form.speakers.length >= MAX_SPEAKERS}
                      aria-label="More speakers"
                      className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/5 border border-white/10 text-white/80 hover:bg-white/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </section>

            {/* Content */}
            <section className="flex flex-col gap-3">
              <Field label="Headline" hint="Enter = new line" multiline value={form.headline} onChange={(v) => setForm((f) => ({ ...f, headline: v }))} placeholder={"Continuation Capital\n& Venture Secondaries:"} />
              <Field label="Subtitle" value={form.subtitle} onChange={(v) => setForm((f) => ({ ...f, subtitle: v }))} placeholder="12 SEP · 14:30 · Main Stage" />
              <Field label="Session label" value={form.label} onChange={(v) => setForm((f) => ({ ...f, label: v }))} placeholder="Fireside Chat" />
            </section>

            {/* Moderator — only when the setup toggle is on (never for hosts) */}
            {!hostMode && form.includeModerator && (
              <section className="flex flex-col gap-2">
                <span className="text-[10px] font-medium text-white/65 uppercase tracking-[0.16em]">Moderator</span>
                <PersonEditor person={form.moderator} onChange={setModerator} roleLabel="Moderator" />
              </section>
            )}

            {/* Speakers */}
            <section className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-medium text-white/65 uppercase tracking-[0.16em]">{hostMode ? "Hosts" : "Speakers"} ({form.speakers.length})</span>
              </div>
              <div className="flex flex-col gap-2">
                {form.speakers.map((s, i) => (
                  <PersonEditor
                    key={i}
                    person={s}
                    onChange={(patch) => setSpeaker(i, patch)}
                    onRemove={form.speakers.length > 1 ? () => removeSpeaker(i) : undefined}
                    roleLabel={`${personNoun} ${i + 1}`}
                  />
                ))}
              </div>
              {form.speakers.length < MAX_SPEAKERS && (
                <button
                  onClick={addSpeaker}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-dashed border-white/15 text-xs text-white/70 hover:border-[#FF6B00]/50 hover:text-white transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Add {personNoun.toLowerCase()}
                </button>
              )}
            </section>
            </>)}

            {template === "next" && (<>
            {/* Setup — the board's composition. ON STAGE is deliberately not a
                toggle: it is the constant that tells the room what the screen
                is for, so it always renders. */}
            <section className="flex flex-col gap-2">
              <span className="text-[10px] font-medium text-white/65 uppercase tracking-[0.16em]">Setup</span>
              <div className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white/85">Moderator</span>
                  <button
                    role="switch"
                    aria-checked={next.includeModerator}
                    aria-label="Include a moderator"
                    onClick={() => setNext((n) => ({ ...n, includeModerator: !n.includeModerator }))}
                    className={`relative w-10 h-6 rounded-full transition-colors ${next.includeModerator ? "bg-[#FF6B00]" : "bg-white/15"}`}
                  >
                    <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${next.includeModerator ? "left-[18px]" : "left-0.5"}`} />
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white/85">Speakers</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setNextSpeakerCount(next.speakers.length - 1)}
                      disabled={next.speakers.length <= 1}
                      aria-label="Fewer speakers"
                      className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/5 border border-white/10 text-white/80 hover:bg-white/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-6 text-center text-sm font-semibold tabular-nums text-white">{next.speakers.length}</span>
                    <button
                      onClick={() => setNextSpeakerCount(next.speakers.length + 1)}
                      disabled={next.speakers.length >= NEXT_MAX_SPEAKERS}
                      aria-label="More speakers"
                      className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/5 border border-white/10 text-white/80 hover:bg-white/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </section>

            {/* Content */}
            <section className="flex flex-col gap-3">
              <Field
                label="Next session"
                hint={"renders as “NEXT: …”"}
                value={next.session}
                onChange={(v) => setNext((n) => ({ ...n, session: v }))}
                placeholder="Fireside Chat on the Bonfire Stage"
              />
              <Field
                label="Session title"
                hint="Enter = new line"
                multiline
                value={next.title}
                onChange={(v) => setNext((n) => ({ ...n, title: v }))}
                placeholder={"Opening with Bjarke Ingels:\nUtopian Pragmatism"}
              />
            </section>

            {/* Speakers */}
            <section className="flex flex-col gap-2">
              <span className="text-[10px] font-medium text-white/65 uppercase tracking-[0.16em]">Speakers ({next.speakers.length})</span>
              <div className="flex flex-col gap-2">
                {next.speakers.map((s, i) => (
                  <PersonEditor
                    key={i}
                    person={s}
                    onChange={(patch) => setNextSpeaker(i, patch)}
                    onRemove={next.speakers.length > 1 ? () => removeNextSpeaker(i) : undefined}
                    roleLabel={`Speaker ${i + 1}`}
                  />
                ))}
              </div>
              {next.speakers.length < NEXT_MAX_SPEAKERS && (
                <button
                  onClick={() => setNextSpeakerCount(next.speakers.length + 1)}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-dashed border-white/15 text-xs text-white/70 hover:border-[#FF6B00]/50 hover:text-white transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Add speaker
                </button>
              )}
            </section>

            {/* Moderator */}
            {next.includeModerator && (
              <section className="flex flex-col gap-2">
                <span className="text-[10px] font-medium text-white/65 uppercase tracking-[0.16em]">Moderator</span>
                <PersonEditor
                  person={next.moderator}
                  onChange={(patch) => setNext((n) => ({ ...n, moderator: { ...n.moderator, ...patch } }))}
                  roleLabel="Moderator"
                />
              </section>
            )}
            </>)}

            {/* Investor accents — the circle pair in opposite corners. The FILL
                says which investor thing the post is about, so this is a
                content choice, not decoration: gradient for investor relations
                in general, orange for LP Forum, red for Investor Day. */}
            <section className="flex flex-col gap-2">
              <span className="text-[10px] font-medium text-white/65 uppercase tracking-[0.16em]">Investor accents</span>
              <div className="flex gap-1.5">
                {[{ id: undefined, label: "None" }, ...ACCENT_OPTIONS].map((opt) => {
                  const active = (accentId ?? undefined) === opt.id;
                  return (
                    <button
                      key={opt.id ?? "none"}
                      onClick={() => setAccent(opt.id)}
                      aria-pressed={active}
                      title={opt.id ? `${opt.label} — circle accents in opposite corners` : "No circle accents"}
                      className={`flex-1 flex flex-col items-center gap-1 px-1.5 py-1.5 rounded-lg text-[10px] leading-tight transition-all ${active ? "bg-[#FF0028] text-white" : "bg-white/5 border border-white/10 text-white/70 hover:bg-white/10"}`}
                    >
                      <span className="w-full aspect-square max-w-8 rounded overflow-hidden border border-white/10">
                        {opt.id ? <AccentThumbnail id={opt.id} /> : <span className="block w-full h-full bg-[#15110E]" />}
                      </span>
                      <span className="font-medium text-center">{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Background */}
            <section className="flex flex-col gap-2">
              <span className="text-[10px] font-medium text-white/65 uppercase tracking-[0.16em]">Background</span>
              <BackgroundPicker
                compact
                value={template === "partner" ? partner.backgroundId : template === "sales" ? sales.backgroundId : template === "next" ? next.backgroundId : form.backgroundId}
                onChange={(id) => template === "partner"
                  ? setPartner((p) => ({ ...p, backgroundId: id }))
                  : template === "sales"
                    ? setSales((p) => ({ ...p, backgroundId: id }))
                    : template === "next"
                      ? setNext((p) => ({ ...p, backgroundId: id }))
                      : setForm((f) => ({ ...f, backgroundId: id }))}
                // The Next board names a stage in its banner, so the per-stage
                // gradients belong to it as much as to a panel.
                excludeGroups={template === "panel" || template === "next" ? undefined : ["Tech Stage", "BBQ Stage", "Bonfire Stage", "Founder Stage"]}
              />
            </section>
          </aside>

          {/* Preview */}
          <main ref={previewRef} className="flex-1 min-h-[55vh] lg:min-h-0 min-w-0 flex items-center justify-center overflow-hidden rounded-2xl bg-card relative">
            {isEmpty && (
              <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
                <div className="text-center rounded-2xl bg-black/60 backdrop-blur-sm px-7 py-6">
                  <p className="text-base text-white/90">Fill in the form to build your visual</p>
                  <p className="text-xs mt-1 text-white/60">{template === "partner" ? "Add a label and the partner's logo on the left" : template === "sales" ? "Add the figure and its caption on the left" : template === "next" ? "Name the next session and its speakers on the left" : "Add a headline and your speakers on the left"}</p>
                  <p className="text-[11px] mt-1 text-white/45">Or hit Save now to export just the background — this hint never lands in the file</p>
                </div>
              </div>
            )}
            <div style={{ transform: `scale(${scale})`, transformOrigin: "center center" }}>
              <div style={{ position: "relative", width: W, height: H }}>
                <div ref={exportRef}>
                  <DynamicTemplate
                    design={doc.design}
                    format={doc.format}
                    customWidth={W}
                    customHeight={H}
                    canvasImages={doc.canvasImages}
                    paused={paused}
                  />
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
