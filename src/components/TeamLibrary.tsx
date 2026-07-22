"use client";

import { useState, useEffect, useCallback } from "react";
import { signIn } from "next-auth/react";
import { toast } from "sonner";
import { X, Loader2, Save, Trash2, FolderOpen, LogIn, Link2 } from "lucide-react";
import type { SimpleDoc, SimpleFormsSnapshot } from "@/lib/simpleLayout";

interface LibraryListItem {
  id: string;
  name: string;
  kind: string;
  updated_by: string;
  updated_at: string;
}

/** What comes back from GET /api/library/[id] — the doc plus, for items saved
 *  since forms-snapshots existed, the sidebar state it was built from and the
 *  tuned docs for the template's OTHER layout variants (One/Two/Four). */
export interface LibraryLoadedItem {
  id: string;
  name: string;
  kind: string;
  doc: SimpleDoc & { simpleForms?: SimpleFormsSnapshot; simpleVariants?: SimpleDoc[] };
}

/**
 * Shared team library modal: list / save / load / delete designs stored in
 * Postgres behind the @techbbq.org-gated API. Unauthenticated users get a
 * Google sign-in prompt instead of the list.
 */
export function TeamLibrary({
  open, onClose, currentKind, currentBundle, onLoad, onSaved,
}: {
  open: boolean;
  onClose: () => void;
  currentKind: "panel" | "partner";
  /** The full save payload, built by the page: active doc + sidebar snapshot
   *  + the tuned docs for this template's other layouts. */
  currentBundle: SimpleDoc & { simpleForms: SimpleFormsSnapshot; simpleVariants: SimpleDoc[] };
  onLoad: (item: LibraryLoadedItem) => void;
  /** Called after a successful save/overwrite, so the page can adopt the item
   *  as "what I'm working on" (header Update button + URL). */
  onSaved?: (item: { id: string; name: string; kind: "panel" | "partner" }) => void;
}) {
  const [items, setItems] = useState<LibraryListItem[] | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saveName, setSaveName] = useState("");

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/library");
      if (res.status === 401) { setNeedsAuth(true); setItems(null); return; }
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Could not load the library"); return; }
      setNeedsAuth(false);
      setItems(data.items);
    } catch {
      setError("Could not reach the library");
    }
  }, []);

  useEffect(() => {
    if (open) void refresh();
  }, [open, refresh]);

  if (!open) return null;

  const handleSave = async () => {
    const name = saveName.trim();
    if (!name) { toast.error("Give the design a name first"); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, kind: currentKind, doc: currentBundle }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Save failed"); return; }
      toast.success(`Saved "${name}" to the team library`);
      setSaveName("");
      if (data.id) onSaved?.({ id: data.id, name, kind: currentKind });
      void refresh();
    } catch {
      toast.error("Save failed — could not reach the library");
    } finally {
      setBusy(false);
    }
  };

  // Overwrite an existing item with the design open right now — same name,
  // same id, so its shared link keeps working.
  const handleUpdate = async (id: string, name: string) => {
    if (!window.confirm(`Overwrite "${name}" for everyone with the design you have open now?`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/library/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, kind: currentKind, doc: currentBundle }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Update failed"); return; }
      toast.success(`Updated "${name}" — its link now opens this design`);
      onSaved?.({ id, name, kind: currentKind });
      void refresh();
    } catch {
      toast.error("Update failed — could not reach the library");
    } finally {
      setBusy(false);
    }
  };

  const handleLoad = async (id: string, name: string) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/library/${id}`);
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Load failed"); return; }
      onLoad({ id, name, kind: data.item.kind, doc: data.item.doc } as LibraryLoadedItem);
      toast.success(`Loaded "${name}"`);
      onClose();
    } catch {
      toast.error("Load failed — could not reach the library");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Delete "${name}" from the team library for everyone?`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/library/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Delete failed"); return; }
      toast.success(`Deleted "${name}"`);
      void refresh();
    } catch {
      toast.error("Delete failed — could not reach the library");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div role="dialog" aria-modal="true" aria-label="Team library" className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/70 backdrop-blur-sm cursor-default" />
      <div className="relative w-full max-w-lg max-h-[80vh] flex flex-col rounded-2xl border border-white/10 bg-[#141414] shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <h2 className="text-sm font-semibold text-white">Team library</h2>
          <button onClick={onClose} aria-label="Close" className="p-1 rounded text-white/60 hover:text-white hover:bg-white/10 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {needsAuth ? (
          <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
            <p className="text-sm text-white/80">The team library is for TechBBQ accounts.</p>
            <button
              onClick={() => signIn("google")}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-white text-black text-xs font-semibold hover:bg-white/90 transition-colors"
            >
              <LogIn className="w-3.5 h-3.5" /> Sign in with Google
            </button>
            <p className="text-xs text-white/45">Use your @techbbq.org address</p>
          </div>
        ) : (
          <>
            {/* Save current design */}
            <div className="flex gap-2 px-5 py-4 border-b border-white/10">
              <input
                type="text"
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") void handleSave(); }}
                placeholder={`Name this ${currentKind === "partner" ? "partner visual" : "panel"}…`}
                className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B00]/70"
              />
              <button
                onClick={handleSave}
                disabled={busy}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-surface text-ink text-xs font-semibold hover:bg-white transition-colors disabled:opacity-50"
              >
                {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Save
              </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto px-3 py-3">
              {error && <p className="px-2 py-4 text-sm text-red-400">{error}</p>}
              {!error && items === null && (
                <p className="flex items-center gap-2 px-2 py-4 text-sm text-white/60"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</p>
              )}
              {items?.length === 0 && (
                <p className="px-2 py-4 text-sm text-white/60">Nothing saved yet. Name the current design above and hit Save.</p>
              )}
              {items?.map((it) => (
                <div key={it.id} className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-white/5 group">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{it.name}</p>
                    <p className="text-[11px] text-white/45">
                      {it.kind === "partner" ? "Partner" : "Panel"} · {it.updated_by.split("@")[0]} · {new Date(it.updated_at).toLocaleDateString("da-DK")}
                    </p>
                  </div>
                  <button
                    onClick={() => void handleLoad(it.id, it.name)}
                    disabled={busy}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 text-xs text-white hover:bg-white/20 transition-colors disabled:opacity-50"
                  >
                    <FolderOpen className="w-3.5 h-3.5" /> Load
                  </button>
                  <button
                    onClick={() => {
                      void navigator.clipboard.writeText(`${window.location.origin}/simple?load=${it.id}`);
                      toast.success("Link copied — opening it loads this design (TechBBQ sign-in required)");
                    }}
                    aria-label={`Copy link to ${it.name}`}
                    title="Copy a direct link to this design"
                    className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    <Link2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => void handleUpdate(it.id, it.name)}
                    disabled={busy}
                    aria-label={`Overwrite ${it.name} with the current design`}
                    title="Overwrite with the design you have open now"
                    className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-50"
                  >
                    <Save className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => void handleDelete(it.id, it.name)}
                    disabled={busy}
                    aria-label={`Delete ${it.name}`}
                    title="Delete for everyone"
                    className="p-1.5 rounded-lg text-white/40 hover:text-red-400 hover:bg-white/10 transition-colors disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
