"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Download, Loader2, Plus, Minus, Trash2, ImagePlus, X, Square, Presentation, Smartphone, PencilRuler, Users, Handshake, LayoutGrid, ChevronLeft, ChevronRight, Library } from "lucide-react";
import { TeamLibrary } from "@/components/TeamLibrary";
import { AnimatedGradient } from "@/components/AnimatedGradient";
import { DynamicTemplate } from "@/components/templates/DynamicTemplate";
import { BackgroundPicker } from "@/components/BackgroundPicker";
import { useExport, type ExportFormat } from "@/hooks/useExport";
import type { PlatformFormat } from "@/types/template";
import { buildSimpleDesign, buildPartnerDesign, emptyForm, emptyPartnerForm, emptyPerson, isBlankPerson, panelShapeKey, retargetTunedDoc, type SimpleForm, type PartnerForm, type PartnerLogo, type SimplePerson, type SimpleDoc } from "@/lib/simpleLayout";

type TemplateKind = "panel" | "partner";

const TEMPLATES: { id: TemplateKind; label: string; icon: typeof Users }[] = [
  { id: "panel", label: "Panel", icon: Users },
  { id: "partner", label: "Partner Announcement", icon: Handshake },
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

// One person block (moderator or a speaker): photo + name/title/company.
function PersonEditor({
  person, onChange, onRemove, roleLabel,
}: {
  person: SimplePerson;
  onChange: (patch: Partial<SimplePerson>) => void;
  onRemove?: () => void;
  roleLabel: string;
}) {
  return (
    <div className="flex gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] p-2.5">
      {/* Photo */}
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
        <div className="flex gap-1.5">
          <input type="text" value={person.title} onChange={(e) => onChange({ title: e.target.value })} placeholder="Job title"
            className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white placeholder:text-white/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B00]/70 focus:border-[#FF6B00]/40" />
          <input type="text" value={person.company} onChange={(e) => onChange({ company: e.target.value })} placeholder="Company"
            className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white placeholder:text-white/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B00]/70 focus:border-[#FF6B00]/40" />
        </div>
      </div>
    </div>
  );
}

// One partner-logo upload slot: dropzone → contain-fit preview + remove.
// `onSwapPrev`/`onSwapNext` (quad grid only) swap this slot's content with the
// neighbouring cell, so logos can be re-ordered after upload.
function LogoSlot({ logo, onChange, small, onSwapPrev, onSwapNext }: { logo: PartnerLogo | null; onChange: (l: PartnerLogo | null) => void; small?: boolean; onSwapPrev?: () => void; onSwapNext?: () => void }) {
  return (
    <div className="relative">
      <label className={`relative flex items-center justify-center ${small ? "h-20" : "h-28"} rounded-xl overflow-hidden border cursor-pointer transition-colors group ${logo?.src ? "border-white/15 bg-white/5" : "border-dashed border-white/15 bg-white/[0.03] hover:border-[#FF6B00]/60"}`}>
        {logo?.src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo.src} alt="Partner logo" className="max-w-[85%] max-h-[80%] object-contain" />
        ) : (
          <span className="flex flex-col items-center gap-1.5 text-white/40 group-hover:text-white/70 transition-colors">
            <ImagePlus className={small ? "w-5 h-5" : "w-6 h-6"} />
            {!small && <span className="text-xs">Upload the partner&apos;s logo</span>}
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

interface PersistedForm {
  form: SimpleForm;
  format: PlatformFormat;
  stash: SimplePerson[];
  template?: TemplateKind;
  partner?: PartnerForm;
}

/** Drop dataURL photos — the fallback when the full form busts the quota. */
function withoutPhotos({ form, format, stash, template, partner }: PersistedForm): PersistedForm {
  const strip = (p: SimplePerson): SimplePerson => ({ ...p, photo: "", naturalWidth: undefined, naturalHeight: undefined });
  return {
    format,
    template,
    partner: partner ? { ...partner, logos: [] } : undefined,
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

/** How many tuned-but-inactive designs to keep on the shelf. Each carries its
 *  own photos, so this is a storage budget, not a UX one. */
const MAX_PARKED = 4;

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

  const trimmed = Object.entries(parked).slice(-MAX_PARKED);
  try {
    localStorage.setItem(PARKED_KEY, JSON.stringify(Object.fromEntries(trimmed)));
  } catch {
    // No room for the shelf — drop it rather than wedge the active design.
    try { localStorage.removeItem(PARKED_KEY); } catch { /* ignore */ }
  }
}

export default function SimplePage() {
  const [form, setForm] = useState<SimpleForm>(emptyForm);
  const [template, setTemplate] = useState<TemplateKind>("panel");
  const [partner, setPartner] = useState<PartnerForm>(emptyPartnerForm);
  const [format, setFormat] = useState<PlatformFormat>("square");
  // Gates the persist + override-drop effects until the one-time hydrate has
  // landed, so restoring a saved form doesn't read as "the user edited it".
  const [hydrated, setHydrated] = useState(false);
  // People parked by lowering the speaker count — popped back in order when
  // the count goes up again, so a mis-click doesn't cost you their details.
  const [stash, setStash] = useState<SimplePerson[]>([]);
  const [exportFormat, setExportFormat] = useState<ExportFormat>("jpeg");
  const [paused, setPaused] = useState(false);
  // When the user fine-tunes in the advanced editor, we adopt their edited doc
  // here and render THAT instead of the form-generated layout — so coming back
  // to the simple panel shows exactly what they saved. Any form/format edit
  // drops the override (rebuilds from the form).
  const [custom, setCustom] = useState<SimpleDoc | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  // Tuned designs for shapes we are not on right now, keyed by panelShapeKey.
  const [parked, setParked] = useState<Record<string, SimpleDoc>>({});

  const { exportRef, isExporting, exportImage } = useExport();
  const genDoc = useMemo(
    () => (template === "partner" ? buildPartnerDesign(partner, format) : buildSimpleDesign(form, format)),
    [template, partner, form, format],
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
          const adopted = { format: s.format, customSize: s.customSize, design: s.design, canvasImages: s.canvasImages ?? [] } as SimpleDoc;
          // Only adopt a design with something in it. An empty editor doc used
          // to be a transient annoyance you could close the tab on; now that
          // tuning is saved, adopting one would strand you on a blank panel.
          if (hasContent(adopted)) {
            // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time adopt of the editor's doc on return
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
          const saved = JSON.parse(rawCustom) as SimpleDoc;
          // Same guard on the way back in — never restore someone onto a blank
          // canvas, and clear the bad entry so it stops haunting them.
          if (hasContent(saved)) setCustom(saved);
          else localStorage.removeItem(CUSTOM_KEY);
        }
      }
      const rawParked = localStorage.getItem(PARKED_KEY);
      if (rawParked) setParked(JSON.parse(rawParked));
    } catch { /* start fresh */ }

    // Restore the last panel. Done here rather than in a useState initializer
    // so the prerendered HTML and the first client render still agree.
    try {
      const rawForm = localStorage.getItem(FORM_KEY);
      if (rawForm) {
        const saved = JSON.parse(rawForm) as Partial<PersistedForm>;
        if (saved?.form?.speakers) {
          setForm(saved.form);
          if (saved.format) setFormat(saved.format);
          setStash(saved.stash ?? []);
          if (saved.template) setTemplate(saved.template);
          if (saved.partner) {
            // Migrate the short-lived single-`logo` shape (2026-07-21 morning)
            // to the slot-array shape.
            const p = saved.partner as PartnerForm & { logo?: string; naturalWidth?: number; naturalHeight?: number };
            setPartner(Array.isArray(p.logos) ? p : {
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
    persistForm({ form, format, stash, template, partner });
  }, [hydrated, form, format, stash, template, partner]);

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
    const key = JSON.stringify([template, form, partner, format]);
    if (baselineRef.current === "") { baselineRef.current = key; return; }
    if (key === baselineRef.current) return;
    baselineRef.current = key;

    const rebuilt = template === "partner" ? buildPartnerDesign(partner, format) : buildSimpleDesign(form, format);

    if (custom) {
      // Same shape → carry the tuning across, only the words change.
      const retargeted = retargetTunedDoc(custom, rebuilt);
      if (retargeted) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- retarget the override at the edited form
        setCustom(retargeted);
        return;
      }
      // Different shape → park it. Stepping 3 → 2 → 3, or flipping format and
      // back, must not cost the tuning just because it can't apply right now.
      setParked((p) => ({ ...p, [panelShapeKey(custom)]: custom }));
    }

    // Coming back to a shape we've tuned before? Put it back.
    const revived = parked[panelShapeKey(rebuilt)];
    setCustom(revived ? retargetTunedDoc(revived, rebuilt) : null);
  }, [hydrated, template, form, partner, format, custom, parked]);

  // Keep the tuned designs across tab closes — they were session-only, so
  // shutting the tab silently threw the fine-tuning away.
  useEffect(() => {
    if (!hydrated) return;
    persistTuned(custom, parked);
  }, [hydrated, custom, parked]);

  const revertCustom = () => {
    setCustom(null);
    // Forget the parked copy for this shape too — otherwise Revert would undo
    // the tuning only until the next round-trip brought it back.
    setParked((p) => {
      const next = { ...p };
      if (custom) delete next[panelShapeKey(custom)];
      return next;
    });
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
  const MAX_SPEAKERS = 9;
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
        ...Array.from({ length: needed - restored.length }, () => emptyPerson()),
      ],
    }));
  };

  const setPartnerLogo = (i: number, logo: PartnerLogo | null) =>
    setPartner((p) => {
      const logos = [...p.logos];
      logos[i] = logo;
      return { ...p, logos };
    });

  // Swap two quad cells — works with an empty neighbour too, which reads as
  // "move the logo there".
  const swapLogos = (i: number, j: number) =>
    setPartner((p) => {
      const logos = [...p.logos];
      [logos[i], logos[j]] = [logos[j] ?? null, logos[i] ?? null];
      return { ...p, logos };
    });

  const isEmpty = template === "partner"
    ? !custom && !partner.label.trim() && !partner.logos.some((l) => l?.src)
    : !custom && !form.headline.trim() && !form.label.trim() && form.speakers.every((s) => !s.name.trim()) && !form.moderator.name.trim();

  const handleExport = () => {
    setPaused(true);
    setTimeout(() => {
      const d = new Date();
      const stamp = `${d.toISOString().slice(0, 10)}-${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}`;
      const ext = exportFormat === "jpeg" ? "jpg" : "png";
      exportImage(`techbbq-${format}-${W}x${H}-${stamp}.${ext}`, exportFormat).finally(() => setPaused(false));
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
        currentDoc={doc}
        currentKind={template}
        onLoad={(loaded) => setCustom(loaded)}
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
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => setLibraryOpen(true)}
              title="Team library — designs shared with the whole team"
              className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-medium border border-surface/40 text-foreground hover:bg-white/5 transition-colors"
            >
              <Library className="w-3.5 h-3.5" strokeWidth={1.5} />
              Team library
            </button>
            <Link href="/" onClick={handleOpenAdvanced} title="Open this panel in the full editor to drag & fine-tune, then save" className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-medium border border-surface/40 text-foreground hover:bg-white/5 transition-colors">
              <PencilRuler className="w-3.5 h-3.5" strokeWidth={1.5} />
              Edit &amp; fine-tune
            </Link>
            <div role="radiogroup" aria-label="Export format" className="flex items-center gap-1 rounded-full bg-card-2 p-1">
              {(["png", "jpeg"] as const).map((fmt) => (
                <button
                  key={fmt}
                  role="radio"
                  aria-checked={exportFormat === fmt}
                  onClick={() => setExportFormat(fmt)}
                  className={`px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider transition-colors ${exportFormat === fmt ? "bg-surface text-ink" : "text-muted hover:text-foreground"}`}
                >
                  {fmt === "jpeg" ? "JPG" : fmt}
                </button>
              ))}
            </div>
            <button
              onClick={handleExport}
              disabled={isExporting || isEmpty}
              aria-label="Save image"
              title={isEmpty ? (template === "partner" ? "Add a label or a partner logo first" : "Add a headline or a speaker first") : "Save image"}
              className="flex items-center gap-1.5 px-5 py-2 rounded-full bg-surface text-ink text-xs font-semibold tracking-wide hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" strokeWidth={1.5} />}
              {isExporting ? "Exporting…" : "Save image"}
            </button>
          </div>
        </header>

        <div className="flex-1 flex flex-col lg:flex-row min-h-0 px-4 sm:px-6 pb-4 sm:pb-6 gap-4 sm:gap-6 overflow-y-auto lg:overflow-hidden">
          {/* Form */}
          <aside className="w-full lg:w-[420px] shrink-0 flex flex-col gap-4 lg:max-h-full lg:overflow-y-auto lg:pr-1">
            {/* Fine-tuned banner — the preview is a saved editor version */}
            {custom && (
              <div className="flex items-center justify-between gap-2 rounded-lg border border-[#FF6B00]/40 bg-[#FF6B00]/10 px-3 py-2">
                <span className="text-xs text-white/85 leading-tight">
                  <span className="font-semibold text-[#FF8A3D]">Fine-tuned in editor — saved.</span> Text edits keep your layout. Changing the speaker count, moderator or format rebuilds it.
                </span>
                <button
                  onClick={revertCustom}
                  className="shrink-0 px-2.5 py-1 rounded-md text-[11px] font-medium bg-white/10 text-white hover:bg-white/20 transition-colors"
                >
                  Revert
                </button>
              </div>
            )}
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

            {/* Format */}
            <section className="flex flex-col gap-2">
              <span className="text-[10px] font-medium text-white/65 uppercase tracking-[0.16em]">Format</span>
              <div className="flex gap-1.5">
                {FORMATS.map((f) => {
                  const active = doc.format === f.id;
                  return (
                    <button
                      key={f.id}
                      onClick={() => { revertCustom(); setFormat(f.id); }}
                      aria-pressed={active}
                      className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-xs transition-all ${active ? "bg-[#FF0028] text-white" : "bg-white/5 border border-white/10 text-white/70 hover:bg-white/10"}`}
                    >
                      <f.icon className="w-3.5 h-3.5" />
                      <span className="font-medium">{f.label}</span>
                    </button>
                  );
                })}
              </div>
            </section>

            {template === "partner" && (<>
            {/* Partner announcement: the label up top + the partner's logo */}
            <section className="flex flex-col gap-3">
              <Field label="Label" value={partner.label} onChange={(v) => setPartner((p) => ({ ...p, label: v }))} placeholder="Partner Announcement" />
            </section>
            <section className="flex flex-col gap-2">
              <span className="text-[10px] font-medium text-white/65 uppercase tracking-[0.16em]">Partner logos</span>
              <div className="flex gap-1.5">
                {([
                  { id: "single" as const, label: "One logo", icon: Square },
                  { id: "quad" as const, label: "Four logos", icon: LayoutGrid },
                ]).map((opt) => {
                  const active = partner.layout === opt.id;
                  return (
                    <button
                      key={opt.id}
                      onClick={() => setPartner((p) => ({ ...p, layout: opt.id }))}
                      aria-pressed={active}
                      className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-xs transition-all ${active ? "bg-[#FF0028] text-white" : "bg-white/5 border border-white/10 text-white/70 hover:bg-white/10"}`}
                    >
                      <opt.icon className="w-3.5 h-3.5" />
                      <span className="font-medium">{opt.label}</span>
                    </button>
                  );
                })}
              </div>
              {partner.layout === "quad" ? (
                <div className="grid grid-cols-2 gap-2">
                  {[0, 1, 2, 3].map((i) => (
                    <LogoSlot
                      key={i}
                      small
                      logo={partner.logos[i] ?? null}
                      onChange={(l) => setPartnerLogo(i, l)}
                      onSwapPrev={i > 0 ? () => swapLogos(i, i - 1) : undefined}
                      onSwapNext={i < 3 ? () => swapLogos(i, i + 1) : undefined}
                    />
                  ))}
                </div>
              ) : (
                <LogoSlot logo={partner.logos[0] ?? null} onChange={(l) => setPartnerLogo(0, l)} />
              )}
            </section>
            </>)}

            {template === "panel" && (<>
            {/* Setup — panel composition: moderator + how many speakers */}
            <section className="flex flex-col gap-2">
              <span className="text-[10px] font-medium text-white/65 uppercase tracking-[0.16em]">Setup</span>
              <div className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
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
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white/85">Speakers</span>
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

            {/* Moderator — only when the setup toggle is on */}
            {form.includeModerator && (
              <section className="flex flex-col gap-2">
                <span className="text-[10px] font-medium text-white/65 uppercase tracking-[0.16em]">Moderator</span>
                <PersonEditor person={form.moderator} onChange={setModerator} roleLabel="Moderator" />
              </section>
            )}

            {/* Speakers */}
            <section className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-medium text-white/65 uppercase tracking-[0.16em]">Speakers ({form.speakers.length})</span>
              </div>
              <div className="flex flex-col gap-2">
                {form.speakers.map((s, i) => (
                  <PersonEditor
                    key={i}
                    person={s}
                    onChange={(patch) => setSpeaker(i, patch)}
                    onRemove={form.speakers.length > 1 ? () => removeSpeaker(i) : undefined}
                    roleLabel={`Speaker ${i + 1}`}
                  />
                ))}
              </div>
              {form.speakers.length < MAX_SPEAKERS && (
                <button
                  onClick={addSpeaker}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-dashed border-white/15 text-xs text-white/70 hover:border-[#FF6B00]/50 hover:text-white transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Add speaker
                </button>
              )}
            </section>
            </>)}

            {/* Background */}
            <section className="flex flex-col gap-2">
              <span className="text-[10px] font-medium text-white/65 uppercase tracking-[0.16em]">Background</span>
              <BackgroundPicker
                value={template === "partner" ? partner.backgroundId : form.backgroundId}
                onChange={(id) => template === "partner"
                  ? setPartner((p) => ({ ...p, backgroundId: id }))
                  : setForm((f) => ({ ...f, backgroundId: id }))}
              />
            </section>
          </aside>

          {/* Preview */}
          <main ref={previewRef} className="flex-1 min-h-[55vh] lg:min-h-0 min-w-0 flex items-center justify-center overflow-hidden rounded-2xl bg-card relative">
            {isEmpty && (
              <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
                <div className="text-center rounded-2xl bg-black/60 backdrop-blur-sm px-7 py-6">
                  <p className="text-base text-white/90">Fill in the form to build your visual</p>
                  <p className="text-xs mt-1 text-white/60">{template === "partner" ? "Add a label and the partner's logo on the left" : "Add a headline and your speakers on the left"}</p>
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
