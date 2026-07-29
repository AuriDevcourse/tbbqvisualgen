// Turns the simple-mode form into a full canvas doc (design + images), reusing
// the same rendering engine as the pro editor. Pure function — no React.
import { FORMAT_DIMENSIONS, type DesignConfig, type PlatformFormat, type TextElement, type ShapeElement } from "@/types/template";
import type { CanvasImage } from "@/components/ImagePlacer";

export interface SimplePerson {
  name: string;
  /** Free-text description under the name — "job title, company", or anything
   *  ("Founder at X & Y"). The single sidebar field writes here. */
  title: string;
  /** Legacy second field (2026-07-29: the sidebar folded it into `title`).
   *  Kept so old saved forms/snapshots deserialize; always "" going forward —
   *  `mergePersonDescription` folds any legacy value into `title`. */
  company: string;
  /** Uploaded headshot as a data-URL. Empty = show a placeholder circle. */
  photo?: string;
  naturalWidth?: number;
  naturalHeight?: number;
}

export function emptyPerson(): SimplePerson {
  return { name: "", title: "", company: "", photo: "" };
}

/** True when nothing has been filled in — i.e. losing this person costs nothing. */
export function isBlankPerson(p: SimplePerson): boolean {
  return !p.name.trim() && !p.title.trim() && !p.company.trim() && !p.photo;
}

/** An empty person/logo slot: the gradient-outlined frame the builders emit
 *  where a photo or logo would go. */
const isSlotPlaceholder = (s: ShapeElement) =>
  s.type === "rectangle" && s.fillType === "outline" && s.colorType === "gradient";

const placeholderCount = (doc: SimpleDoc): number =>
  (doc.design.shapes ?? []).filter(isSlotPlaceholder).length;

/**
 * Identifies which layers a doc is made of. Two docs sharing a key can swap
 * words via `retargetTunedDoc`, so it doubles as the shelf label for parking a
 * tuned design: drop to 2 speakers and back to 3 and the key matches again,
 * which is how the tuning comes home instead of being binned.
 */
export function panelShapeKey(doc: SimpleDoc): string {
  const roles = doc.design.texts
    .map((t) => t.simpleRole)
    .filter((r): r is string => Boolean(r))
    .sort();
  // Image slots are part of the shape: a doc with a photo/logo is not the same
  // composition as one without, and a single-logo doc is not a quad doc even
  // when the text roles match.
  const imgRoles = doc.canvasImages.map((i) => i.simpleRole ?? "img").sort();
  // Placeholder frames count too: a BLANK extra speaker adds no text or image
  // layer — its only trace is the outlined frame. Without this, a 4-speaker
  // doc with a blank 4th shares its key with the 3-speaker doc, and the tuned
  // 3-speaker design revives right over the new card (Auri: "the 4th speaker
  // card doesn't appear"). Keys are recomputed on every hydrate/load, so
  // extending the format strands nothing.
  return `${doc.format}|${doc.customSize.width}x${doc.customSize.height}|${roles.join(",")}|imgs:${imgRoles.join(",") || "none"}|frames:${placeholderCount(doc)}`;
}

/**
 * Re-point a hand-tuned doc at the current form, keeping every hand-placed
 * position, size and colour. Only the WORDS move across.
 *
 * Returns null when the edit can't be absorbed — a field appearing or
 * disappearing (clearing a name, adding a company) changes which layers exist,
 * and there is no honest place to put a layer the tuned design never had. The
 * caller rebuilds from scratch in that case.
 */
export function retargetTunedDoc(tuned: SimpleDoc, rebuilt: SimpleDoc): SimpleDoc | null {
  // A tuned doc carries its own canvas — reusing it across formats would keep
  // the old dimensions and silently ignore the format switch.
  if (tuned.format !== rebuilt.format) return null;
  if (tuned.customSize.width !== rebuilt.customSize.width) return null;
  if (tuned.customSize.height !== rebuilt.customSize.height) return null;

  // A blank person leaves no text or image layer — only a placeholder frame.
  // Role comparison alone is blind to it, so a 3-speaker tuning would absorb
  // a 4th-blank-speaker rebuild and the new card would never show.
  if (placeholderCount(tuned) !== placeholderCount(rebuilt)) return null;

  // Images match by slot role, the same way texts match below. A REPLACED
  // photo/logo (same slot, new file) carries its src into the tuned layer,
  // keeping the hand-placed geometry — a swap between two FILLED quad cells
  // retargets the same way, as two src changes. Only a slot appearing or
  // disappearing — a removed photo, a single↔quad switch, a swap into an
  // EMPTY quad cell — is a rebuild, because the tuned doc has no layer for
  // the new shape. Role-less images were hand-added in the editor; the form
  // can't address them, so they pass through untouched.
  const roleImgs = (d: SimpleDoc) =>
    new Map(d.canvasImages.filter((i) => i.simpleRole).map((i) => [i.simpleRole as string, i]));
  const wantImgs = roleImgs(rebuilt);
  const haveImgs = roleImgs(tuned);
  if (wantImgs.size !== haveImgs.size) return null;
  for (const role of wantImgs.keys()) if (!haveImgs.has(role)) return null;

  const roleOf = (d: SimpleDoc) =>
    new Map(d.design.texts.filter((t) => t.simpleRole).map((t) => [t.simpleRole as string, t.content]));

  const want = roleOf(rebuilt);
  const have = roleOf(tuned);
  if (want.size !== have.size) return null;
  for (const role of want.keys()) if (!have.has(role)) return null;

  const result: SimpleDoc = {
    ...tuned,
    canvasImages: tuned.canvasImages.map((img) => {
      const next = img.simpleRole ? wantImgs.get(img.simpleRole) : undefined;
      if (!next || next.src === img.src) return img;
      // New picture in this slot — keep the tuned frame, swap the contents.
      // The crop was drawn for the old image, so it doesn't carry over.
      return { ...img, src: next.src, naturalWidth: next.naturalWidth, naturalHeight: next.naturalHeight, crop: undefined };
    }),
    design: {
      ...tuned.design,
      // The background is a form choice, not a hand-placed layer — carry the
      // CURRENT pick across, else switching backgrounds does nothing while a
      // tuned design is active.
      backgroundId: rebuilt.design.backgroundId,
      texts: tuned.design.texts.map((t) => carryWords(t, want)),
    },
  };
  // A changed label needs its white chip refitted to the new text.
  return resizeLabelChip(result, tuned.design.texts.find((t) => t.simpleRole === "label")?.content);
}

/**
 * The white chip behind the session/partner label is sized for its TEXT — so
 * when a retarget carries a different label into a tuned doc, the chip must
 * be resized too, else "BBQ Stage" swims in a chip cut for "Meet your hosts"
 * (or a long label overflows a short chip, as on Auri's community partner).
 * Width changes by the estimated text-width delta (padding stays); a
 * center-aligned label keeps the chip centered, a left-aligned one keeps the
 * chip's left edge.
 */
function resizeLabelChip(doc: SimpleDoc, oldContent: string | undefined, role = "label"): SimpleDoc {
  const label = doc.design.texts.find((t) => t.simpleRole === role);
  if (!label || oldContent === undefined || label.content === oldContent) return doc;
  const chip = (doc.design.shapes ?? []).find((s) => s.simpleRole === "label.chip")
    ?? (doc.design.shapes ?? []).find((s) =>
      s.fillType === "fill"
      && Math.abs(label.position.x - s.x) <= s.width / 2 + 0.001
      && Math.abs(label.position.y - s.y) <= s.height / 2 + 0.02);
  if (!chip) return doc;
  const textW = (s: string) => (Math.max(...s.split("\n").map((l) => l.length), 1) * label.fontSize * 0.62) / doc.customSize.width;
  // Delta keeps hand-tuned extra width; the floor guarantees the chip is
  // always slightly LONGER than the text (builder's padding), even when the
  // old chip was already too tight for its old label.
  const minW = textW(label.content) + (0.076 * Math.min(doc.customSize.width, doc.customSize.height)) / doc.customSize.width;
  const width = Math.min(0.94, Math.max(minW, chip.width - textW(oldContent) + textW(label.content)));
  const x = label.align === "center" ? chip.x : chip.x - chip.width / 2 + width / 2;
  return {
    ...doc,
    design: { ...doc.design, shapes: (doc.design.shapes ?? []).map((s) => (s === chip ? { ...s, width, x } : s)) },
  };
}

/**
 * Put the rebuilt doc's words into a tuned text layer. Caption layers
 * (name/title/…) arrive pre-wrapped for the GENERIC layout's column widths —
 * when the WORDS are unchanged, the tuned layer keeps its own line breaks
 * (stamping the generic wrap re-broke "Omolade Adebisi" onto two lines after
 * a 4→3→4 round-trip even though nobody edited her). Headline/subtitle/label
 * are verbatim form text (the user's own Enter presses), so they compare
 * exactly and an edited line break still lands.
 */
function carryWords(t: TextElement, want: Map<string, string>): TextElement {
  if (!t.simpleRole || !want.has(t.simpleRole)) return t;
  const next = want.get(t.simpleRole) as string;
  const caption = /\.(name|title|company|secondary)$/.test(t.simpleRole);
  const flat = (s: string) => s.split("\n").join(" ");
  if (caption && flat(t.content) === flat(next)) return t;
  return t.content === next ? t : { ...t, content: next };
}

/** Which partner logo layout a doc renders — read from its image roles, or
 *  from the placeholder frames' role tags when no logo is uploaded yet (a
 *  zero-logo partner doc still has a layout; only untagged legacy docs with
 *  no images stay null). */
export function partnerLayoutOf(doc: SimpleDoc): "single" | "duo" | "quad" | null {
  const of = (r: string) =>
    r === "logo-single" ? "single" as const
    : r.startsWith("logo-duo-") ? "duo" as const
    : /^logo-\d$/.test(r) ? "quad" as const
    : null;
  for (const i of doc.canvasImages) {
    const l = of(i.simpleRole ?? "");
    if (l) return l;
  }
  for (const s of doc.design.shapes ?? []) {
    const l = of(s.simpleRole ?? "");
    if (l) return l;
  }
  return null;
}

const SLOT_ROLES = {
  single: ["logo-single"],
  duo: ["logo-duo-0", "logo-duo-1"],
  quad: ["logo-0", "logo-1", "logo-2", "logo-3"],
} as const;

/** An empty partner slot renders as this outline-gradient frame. */
/**
 * Like `retargetTunedDoc`, but for partner docs of the SAME logo layout with a
 * DIFFERENT fill pattern — a slot gaining or losing its logo. The exact-key
 * path treats that as a different composition and rebuilds, which bounced
 * users off their hand-tuned layout the moment a slot changed (Auri hit this
 * switching One/Two/Four when a saved variant had fewer logos uploaded than
 * the form). Here the tuned geometry is kept: a slot that gained a logo swaps
 * its placeholder frame for an image layer at the frame's position, and a
 * cleared slot swaps its image back to a placeholder frame.
 *
 * `layout` comes from the form — the rebuilt doc can't always witness it
 * (a doc with zero logos has no image roles).
 */
export function retargetPartnerLayout(tuned: SimpleDoc, rebuilt: SimpleDoc, layout: "single" | "duo" | "quad"): SimpleDoc | null {
  if (partnerLayoutOf(tuned) !== layout) return null;
  if (tuned.format !== rebuilt.format) return null;
  if (tuned.customSize.width !== rebuilt.customSize.width) return null;
  if (tuned.customSize.height !== rebuilt.customSize.height) return null;

  // Words move across on the same contract as retargetTunedDoc.
  const want = new Map(rebuilt.design.texts.filter((t) => t.simpleRole).map((t) => [t.simpleRole as string, t.content]));
  const have = new Map(tuned.design.texts.filter((t) => t.simpleRole).map((t) => [t.simpleRole as string, t.content]));
  if (want.size !== have.size) return null;
  for (const role of want.keys()) if (!have.has(role)) return null;

  const slotRoles: readonly string[] = SLOT_ROLES[layout];
  const rebuiltImgs = new Map(rebuilt.canvasImages.filter((i) => i.simpleRole).map((i) => [i.simpleRole as string, i]));
  const tunedImgs = new Map(tuned.canvasImages.filter((i) => i.simpleRole).map((i) => [i.simpleRole as string, i]));
  // A role outside this layout's slot set means the docs aren't the plain
  // partner composition this function understands — let the exact path rule.
  for (const r of rebuiltImgs.keys()) if (!slotRoles.includes(r)) return null;
  for (const r of tunedImgs.keys()) if (!slotRoles.includes(r)) return null;

  // Map each empty slot to its placeholder frame — by role tag when present
  // (the builder and this function both tag frames now). Untagged frames
  // (legacy docs) fall back to array order over whatever roles remain: the
  // builder emitted slots in role order, so for a doc it produced the k-th
  // untagged frame is the k-th unclaimed slot. Any inconsistency — a frame
  // count mismatch (hand-deleted frame), a tag for a slot that has an image —
  // makes the mapping a guess: bail to a rebuild instead.
  const placeholders = (tuned.design.shapes ?? []).filter(isSlotPlaceholder);
  const emptyRoles = slotRoles.filter((r) => !tunedImgs.has(r));
  if (placeholders.length !== emptyRoles.length) return null;
  const placeholderOf = new Map<string, ShapeElement>();
  const untagged: ShapeElement[] = [];
  for (const p of placeholders) {
    if (p.simpleRole && slotRoles.includes(p.simpleRole)) {
      if (!emptyRoles.includes(p.simpleRole) || placeholderOf.has(p.simpleRole)) return null;
      placeholderOf.set(p.simpleRole, p);
    } else {
      untagged.push(p);
    }
  }
  const remaining = emptyRoles.filter((r) => !placeholderOf.has(r));
  if (untagged.length !== remaining.length) return null;
  remaining.forEach((r, k) => placeholderOf.set(r, untagged[k]));

  const dropShapeIds = new Set<string>();
  const dropImageIds = new Set<string>();
  const addImages: CanvasImage[] = [];
  const addShapes: ShapeElement[] = [];
  const orderSwap = new Map<string, string>();

  const nextImages = tuned.canvasImages.map((img) => {
    const role = img.simpleRole;
    if (!role) return img;
    const next = rebuiltImgs.get(role);
    if (next) {
      // Filled before, filled now — carry the (possibly new) picture into the
      // tuned frame. The crop was drawn for the old image.
      return next.src === img.src ? img : { ...img, src: next.src, naturalWidth: next.naturalWidth, naturalHeight: next.naturalHeight, crop: undefined };
    }
    // Slot cleared — the tuned image becomes a placeholder frame with the
    // same hand-placed geometry, tagged with the slot it stands in for.
    dropImageIds.add(img.id);
    const shape: ShapeElement = {
      id: `shape-${img.id}`, type: "rectangle", x: img.x, y: img.y,
      width: img.width, height: img.height,
      fillType: "outline", strokeWidth: 2 / 1500, colorType: "gradient",
      color1: "#FF6B00", color2: "#FF0028", opacity: 1, blur: 0, rotation: 0,
      borderRadius: 0.08,
      simpleRole: role,
    };
    addShapes.push(shape);
    orderSwap.set(`image:${img.id}`, `shape:${shape.id}`);
    return img;
  });

  for (const role of slotRoles) {
    const next = rebuiltImgs.get(role);
    if (!next || tunedImgs.has(role)) continue;
    // Slot filled — the tuned placeholder frame becomes the image, keeping
    // the frame's hand-placed geometry.
    const ph = placeholderOf.get(role);
    if (!ph) return null;
    dropShapeIds.add(ph.id);
    const img: CanvasImage = {
      id: `img-${ph.id}`, src: next.src, x: ph.x, y: ph.y,
      width: ph.width, height: ph.height,
      cornerRadius: 0, border: false, fit: "contain",
      naturalWidth: next.naturalWidth, naturalHeight: next.naturalHeight,
      simpleRole: role,
    };
    addImages.push(img);
    orderSwap.set(`shape:${ph.id}`, `image:${img.id}`);
  }

  const result: SimpleDoc = {
    ...tuned,
    canvasImages: [...nextImages.filter((i) => !dropImageIds.has(i.id)), ...addImages],
    design: {
      ...tuned.design,
      backgroundId: rebuilt.design.backgroundId,
      texts: tuned.design.texts.map((t) => carryWords(t, want)),
      shapes: [...(tuned.design.shapes ?? []).filter((s) => !dropShapeIds.has(s.id)), ...addShapes],
      layerOrder: tuned.design.layerOrder?.map((l) => orderSwap.get(l) ?? l),
    },
  };
  // A changed label (rename, singular↔plural) needs its white chip refitted.
  return resizeLabelChip(result, tuned.design.texts.find((t) => t.simpleRole === "label")?.content);
}

/**
 * Carry the shared "chrome" of a partner design — the label's position and
 * styling, hand-added decorations (lines etc.), and the TechBBQ logo settings
 * — from the doc being left (`from`) into the doc being shown (`to`). Used on
 * layout switches within the SAME format, so One/Two/Four share one chrome:
 * tune the label and the line once, switch layouts, they stay put.
 *
 * The layout-specific part of `to` is untouched: its slot images, its slot
 * placeholder frames, its label CONTENT (the plural rule lives in the
 * builder). `to`'s own role-less extras are replaced by `from`'s — chrome is
 * last-touched-wins, per Auri's "should stay in the same place".
 * Cross-format/size pairs are returned unchanged: each format has its own
 * chrome geometry.
 */
export function syncPartnerChrome(from: SimpleDoc, to: SimpleDoc): SimpleDoc {
  if (from.format !== to.format) return to;
  if (from.customSize.width !== to.customSize.width) return to;
  if (from.customSize.height !== to.customSize.height) return to;
  // Partner chrome only flows between partner docs. A template switch lands
  // here with `from` still being the PANEL doc being left — carrying its
  // role-less texts would float MODERATOR/SPEAKER words over the partner
  // design (live bug: Auri's 9:16 partner announcement wearing panel words).
  if (!isPartnerDoc(from) || !isPartnerDoc(to)) return to;

  const fromLabel = from.design.texts.find((t) => t.simpleRole === "label");
  const texts = [
    ...to.design.texts
      .filter((t) => t.simpleRole)
      .map((t) => (t.simpleRole === "label" && fromLabel ? { ...fromLabel, id: t.id, content: t.content } : t)),
    ...from.design.texts.filter((t) => !t.simpleRole),
  ];
  // `to` keeps only its slot placeholder frames; every other shape (the chip
  // if it still exists, hand-drawn lines, decorations) comes from `from` —
  // minus `from`'s own placeholders, which belong to the layout being left.
  const shapes = [
    ...(to.design.shapes ?? []).filter(isSlotPlaceholder),
    ...(from.design.shapes ?? []).filter((s) => !isSlotPlaceholder(s)),
  ];
  const canvasImages = [
    ...to.canvasImages.filter((i) => i.simpleRole),
    ...from.canvasImages.filter((i) => !i.simpleRole),
  ];
  // Keep `from`'s z-order for the elements that survived; the renderer's
  // reconcileLayerOrder slots the rest in predictably.
  const ids = new Set([
    ...texts.map((t) => `text:${t.id}`),
    ...shapes.map((s) => `shape:${s.id}`),
    ...canvasImages.map((i) => `image:${i.id}`),
  ]);
  const layerOrder = from.design.layerOrder?.filter((l) => ids.has(l));

  return {
    ...to,
    canvasImages,
    design: {
      ...to.design,
      texts,
      shapes,
      layerOrder,
      showLogo: from.design.showLogo,
      logoStyle: from.design.logoStyle,
      logoPosition: from.design.logoPosition,
      logoCustomPosition: from.design.logoCustomPosition,
      logoScale: from.design.logoScale,
    },
  };
}

/**
 * The panel counterpart of `syncPartnerChrome`, scoped to what must not move
 * when the speaker count changes (Auri: "a three-speaker panel should always
 * look the same"): the HEADER (headline, subtitle, session label + its chip)
 * and the MODERATOR (photo card, caption texts, the overlaid "MODERATOR"
 * word). Speaker cards, their captions and role labels are count-specific and
 * always stay the target's own.
 *
 * Geometry and styling come from `from`; content stays the target's (both
 * derive from the same form anyway). Cross-format/size pairs and partner docs
 * are returned unchanged.
 */
export function syncPanelChrome(from: SimpleDoc, to: SimpleDoc): SimpleDoc {
  if (from.format !== to.format) return to;
  if (from.customSize.width !== to.customSize.width) return to;
  if (from.customSize.height !== to.customSize.height) return to;
  if (isPartnerDoc(from) || isPartnerDoc(to)) return to;

  // The chrome roles: header + moderator caption. `moderator.secondary` is
  // the grid layout's merged "title, company" line.
  const CHROME = new Set([
    "headline", "subtitle", "label",
    "moderator.name", "moderator.title", "moderator.secondary",
  ]);
  const fromByRole = new Map(from.design.texts.filter((t) => t.simpleRole).map((t) => [t.simpleRole as string, t]));

  let texts = to.design.texts.map((t) => {
    if (!t.simpleRole || !CHROME.has(t.simpleRole)) return t;
    const src = fromByRole.get(t.simpleRole);
    return src ? { ...src, id: t.id, content: t.content } : t;
  });

  // The overlaid MODERATOR word is role-less (tagging it would churn
  // panelShapeKey and strand existing tuned docs), so it's identified by its
  // content. `from`'s copies replace the target's wholesale — a deleted or
  // dragged label stays deleted/dragged. A reworded label ("HOST") is not
  // recognised and keeps the target's generic one.
  //
  // Carried only when BOTH docs actually render a moderator — a count change
  // keeps the moderator, but the moderator TOGGLE also lands here, and an
  // ungated carry would float a stray "MODERATOR" over a speakers-only layout
  // (toggle off) or silently delete the target's legitimate one (toggle on).
  // The role-based carries above need no gate: a missing role no-ops per key.
  const hasModerator = (d: SimpleDoc) =>
    d.design.texts.some((t) => t.simpleRole?.startsWith("moderator."))
    || d.canvasImages.some((i) => i.simpleRole === "moderator.photo");
  if (hasModerator(from) && hasModerator(to)) {
    const isModWord = (t: TextElement) => !t.simpleRole && t.content.trim().toUpperCase() === "MODERATOR";
    const fromModWords = from.design.texts.filter(isModWord);
    const freedIds = texts.filter(isModWord).map((t) => t.id);
    texts = texts.filter((t) => !isModWord(t));
    const taken = new Set(texts.map((t) => t.id));
    texts.push(...fromModWords.map((t, i) => {
      let id = freedIds[i] ?? `${t.id}-mc`;
      while (taken.has(id)) id = `${id}x`;
      taken.add(id);
      return { ...t, id };
    }));
  }

  // Moderator photo: the target keeps its own picture (src/crop), framed by
  // `from`'s hand-tuned geometry. Skipped when either side has no photo —
  // a placeholder frame is a shape and count-agnostic already.
  const fromMod = from.canvasImages.find((i) => i.simpleRole === "moderator.photo");
  const canvasImages = fromMod
    ? to.canvasImages.map((i) => i.simpleRole === "moderator.photo"
      ? { ...fromMod, id: i.id, src: i.src, naturalWidth: i.naturalWidth, naturalHeight: i.naturalHeight, crop: i.crop }
      : i)
    : to.canvasImages;

  // Label chip: tagged "label.chip" by the builder; docs tuned before the tag
  // existed fall back to "the filled shape under the label text". If `from`
  // has a label but its chip was deleted, the target's chip is dropped too.
  const chipOf = (d: SimpleDoc): ShapeElement | undefined => {
    const tagged = (d.design.shapes ?? []).find((s) => s.simpleRole === "label.chip");
    if (tagged) return tagged;
    const lbl = d.design.texts.find((t) => t.simpleRole === "label");
    if (!lbl) return undefined;
    return (d.design.shapes ?? []).find((s) =>
      s.fillType === "fill"
      && Math.abs(lbl.position.x - s.x) <= s.width / 2 + 0.001
      && Math.abs(lbl.position.y - s.y) <= s.height / 2 + 0.001);
  };
  let shapes = to.design.shapes ?? [];
  if (fromByRole.has("label")) {
    const fromChip = chipOf(from);
    const toChip = chipOf(to);
    if (fromChip && toChip) shapes = shapes.map((s) => (s === toChip ? { ...fromChip, id: toChip.id } : s));
    else if (!fromChip && toChip) shapes = shapes.filter((s) => s !== toChip);
  }

  return {
    ...to,
    canvasImages,
    design: {
      ...to.design,
      texts,
      shapes,
      // The TechBBQ logo is chrome too — a dragged/custom-positioned logo must
      // not snap back to the preset corner on a speaker-count switch. Same
      // five fields the partner sync carries.
      showLogo: from.design.showLogo,
      logoStyle: from.design.logoStyle,
      logoPosition: from.design.logoPosition,
      logoCustomPosition: from.design.logoCustomPosition,
      logoScale: from.design.logoScale,
    },
  };
}

/**
 * Park a doc on the shelf under its shape key, RE-INSERTING at the end — so
 * the shelf's insertion order doubles as touch recency. The size trim slices
 * from the end, meaning it drops the least-recently-touched entries first: a
 * hand-tuned design the user keeps coming back to can never be evicted by
 * the chrome-only docs the layout tour auto-parks.
 */
export function parkDoc(shelf: Record<string, SimpleDoc>, doc: SimpleDoc): Record<string, SimpleDoc> {
  const key = panelShapeKey(doc);
  const next = Object.fromEntries(Object.entries(shelf).filter(([k]) => k !== key));
  next[key] = doc;
  return next;
}

/** One (format × layout) combination a template bundle has a tuned design
 *  for. Panel docs carry no logo layout — their `layout` is null and coverage
 *  is per-format only. */
export interface TemplateCoverage {
  format: PlatformFormat;
  layout: "single" | "duo" | "quad" | null;
}

/** What a template bundle consists of: the distinct (format × layout) combos
 *  across its active doc + bundled variants. Drives the sidebar's "set up
 *  for / not set up for" hints. */
export function bundleCoverage(docs: SimpleDoc[]): TemplateCoverage[] {
  const seen = new Set<string>();
  const out: TemplateCoverage[] = [];
  for (const d of docs) {
    const layout = partnerLayoutOf(d);
    const key = `${d.format}|${layout}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ format: d.format, layout });
  }
  return out;
}

export interface PartnerLogo {
  /** Uploaded logo as a data-URL. */
  src: string;
  naturalWidth?: number;
  naturalHeight?: number;
}

export interface PartnerForm {
  /** Announcement label rendered across the top — e.g. "Partner Announcement". */
  label: string;
  /** "single" = one big logo; "duo" = two side by side; "quad" = 2×2 grid. */
  layout: "single" | "duo" | "quad";
  /** Slot 0 for single, 0–1 for duo, 0–3 for quad. A missing/empty slot
   *  renders as an outlined placeholder frame. */
  logos: (PartnerLogo | null)[];
  backgroundId: string;
}

export function emptyPartnerForm(): PartnerForm {
  return { label: "Partner Announcement", layout: "single", logos: [], backgroundId: "orb7" };
}

export interface SimpleForm {
  /** Eyebrow / session label — e.g. "Fireside Chat", the discussion topic. */
  label: string;
  headline: string;
  subtitle: string;
  /** Whether this panel has a moderator (drives the layout + form). */
  includeModerator: boolean;
  moderator: SimplePerson;
  speakers: SimplePerson[];
  backgroundId: string;
}

export function emptyForm(): SimpleForm {
  return {
    // Sample panel pre-filled so there's no retyping to preview/tweak. Photos
    // live in /public/samples. Clear or edit any field as needed.
    label: "Panel Discussion",
    headline: "Continuation Capital\n& Venture Secondaries:",
    subtitle: "Financing the Next Phase of European Growth",
    includeModerator: true,
    moderator: { name: "Pierre Leroy", title: "Managing Director & Co-Head of Secondaries at Stifel", company: "", photo: "/samples/pierre-leroy.jpg" },
    speakers: [
      { name: "Andrei Xydas", title: "Principal, Lightrock", company: "", photo: "/samples/andrei-xydas.jpg" },
      { name: "Nicholas Sando", title: "Partner, Secondaries, Molten", company: "", photo: "/samples/nicholas-sando.jpg" },
      { name: "Omolade Adebisi", title: "Principal & Head of Secondaries, ISOMER Capital", company: "", photo: "/samples/omolade-adebisi.jpg" },
    ],
    backgroundId: "orb7",
  };
}

// Reset per build (see buildSimpleDesign) so ids depend only on the doc being
// built, never on how many times this module has run. A module-level counter
// that kept climbing gave the server and the client different ids for the same
// panel, which broke React hydration.
let seq = 0;
const uid = (p: string) => `${p}-s${(seq++).toString(36)}`;

export interface SimpleDoc {
  format: PlatformFormat;
  customSize: { width: number; height: number };
  design: DesignConfig;
  canvasImages: CanvasImage[];
}

const MARGIN = 0.06;

/**
 * Build a Partner Announcement visual: a centered vertical stack — the label
 * as a white chip up top, the partner's logo contain-fit in the middle, the
 * TechBBQ logo bottom-center. Same doc shape as the panel builder, so the
 * editor round-trip, parking and retargeting machinery apply unchanged.
 */
export function buildPartnerDesign(form: PartnerForm, format: PlatformFormat): SimpleDoc {
  seq = 0;
  const dims = FORMAT_DIMENSIONS[format] ?? FORMAT_DIMENSIONS.square;
  const W = dims.width;
  const H = dims.height;
  const S = Math.min(W, H);
  const vs = S / H;

  const texts: TextElement[] = [];
  const shapes: ShapeElement[] = [];
  const canvasImages: CanvasImage[] = [];

  // ── Label chip, top-center — same house chip as the panel's session label
  // (white rounded rectangle, dark uppercase text), anchored by its center. ──
  if (form.label.trim()) {
    // A label ending in "partner" pluralizes when the layout shows more than
    // one logo — "OFFICIAL PARTNER" with one logo, "OFFICIAL PARTNERS" with
    // two or four. The label field is shared across layouts, so this is the
    // only place the wording can follow the layout.
    const labelRaw = form.label.trim();
    const plural = form.layout !== "single" && /partner$/i.test(labelRaw) ? `${labelRaw}s` : labelRaw;
    const labelText = plural.toUpperCase();
    const fsFrac = 0.038;
    const fsPx = fsFrac * S;
    const letterSpacingPx = Math.round(0.0005 * S);
    const padX = 0.042 * S;
    const textWpx = labelText.length * fsPx * 0.62 + Math.max(0, labelText.length - 1) * letterSpacingPx;
    const chipHfrac = fsFrac * vs * 1.7;
    const chipWfrac = Math.min((textWpx + padX * 2) / W, 0.94);
    const chipY = 0.13;
    shapes.push({
      id: uid("shape"), type: "rectangle",
      x: 0.5, y: chipY, width: chipWfrac, height: chipHfrac,
      fillType: "fill", strokeWidth: 0, colorType: "solid",
      color1: "#FFFFFF", color2: "#FF6B00", opacity: 1, blur: 0, rotation: 0,
      borderRadius: 0.22,
    });
    // Same optical correction as the panel chip: caps sit high in their line
    // box, so nudge the text down a touch to centre it visually.
    texts.push({
      id: uid("text"), content: labelText,
      position: { x: 0.5, y: chipY + fsFrac * vs * 0.11 },
      fontSize: Math.round(fsFrac * S), align: "center",
      weight: 800, uppercase: true, font: "onest",
      color: "#15110E", letterSpacing: letterSpacingPx,
      simpleRole: "label",
    });
  }

  // ── Partner logo(s), centered — contain-fit so nothing gets cropped, no
  // border, no backdrop: the logo sits directly on the background. Boxes are
  // sized off the shorter side so they read the same in every format. An
  // empty slot → the same gradient-outlined placeholder the panel uses. ──
  const emitLogo = (logo: PartnerLogo | null | undefined, cx: number, cy: number, wFrac: number, hFrac: number, role: string): void => {
    if (logo?.src) {
      canvasImages.push({
        id: uid("img"), src: logo.src, x: cx, y: cy,
        width: wFrac, height: hFrac,
        cornerRadius: 0, border: false, fit: "contain",
        naturalWidth: logo.naturalWidth, naturalHeight: logo.naturalHeight,
        simpleRole: role,
      });
    } else {
      shapes.push({
        id: uid("shape"), type: "rectangle", x: cx, y: cy,
        width: wFrac, height: hFrac,
        fillType: "outline", strokeWidth: 2 / 1500, colorType: "gradient",
        color1: "#FF6B00", color2: "#FF0028", opacity: 1, blur: 0, rotation: 0,
        borderRadius: 0.08,
        // Tagged with the slot it stands in for, so retargetPartnerLayout can
        // swap the right frame when this slot later gains a logo — array
        // order stops being trustworthy once frames get added and removed.
        simpleRole: role,
      });
    }
  };

  const centerY = 0.52;
  if (form.layout === "quad") {
    // 2×2 grid centered as a block: each cell contain-fits its logo.
    const cellW = (0.34 * S) / W;
    const cellH = (0.2 * S) / H;
    const dx = ((0.34 + 0.06) / 2) * S / W; // half cell + half gap
    const dy = ((0.2 + 0.07) / 2) * S / H;
    const centers: [number, number][] = [
      [0.5 - dx, centerY - dy], [0.5 + dx, centerY - dy],
      [0.5 - dx, centerY + dy], [0.5 + dx, centerY + dy],
    ];
    centers.forEach(([cx, cy], i) => emitLogo(form.logos[i], cx, cy, cellW, cellH, `logo-${i}`));
  } else if (form.layout === "duo") {
    // Two logos side by side, block-centered — the same contain-fit cells as
    // the quad grid, just bigger. Roles are duo-specific ("logo-duo-N", not
    // "logo-N") so a duo doc never shape-matches a half-filled quad doc.
    const cellW = (0.42 * S) / W;
    const cellH = (0.26 * S) / H;
    const dx = (((0.42 + 0.06) / 2) * S) / W; // half cell + half gap
    emitLogo(form.logos[0], 0.5 - dx, centerY, cellW, cellH, "logo-duo-0");
    emitLogo(form.logos[1], 0.5 + dx, centerY, cellW, cellH, "logo-duo-1");
  } else {
    emitLogo(form.logos[0], 0.5, centerY, (0.62 * S) / W, (0.32 * S) / H, "logo-single");
  }

  const design: DesignConfig = {
    backgroundId: form.backgroundId || "orb7",
    texts,
    shapes,
    showLogo: true,
    logoStyle: "white",
    logoPosition: "bottom-center",
  };

  return {
    format,
    customSize: { width: W, height: H },
    design,
    canvasImages,
  };
}

/**
 * Build a TechBBQ panel visual from the simple form, matching the hand-made
 * house style: everything LEFT-aligned down the left margin — headline
 * (weight 600) + subtitle (weight 400) at the top, the session label as a
 * WHITE PILL with dark uppercase text, then a row of rounded-rectangle
 * portrait headshots (moderator first), each with name (600) + job title +
 * company (400) beneath it. Logo bottom-left. Photos become rounded images;
 * empty people get a rounded placeholder frame.
 */
export function buildSimpleDesign(form: SimpleForm, format: PlatformFormat): SimpleDoc {
  // Ids restart with every build, so the same form always yields the same
  // doc — server and client included.
  seq = 0;
  const dims = FORMAT_DIMENSIONS[format] ?? FORMAT_DIMENSIONS.square;
  const W = dims.width;
  const H = dims.height;

  // Font sizes are expressed as a fraction of the SHORTER side `S`, so text
  // looks the same visual size across formats (square vs 16:9 vs 9:16). Because
  // a font-fraction measures a WIDTH but vertical layout is in H-fractions,
  // `vs` converts a font-fraction into the height (in H-fractions) that one
  // line of it occupies. On a square canvas S=W=H and vs=1, so the (approved)
  // square layout is unchanged; only non-square formats are corrected.
  const S = Math.min(W, H);
  const vs = S / H;

  const texts: TextElement[] = [];
  const shapes: ShapeElement[] = [];
  const canvasImages: CanvasImage[] = [];

  // Left-aligned text helper. `x` is the left edge (align:left anchors there).
  const mkText = (content: string, x: number, y: number, sizeFrac: number, opts: Partial<TextElement> = {}): void => {
    if (!content.trim()) return;
    texts.push({
      id: uid("text"),
      content,
      position: { x, y },
      fontSize: Math.round(sizeFrac * S),
      align: "left",
      weight: 600,
      font: "onest",
      ...opts,
    });
  };

  // Auto-fit a font so the longest line fits within the usable width — used for
  // the headline/subtitle which are single-flow lines (may be manually broken).
  const avail = 0.94 - MARGIN;
  const fitFont = (text: string, baseFrac: number, avgChar = 0.55): number => {
    const longest = Math.max(1, ...text.split("\n").map((l) => l.trim().length));
    const maxPx = (avail * W) / (longest * avgChar);
    return Math.min(baseFrac * S, maxPx) / S;
  };

  // Greedily word-wrap `text` so no line exceeds `maxWfrac` of the canvas width
  // at the given font size — keeps long names/titles from overflowing into the
  // neighbouring card. Honours any manual "\n" the user typed.
  const wrapToWidth = (text: string, maxWfrac: number, fontFrac: number, avgChar = 0.56): string => {
    const maxChars = Math.max(4, Math.floor((maxWfrac * W) / (fontFrac * S * avgChar)));
    return text.split("\n").map((line) => {
      const words = line.trim().split(/\s+/);
      const out: string[] = [];
      let cur = "";
      for (const w of words) {
        const trial = cur ? `${cur} ${w}` : w;
        if (trial.length > maxChars && cur) { out.push(cur); cur = w; }
        else cur = trial;
      }
      if (cur) out.push(cur);
      return out.join("\n");
    }).join("\n");
  };

  // ── Header: headline, subtitle, session label — flowed top-down so a
  // multi-line (manually broken) headline never collides with what follows. ──
  const lineCount = (s: string) => (s.trim() ? s.split("\n").length : 0);
  let cursorY = 0.115; // top edge of the header content block

  if (form.headline.trim()) {
    const f = fitFont(form.headline, 0.082);
    const blockH = lineCount(form.headline) * f * vs;
    mkText(form.headline, MARGIN, cursorY + blockH / 2, f, { weight: 600, color: "#FFFFFF", simpleRole: "headline" });
    cursorY += blockH + 0.03;
  }
  if (form.subtitle.trim()) {
    // Smaller than before but higher-contrast so it stays readable.
    const f = fitFont(form.subtitle, 0.036);
    const blockH = lineCount(form.subtitle) * f * vs;
    mkText(form.subtitle, MARGIN, cursorY + blockH / 2, f, { weight: 500, color: "rgba(255,255,255,0.95)", simpleRole: "subtitle" });
    cursorY += blockH + 0.028;
  }

  // ── Session label — a rounded-RECTANGLE chip (not a pill). Uses asymmetric
  // padding (text sits a touch left, with extra breathing room on the right)
  // and accounts for letter-spacing so the text never crowds the right edge. ──
  if (form.label.trim()) {
    const labelText = form.label.toUpperCase();
    const fsFrac = 0.036;
    const fsPx = fsFrac * S;
    const letterSpacingPx = Math.round(0.0005 * S); // near-normal tracking
    const padLeft = 0.03 * S;
    const padRight = 0.046 * S; // more padding on the right of the text
    const textWpx = labelText.length * fsPx * 0.62 + Math.max(0, labelText.length - 1) * letterSpacingPx;
    const chipHfrac = fsFrac * vs * 1.7; // font's line height + vertical padding
    const chipWfrac = Math.min((textWpx + padLeft + padRight) / W, 0.94);
    const chipY = cursorY + chipHfrac / 2 - 0.004; // nudge the chip up slightly
    shapes.push({
      id: uid("shape"), type: "rectangle",
      x: MARGIN + chipWfrac / 2, y: chipY, width: chipWfrac, height: chipHfrac,
      fillType: "fill", strokeWidth: 0, colorType: "solid",
      color1: "#FFFFFF", color2: "#FF6B00", opacity: 1, blur: 0, rotation: 0,
      borderRadius: 0.22, // rounded rectangle, not a pill
      simpleRole: "label.chip", // syncPanelChrome moves it with the label
    });
    // Uppercase caps sit high in their line box (descender space below), which
    // reads as extra padding under the text — nudge the text DOWN to optically
    // centre the caps in the chip.
    mkText(labelText, MARGIN + padLeft / W, chipY + fsFrac * vs * 0.11, fsFrac, {
      weight: 800, uppercase: true, color: "#15110E", letterSpacing: letterSpacingPx,
      simpleRole: "label",
    });
    cursorY += chipHfrac + 0.03;
  }

  // ── People: moderator (rendered larger) + speakers ────────────────────────
  // Composition is driven by the setup selection, not by which fields are
  // filled — so the chosen structure (moderator? how many speakers?) always
  // renders, showing placeholder cards for people not yet filled in.
  const moderator = form.includeModerator ? form.moderator : null;
  const speakerList = form.speakers;

  // Region for the people cards begins right below the flowed header.
  const areaLeft = MARGIN;
  const areaRight = 0.94;
  const areaTop = Math.max(cursorY + 0.015, 0.34);

  // Draw just the photo (gradient-bordered) or an outlined placeholder frame.
  // `who` mirrors the caption roles ("moderator", "speaker-0"…) so a replaced
  // headshot can retarget into a tuned design instead of forcing a rebuild.
  const emitPhoto = (p: SimplePerson, left: number, top: number, w: number, h: number, who: string): void => {
    const cx = left + w / 2;
    const cy = top + h / 2;
    if (p.photo) {
      canvasImages.push({
        id: uid("img"), src: p.photo, x: cx, y: cy, width: w, height: h,
        cornerRadius: 8, border: true, borderWidth: 2 / 1500, fit: "cover",
        scrimBottom: 0.5, // subtle bottom fade so overlaid labels/text read
        naturalWidth: p.naturalWidth, naturalHeight: p.naturalHeight,
        simpleRole: `${who}.photo`,
      });
    } else {
      shapes.push({
        id: uid("shape"), type: "rectangle", x: cx, y: cy, width: w, height: h,
        fillType: "outline", strokeWidth: 2 / 1500, colorType: "gradient",
        color1: "#FF6B00", color2: "#FF0028", opacity: 1, blur: 0, rotation: 0,
        borderRadius: 0.08,
      });
    }
  };

  // Role label overlaid on the photo's lower-left — NO background chip, just
  // bold white letters with a soft shadow so they read on any headshot.
  const emitRoleLabel = (role: string, left: number, top: number, _w: number, h: number, fsFrac: number): void => {
    mkText(role.toUpperCase(), left + 0.02, top + h - fsFrac * vs * 1.25, fsFrac, {
      weight: 800, uppercase: true, color: "#FFFFFF",
      letterSpacing: Math.round(0.0008 * S),
      shadow: "0 1px 4px rgba(0,0,0,0.5)",
    });
  };

  // Wrap the name/title/company to `maxWfrac` and measure the block's height
  // (in H-fractions) so it can be anchored above a card without overlapping.
  const buildCaption = (p: SimplePerson, nameFrac: number, maxWfrac: number) => {
    const titleFrac = nameFrac * 0.72;
    const name = p.name.trim() ? wrapToWidth(p.name, maxWfrac, nameFrac) : "";
    const title = p.title.trim() ? wrapToWidth(p.title, maxWfrac, titleFrac) : "";
    const company = p.company.trim() ? wrapToWidth(p.company, maxWfrac, titleFrac) : "";
    let height = 0;
    if (name) height += lineCount(name) * nameFrac * vs;
    if (title) height += 0.006 + lineCount(title) * titleFrac * vs;
    if (company) height += 0.004 + lineCount(company) * titleFrac * vs;
    return { name, title, company, titleFrac, height };
  };
  const captionHeight = (p: SimplePerson, nameFrac: number, maxWfrac: number): number =>
    buildCaption(p, nameFrac, maxWfrac).height;

  // Render a wrapped caption block downward from topY, left-aligned at x.
  // `who` tags each layer with the form field behind it (e.g. "speaker-1"), so
  // a later text edit can retarget the matching layer of a tuned design.
  const captionBlock = (p: SimplePerson, x: number, topY: number, nameFrac: number, maxWfrac: number, who: string): void => {
    const { name, title, company, titleFrac } = buildCaption(p, nameFrac, maxWfrac);
    let ty = topY;
    if (name) {
      const half = (lineCount(name) * nameFrac * vs) / 2;
      ty += half;
      mkText(name, x, ty, nameFrac, { weight: 700, color: "#FFFFFF", simpleRole: `${who}.name` });
      ty += half;
    }
    if (title) {
      const half = (lineCount(title) * titleFrac * vs) / 2;
      ty += 0.006 + half;
      mkText(title, x, ty, titleFrac, { weight: 400, color: "rgba(255,255,255,0.82)", simpleRole: `${who}.title` });
      ty += half;
    }
    if (company) {
      const half = (lineCount(company) * titleFrac * vs) / 2;
      ty += 0.004 + half;
      mkText(company, x, ty, titleFrac, { weight: 500, color: "rgba(255,255,255,0.64)", simpleRole: `${who}.company` });
      ty += half;
    }
  };

  // Portrait-card geometry helpers (aspect ar = width:height). Keep photos from
  // squishing on wide (16:9) or tall (9:16) canvases.
  const cardWfromH = (hFrac: number, ar: number): number => hFrac * (H / W) * ar;
  const cardHfromW = (wFrac: number, ar: number): number => (wFrac * (W / H)) / ar;

  const isLandscape = W > H * 1.2;
  const isPortrait = H > W * 1.2;

  if (moderator && isLandscape) {
    // ── Landscape (16:9): a level ROW of cards (moderator a bit bigger),
    // each with its caption ABOVE. The diagonal/right-caption layout needs
    // vertical room a wide-short canvas doesn't have. ──
    const people = [moderator, ...speakerList];
    const m = people.length;
    const gap = 0.018;
    const rowBottom = 0.92;
    const capAllow = 0.04 + 0.06 * vs;
    const rowTop = areaTop + capAllow;
    const bandH = rowBottom - rowTop;
    // The moderator card is sized by the band alone, never by how many
    // speakers share the row — adding or removing a speaker resizes only the
    // speakers (the moderator picture stays identical for 1..N speakers).
    const modW = cardWfromH(bandH, 0.85);
    const spkUnit = m > 1 ? ((areaRight - areaLeft) - modW - gap * (m - 1)) / (m - 1) : 0;
    let x = areaLeft;
    people.forEach((p, i) => {
      const isMod = i === 0;
      const uw = isMod ? modW : spkUnit;
      let cw = uw;
      let ch = cardHfromW(cw, 0.85);
      if (ch > bandH) { ch = bandH; cw = cardWfromH(ch, 0.85); }
      const top = rowBottom - ch;
      const nameFrac = isMod ? 0.02 : 0.018;
      const who = isMod ? "moderator" : `speaker-${i - 1}`;
      const capH = captionHeight(p, nameFrac, cw);
      captionBlock(p, x, top - 0.012 - capH, nameFrac, cw, who);
      emitPhoto(p, x, top, cw, ch, who);
      emitRoleLabel(isMod ? "Moderator" : "Speaker", x, top, cw, ch, isMod ? 0.018 : 0.015);
      x += uw + gap;
    });
  } else if (moderator && !isPortrait) {
    // ── Square panel (the hand-made "Panel Discussion" reference) ──
    // Big moderator card left with caption to the RIGHT; speakers step UPWARD
    // to the right, each with its caption ABOVE the card.
    const n = speakerList.length;
    const modAr = 0.82;
    const modTop = areaTop + 0.01;
    const modBottom = 0.9;
    let modH = modBottom - modTop;
    let modW = cardWfromH(modH, modAr);
    if (modW > 0.3) { modW = 0.3; modH = cardHfromW(modW, modAr); } // cap width, keep room for speakers
    emitPhoto(moderator, areaLeft, modTop, modW, modH, "moderator");
    emitRoleLabel("Moderator", areaLeft, modTop, modW, modH, 0.019);
    const modCapX = areaLeft + modW + 0.03;
    captionBlock(moderator, modCapX, modTop + 0.006, 0.02, Math.min(0.32, areaRight - modCapX), "moderator");

    if (n > 0) {
      const spkAreaLeft = modCapX;
      const spkAreaRight = areaRight;
      const spkGap = 0.02;
      const spkBottom = 0.93;
      const capAllow = (0.05 + 0.05 * vs) * 1.1;
      const spkTop = areaTop + capAllow;
      const bandH = spkBottom - spkTop;
      // 4 speakers use Auri's fixed card size (15% × 17% of canvas, radius
      // stays the standard 8) — the derived size squeezed them too small.
      let spkW = n === 4 ? 0.15 : n <= 3 ? 0.185 : Math.max(0.12, (spkAreaRight - spkAreaLeft - spkGap * (n - 1)) / n);
      let spkH = n === 4 ? 0.17 : cardHfromW(spkW, 0.9); // portrait, un-squished
      if (spkH > bandH) { const s = bandH / spkH; spkH = bandH; spkW *= s; } // fit the band, keep aspect
      const step = n > 1 ? (spkAreaRight - spkAreaLeft - spkW) / (n - 1) : 0;
      const ascend = n > 1 ? (bandH - spkH) / (n - 1) : 0;
      speakerList.forEach((p, i) => {
        const cardLeft = spkAreaLeft + i * step;
        const cardBottom = spkBottom - i * ascend;
        const cardTop = cardBottom - spkH;
        const capMaxW = i < n - 1 ? Math.max(spkW, step * 0.9) : Math.max(spkW, spkAreaRight - cardLeft);
        const capH = captionHeight(p, 0.018, capMaxW);
        captionBlock(p, cardLeft, cardTop - 0.012 - capH, 0.018, capMaxW, `speaker-${i}`);
        emitPhoto(p, cardLeft, cardTop, spkW, spkH, `speaker-${i}`);
        emitRoleLabel("Speaker", cardLeft, cardTop, spkW, spkH, 0.015);
      });
    }
  } else {
    // ── Grid — portrait-with-moderator OR speakers-only (any format). Cards
    // are equal-sized and fill the area; captions are overlaid on the photo,
    // with a small role label above the name when a moderator is present. ──
    const gridPeople: { p: SimplePerson; role: string | null }[] = moderator
      ? [{ p: moderator, role: "Moderator" }, ...speakerList.map((p) => ({ p, role: "Speaker" as string | null }))]
      : speakerList.map((p) => ({ p, role: null as string | null }));
    const total = gridPeople.length;
    if (total > 0) {
      const peopleBottom = 0.92;
      // With a moderator the grid commits to 3 columns and the 2-row cell
      // height for up to 6 people, instead of re-fitting per count — so the
      // moderator cell (and the header above it) is identical whether the
      // panel has 1..5 speakers. Speakers-only grids keep filling the area.
      const pinned = Boolean(moderator) && total <= 6;
      const cols = pinned ? 3 : total <= 3 ? total : total === 4 ? 2 : 3;
      const nameFrac = pinned ? 0.02 : total <= 4 ? 0.024 : 0.02;
      const rows = Math.ceil(total / cols);
      const gapPx = 0.024 * W;
      const rowGapPx = 0.024 * H;
      const cellWpx = ((areaRight - areaLeft) * W - gapPx * (cols - 1)) / cols;
      const availHpx = pinned
        ? ((peopleBottom - areaTop) * H - rowGapPx) / 2
        : ((peopleBottom - areaTop) * H - rowGapPx * (rows - 1)) / rows;
      const photoWpx = cellWpx;
      const photoHpx = Math.max(cellWpx * 0.55, Math.min(availHpx, cellWpx * 1.4));
      gridPeople.forEach(({ p, role }, i) => {
        // Moderator (when present) occupies slot 0; speakers follow.
        const who = moderator ? (i === 0 ? "moderator" : `speaker-${i - 1}`) : `speaker-${i}`;
        const c = i % cols;
        const r = Math.floor(i / cols);
        const left = areaLeft + (c * (cellWpx + gapPx)) / W;
        const top = areaTop + (r * (photoHpx + rowGapPx)) / H;
        const w = photoWpx / W;
        const h = photoHpx / H;
        emitPhoto(p, left, top, w, h, who);
        // Overlaid caption: optional ROLE line, then name, then "title, company"
        // — all wrap to the card width so long names don't spill.
        const titleFrac = nameFrac * 0.72;
        const roleFrac = Math.min(0.014, nameFrac * 0.66);
        const maxCapW = w - 0.032;
        const roleTxt = role ? role.toUpperCase() : "";
        const name = p.name.trim() ? wrapToWidth(p.name, maxCapW, nameFrac) : "";
        const secRaw = [p.title.trim(), p.company.trim()].filter(Boolean).join(", ");
        const secondary = secRaw ? wrapToWidth(secRaw, maxCapW, titleFrac) : "";
        const roleH = roleTxt ? roleFrac * vs : 0;
        const roleGap = roleTxt && (name || secondary) ? 0.005 : 0;
        const nameH = name ? lineCount(name) * nameFrac * vs : 0;
        const secH = secondary ? lineCount(secondary) * titleFrac * vs : 0;
        const innerGap = name && secondary ? 0.006 : 0;
        const totalH = roleH + roleGap + nameH + secH + innerGap;
        const padBottom = 0.016 * vs + 0.012;
        if (!p.photo && totalH > 0) {
          const scrimH = totalH + padBottom + 0.02;
          shapes.push({
            id: uid("shape"), type: "rectangle",
            x: left + w / 2, y: top + h - scrimH / 2, width: w, height: scrimH,
            fillType: "fill", strokeWidth: 0, colorType: "solid",
            color1: "rgba(0,0,0,0.45)", color2: "#000000", opacity: 1, blur: 0, rotation: 0,
            borderRadius: 0.08,
          });
        }
        const padL = left + 0.016;
        let ty = top + h - padBottom - totalH; // top of the caption block
        if (roleTxt) {
          ty += roleH / 2;
          mkText(roleTxt, padL, ty, roleFrac, {
            weight: 800, uppercase: true, color: "#FFFFFF",
            letterSpacing: Math.round(0.0008 * S), shadow: "0 1px 4px rgba(0,0,0,0.5)",
          });
          ty += roleH / 2 + roleGap;
        }
        if (name) {
          ty += nameH / 2;
          mkText(name, padL, ty, nameFrac, { weight: 700, color: "#FFFFFF", simpleRole: `${who}.name` });
          ty += nameH / 2;
        }
        if (secondary) {
          ty += innerGap + secH / 2;
          mkText(secondary, padL, ty, titleFrac, { weight: 400, color: "rgba(255,255,255,0.88)", simpleRole: `${who}.secondary` });
        }
      });
    }
  }

  const design: DesignConfig = {
    backgroundId: form.backgroundId || "orb7",
    texts,
    shapes,
    showLogo: true,
    logoStyle: "white",
    logoPosition: "bottom-left",
  };

  return {
    format,
    customSize: { width: W, height: H },
    design,
    canvasImages,
  };
}

/**
 * Sidebar state saved ALONGSIDE a library doc, so loading restores the exact
 * form the design was built from. Panel photos are stripped before saving —
 * the doc's role-tagged canvasImages already carry them — and rehydrated by
 * role in `formsFromDoc`, so the payload stays small. Partner logos are
 * KEPT in full: One/Two/Four share the slot array, and the active doc only
 * carries the current layout's slots, so stripping would lose the others.
 */
export interface SimpleFormsSnapshot {
  template: "panel" | "partner";
  form?: SimpleForm;
  partner?: PartnerForm;
}

export function stripFormsForSave(template: "panel" | "partner", form: SimpleForm, partner: PartnerForm): SimpleFormsSnapshot {
  const strip = (p: SimplePerson): SimplePerson => ({ ...p, photo: "", naturalWidth: undefined, naturalHeight: undefined });
  return {
    template,
    form: { ...form, moderator: strip(form.moderator), speakers: form.speakers.map(strip) },
    partner,
  };
}

/** Partner docs are recognisable by their logo slots — used to pick which
 *  parked layout-variants belong to the template being saved. Delegates to
 *  `partnerLayoutOf` so a zero-logo doc with tagged placeholder frames counts
 *  too (same assumption fix, kept in one place). */
export function isPartnerDoc(doc: SimpleDoc): boolean {
  return partnerLayoutOf(doc) !== null;
}

/**
 * Panel docs saved before photo layers carried `simpleRole` (pre 2026-07-22)
 * have role-less headshots. Two things break on such a doc: `formsFromDoc`
 * can't rehydrate the sidebar photos, and `panelShapeKey` can never match a
 * rebuild — so a 3 → 2 → 3 speaker round-trip parks the design under a key no
 * rebuild reproduces and the tuning is stranded (generic layout shows instead).
 *
 * The builder has always emitted photos in person order — moderator first,
 * then speakers by index — so when EVERY image is role-less and the image
 * count equals the person count (read from the text roles), the roles can be
 * re-attached by position. Anything ambiguous passes through untouched:
 * docs that already carry any role, partner docs, and docs where the counts
 * differ (hand-added extras, or a person whose photo was never uploaded).
 */
export function adoptLegacyPanelRoles(doc: SimpleDoc): SimpleDoc {
  if (doc.canvasImages.length === 0) return doc;
  if (doc.canvasImages.some((i) => i.simpleRole)) return doc;
  if (isPartnerDoc(doc)) return doc;
  const textRoles = doc.design.texts
    .map((t) => t.simpleRole)
    .filter((r): r is string => Boolean(r));
  const speakerIdx = [...new Set(
    textRoles
      .map((r) => /^speaker-(\d+)\./.exec(r)?.[1])
      .filter((n): n is string => Boolean(n))
      .map(Number),
  )].sort((a, b) => a - b);
  const persons = [
    ...(textRoles.some((r) => r.startsWith("moderator.")) ? ["moderator"] : []),
    ...speakerIdx.map((i) => `speaker-${i}`),
  ];
  if (persons.length !== doc.canvasImages.length) return doc;
  return {
    ...doc,
    canvasImages: doc.canvasImages.map((img, i) => ({ ...img, simpleRole: `${persons[i]}.photo` })),
  };
}

/** Fold a legacy two-field person ("Principal" + "Lightrock") into the single
 *  description field ("Principal, Lightrock"). No-op when company is empty —
 *  which is every person created after the sidebar merged the fields. */
export function mergePersonDescription(p: SimplePerson): SimplePerson {
  if (!p.company.trim()) return p;
  return { ...p, title: [p.title.trim(), p.company.trim()].filter(Boolean).join(", "), company: "" };
}

/**
 * Doc-side counterpart of `mergePersonDescription`: docs built before the
 * description merge carry separate `<who>.title` and `<who>.company` text
 * layers, but a rebuild from a merged form emits only `.title` — so the role
 * sets diverge and every tuned legacy doc would strand (round-8 bug class).
 * Folds each `.company` layer into its `.title` layer as an extra line
 * (keeping the tuned title layer's position/styling), or re-roles it to
 * `.title` when the person had a company but no title. Returns the doc
 * untouched when there is nothing to merge.
 */
export function mergeLegacyCompanyLayers(doc: SimpleDoc): SimpleDoc {
  const companies = doc.design.texts.filter((t) => t.simpleRole?.endsWith(".company"));
  if (companies.length === 0) return doc;
  const titleRoles = new Set(doc.design.texts.map((t) => t.simpleRole).filter((r): r is string => Boolean(r)));
  const byWho = new Map(companies.map((t) => [(t.simpleRole as string).replace(/\.company$/, ""), t]));
  return {
    ...doc,
    design: {
      ...doc.design,
      texts: doc.design.texts.flatMap((t) => {
        if (t.simpleRole?.endsWith(".company")) {
          const who = t.simpleRole.replace(/\.company$/, "");
          // No title layer to merge into — this layer BECOMES the description.
          return titleRoles.has(`${who}.title`) ? [] : [{ ...t, simpleRole: `${who}.title` }];
        }
        if (t.simpleRole?.endsWith(".title")) {
          const company = byWho.get(t.simpleRole.replace(/\.title$/, ""));
          // ",\n" — renders as the same two lines, and formsFromDoc's
          // newline-to-space flatten yields "title, company" for the single
          // input instead of silently eating the comma. Trailing comma or
          // whitespace on the old title is stripped first so "Partner," +
          // "Molten" doesn't double-comma.
          if (company) return [{ ...t, content: `${t.content.replace(/[,\s]+$/, "")},\n${company.content}` }];
        }
        return [t];
      }),
    },
  };
}

/**
 * The editor's Duplicate (⌘D) copies a layer's `simpleRole` verbatim, so a
 * user who clones a speaker's layers to mock up an extra speaker produces a
 * doc with DUPLICATE roles — which no rebuild can ever shape-match, stranding
 * the design on any form change (bit Auri's "Panel with 4 People": Omolade's
 * texts duplicated as a 4th speaker, still tagged speaker-2).
 *
 * Repair heuristic: the first occurrence of each role keeps it; later copies
 * of a `speaker-N.*` role are renumbered to a fresh speaker index (same
 * duplicate-ordinal → same new index, so a cloned name+title pair becomes ONE
 * new person). Duplicate copies of any other role (moderator.*, headline…)
 * just lose the tag and live on as hand-added decorations.
 */
export function dedupeSpeakerRoles(doc: SimpleDoc): SimpleDoc {
  const roles = [...doc.design.texts, ...doc.canvasImages]
    .map((x) => x.simpleRole)
    .filter((r): r is string => Boolean(r));
  if (new Set(roles).size === roles.length) return doc;
  if (isPartnerDoc(doc)) return doc;

  const spkIdx = (r: string) => { const m = /^speaker-(\d+)\./.exec(r); return m ? Number(m[1]) : null; };
  const maxIdx = Math.max(-1, ...roles.map(spkIdx).filter((n): n is number => n !== null));
  const seen = new Map<string, number>();
  const rerole = <T extends { simpleRole?: string }>(el: T): T => {
    if (!el.simpleRole) return el;
    const ordinal = seen.get(el.simpleRole) ?? 0;
    seen.set(el.simpleRole, ordinal + 1);
    if (ordinal === 0) return el;
    const idx = spkIdx(el.simpleRole);
    if (idx === null) return { ...el, simpleRole: undefined };
    return { ...el, simpleRole: el.simpleRole.replace(/^speaker-\d+\./, `speaker-${maxIdx + ordinal}.`) };
  };
  return {
    ...doc,
    canvasImages: doc.canvasImages.map(rerole),
    design: { ...doc.design, texts: doc.design.texts.map(rerole) },
  };
}

/** A partner doc has no people, so role-less MODERATOR/SPEAKER words on one
 *  are leakage from the pre-guard `syncPartnerChrome` bug (panel chrome
 *  carried across a template switch) — drop them so docs contaminated before
 *  the fix heal on their next load. Panel docs keep their words, of course. */
export function stripLeakedPanelWords(doc: SimpleDoc): SimpleDoc {
  if (!isPartnerDoc(doc)) return doc;
  const leaked = (t: TextElement) => !t.simpleRole && ["MODERATOR", "SPEAKER"].includes(t.content.trim());
  if (!doc.design.texts.some(leaked)) return doc;
  return { ...doc, design: { ...doc.design, texts: doc.design.texts.filter((t) => !leaked(t)) } };
}

/** Everything a doc from storage or the library needs before use: photo roles
 *  for pre-2026-07-22 items, deduped roles for editor-cloned layers,
 *  description-merged text layers for pre-merge ones, leaked panel words
 *  stripped off partner docs. All no-ops on clean current docs. */
export function migrateLegacyPanelDoc(doc: SimpleDoc): SimpleDoc {
  return stripLeakedPanelWords(mergeLegacyCompanyLayers(dedupeSpeakerRoles(adoptLegacyPanelRoles(doc))));
}

/** The identity a newly added 4th speaker starts with (Auri's sample) — a
 *  real card with a face beats an empty frame for first-run feel. */
export function sampleFourthSpeaker(): SimplePerson {
  return { name: "Rajeev Kumal", title: "CTO at 88 Angle", company: "", photo: "/samples/rajeev-kumal.jpg" };
}

/**
 * Saved-image file name (without extension): format first, then the template,
 * then the headline for panels — "1x1 - Panel - Continuation Capital".
 * Partner announcements are just "16x9 - Partner Announcement" (their label is
 * generic). Colons are illegal in Windows file names, so 16:9 → 16x9.
 */
export function simpleExportName(template: "panel" | "partner", format: PlatformFormat, headline: string): string {
  const fmt = format === "presentation" ? "16x9" : format === "story" ? "9x16" : "1x1";
  if (template === "partner") return `${fmt} - Partner Announcement`;
  const clean = headline
    .split("\n").join(" ")
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return clean ? `${fmt} - Panel - ${clean}` : `${fmt} - Panel`;
}

/**
 * Rebuild the sidebar state for a doc loaded from the team library, so the
 * template toggle and every field match what's on the canvas. Prefers the
 * `SimpleFormsSnapshot` saved with the doc (exact); for docs saved before
 * snapshots existed it reconstructs what it can from the role-tagged layers.
 * Returns null for the form that doesn't belong to the doc's kind, so the
 * caller leaves that side of the state alone.
 */
export function formsFromDoc(kind: string, doc: SimpleDoc, saved?: SimpleFormsSnapshot): { template: "panel" | "partner"; form: SimpleForm | null; partner: PartnerForm | null } {
  const template: "panel" | "partner" = saved?.template ?? (kind === "partner" ? "partner" : "panel");
  const imgByRole = new Map(doc.canvasImages.filter((i) => i.simpleRole).map((i) => [i.simpleRole as string, i]));
  const textByRole = new Map(doc.design.texts.filter((t) => t.simpleRole).map((t) => [t.simpleRole as string, t.content]));
  const asLogo = (role: string): PartnerLogo | null => {
    const i = imgByRole.get(role);
    return i ? { src: i.src, naturalWidth: i.naturalWidth, naturalHeight: i.naturalHeight } : null;
  };

  if (template === "partner") {
    const base = saved?.partner ?? emptyPartnerForm();
    const quad = [0, 1, 2, 3].some((i) => imgByRole.has(`logo-${i}`));
    const duo = [0, 1].some((i) => imgByRole.has(`logo-duo-${i}`));
    // A doc with no uploaded logos has no image roles to infer from — the
    // saved layout (when present) is the only witness.
    const layout = duo ? "duo" as const : quad ? "quad" as const : (imgByRole.has("logo-single") || !saved?.partner) ? "single" as const : base.layout;
    // Snapshots carry the FULL slot array (One/Two/Four share it); the doc's
    // roles only cover the active layout, so they're the legacy fallback.
    const roleLogos = layout === "quad" ? [0, 1, 2, 3].map((i) => asLogo(`logo-${i}`))
      : layout === "duo" ? [0, 1].map((i) => asLogo(`logo-duo-${i}`))
      : [asLogo("logo-single")];
    return {
      template,
      form: null,
      partner: {
        ...base,
        label: saved?.partner ? base.label : (textByRole.get("label") ?? base.label),
        layout,
        logos: base.logos.some((l) => l?.src) ? base.logos : roleLogos,
        backgroundId: doc.design.backgroundId || base.backgroundId,
      },
    };
  }

  // Panel. Photos always come from the doc's role-tagged images; text fields
  // from the snapshot when present, else reconstructed from the text roles.
  const withPhoto = (p: SimplePerson, who: string): SimplePerson => {
    const img = imgByRole.get(`${who}.photo`);
    return img ? { ...p, photo: img.src, naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight } : p;
  };

  if (saved?.form) {
    return {
      template,
      partner: null,
      form: {
        ...saved.form,
        // Old snapshots carry two-field people — fold company into the
        // description so the single sidebar input shows everything.
        moderator: mergePersonDescription(withPhoto(saved.form.moderator, "moderator")),
        speakers: saved.form.speakers.map((p, i) => mergePersonDescription(withPhoto(p, `speaker-${i}`))),
        backgroundId: doc.design.backgroundId || saved.form.backgroundId,
      },
    };
  }

  // Legacy doc (no snapshot): reconstruct from roles. The description is one
  // field now, so the grid's "secondary" line and any legacy separate
  // title/company layers all fold into `title`. Builder-wrapped newlines
  // become spaces — a single-line input can't show them.
  const flat = (s: string) => s.split("\n").join(" ");
  const person = (who: string): SimplePerson => {
    const secondary = textByRole.get(`${who}.secondary`) ?? "";
    return withPhoto(mergePersonDescription({
      name: textByRole.get(`${who}.name`) ?? "",
      title: flat(textByRole.get(`${who}.title`) ?? secondary),
      company: flat(textByRole.get(`${who}.company`) ?? ""),
      photo: "",
    }), who);
  };
  const roles = [...textByRole.keys(), ...imgByRole.keys()];
  const speakerCount = 1 + Math.max(-1, ...roles
    .map((r) => /^speaker-(\d+)\./.exec(r))
    .filter((m): m is RegExpExecArray => Boolean(m))
    .map((m) => Number(m[1])));
  const includeModerator = roles.some((r) => r.startsWith("moderator"));
  return {
    template,
    partner: null,
    form: {
      label: textByRole.get("label") ?? "",
      headline: textByRole.get("headline") ?? "",
      subtitle: textByRole.get("subtitle") ?? "",
      includeModerator,
      moderator: includeModerator ? person("moderator") : emptyPerson(),
      speakers: speakerCount > 0
        ? Array.from({ length: speakerCount }, (_, i) => person(`speaker-${i}`))
        : [emptyPerson()],
      backgroundId: doc.design.backgroundId || "orb7",
    },
  };
}
