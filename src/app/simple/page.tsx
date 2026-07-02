"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Download, Loader2, Plus, Trash2, ImagePlus, X, Square, Presentation, Smartphone, PencilRuler } from "lucide-react";
import { AnimatedGradient } from "@/components/AnimatedGradient";
import { DynamicTemplate } from "@/components/templates/DynamicTemplate";
import { BackgroundPicker } from "@/components/BackgroundPicker";
import { useExport, type ExportFormat } from "@/hooks/useExport";
import type { PlatformFormat } from "@/types/template";
import { buildSimpleDesign, emptyForm, emptyPerson, type SimpleForm, type SimplePerson } from "@/lib/simpleLayout";

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

// Small labelled text input.
function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-medium text-white/65 uppercase tracking-[0.16em]">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B00]/70 focus:border-[#FF6B00]/40"
      />
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
    <div className="flex flex-col gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold text-orange uppercase tracking-[0.16em]">{roleLabel}</span>
        {onRemove && (
          <button onClick={onRemove} aria-label="Remove speaker" title="Remove speaker" className="p-1 rounded text-white/50 hover:text-white hover:bg-white/10 transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      <div className="flex gap-3">
        {/* Photo */}
        <div className="shrink-0">
          <label className="relative flex items-center justify-center w-16 h-16 rounded-full overflow-hidden border border-white/15 bg-white/5 cursor-pointer hover:border-[#FF6B00]/60 transition-colors group">
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
            <button onClick={() => onChange({ photo: "", naturalWidth: undefined, naturalHeight: undefined })} className="mt-1 w-full text-[9px] text-white/50 hover:text-white/80 flex items-center justify-center gap-0.5">
              <X className="w-2.5 h-2.5" /> photo
            </button>
          )}
        </div>
        {/* Fields */}
        <div className="flex-1 flex flex-col gap-2 min-w-0">
          <Field label="Name" value={person.name} onChange={(v) => onChange({ name: v })} placeholder="Jane Doe" />
          <Field label="Job title" value={person.title} onChange={(v) => onChange({ title: v })} placeholder="CEO" />
          <Field label="Company" value={person.company} onChange={(v) => onChange({ company: v })} placeholder="TechBBQ" />
        </div>
      </div>
    </div>
  );
}

export default function SimplePage() {
  const [form, setForm] = useState<SimpleForm>(emptyForm);
  const [format, setFormat] = useState<PlatformFormat>("square");
  const [exportFormat, setExportFormat] = useState<ExportFormat>("jpeg");
  const [paused, setPaused] = useState(false);

  const { exportRef, isExporting, exportImage } = useExport();
  const doc = useMemo(() => buildSimpleDesign(form, format), [form, format]);
  const { width: W, height: H } = doc.customSize;

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
  const addSpeaker = () => setForm((f) => ({ ...f, speakers: [...f.speakers, emptyPerson()] }));
  const removeSpeaker = (i: number) => setForm((f) => ({ ...f, speakers: f.speakers.filter((_, idx) => idx !== i) }));

  const isEmpty = !form.headline.trim() && !form.label.trim() && form.speakers.every((s) => !s.name.trim()) && !form.moderator.name.trim();

  const handleExport = () => {
    setPaused(true);
    setTimeout(() => {
      const d = new Date();
      const stamp = `${d.toISOString().slice(0, 10)}-${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}`;
      const ext = exportFormat === "jpeg" ? "jpg" : "png";
      exportImage(`techbbq-${format}-${W}x${H}-${stamp}.${ext}`, exportFormat).finally(() => setPaused(false));
    }, 100);
  };

  return (
    <div className="h-screen relative overflow-hidden">
      <AnimatedGradient />
      <div className="relative z-10 flex flex-col h-screen overflow-hidden">
        {/* Header */}
        <header className="px-8 py-5 flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-red.svg" alt="TechBBQ" className="h-8" />
          <h1 className="text-lg font-medium tracking-tight">
            Panel <span className="text-tbbq-gradient font-semibold">Maker</span>
          </h1>
          <div className="ml-auto flex items-center gap-2">
            <Link href="/" className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-medium border border-surface/40 text-foreground hover:bg-white/5 transition-colors">
              <PencilRuler className="w-3.5 h-3.5" strokeWidth={1.5} />
              Advanced editor
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
              title={isEmpty ? "Add a headline or a speaker first" : "Save image"}
              className="flex items-center gap-1.5 px-5 py-2 rounded-full bg-surface text-ink text-xs font-semibold tracking-wide hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" strokeWidth={1.5} />}
              {isExporting ? "Exporting…" : "Save image"}
            </button>
          </div>
        </header>

        <div className="flex-1 flex min-h-0 px-6 pb-6 gap-6">
          {/* Form */}
          <aside className="w-[420px] shrink-0 flex flex-col gap-4 max-h-full overflow-y-auto pr-1">
            {/* Format */}
            <section className="flex flex-col gap-2">
              <span className="text-[10px] font-medium text-white/65 uppercase tracking-[0.16em]">Format</span>
              <div className="flex gap-1.5">
                {FORMATS.map((f) => {
                  const active = format === f.id;
                  return (
                    <button
                      key={f.id}
                      onClick={() => setFormat(f.id)}
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

            {/* Content */}
            <section className="flex flex-col gap-3">
              <Field label="Session label" value={form.label} onChange={(v) => setForm((f) => ({ ...f, label: v }))} placeholder="Fireside Chat" />
              <Field label="Headline" value={form.headline} onChange={(v) => setForm((f) => ({ ...f, headline: v }))} placeholder="The Future of European Tech" />
              <Field label="Subtitle" value={form.subtitle} onChange={(v) => setForm((f) => ({ ...f, subtitle: v }))} placeholder="12 SEP · 14:30 · Main Stage" />
            </section>

            {/* Moderator */}
            <section className="flex flex-col gap-2">
              <span className="text-[10px] font-medium text-white/65 uppercase tracking-[0.16em]">Moderator</span>
              <PersonEditor person={form.moderator} onChange={setModerator} roleLabel="Moderator" />
            </section>

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
              <button
                onClick={addSpeaker}
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-dashed border-white/15 text-xs text-white/70 hover:border-[#FF6B00]/50 hover:text-white transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Add speaker
              </button>
            </section>

            {/* Background */}
            <section className="flex flex-col gap-2">
              <span className="text-[10px] font-medium text-white/65 uppercase tracking-[0.16em]">Background</span>
              <BackgroundPicker value={form.backgroundId} onChange={(id) => setForm((f) => ({ ...f, backgroundId: id }))} />
            </section>
          </aside>

          {/* Preview */}
          <main ref={previewRef} className="flex-1 min-h-0 min-w-0 flex items-center justify-center overflow-hidden rounded-2xl bg-card relative">
            {isEmpty && (
              <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
                <div className="text-center rounded-2xl bg-black/60 backdrop-blur-sm px-7 py-6">
                  <p className="text-base text-white/90">Fill in the form to build your panel visual</p>
                  <p className="text-xs mt-1 text-white/60">Add a headline and your speakers on the left</p>
                </div>
              </div>
            )}
            <div style={{ transform: `scale(${scale})`, transformOrigin: "center center" }}>
              <div style={{ position: "relative", width: W, height: H }}>
                <div ref={exportRef}>
                  <DynamicTemplate
                    design={doc.design}
                    format={format}
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
