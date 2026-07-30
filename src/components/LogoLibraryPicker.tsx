"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, Loader2, FolderOpen, LayoutGrid, X, Trash2, CheckSquare, Square } from "lucide-react";
import { Dialog } from "radix-ui";
import { toast } from "sonner";
import LOGO_LIBRARY from "@/data/logoLibrary.json";

export interface LibraryLogo {
  src: string;
  name: string;
  tags: string[];
  bytes: number;
  /** Brightness of the artwork, measured by `npm run logos`. Drives the plate
   *  colour so a knockout logo isn't invisible. */
  tone?: "light" | "dark" | "mixed";
}

const ALL_LOGOS = LOGO_LIBRARY as LibraryLogo[];

/** File type, shown on every tile: SVG scales and can be recoloured in-app, a
 *  bitmap can do neither — worth seeing before you pick one. */
function fileKind(src: string): "SVG" | "PNG" | "WEBP" | "JPG" {
  const ext = src.split(".").pop()?.toLowerCase();
  return ext === "svg" ? "SVG" : ext === "webp" ? "WEBP" : ext === "png" ? "PNG" : "JPG";
}

/**
 * A picked file is embedded in the design as a data URL (base64, so ~1.33x its
 * size) and the team library refuses a design over 4MB. Above this it is
 * refused with an explanation — the alternative is a 32MB artboard that hangs
 * the tab and then fails to save. Anything over `WARN_BYTES` still works but
 * gets a size badge.
 */
const MAX_PICK_BYTES = 2_000_000;
const WARN_BYTES = 400_000;

/**
 * How many tiles the "See all" grid renders before you scroll.
 *
 * `loading="lazy"` only defers the download — the browser still builds every
 * element and lays it out. At 835 logos that is ~6000 DOM nodes created on open
 * and rebuilt on every keystroke, which made the modal visibly janky. Rendering
 * a window and growing it on scroll keeps the work proportional to what is
 * actually on screen.
 */
const PAGE_SIZE = 60;
const kb = (bytes: number) => (bytes >= 1_000_000 ? `${(bytes / 1_000_000).toFixed(1)}MB` : `${Math.round(bytes / 1024)}KB`);

/**
 * The plate a logo sits on inside the picker. White artwork on a white plate is
 * invisible (Auri hit this with "Gothenburg Tech Week"), and so is black
 * artwork on a dark plate — so each tile gets the opposite of its own
 * brightness. Colourful logos get a light neutral, which suits both a bright
 * accent and any white detail inside the mark.
 */
const PLATE: Record<string, string> = {
  light: "bg-[#1b1b1b]",
  dark: "bg-white/90",
  mixed: "bg-neutral-200",
};
const plateFor = (tone?: string) => PLATE[tone ?? "mixed"] ?? PLATE.mixed;

// Letters Unicode normalization does NOT decompose — ø, æ, ß and friends are
// their own characters, not a base plus an accent. Without this, "hoje" finds
// nothing for "Høje-Taastrup", which matters for a Danish partner list.
const TRANSLITERATE: Record<string, string> = {
  ø: "o", æ: "ae", œ: "oe", å: "a", ð: "d", đ: "d", ł: "l", ß: "ss", þ: "th", ı: "i",
};

/**
 * Fold a string down to bare lowercase letters and digits: accents stripped,
 * spaces / dashes / underscores dropped. Real logo filenames are messy —
 * "Adyen0.png", "AllianceVC logo white0.png", "Høje-Taastrup_vertical.png" —
 * so an exact-substring search finds almost nothing. Folded, "adyen" matches
 * "Adyen0", "alliancevc" matches "AllianceVC logo white0", and "hoje" matches
 * "Høje-Taastrup".
 */
const fold = (s: string) =>
  s.toLowerCase()
    .replace(/[øæœåðđłßþı]/g, (c) => TRANSLITERATE[c] ?? c)
    .normalize("NFD").replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]/g, "");

// Precomputed once: name + folder tags + the raw filename, all folded.
const SEARCH_KEYS_ALL = ALL_LOGOS.map((l) => fold(`${l.name} ${l.tags.join(" ")} ${decodeURIComponent(l.src)}`));

/** Every logo in `list` matching `query` (all terms must match), name order.
 *  Keys are precomputed for the full library and looked up by src, so deleting
 *  entries never desynchronises them from their index. */
const KEY_BY_SRC = new Map(ALL_LOGOS.map((l, i) => [l.src, SEARCH_KEYS_ALL[i]]));
function search(list: LibraryLogo[], query: string): LibraryLogo[] {
  const terms = query.split(/\s+/).map(fold).filter(Boolean);
  if (!terms.length) return list;
  return list.filter((l) => {
    const key = KEY_BY_SRC.get(l.src) ?? fold(l.name);
    return terms.every((t) => key.includes(t));
  });
}

/**
 * Fetch a library file and hand it over in the SAME shape an upload produces —
 * a data URL plus natural dimensions. Designs must not depend on `/logos/…`
 * staying put: a data URL keeps a saved design intact if the file is later
 * renamed or removed, and matches what `retargetPartnerLayout` expects.
 */
async function asUploadedImage(src: string): Promise<{ src: string; naturalWidth?: number; naturalHeight?: number }> {
  const res = await fetch(src);
  if (!res.ok) throw new Error(`${res.status}`);
  const blob = await res.blob();
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
  // An SVG with no width/height and no viewBox reports 0 — leave the fields
  // undefined in that case rather than writing zeroes into the doc.
  const dims = await new Promise<{ w: number; h: number }>((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => resolve({ w: 0, h: 0 });
    img.src = dataUrl;
  });
  return { src: dataUrl, naturalWidth: dims.w || undefined, naturalHeight: dims.h || undefined };
}

function LogoTile({
  logo, busy, onPick, targetHint, big, selectable, selected,
}: {
  logo: LibraryLogo;
  busy: boolean;
  onPick: (logo: LibraryLogo) => void;
  targetHint?: string;
  big?: boolean;
  /** In select mode a click toggles selection instead of placing the logo. */
  selectable?: boolean;
  selected?: boolean;
}) {
  const tooBig = logo.bytes > MAX_PICK_BYTES;
  const kind = fileKind(logo.src);
  return (
    <button
      onClick={() => onPick(logo)}
      disabled={busy}
      aria-pressed={selectable ? Boolean(selected) : undefined}
      title={selectable
        ? `${logo.name} — ${selected ? "deselect" : "select for deletion"}`
        : tooBig
          ? `${logo.name} — ${kb(logo.bytes)}, too big to use`
          : `${logo.name} (${kb(logo.bytes)}, ${kind}) — add${targetHint ? ` to ${targetHint}` : ""}`}
      className={`group relative flex flex-col items-center gap-1 p-1.5 rounded-lg border transition-colors disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B00]/70 ${
        selected
          ? "border-[#FF0028] bg-[#FF0028]/15"
          : "border-white/10 bg-white/[0.04] hover:border-[#FF6B00]/60 hover:bg-white/[0.08]"
      }`}
    >
      <span className={`flex items-center justify-center w-full ${big ? "h-16" : "h-9"} rounded overflow-hidden ${plateFor(logo.tone)}`}>
        {busy
          ? <Loader2 className="w-3.5 h-3.5 animate-spin text-black/60" />
          // eslint-disable-next-line @next/next/no-img-element
          : <img src={logo.src} alt="" loading="lazy" decoding="async" className="max-w-[85%] max-h-[80%] object-contain" />}
      </span>
      <span className="w-full truncate text-[10px] leading-tight text-white/70 group-hover:text-white">{logo.name}</span>
      {/* File type. SVG is called out in orange because it is the one that
          scales and can be recoloured in the slot. */}
      <span
        aria-hidden
        className={`absolute top-1 left-1 px-1 rounded text-[8px] font-bold leading-[1.4] tracking-wide ${
          kind === "SVG" ? "bg-[#FF6B00]/85 text-black" : "bg-black/65 text-white/80"
        }`}
      >
        {kind}
      </span>
      {selectable && (
        <span aria-hidden className="absolute bottom-6 right-1 text-white">
          {selected
            ? <CheckSquare className="w-3.5 h-3.5 text-[#FF0028]" strokeWidth={2.5} />
            : <Square className="w-3.5 h-3.5 text-white/50" strokeWidth={2} />}
        </span>
      )}
      {logo.bytes > WARN_BYTES && (
        <span
          aria-hidden
          className={`absolute top-1 right-1 px-1 rounded text-[9px] font-semibold ${tooBig ? "bg-red-500/90 text-white" : "bg-amber-400/90 text-black"}`}
        >
          {kb(logo.bytes)}
        </span>
      )}
    </button>
  );
}

/**
 * Search the logos committed under `public/logos/` and drop one straight into a
 * slot — the alternative being to go and find the company's logo on the web
 * every single time. The index is built by `npm run logos` (which `predev` and
 * `prebuild` run), so a file added to the folder is searchable immediately.
 */
export function LogoLibraryPicker({
  onPick, targetHint,
}: {
  onPick: (logo: { src: string; naturalWidth?: number; naturalHeight?: number }) => void;
  /** Where the pick will land, e.g. "slot 2" — shown so a click is predictable. */
  targetHint?: string;
}) {
  const [query, setQuery] = useState("");
  const [allQuery, setAllQuery] = useState("");
  const [allOpen, setAllOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  // The library minus anything deleted this session, so the grid updates
  // immediately instead of waiting for the manifest module to hot-reload.
  const [logos, setLogos] = useState<LibraryLogo[]>(ALL_LOGOS);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  const matches = useMemo(() => search(logos, query), [logos, query]);
  const results = matches.slice(0, query.trim() ? 24 : 12);
  const allMatches = useMemo(() => search(logos, allQuery), [logos, allQuery]);

  // Growing window for the "See all" grid.
  //
  // The scroller and sentinel are held in STATE, not refs. Radix mounts the
  // dialog's portal content in a later commit than the one where `allOpen`
  // flips, so an effect keyed on `allOpen` reads both refs as null, returns
  // early and never retries — no dependency changes after that. A callback ref
  // re-runs the effect exactly when the node appears.
  const [scrollEl, setScrollEl] = useState<HTMLDivElement | null>(null);
  const [sentinelEl, setSentinelEl] = useState<HTMLDivElement | null>(null);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const visibleAll = allMatches.slice(0, limit);
  const hasMore = allMatches.length > visibleAll.length;

  // A new search (or reopening) starts from the top, so the window must too.
  useEffect(() => { setLimit(PAGE_SIZE); }, [allQuery, allOpen]);

  // `limit` is a dependency on purpose: once the sentinel is inside the root it
  // stays intersecting and fires no further callbacks, so the observer has to be
  // re-attached after each grow. It stops when the new rows push it out of view.
  useEffect(() => {
    if (!scrollEl || !sentinelEl) return;
    const io = new IntersectionObserver(
      (entries) => { if (entries.some((e) => e.isIntersecting)) setLimit((l) => l + PAGE_SIZE); },
      { root: scrollEl, rootMargin: "300px" },
    );
    io.observe(sentinelEl);
    return () => io.disconnect();
  }, [scrollEl, sentinelEl, limit]);

  const toggleSelected = (src: string) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(src)) next.delete(src); else next.add(src);
    return next;
  });

  const leaveSelectMode = () => { setSelectMode(false); setSelected(new Set()); };

  /**
   * Delete the selected files. Local-dev only (the route refuses in
   * production): the library is committed, so this is a repo change the whole
   * team gets on the next push. Files are moved to a gitignored `.logos-trash/`,
   * so a mistake is recoverable.
   */
  const deleteSelected = async () => {
    const srcs = [...selected];
    if (!srcs.length) return;
    const names = srcs.map((s) => logos.find((l) => l.src === s)?.name ?? s);
    const preview = names.slice(0, 6).join(", ") + (names.length > 6 ? `, +${names.length - 6} more` : "");
    if (!window.confirm(`Delete ${srcs.length} logo${srcs.length === 1 ? "" : "s"} from the library?\n\n${preview}\n\nThe files move to .logos-trash/ and disappear for the whole team once you commit.`)) return;
    setDeleting(true);
    try {
      const res = await fetch("/api/logos", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ srcs }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Delete failed");
        return;
      }
      const gone = new Set<string>(data.deleted ?? []);
      setLogos((prev) => prev.filter((l) => !gone.has(l.src)));
      leaveSelectMode();
      if (data.warning) toast.warning(data.warning);
      const failed = (data.failed ?? []).length;
      toast.success(`Deleted ${gone.size} logo${gone.size === 1 ? "" : "s"}${failed ? ` — ${failed} could not be removed` : ""}`);
    } catch {
      toast.error("Delete failed — is the dev server running?");
    } finally {
      setDeleting(false);
    }
  };

  const pick = async (logo: LibraryLogo, closeAfter = false) => {
    if (logo.bytes > MAX_PICK_BYTES) {
      toast.error(`${logo.name} is ${kb(logo.bytes)} — too big to embed. Re-export it as a plain SVG (no embedded images) and re-run "npm run logos".`);
      return;
    }
    setBusy(logo.src);
    try {
      onPick(await asUploadedImage(logo.src));
      toast.success(`${logo.name} added`);
      if (closeAfter) setAllOpen(false);
    } catch {
      toast.error(`Couldn't load ${logo.name} — re-run "npm run logos"`);
    } finally {
      setBusy(null);
    }
  };

  if (logos.length === 0) {
    return (
      <div className="flex flex-col gap-1.5 rounded-xl border border-dashed border-white/15 bg-white/[0.03] p-3">
        <span className="flex items-center gap-1.5 text-[11px] font-medium text-white/70">
          <FolderOpen className="w-3.5 h-3.5" strokeWidth={1.5} />
          Logo Library is empty
        </span>
        <p className="text-[11px] leading-snug text-white/50">
          Put SVGs in <code className="text-white/70">public/logos/</code> named after the company
          (<code className="text-white/70">molten-ventures.svg</code>), then run <code className="text-white/70">npm run logos</code>.
          They become searchable here for the whole team.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5">
        <label className="relative flex flex-1 items-center">
          <Search className="absolute left-2.5 w-3.5 h-3.5 text-white/40" strokeWidth={2} />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${logos.length} logos`}
            aria-label="Search the logo library"
            className="w-full pl-8 pr-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-white placeholder:text-white/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B00]/70 focus:border-[#FF6B00]/40"
          />
        </label>
        <button
          onClick={() => { setAllQuery(query); setAllOpen(true); }}
          title="Browse every saved logo in a bigger grid"
          className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg border border-white/10 bg-white/5 text-[11px] font-medium text-white/75 hover:bg-white/10 hover:text-white transition-colors whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B00]/70"
        >
          <LayoutGrid className="w-3.5 h-3.5" strokeWidth={1.5} />
          See all
        </button>
      </div>

      {results.length === 0 ? (
        <p className="text-[11px] text-white/45">
          Nothing matches &ldquo;{query}&rdquo;. Add the file to <code className="text-white/65">public/logos/</code> and run <code className="text-white/65">npm run logos</code>.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-1.5">
            {results.map((logo) => (
              <LogoTile key={logo.src} logo={logo} busy={busy === logo.src} onPick={(l) => void pick(l)} targetHint={targetHint} />
            ))}
          </div>
          <p className="text-[11px] text-white/40">
            {matches.length > results.length
              ? `Showing ${results.length} of ${matches.length} matches — keep typing, or press See all. `
              : query.trim() ? `${matches.length} match${matches.length === 1 ? "" : "es"}. ` : ""}
            {targetHint && `Clicking a logo fills ${targetHint}.`}
          </p>
        </>
      )}

      {/* Browse-everything modal. Radix Dialog gives Esc, click-outside and a
          focus trap; the grid renders a window of PAGE_SIZE tiles and grows on
          scroll, so opening it never builds 835 of them. */}
      <Dialog.Root open={allOpen} onOpenChange={setAllOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 flex max-h-[86vh] w-[min(1100px,94vw)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-2xl border border-white/10 bg-[#15110e] shadow-2xl">
            <div className="flex items-center gap-3 border-b border-white/10 px-5 py-4">
              <Dialog.Title className="text-sm font-medium text-white">
                Logo Library <span className="text-white/45">({logos.length})</span>
              </Dialog.Title>
              <label className="relative ml-auto flex w-64 items-center">
                <Search className="absolute left-2.5 w-3.5 h-3.5 text-white/40" strokeWidth={2} />
                <input
                  autoFocus
                  type="text"
                  value={allQuery}
                  onChange={(e) => setAllQuery(e.target.value)}
                  placeholder="Search by company name"
                  aria-label="Search the whole logo library"
                  className="w-full pl-8 pr-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-white placeholder:text-white/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B00]/70 focus:border-[#FF6B00]/40"
                />
              </label>
              <button
                onClick={() => (selectMode ? leaveSelectMode() : setSelectMode(true))}
                aria-pressed={selectMode}
                title={selectMode ? "Leave select mode" : "Select logos to delete from the library"}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B00]/70 ${
                  selectMode
                    ? "border-[#FF0028]/60 bg-[#FF0028]/15 text-white"
                    : "border-white/10 bg-white/5 text-white/75 hover:bg-white/10 hover:text-white"
                }`}
              >
                <CheckSquare className="w-3.5 h-3.5" strokeWidth={1.5} />
                {selectMode ? "Cancel" : "Select"}
              </button>
              <Dialog.Close
                aria-label="Close"
                className="rounded-lg p-1.5 text-white/60 hover:bg-white/10 hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B00]/70"
              >
                <X className="w-4 h-4" strokeWidth={2} />
              </Dialog.Close>
            </div>

            <div ref={setScrollEl} className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              {allMatches.length === 0 ? (
                <p className="py-8 text-center text-sm text-white/50">Nothing matches &ldquo;{allQuery}&rdquo;.</p>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
                    {visibleAll.map((logo) => (
                      <LogoTile
                        key={logo.src}
                        logo={logo}
                        busy={busy === logo.src}
                        onPick={(l) => (selectMode ? toggleSelected(l.src) : void pick(l, true))}
                        targetHint={targetHint}
                        big
                        selectable={selectMode}
                        selected={selected.has(logo.src)}
                      />
                    ))}
                  </div>
                  {/* Scrolling near this loads the next batch. Also a manual
                      button, so the grid still works without IntersectionObserver
                      and is reachable by keyboard. */}
                  {hasMore && (
                    <div ref={setSentinelEl} className="flex justify-center py-4">
                      <button
                        onClick={() => setLimit((l) => l + PAGE_SIZE)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 text-[11px] font-medium text-white/70 hover:bg-white/10 hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B00]/70"
                      >
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Loading more · {visibleAll.length} of {allMatches.length}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="flex items-center gap-3 border-t border-white/10 px-5 py-3 text-[11px] text-white/45">
              <span>
                {allQuery.trim()
                  ? `${allMatches.length} match${allMatches.length === 1 ? "" : "es"} of ${logos.length}. `
                  : `${logos.length} logos. `}
                {hasMore && `Showing ${visibleAll.length} — scroll for more. `}
                {selectMode
                  ? "Click tiles to select, then Delete."
                  : targetHint ? `Clicking a logo fills ${targetHint} and closes this.` : "Clicking a logo adds it and closes this."}
              </span>
              {selectMode && (
                <div className="ml-auto flex items-center gap-2">
                  {selected.size > 0 && (
                    <button
                      onClick={() => setSelected(new Set(allMatches.map((l) => l.src)))}
                      className="px-2 py-1 rounded text-[11px] text-white/70 hover:bg-white/10 hover:text-white transition-colors"
                    >
                      Select all {allQuery.trim() ? "matching" : ""}
                    </button>
                  )}
                  <span className="text-white/70">{selected.size} selected</span>
                  <button
                    onClick={() => void deleteSelected()}
                    disabled={selected.size === 0 || deleting}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-[#FF0028] text-white hover:bg-[#ff1f45] transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B00]/70"
                  >
                    {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" strokeWidth={2} />}
                    Delete
                  </button>
                </div>
              )}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
