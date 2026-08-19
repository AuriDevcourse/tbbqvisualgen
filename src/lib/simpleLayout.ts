// Turns the simple-mode form into a full canvas doc (design + images), reusing
// the same rendering engine as the pro editor. Pure function — no React.
import { FORMAT_DIMENSIONS, type DesignConfig, type PlatformFormat, type TextElement, type ShapeElement } from "@/types/template";
import { accentShapes, syncAccentShapes } from "@/lib/accents";
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
  // Placeholder frames carry the slot they stand in for (partner/sales docs;
  // panel person-frames are untagged), and those tags are part of the shape:
  // a thank-you wall with a LEAD tier has the same frame COUNT as a flat one of
  // the same size, so on count alone the two parked under one key and the flat
  // tuning revived over the tiered rebuild — the tier change silently ignored.
  const frameRoles = (doc.design.shapes ?? [])
    .filter(isSlotPlaceholder)
    .map((s) => s.simpleRole)
    .filter((r): r is string => Boolean(r))
    .sort();
  const slots = frameRoles.length ? `|slots:${frameRoles.join(",")}` : "";
  return `${doc.format}|${doc.customSize.width}x${doc.customSize.height}|${roles.join(",")}|imgs:${imgRoles.join(",") || "none"}|frames:${placeholderCount(doc)}${slots}`;
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
/**
 * The whole-canvas choices a tuned doc must NOT keep. Each is a form field
 * rather than a hand-placed layer, so the rebuild always wins — otherwise the
 * control appears dead for as long as a tuned design is on screen.
 *
 * Assigned unconditionally, including when the rebuild leaves one undefined:
 * spreading `tuned.design` first would keep a stale value, and dragging the
 * scrim back to 0 (or clearing an accent) would do nothing. That is exactly how
 * the scrim shipped broken on 2026-08-10 — it only responded on a 26-logo wall,
 * the one shape with no tuned doc to absorb the change.
 */
function canvasChoices(rebuilt: SimpleDoc): Pick<SimpleDoc["design"], "backgroundId" | "overlayColor" | "overlayOpacity" | "overlayBlend" | "accentId"> {
  return {
    backgroundId: rebuilt.design.backgroundId,
    overlayColor: rebuilt.design.overlayColor,
    overlayOpacity: rebuilt.design.overlayOpacity,
    overlayBlend: rebuilt.design.overlayBlend,
    // The accent CHOICE is a form field but its circles are hand-movable
    // layers, so the tuned doc keeps their geometry (via syncAccentShapes) and
    // the rebuild supplies only the fill, or removes them.
    accentId: rebuilt.design.accentId,
  };
}

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

  // Frames also carry the slot they stand in for, and a frame standing in for a
  // DIFFERENT slot is a different composition even when the counts match: a
  // thank-you wall's lead-tier cell is not one of its support cells. Compared
  // only when both sides are tagged, so a doc tuned before frames carried tags
  // still retargets instead of being binned.
  const frameRoles = (d: SimpleDoc) => (d.design.shapes ?? [])
    .filter(isSlotPlaceholder)
    .map((s) => s.simpleRole)
    .filter((r): r is string => Boolean(r))
    .sort();
  const tunedFrames = frameRoles(tuned);
  const rebuiltFrames = frameRoles(rebuilt);
  if (tunedFrames.length && rebuiltFrames.length && tunedFrames.join(",") !== rebuiltFrames.join(",")) return null;

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
      ...canvasChoices(rebuilt),
      shapes: syncAccentShapes(tuned.design.shapes ?? [], rebuilt.design.shapes ?? []),
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
  // `thanks.headline` joins the captions: the builder WRAPS it, so its newlines
  // are layout rather than the user's Enter presses, and a hand re-break in the
  // editor must survive a form edit that didn't change the words.
  const caption = /\.(name|title|company|secondary)$/.test(t.simpleRole) || t.simpleRole === "thanks.headline";
  const flat = (s: string) => s.split("\n").join(" ");
  if (caption && flat(t.content) === flat(next)) return t;
  return t.content === next ? t : { ...t, content: next };
}

/** Which partner logo layout a doc renders — read from its image roles, or
 *  from the placeholder frames' role tags when no logo is uploaded yet (a
 *  zero-logo partner doc still has a layout; only untagged legacy docs with
 *  no images stay null). */
export function partnerLayoutOf(doc: SimpleDoc): PartnerLayout | null {
  const of = (r: string) =>
    r === "logo-single" ? "single" as const
    : r.startsWith("logo-duo-") ? "duo" as const
    : THANKS_ROLE_RE.test(r) ? "thanks" as const
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

/**
 * A thank-you cell's role. The lead tier gets its OWN role name, not just a
 * bigger box: the tier split drives geometry, so it has to be visible in the
 * role set — else `retargetPartnerLayout` would carry a tuned design across a
 * tier change and silently ignore it (the same trap the cell count avoids by
 * changing the role COUNT).
 */
const thanksSlotRole = (index: number, isLead: boolean): string =>
  isLead ? `logo-thanks-lead-${index}` : `logo-thanks-${index}`;

const THANKS_ROLE_RE = /^logo-thanks-(?:lead-)?(\d+)$/;

/** The thank-you wall's slot roles, read off a doc — its cell count and tier
 *  split are form fields, so unlike One/Two/Four the role set can't be a
 *  constant. Covers both filled cells (images) and empty ones (tagged
 *  placeholder frames), ordered by cell index. */
function thanksSlotRoles(doc: SimpleDoc): string[] {
  const found = new Map<number, string>();
  const take = (r: string | undefined) => {
    const m = r ? THANKS_ROLE_RE.exec(r) : null;
    if (m) found.set(Number(m[1]), r as string);
  };
  for (const i of doc.canvasImages) take(i.simpleRole);
  for (const s of doc.design.shapes ?? []) take(s.simpleRole);
  return [...found.keys()].sort((a, b) => a - b).map((n) => found.get(n) as string);
}

/** How many of a wall's cells are in the lead (bigger) tier. */
function thanksLeadCount(doc: SimpleDoc): number {
  return thanksSlotRoles(doc).filter((r) => r.startsWith("logo-thanks-lead-")).length;
}

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
export function retargetPartnerLayout(tuned: SimpleDoc, rebuilt: SimpleDoc, layout: PartnerLayout): SimpleDoc | null {
  if (partnerLayoutOf(tuned) !== layout) return null;
  if (layout === "thanks") {
    // The wall's cell count is part of its composition: a different count is a
    // different grid, so only an identical role set can carry the tuning (the
    // count change then parks + rebuilds, like a speaker-count change).
    const have = thanksSlotRoles(tuned);
    const want = thanksSlotRoles(rebuilt);
    if (have.length !== want.length || have.some((r, i) => r !== want[i])) return null;
    return retargetSlotDoc(tuned, rebuilt, have);
  }
  return retargetSlotDoc(tuned, rebuilt, SLOT_ROLES[layout]);
}

/**
 * The sales template's counterpart: one photo slot that can be filled or
 * cleared without binning the tuned design. Same machinery as the partner
 * layouts — the tuned frame keeps its hand-placed geometry and only its
 * contents change.
 */
export function retargetSalesLayout(tuned: SimpleDoc, rebuilt: SimpleDoc, layout: "countdown" | "discount"): SimpleDoc | null {
  if (salesLayoutOf(tuned) !== layout) return null;
  return retargetSlotDoc(tuned, rebuilt, [`sales-${layout}.photo`]);
}

/** The slot reconciliation shared by `retargetPartnerLayout` and
 *  `retargetSalesLayout`: same composition, different fill pattern. */
function retargetSlotDoc(tuned: SimpleDoc, rebuilt: SimpleDoc, slotRoles: readonly string[]): SimpleDoc | null {
  if (tuned.format !== rebuilt.format) return null;
  if (tuned.customSize.width !== rebuilt.customSize.width) return null;
  if (tuned.customSize.height !== rebuilt.customSize.height) return null;

  // Words move across on the same contract as retargetTunedDoc.
  const want = new Map(rebuilt.design.texts.filter((t) => t.simpleRole).map((t) => [t.simpleRole as string, t.content]));
  const have = new Map(tuned.design.texts.filter((t) => t.simpleRole).map((t) => [t.simpleRole as string, t.content]));
  if (want.size !== have.size) return null;
  for (const role of want.keys()) if (!have.has(role)) return null;

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
      ...canvasChoices(rebuilt),
      texts: tuned.design.texts.map((t) => carryWords(t, want)),
      // Slot reconciliation first (frames swapped for images), then the accents
      // on whatever survived.
      shapes: syncAccentShapes(
        [...(tuned.design.shapes ?? []).filter((s) => !dropShapeIds.has(s.id)), ...addShapes],
        rebuilt.design.shapes ?? [],
      ),
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
  // The thank-you wall shares no chrome with One/Two/Four: it leads with a big
  // headline instead of the label chip, and it deliberately hides the TechBBQ
  // lockup the others place bottom-centre. Carrying either way would drop a
  // logo onto the grid's last row (or strip it off an announcement).
  if ((partnerLayoutOf(from) === "thanks") !== (partnerLayoutOf(to) === "thanks")) return to;

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
  // The two panel layouts have different headers: the discussion's chip sits
  // under a headline on the left, the stage-host's is the top of the right-hand
  // column. Carrying chrome across the flavour switch would drag the label (and
  // its chip) into the wrong column.
  if (isStageHostDoc(from) !== isStageHostDoc(to)) return to;

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
/**
 * The Next Session equivalent of `syncPanelChrome`: adding or removing a
 * speaker must not move the parts of the board that have nothing to do with
 * the count — the banner and its text, the ON STAGE chip and its text, and the
 * title. Those carry their geometry across from the design being left; the
 * people rows are count-specific and always stay the target's own.
 *
 * Geometry and styling come from `from`, content stays the target's (both
 * derive from the same form anyway). Cross-format/size pairs, and pairs where
 * either side is not a Next doc, are returned unchanged.
 */
/**
 * How many speakers a built Next doc holds, read back off its role tags. Used
 * to tell the fireside board apart from the rest without the form in hand.
 */
function nextSpeakerCountOf(doc: SimpleDoc): number {
  const roles = [
    ...doc.design.texts.map((t) => t.simpleRole),
    ...doc.canvasImages.map((i) => i.simpleRole),
  ];
  return new Set(
    roles.map((r) => /^speaker-(\d+)\./.exec(r ?? "")?.[1]).filter(Boolean),
  ).size;
}

/** The fireside board: exactly one speaker AND a moderator. Its header is laid
 *  out differently from every other count, so several rules branch on it. */
function isFiresideDoc(doc: SimpleDoc): boolean {
  const hasModerator = doc.design.texts.some((t) => t.simpleRole?.startsWith("moderator."))
    || doc.canvasImages.some((i) => i.simpleRole?.startsWith("moderator."));
  return hasModerator && nextSpeakerCountOf(doc) === 1;
}

export function syncNextChrome(from: SimpleDoc, to: SimpleDoc): SimpleDoc {
  if (from.format !== to.format) return to;
  if (from.customSize.width !== to.customSize.width) return to;
  if (from.customSize.height !== to.customSize.height) return to;
  if (!isNextDoc(from) || !isNextDoc(to)) return to;

  // The subtitle is chrome too: it flows with the title, so a speaker added or
  // removed must not re-fit it. `next.moderatorLabel` is NOT here on purpose —
  // it belongs to the moderator card, which is count-specific and moves.
  //
  // The header is chrome only WITHIN a family, though. The fireside board (one
  // moderator, one speaker) puts its cards beside the title and runs its own
  // type scale — 88/38 against 120/66, fitted to half the width. Carrying that
  // header onto a 3-speaker board, whose cards sit under the title, dropped the
  // subtitle straight through the moderator's card and its label. Crossing that
  // boundary, the target keeps its own freshly-measured header.
  const crossesFireside = isFiresideDoc(from) !== isFiresideDoc(to);
  const CHROME_TEXT = crossesFireside
    ? new Set(["next.session", "next.stage"])
    : new Set(["next.session", "next.stage", "headline", "subtitle"]);
  const CHROME_SHAPE = new Set(["next.banner", "next.stage.chip"]);

  const fromText = new Map(from.design.texts.filter((t) => t.simpleRole).map((t) => [t.simpleRole as string, t]));
  const texts = to.design.texts.map((t) => {
    if (!t.simpleRole || !CHROME_TEXT.has(t.simpleRole)) return t;
    const src = fromText.get(t.simpleRole);
    // Content stays the target's; everything else (position, size, colour,
    // weight) is the tuning being carried.
    return src ? { ...src, id: t.id, content: t.content } : t;
  });

  const fromShape = new Map((from.design.shapes ?? []).filter((s) => s.simpleRole).map((s) => [s.simpleRole as string, s]));
  const shapes = (to.design.shapes ?? []).map((s) => {
    if (!s.simpleRole || !CHROME_SHAPE.has(s.simpleRole)) return s;
    const src = fromShape.get(s.simpleRole);
    return src ? { ...src, id: s.id } : s;
  });

  return {
    ...to,
    design: {
      ...to.design,
      texts,
      shapes,
      // The logo is chrome too — a dragged logo must not snap back when the
      // speaker count changes.
      logoPosition: from.design.logoPosition ?? to.design.logoPosition,
      logoCustomPosition: from.design.logoCustomPosition ?? to.design.logoCustomPosition,
      logoScale: from.design.logoScale ?? to.design.logoScale,
      logoStyle: from.design.logoStyle ?? to.design.logoStyle,
      showLogo: from.design.showLogo ?? to.design.showLogo,
    },
  };
}

export function parkDoc(shelf: Record<string, SimpleDoc>, doc: SimpleDoc): Record<string, SimpleDoc> {
  const key = panelShapeKey(doc);
  const next = Object.fromEntries(Object.entries(shelf).filter(([k]) => k !== key));
  next[key] = doc;
  return next;
}

/** One (format × layout) combination a template bundle has a tuned design
 *  for. Panel docs carry no layout — their `layout` is null and coverage
 *  is per-format only. */
export interface TemplateCoverage {
  format: PlatformFormat;
  layout: PartnerLayout | "countdown" | "discount" | null;
}

/** What a template bundle consists of: the distinct (format × layout) combos
 *  across its active doc + bundled variants. Drives the sidebar's "set up
 *  for / not set up for" hints. */
export function bundleCoverage(docs: SimpleDoc[]): TemplateCoverage[] {
  const seen = new Set<string>();
  const out: TemplateCoverage[] = [];
  for (const d of docs) {
    const layout = salesLayoutOf(d) ?? partnerLayoutOf(d);
    const key = `${d.format}|${layout}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ format: d.format, layout });
  }
  return out;
}

export interface PartnerLogo {
  /** Uploaded logo as a data-URL. When `tint` is set this is the RECOLOURED
   *  copy — the doc only ever sees a finished image. */
  src: string;
  naturalWidth?: number;
  naturalHeight?: number;
  /** The untouched artwork, kept so "Original" can restore it and so switching
   *  colours never compounds (a multi-colour logo cannot be un-flattened). */
  originalSrc?: string;
  /** The colour the logo was restained to, for the active swatch. */
  tint?: string;
}

/** The partner template's compositions. The first three announce one to four
 *  partners; `thanks` is the end-of-event "thank you to our partners" wall — a
 *  big headline over an auto-flowed grid of as many logos as needed. */
export type PartnerLayout = "single" | "duo" | "quad" | "thanks";

/**
 * How many logo cells the thank-you wall can hold. The floor is 1 so the
 * stepper can't produce an empty grid (which would leave the doc with no
 * partner role at all, i.e. no longer a partner doc).
 *
 * The ceiling was 30 — a 6×5 grid, the most that reads at 16:9 while the wall
 * stays capped at 5 columns. Raised to 48 on 2026-08-10 for the Life Science x
 * Deep Tech thank-you posts, where the roster is the whole exhibiting cohort
 * and splitting it across slides was rejected: everyone gets thanked on one
 * image. A wall over 30 widens past 5 columns instead of growing rows — see
 * `thanksFlatMaxColumns` — so the cells shrink far less than the count suggests.
 *
 * Raised again to 56 on 2026-08-14, for the same reason and by the same call:
 * the LS x DT roster grew to 44 exhibitors, which puts the participating wall
 * (exhibitors + pitch finalists, de-duplicated) at 54. Columns are capped at 8,
 * so this is the first wall to grow a SEVENTH row, and 8×7 = 56 is where the cap
 * now sits. Rows past six cost cell height, not width, so the shrink is
 * ~1/7 per logo rather than the halving a column change would cause.
 *
 * Walls of 30 or fewer are untouched by this: same column count, same cell
 * size, same output as before.
 */
export const THANKS_MIN_LOGOS = 1;
export const THANKS_MAX_LOGOS = 56;

/**
 * The cap for a TIERED wall — a wall whose form carries `tiers`, i.e. the whole
 * partner list drawn tier by tier rather than one flat grid.
 *
 * It is four times the flat cap because it answers a different question. The
 * flat cap is "how many logos still READ at one size on this canvas"; a tiered
 * wall has already accepted that the bottom tiers are small — the point of it is
 * that the complete list fits one image, with the hierarchy showing. 240 covers
 * the 2026 list (211 partners) with room for the roster to grow.
 *
 * A wall this dense is a POSTER, not a slide: at 16:9 the Community tier lands
 * near 40px cells. Build it in 9:16 or a tall custom size when it has to be read
 * rather than glanced at — the per-tier walls exist for everything else.
 */
export const THANKS_TIERED_MAX_LOGOS = 240;

/**
 * How the logo block sits in the room below the headline: the share of the
 * leftover height placed ABOVE the block. 0.5 = dead centre, 0 = flush under
 * the headline, so LOWER means the logos ride higher.
 *
 * 0.42 on a full 30-logo square leaves 0.080 of the canvas under the headline
 * against 0.110 above the bottom margin. Tune this one number if the wall wants
 * to sit higher or lower; nothing else needs to move.
 *
 * The wall was dead-centred until 2026-08-10. Two things changed together that
 * day — the headline dropped from 162px to 120px, which frees roughly 0.06 of
 * height on its own, and this bias went in on top. Going much below 0.4 stacks
 * the two and strands the grid high with a wide empty band along the bottom.
 */
export const THANKS_GRID_BIAS = 0.42;

/** One tier band of a tiered wall: how many of the wall's logos it holds, and
 *  optionally how many columns to draw them in. The COLUMN COUNT is what makes a
 *  tier's cells bigger or smaller (a 4-across cell is 1.5x the width of a
 *  6-across one), so passing it is how the caller sets the hierarchy; omitted, it
 *  is derived from the band's size. */
export interface PartnerTierBand {
  count: number;
  cols?: number;
  /** Shown in no design — carried so a wall can be read back and explained. */
  label?: string;
}

export interface PartnerForm {
  /** Announcement label rendered across the top — e.g. "Partner Announcement".
   *  Unused by the `thanks` layout, which leads with `headline` instead. */
  label: string;
  layout: PartnerLayout;
  /** Slot 0 for single, 0–1 for duo, 0–3 for quad, 0–(logoCount-1) for thanks.
   *  A missing/empty slot renders as an outlined placeholder frame. */
  logos: (PartnerLogo | null)[];
  /** Thank-you layout only: how many cells the logo grid renders. Kept as its
   *  own field rather than derived from `logos.length` so an empty trailing
   *  cell survives (the grid is chosen first, filled second). */
  logoCount: number;
  /** Thank-you layout only: how many of the FIRST cells form the lead tier,
   *  rendered bigger than the rest (main partners over support partners).
   *  0 = one uniform grid. */
  featuredCount: number;
  /** Thank-you layout only: tier BANDS, in order, when the wall draws the whole
   *  list tier by tier (All Partners). Each band gets its own column count and
   *  therefore its own cell size, and the bands stack down the canvas. When set
   *  this REPLACES the lead/rest split — `featuredCount` is ignored — and the
   *  cell cap becomes `THANKS_TIERED_MAX_LOGOS`. Bands are a form field rather
   *  than something read off the doc's roles, so a tiered wall reloaded from a
   *  library item without a form snapshot comes back as a flat wall. */
  tiers?: PartnerTierBand[];
  /** Thank-you layout only: the big centred headline. Its own field so
   *  switching layouts never overwrites the label chip's wording. */
  headline: string;
  /** Thank-you layout only: how far to dim the background behind the logos,
   *  0 (off) to 1. Some backgrounds have pale patches that swallow a white
   *  logo — the light-green orb is the worst — and a scrim buys back the
   *  contrast without forcing a different background. Renders as a black
   *  overlay BELOW the logos and headline, so only the background darkens. */
  scrim?: number;
  /** Investor Relations circle accents (see ACCENT_REGISTRY), or undefined
   *  for none. Sits next to the background because it is the same kind of
   *  choice: a whole-canvas look, not a layer. */
  accentId?: string;
  backgroundId: string;
}

/** The scrim slider's ceiling. Past this the background stops reading as a
 *  background and the post is a black card with a coloured edge. */
export const THANKS_SCRIM_MAX = 0.6;

/**
 * Shuffle the wall's logos. Alphabetical order puts every A-name on row one,
 * which reads like a ranking nobody intended; one click makes the grid look
 * like a wall of peers.
 *
 * Two rules the shuffle must not break:
 *   The LEAD TIER shuffles within itself. Main partners have to stay in the
 *     first cells or the tier stops meaning anything, so a two-tier wall gets
 *     two independent shuffles rather than one across the boundary.
 *   Logos parked BEYOND `logoCount` never move. They are the ones the stepper
 *     hid, and pulling a hidden logo into view is not what "shuffle" means.
 *
 * `rand` is injectable so the tests can assert the arrangement instead of just
 * its length.
 */
export function shuffleWallLogos(form: PartnerForm, rand: () => number = Math.random): (PartnerLogo | null)[] {
  const shuffled = (arr: (PartnerLogo | null)[]): (PartnerLogo | null)[] => {
    const out = [...arr];
    // Fisher-Yates: every ordering equally likely. A `sort(() => rand() - 0.5)`
    // is biased and, worse, not a valid comparator.
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  };
  const lead = Math.max(0, Math.min(form.featuredCount, form.logoCount));
  const visible = form.logos.slice(0, form.logoCount);
  return [
    ...shuffled(visible.slice(0, lead)),
    ...shuffled(visible.slice(lead)),
    ...form.logos.slice(form.logoCount),
  ];
}

export function emptyPartnerForm(): PartnerForm {
  return {
    label: "Partner Announcement",
    layout: "single",
    logos: [],
    logoCount: 12,
    featuredCount: 0,
    headline: "Thank you to our partners",
    scrim: 0,
    backgroundId: "orb7",
  };
}

/**
 * Sales / ticket announcement — the countdown and discount visuals.
 *
 * Two layouts, same form (like the partner template's One/Two/Four):
 *  - "countdown": giant number + caption ("48" / "days left") with a wide
 *    photo band along the bottom.
 *  - "discount": headline, giant value ("10%"), a white CTA pill, a small
 *    footer line, and a portrait photo card on the right.
 *
 * Every field is plain text — nothing is computed from today's date, so a
 * saved design never silently changes its number.
 */
export interface SalesForm {
  layout: "countdown" | "discount";
  /** The big figure: "48", "10%", "2". */
  value: string;
  /** The line under the figure — "days left", "off your ticket". */
  caption: string;
  /** Discount layout only: the sentence above the figure. */
  headline: string;
  /** Discount layout only: white pill under the figure. Empty = no pill. */
  cta: string;
  /** Discount layout only: small line along the bottom edge. */
  footer: string;
  /** Diagonal corner ribbon across the top-right. Empty = no ribbon. */
  ribbon: string;
  /** The one photo this layout frames. Same {src, natural*} shape as a
   *  partner logo, so the upload slot component is shared. */
  photo: PartnerLogo | null;
  /** Investor Relations circle accents (see ACCENT_REGISTRY), or undefined
   *  for none. Sits next to the background because it is the same kind of
   *  choice: a whole-canvas look, not a layer. */
  accentId?: string;
  backgroundId: string;
}

export function emptySalesForm(): SalesForm {
  return {
    layout: "countdown",
    value: "48",
    caption: "days left",
    headline: "Less than 2 weeks\nleft to save",
    cta: "BOOK NOW",
    footer: "COPENHAGEN  |  26-27 AUGUST 2026",
    ribbon: "TECHBBQ · TECHBBQ · TECHBBQ",
    photo: null,
    backgroundId: "orb7",
  };
}

/** Which sales layout a doc renders. Read from the photo slot's role (image or
 *  placeholder frame, the partner trick — countdown and discount use distinct
 *  role names so their docs can never shape-match each other), falling back to
 *  the text roles for a doc whose photo layer was deleted by hand. */
export function salesLayoutOf(doc: SimpleDoc): "countdown" | "discount" | null {
  const of = (r: string) =>
    r === "sales-countdown.photo" ? "countdown" as const
    : r === "sales-discount.photo" ? "discount" as const
    : null;
  for (const i of doc.canvasImages) {
    const l = of(i.simpleRole ?? "");
    if (l) return l;
  }
  for (const s of doc.design.shapes ?? []) {
    const l = of(s.simpleRole ?? "");
    if (l) return l;
  }
  const roles = doc.design.texts.map((t) => t.simpleRole ?? "");
  if (!roles.some((r) => r.startsWith("sales."))) return null;
  // The CTA pill and the footer line only exist on the discount layout.
  return roles.includes("sales.cta") || roles.includes("sales.footer") ? "discount" : "countdown";
}

export function isSalesDoc(doc: SimpleDoc): boolean {
  return salesLayoutOf(doc) !== null;
}

/**
 * The Next Session people row, measured off the four reference boards Auri
 * hand-built in the editor on 2026-08-13 and exported at 1920×1080.
 *
 * **These are transcribed positions, not a formula, on Auri's explicit call.**
 * The references do not follow one rule — the speaker group's right edge lands
 * at 1826, 1786 and 1642 px across the 4-, 3- and 2-speaker boards, and the
 * gaps run 80, 85 and 142 — because the cards were dragged by hand. A formula
 * was offered and turned down, so the tables below reproduce each board and
 * `rightAlignedRow` covers only the counts the references do not show.
 *
 * The one thing NOT transcribed: on the 2-speaker board the moderator's card
 * sits 13px lower than the speakers'. Every other board has them level, so that
 * is drag noise rather than intent, and all three share `ROW_TOP` here.
 *
 * Everything is a fraction of the WIDTH (x, card width) or the HEIGHT (row
 * top). The card's height is derived from its width through the 0.9 aspect
 * rather than stored, so the card stays the same SHAPE on the square and story
 * canvases instead of stretching — the house rule for this file.
 */
/** Card width: 250px on the 1920-wide reference. */
const NEXT_CARD_W = 250 / 1920;
/** Shared top edge for the 2-, 3- and 4-speaker rows: 577px of 1080. */
const NEXT_ROW_TOP = 577 / 1080;
/** The moderator's left edge on those same rows: 97px of 1920. */
const NEXT_MOD_X = 97 / 1920;
/** The one-speaker board moves BOTH cards beside the title and lifts them.
 *  Moderator 1053px, speaker 1510px, top 540px. */
const SOLO_MOD_X = 1053 / 1920;
const SOLO_SPK_X = 1510 / 1920;
const SOLO_ROW_TOP = 540 / 1080;
/** Speaker left edges, indexed by speaker count, for a board WITH a moderator.
 *  Count 1 is handled by the solo constants above, so it is absent here. */
const NEXT_SPEAKER_X: Record<number, number[]> = {
  2: [1000 / 1920, 1392 / 1920],
  3: [866 / 1920, 1205 / 1920, 1536 / 1920],
  4: [585 / 1920, 919 / 1920, 1251 / 1920, 1576 / 1920],
};
/**
 * The fallback for counts the references do not cover — a moderator-less board,
 * or a moderator with no speakers at all. Right-aligned to the 4-speaker
 * board's right edge (1826px) with its 80px gap, which is the one rule the
 * references DO agree on: applied to four speakers it returns 586/916/1246/1576
 * against the measured 585/919/1251/1576.
 */
function rightAlignedRow(count: number): number[] {
  const GAP = 80 / 1920;
  const RIGHT = 1826 / 1920;
  return Array.from({ length: count }, (_, i) =>
    RIGHT - NEXT_CARD_W - (count - 1 - i) * (NEXT_CARD_W + GAP));
}

/** The fixed prefix on the Next Session banner. */
const NEXT_BANNER_PREFIX = "UP NEXT:";

/**
 * Compose the banner: `UP NEXT: <session> (<time>)`.
 *
 * The brackets live HERE, not in the input, so nobody has to remember the
 * format and no two boards end up punctuated differently. Either half may be
 * empty — an empty time renders no brackets, and an empty session renders just
 * the time — so a half-filled form never shows stray "()" on a venue screen.
 *
 * Paired with `parseNextBanner`, which has to invert this exactly. Change one
 * and change the other; the round-trip is tested.
 */
export function nextBannerText(session: string, time: string): string {
  const parts = [session.trim(), time.trim() ? `(${time.trim()})` : ""].filter(Boolean);
  return parts.length ? `${NEXT_BANNER_PREFIX} ${parts.join(" ")}` : NEXT_BANNER_PREFIX;
}

/**
 * Read a banner back into its two fields.
 *
 * Only a TRAILING bracket group is treated as the time, and the match is
 * anchored to the end, so a session called "Fireside (Bonfire Stage) 14:30"
 * does not lose its middle. The `UP ` is optional: boards saved before
 * 2026-08-13 carry the bare "NEXT:" prefix and must still load with their name
 * intact rather than keeping "NEXT:" inside the input.
 */
export function parseNextBanner(raw: string): { session: string; time: string } {
  const body = raw.replace(/^\s*(UP\s+)?NEXT:\s*/i, "").trim();
  const m = /^(.*?)\s*\(([^()]*)\)$/.exec(body);
  return m ? { session: m[1].trim(), time: m[2].trim() } : { session: body, time: "" };
}

/**
 * Placeholder job lines for speaker slots 3 and 4, which the default form does
 * not fill. An added slot used to arrive completely blank, so the board drew a
 * card captioned "Person" with nothing under it while its neighbours carried a
 * name and a role — it read as a rendering bug rather than an empty field.
 * A sample role makes the slot look like the others until it is typed over.
 *
 * The NAME is deliberately left empty: it falls back to "Person" on canvas,
 * which reads as "fill me in". A sample name would look like real content.
 */
const NEXT_SAMPLE_ROLES = [
  "Principal, Lightrock",
  "Partner, Secondaries, Molten",
  "General Partner, Kattegat Capital",
  "Founder & CEO, Northbound",
];

/** The person a newly added speaker slot starts as. */
export function nextSampleSpeaker(index: number): SimplePerson {
  return {
    name: "",
    title: NEXT_SAMPLE_ROLES[index] ?? NEXT_SAMPLE_ROLES[NEXT_SAMPLE_ROLES.length - 1],
    company: "",
    photo: "",
  };
}

/** Speakers the Next Session board can list. Four is the design's limit, not a
 *  storage one: they share ONE row with the moderator, and a fifth card cuts the
 *  others down to a size their captions no longer sit under. */
export const NEXT_MAX_SPEAKERS = 4;

/**
 * The "what's on next" holding board shown between sessions: a translucent
 * banner naming the upcoming session, a permanent ON STAGE chip, the session
 * title, then one row of headshots — the moderator on the left, up to four
 * speakers beside it. The people were a plain text list under "Speakers:" /
 * "Moderator:" headings until 2026-08-12; see `buildNextDesign` for what
 * replaced it and why.
 */
export interface NextForm {
  /** Named in the top banner, after the fixed "UP NEXT:" prefix. Just the
   *  session's NAME — the start time is its own field. */
  session: string;
  /** The start time, rendered in brackets after the session name. Typed bare
   *  ("14:30"); the brackets belong to the canvas, not the input, so nobody has
   *  to remember the format and no board ends up with mismatched punctuation.
   *  Empty renders no brackets at all. */
  time: string;
  /** The big headline — the session's own title. */
  title: string;
  /** The lighter line under the title — "Fireside with X (Role at Company)".
   *  Optional: an empty subtitle emits nothing and the row keeps its place. */
  subtitle: string;
  speakers: SimplePerson[];
  /** Whether this session has a moderator (drives the layout + form). */
  includeModerator: boolean;
  moderator: SimplePerson;
  /** Investor Relations circle accents, as on the panel form. */
  accentId?: string;
  backgroundId: string;
}

export function emptyNextForm(): NextForm {
  return {
    // Both defaults are placeholders that read as instructions. "XX:XX" stays
    // literal on purpose: an unedited board should look obviously unfinished
    // rather than quietly show a wrong start time on a screen at the venue.
    session: "Session",
    time: "XX:XX",
    // EMPTY on purpose, unlike the sample headshots. The subtitle belongs to
    // the fireside board; on a 3- or 4-speaker board it competes with the row
    // for vertical space and the header guard answers by shrinking the title
    // (120px → 82px on the default board). Auri's multi-speaker references
    // carry no subtitle, so shipping sample copy here would make every crowded
    // board wrong by default. The field is always visible in the sidebar, so
    // nothing is hidden by leaving it blank.
    subtitle: "",
    title: "Opening with Bjarke Ingels:\nUtopian Pragmatism",
    includeModerator: true,
    // Sample headshots, as the panel form does it — the board renders photos
    // since 2026-08-12, and an empty-frame preview says nothing about how it
    // actually looks. Files live in /public/samples.
    moderator: { name: "Pierre Leroy", title: "Managing Director & Co-Head of Secondaries, Stifel", company: "", photo: "/samples/pierre-leroy.jpg" },
    speakers: [
      { name: "Andrei Xydas", title: "Principal, Lightrock", company: "", photo: "/samples/andrei-xydas.jpg" },
      { name: "Nicholas Sando", title: "Partner, Secondaries, Molten", company: "", photo: "/samples/nicholas-sando.jpg" },
    ],
    // Midnight Sky — the background the board was designed against.
    backgroundId: "lm18",
  };
}

/** Next Session docs are recognisable by their `next.*` roles. The banner and
 *  the ON STAGE chip always render, so at least two of them always exist —
 *  including on a doc whose speakers were all cleared. */
export function isNextDoc(doc: SimpleDoc): boolean {
  const tagged = (r: string | undefined) => Boolean(r?.startsWith("next."));
  return doc.design.texts.some((t) => tagged(t.simpleRole))
    || (doc.design.shapes ?? []).some((s) => tagged(s.simpleRole));
}

/**
 * Which template a doc belongs to. The single source of truth for every
 * kind guard — a doc of the wrong kind for the active sidebar is a bug the
 * page heals (see `kindMismatch` in /simple), and the parked shelf is
 * partitioned by this too. Sales is checked first: it has no logo slots, so
 * the checks are disjoint, but the order documents the intent.
 */
export function docKindOf(doc: SimpleDoc): "panel" | "partner" | "sales" | "next" {
  if (isSalesDoc(doc)) return "sales";
  if (isPartnerDoc(doc)) return "partner";
  // Before the panel fallback: a Next Session doc carries panel-style
  // `speaker-N.*` roles too, so only its `next.*` tags tell the two apart.
  if (isNextDoc(doc)) return "next";
  return "panel";
}

/** Which composition the panel template renders.
 *
 *  - "discussion" · the house panel: headline, subtitle, label chip, then the
 *    moderator + speaker cards. Everything shipped before 2026-08-17.
 *  - "stage-host" · the stage card for one host: their photo in a
 *    white-outlined frame on the left, the stage name in the label chip on the
 *    right, then the host's name, job title and company. One person only, no
 *    headline and no subtitle.
 *
 *  Optional on the form so panels saved before it existed still deserialize —
 *  read it as `form.panelLayout ?? "discussion"`. */
export type PanelLayout = "discussion" | "stage-host";

/** How many hosts the stage-host card holds. Two is a composition, not a cap
 *  that happens to be low: one host is photo-beside-words, two are equal
 *  columns, and a third would need a third layout. */
export const STAGE_HOSTS_MAX = 2;

/** The stage-host layout's hosts, always at least one and never more than
 *  `STAGE_HOSTS_MAX` — forms saved before the layout existed have none. */
export function stageHostsOf(form: SimpleForm): SimplePerson[] {
  const held = (form.stageHosts ?? []).slice(0, STAGE_HOSTS_MAX);
  return held.length ? held : [emptyPerson()];
}

export interface SimpleForm {
  /** Eyebrow / session label — e.g. "Fireside Chat", the discussion topic.
   *  On the stage-host layout this is the STAGE NAME in the chip. */
  label: string;
  headline: string;
  subtitle: string;
  /** Which panel composition to build. Absent = "discussion". */
  panelLayout?: PanelLayout;
  /** The stage-host layout's hosts — one or two (`STAGE_HOSTS_MAX`). Their own
   *  people rather than `speakers`, because that array is folded by
   *  `mergePersonDescription` on every hydrate, which would swallow the
   *  separate company line this layout renders. Absent on forms saved before
   *  the layout existed — read it through `stageHostsOf`. */
  stageHosts?: SimplePerson[];
  /** Whether this panel has a moderator (drives the layout + form). */
  includeModerator: boolean;
  moderator: SimplePerson;
  speakers: SimplePerson[];
  /** Investor Relations circle accents (see ACCENT_REGISTRY), or undefined
   *  for none. Sits next to the background because it is the same kind of
   *  choice: a whole-canvas look, not a layer. */
  accentId?: string;
  backgroundId: string;
}

export function emptyForm(): SimpleForm {
  return {
    // Sample panel pre-filled so there's no retyping to preview/tweak. Photos
    // live in /public/samples. Clear or edit any field as needed.
    label: "Panel Discussion",
    headline: "Continuation Capital\n& Venture Secondaries:",
    subtitle: "Financing the Next Phase of European Growth",
    panelLayout: "discussion",
    // Sample host for the stage-host layout, same idea as the sample panel:
    // pressing the flavour shows a filled design, not four empty fields.
    stageHosts: [{ name: "Pierre Leroy", title: "Managing Director & Co-Head of Secondaries", company: "Stifel", photo: "/samples/pierre-leroy.jpg" }],
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
  if (form.layout === "thanks") return buildThanksDesign(form, format);
  seq = 0;
  const dims = FORMAT_DIMENSIONS[format] ?? FORMAT_DIMENSIONS.square;
  const W = dims.width;
  const H = dims.height;
  const S = Math.min(W, H);
  const vs = S / H;

  const texts: TextElement[] = [];
  // Accent circles first, so they sit at the BOTTOM of the shape stack.
  const shapes: ShapeElement[] = accentShapes(form.accentId, W, H, () => uid("shape"));
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
      // Spread rather than assigned, so a design with no accent is exactly
      // the doc the builders produced before accents existed.
      ...(form.accentId ? { accentId: form.accentId } : {}),
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
 * How many columns the thank-you wall flows `count` logos into, for a canvas of
 * the given aspect ratio (width / height).
 *
 * A square-ish grid reads best, so the starting point is √(count) stretched by
 * the canvas aspect — then capped, because a 9:16 story can't carry six logos
 * across. One trailing orphan is worse than a slightly wider grid ("5,5,1"
 * looks broken next to "4,4,3"), so a column count that leaves exactly one logo
 * on the last row steps down by one.
 */
/**
 * Average glyph width of the thank-you headline's font (Onest, weight 800,
 * sentence case), MEASURED with canvas `measureText` rather than guessed:
 * 0.486–0.532 per character across the real strings. Uppercase would be
 * 0.635–0.658 — worth knowing if the headline ever goes back to caps.
 */
export const THANKS_HEADLINE_GLYPH = 0.54;

/** The headline never grows past this fraction of the shorter side, so a
 *  two-word headline can't fill the canvas. Every wall whose lines fit inside
 *  the cap's width therefore renders at exactly the same size.
 *
 *  0.08 of the shorter side = **120px at 1:1** (1500×1500), which is the size
 *  Auri asked for on 2026-08-10, down from 0.108 / 162px. Kept as a FRACTION so
 *  16:9 and 9:16 scale with the canvas instead of rendering a 120px headline on
 *  a 1080px-tall story, where it would read twice as large. */
export const THANKS_HEADLINE_CAP = 0.08;

/**
 * How many logos each row of a tier carries.
 *
 * `cols` per row, except that **a single logo stranded on the last row is
 * squeezed into the row above** (Auri: "if there is only one logo left on the
 * different line, we should try to squeeze it in the one previous line") — 13
 * logos six across flow 6, 7 rather than 6, 6, 1. The squeezed row's cells are
 * narrowed to fit the same margins; every other row keeps the tier's cell width.
 *
 * A lone logo is only ever moved UP, never down: a row of `cols + 1` is a small
 * compromise, a row of one reads as a mistake.
 */
export function thanksRowCounts(count: number, cols: number): number[] {
  const rows: number[] = [];
  for (let k = 0; k < count; k += cols) rows.push(Math.min(cols, count - k));
  if (rows.length > 1 && rows[rows.length - 1] === 1) {
    rows.pop();
    rows[rows.length - 1] += 1;
  }
  return rows;
}

/** Greedy word wrap to a character budget. Words longer than the budget get
 *  their own line rather than being broken mid-word. */
function wrapWords(text: string, maxChars: number): string[] {
  const out: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const trial = line ? `${line} ${word}` : word;
    if (trial.length > maxChars && line) { out.push(line); line = word; }
    else line = trial;
  }
  if (line) out.push(line);
  return out.length ? out : [text];
}

/** Most logos a wall puts across, per canvas shape. Six on anything square or
 *  wider (Auri: "for smaller logos it should be 6 in one row"); a 9:16 story
 *  cannot carry more than three. */
export function thanksMaxColumns(aspect: number): number {
  return aspect >= 0.9 ? 6 : 3;
}

/**
 * The cap for a FLAT wall — one with no lead tier. 5 across rather than 6, so
 * each logo gets a 20% wider cell (2026-08-10: "make only five in one row
 * because we have a little bit more space"). A 30-logo wall becomes 5×6.
 *
 * Deliberately NOT applied to the two-tier investor wall: its support tier runs
 * 6 across on an explicit earlier instruction, and the tier being wider than
 * the lead tier is the entire mechanism that makes main partners look bigger.
 * Narrowing it to 5 would flatten that hierarchy.
 *
 * The Life Science wall is unaffected — 25 logos already scored 5 columns.
 *
 * ABOVE 30 the 5-column rule inverts and starts hurting: 43 logos at 5 across
 * is NINE rows, and on a 16:9 canvas nine rows of cells forces each one down to
 * roughly half the height a 30-wall gets. A big wall has to grow sideways
 * instead — cell height follows cell WIDTH (`CELL_ASPECT`), so a wider grid
 * loses far less size than the extra rows would have cost.
 *
 * But a FIXED wide cap overshoots in the other direction. At 8 columns a
 * 31-logo wall is only four rows, the block stops two thirds of the way down a
 * 1080-tall canvas, and the logos come out smaller than a 30-wall's despite
 * there being fewer of them — measured, not guessed: the first export of the
 * exhibiting wall left an empty bottom third.
 *
 * So aim for a ROW COUNT instead and let the columns follow. Six rows is what
 * fills a 16:9 canvas below the headline at this cell aspect, so the width is
 * whatever it takes to land the wall in six rows, clamped to the 5-column floor
 * the flat rule sets and an 8-column ceiling past which a wordmark stops
 * reading at 1920 wide:
 *
 *   31 logos → 6 across → 6,6,6,6,7   (five rows, the tallest cells available)
 *   43 logos → 8 across → 8,8,8,8,8,3 (six rows)
 *   48 logos → 8 across → six full rows, the cap
 *
 * Story stays narrow — 4 across on 9:16 — since a phone-shaped canvas has the
 * vertical room and not the horizontal.
 *
 * `count` is optional so the existing callers and their tests keep the old
 * behaviour; only a wall that declares its size can opt into the wide grid.
 */
const THANKS_BIG_WALL_ROWS = 6;
export function thanksFlatMaxColumns(aspect: number, count = 0): number {
  if (count > 30) {
    if (aspect < 0.9) return 4;
    return Math.min(8, Math.max(5, Math.ceil(count / THANKS_BIG_WALL_ROWS)));
  }
  return Math.min(5, thanksMaxColumns(aspect));
}

export function thanksGridColumns(count: number, aspect: number, minCols = 1, maxCols = thanksMaxColumns(aspect)): number {
  const ideal = Math.round(Math.sqrt(Math.max(1, count) * aspect * 1.15));
  // `minCols` is a floor the caller needs for a reason the score cannot see —
  // the support tier of a two-tier wall MUST be wider than the lead tier, or
  // the support logos come out bigger than the main partners.
  const hi = Math.max(1, Math.min(count, maxCols));
  const lo = Math.max(1, Math.min(minCols, hi));
  // Score every allowed column count: distance from the ideal, plus a penalty
  // for leaving a single logo alone on the last row. 1.5 makes the penalty
  // worth a one-column detour but not a two-column one — so "5,5,1" becomes
  // "4,4,3", while a 9:16 story capped at 3 columns keeps its 3 rather than
  // dropping to 2 and growing four rows taller.
  let best = lo;
  let bestScore = Infinity;
  for (let cols = lo; cols <= hi; cols++) {
    const score = Math.abs(cols - ideal) + (count % cols === 1 && count > cols ? 1.5 : 0);
    if (score < bestScore) { bestScore = score; best = cols; }
  }
  return best;
}

/**
 * Build the "Thank you to our partners" wall: one big centred headline over an
 * auto-flowed grid of contain-fit logos, last row centred. Same doc shape as
 * every other partner layout — slot roles are `logo-thanks-N`, so parking,
 * retargeting and the editor round-trip work unchanged.
 *
 * The TechBBQ logo is OFF here: the grid uses the full canvas below the
 * headline, and the 2025 originals this follows carry no lockup. Turn it back
 * on in the editor if a particular post needs one.
 */
function buildThanksDesign(form: PartnerForm, format: PlatformFormat): SimpleDoc {
  seq = 0;
  const dims = FORMAT_DIMENSIONS[format] ?? FORMAT_DIMENSIONS.square;
  const W = dims.width;
  const H = dims.height;
  const S = Math.min(W, H);
  const vs = S / H;

  const texts: TextElement[] = [];
  // Accent circles first, so they sit at the BOTTOM of the shape stack.
  const shapes: ShapeElement[] = accentShapes(form.accentId, W, H, () => uid("shape"));
  const canvasImages: CanvasImage[] = [];
  const scrim = Math.min(THANKS_SCRIM_MAX, Math.max(0, form.scrim ?? 0));

  // ── Headline, centred at the top. ──
  let gridTop = 0.12; // top of the logo block when there is no headline
  const headline = form.headline.trim();
  if (headline) {
    // 0.82, not the 0.88 the margin allows: a headline that only just clears the
    // margin reads as touching the wall.
    const avail = 0.82;
    // MEASURED with the real font (Onest, weight 800, canvas measureText):
    // sentence case averages 0.486–0.532 per character, uppercase 0.635–0.658.
    // The headline renders as typed now, so 0.54 is the sizing constant.
    const glyph = THANKS_HEADLINE_GLYPH;
    // A LONG headline used to come out much smaller than a short one — "our
    // investor partners" at 108px against "our partners" at the 162px cap —
    // because both were fitted to their longest line and only the short one
    // reached the cap. Wrapping to the width the CAP allows fixes that: the
    // long headline becomes three lines at full size instead of two small ones,
    // so every wall's headline is the same size. The user's own Enter presses
    // still win; this only decides where an unbroken headline breaks.
    const maxChars = Math.max(6, Math.floor((avail * W) / (THANKS_HEADLINE_CAP * S * glyph)));
    const lines = headline.includes("\n") ? headline.split("\n") : wrapWords(headline, maxChars);
    const content = lines.join("\n");
    const longest = Math.max(1, ...lines.map((l) => l.trim().length));
    const fFrac = Math.min(THANKS_HEADLINE_CAP, (avail * W) / (longest * glyph) / S);
    const lineH = 0.98;
    const blockH = lines.length * fFrac * vs * lineH;
    texts.push({
      id: uid("text"), content,
      position: { x: 0.5, y: 0.11 + blockH / 2 },
      fontSize: Math.round(fFrac * S), align: "center",
      // Semi-bold, not the 800 the wall used to carry (2026-08-10).
      weight: 600, font: "onest",
      color: "#FFFFFF", lineHeight: lineH,
      simpleRole: "thanks.headline",
    });
    gridTop = 0.11 + blockH + 0.07;
  }

  // ── Logo grid, block-centred in what is left below the headline ──
  // A tiered wall is capped higher than a flat one: its whole point is that the
  // complete list fits one image, and it has already accepted small bottom tiers.
  const tiered = (form.tiers ?? []).filter((t) => t.count > 0);
  const cap = tiered.length ? THANKS_TIERED_MAX_LOGOS : THANKS_MAX_LOGOS;
  const count = Math.min(cap, Math.max(THANKS_MIN_LOGOS, Math.round(form.logoCount || THANKS_MIN_LOGOS)));
  // The lead tier: the first `featuredCount` logos, rendered bigger. Main
  // partners over support partners, the shape the investor wall needs.
  const lead = tiered.length ? Math.min(count, tiered[0].count) : Math.min(count, Math.max(0, Math.round(form.featuredCount || 0)));
  const rest = count - lead;

  const gapX = 0.045 * S;
  const usableW = W * (1 - 2 * MARGIN);
  const widthOf = (cols: number) => (usableW - (cols - 1) * gapX) / cols;
  // Each tier gets its OWN column count, and that alone makes the lead cells
  // bigger — 4 across instead of 6 is a 1.5× wider cell, so no size multiplier
  // is needed and the two tiers still share one margin. The lead tier is a
  // single row whenever it fits across; the rest flows normally.
  const maxCols = thanksMaxColumns(W / H);
  let leadCols = lead ? Math.max(1, Math.min(lead, maxCols - 1)) : 0;
  // The support tier FILLS the row — six across on square or wider. That is an
  // explicit instruction ("for smaller logos it should be 6 in one row") and it
  // overrides the orphan-avoiding score the flat wall uses: 13 support logos
  // flow 6, 6, 1 rather than 5, 5, 3.
  //
  // The `leadCols + 1` floor stays. Cell size comes from the column count, so
  // the support tier being WIDER than the lead tier is the whole mechanism
  // behind "the main partners are bigger".
  // A wall with no lead tier has no "smaller" logos, so it keeps the balanced
  // auto rule — the 25-logo Life Science wall stays a clean 5×5 rather than
  // 6,6,6,6,1.
  const restCols = rest
    ? (lead
        ? Math.min(rest, Math.max(leadCols + 1, maxCols))
        // Flat wall: capped at 5 so each logo gets a wider cell.
        : thanksGridColumns(rest, W / H, 1, thanksFlatMaxColumns(W / H, rest)))
    : 0;
  // Too few support logos to be wider? Narrow the LEAD tier instead, so the
  // hierarchy still reads (4 main partners stacked over 2 support ones).
  if (lead && rest && restCols <= leadCols) leadCols = Math.max(1, restCols - 1);
  // How many cells each row carries — NOT simply `cols` per row, because a
  // single logo stranded on the last row gets squeezed into the row above it.
  const leadCounts = leadCols ? thanksRowCounts(lead, leadCols) : [];
  const restCounts = restCols ? thanksRowCounts(rest, restCols) : [];

  /**
   * The wall as a list of BANDS to stack: `{ from, counts, cols }`.
   *
   * A flat or lead/rest wall is the two-band case and keeps the numbers computed
   * above verbatim — that is deliberate, so every wall that shipped before tiers
   * existed is byte-identical afterwards. A tiered wall replaces them with one
   * band per tier, in tier order, each sized by its own column count: more
   * columns, smaller cells, which is the same mechanism the lead/rest split
   * already used to make main partners bigger.
   */
  const bands: { from: number; counts: number[]; cols: number }[] = [];
  if (tiered.length) {
    // Cells are wide, so a band of n logos wants roughly sqrt(3n) columns —
    // 5 logos across 4, 24 across 9, 99 across 18. Clamped to 2x the flat
    // maximum, past which a cell is narrower than a wordmark can survive.
    //
    // The column count does two separate jobs, and they part ways when a band
    // holds fewer logos than its grid is wide: `cols` sets the CELL SIZE, so it
    // keeps whatever the roster asked for, while the ROW fill is clamped to the
    // logos actually there. Prime at 6 asks for 5 columns and Main at 4 inherits
    // that 5 to stay the same size — clamping its size to 4 columns would draw
    // the lower tier's logos bigger than the higher one's. Main simply lays out
    // as one short, centred row of 4.
    const hardMax = thanksMaxColumns(W / H) * 2;
    let at = 0;
    for (const band of tiered) {
      const n = Math.min(band.count, Math.max(0, count - at));
      if (n <= 0) break;
      const auto = Math.ceil(Math.sqrt(n * 3));
      const cols = Math.max(1, Math.min(hardMax, Math.round(band.cols ?? auto)));
      bands.push({ from: at, counts: thanksRowCounts(n, Math.min(n, cols)), cols });
      at += n;
    }
    // Anything past the last band (a logo count raised without re-tiering) joins
    // the final band rather than vanishing.
    if (at < count && bands.length) {
      const last = bands[bands.length - 1];
      last.counts = thanksRowCounts(count - last.from, last.cols);
    }
  } else {
    if (lead) bands.push({ from: 0, counts: leadCounts, cols: leadCols });
    if (rest) bands.push({ from: lead, counts: restCounts, cols: restCols });
  }

  // Cells are wider than tall — a logo is a wordmark far more often than a
  // square mark.
  const CELL_ASPECT = 0.45;
  const roomH = H * (1 - MARGIN - gridTop);
  // Row gaps live INSIDE a band; the step between bands is `tierGap`, counted
  // once per boundary.
  const gapSlots = bands.reduce((n, b) => n + Math.max(0, b.counts.length - 1), 0);
  const cellH = bands.map((b) => widthOf(b.cols) * CELL_ASPECT);
  let gapYMin = 0.055 * S;
  // A visible step between the tiers, so the size difference reads as two
  // groups rather than an accident.
  let tierGap = bands.length > 1 ? 0.085 * S : 0;

  // Too tall for the canvas? Scale cells AND gaps by one factor, so the block
  // lands exactly on the room and the ratio between the tiers survives
  // (shrinking the cells alone overflowed the bottom margin, and shrinking one
  // tier alone would flatten the hierarchy).
  const bandsH = () => bands.reduce((h, b, i) => h + b.counts.length * cellH[i], 0);
  const boundaries = Math.max(0, bands.length - 1);
  const natural = bandsH() + boundaries * tierGap + gapSlots * gapYMin;
  if (natural > roomH) {
    const shrink = roomH / natural;
    for (let i = 0; i < cellH.length; i++) cellH[i] *= shrink;
    gapYMin *= shrink;
    tierGap *= shrink;
  }

  // Leftover height goes into the row gaps rather than leaving the whole block
  // floating in the middle of a tall canvas — capped, so a 3-logo wall on a
  // 9:16 story spreads without the rows drifting apart.
  const fixedH = bandsH() + boundaries * tierGap;
  const smallestCell = bands.length ? Math.min(...cellH) : Infinity;
  const gapY = gapSlots
    ? Math.min(smallestCell * 0.85, Math.max(gapYMin, (roomH - fixedH) / gapSlots))
    : 0;
  // Where the block sits in the room left over below the headline. 0.5 centres
  // it, which is what the wall did until 2026-08-10 — and on a full 30-logo
  // square that left a visible dead band under the headline while the bottom
  // margin stayed tight. 0.34 pushes the grid up into that band without letting
  // a SHORT wall (3 or 4 logos) ride up against the headline, which anchoring
  // to the top outright would do.
  const blockTop = H * gridTop + (roomH - (fixedH + gapSlots * gapY)) * THANKS_GRID_BIAS;

  const emitCell = (i: number, cx: number, cy: number, w: number, h: number, role: string): void => {
    const logo = form.logos[i];
    if (logo?.src) {
      canvasImages.push({
        id: uid("img"), src: logo.src, x: cx, y: cy,
        width: w, height: h,
        cornerRadius: 0, border: false, fit: "contain",
        naturalWidth: logo.naturalWidth, naturalHeight: logo.naturalHeight,
        simpleRole: role,
      });
    } else {
      shapes.push({
        id: uid("shape"), type: "rectangle", x: cx, y: cy,
        width: w, height: h,
        fillType: "outline", strokeWidth: 2 / 1500, colorType: "gradient",
        color1: "#FF6B00", color2: "#FF0028", opacity: 1, blur: 0, rotation: 0,
        borderRadius: 0.08,
        simpleRole: role,
      });
    }
  };

  // One tier, row by row from `counts`. Every row is centred on its own width,
  // so a last row that doesn't divide evenly still looks deliberate. A row that
  // carries MORE than the tier's column count — the squeezed-in orphan — has its
  // cells narrowed to stay inside the margins; the row height never changes, so
  // the size difference is limited to width.
  const emitTier = (from: number, counts: number[], cw: number, ch: number, top: number): void => {
    let i = from;
    counts.forEach((inRow, row) => {
      const rowCw = Math.min(cw, (usableW - (inRow - 1) * gapX) / inRow);
      const rowW = inRow * rowCw + (inRow - 1) * gapX;
      const cy = (top + row * (ch + gapY) + ch / 2) / H;
      for (let col = 0; col < inRow; col++, i++) {
        const cx = ((W - rowW) / 2 + col * (rowCw + gapX) + rowCw / 2) / W;
        emitCell(i, cx, cy, rowCw / W, ch / H, thanksSlotRole(i, i < lead));
      }
    });
  };

  let bandTop = blockTop;
  bands.forEach((b, i) => {
    emitTier(b.from, b.counts, widthOf(b.cols), cellH[i], bandTop);
    bandTop += b.counts.length * cellH[i] + Math.max(0, b.counts.length - 1) * gapY + tierGap;
  });

  return {
    format,
    customSize: { width: W, height: H },
    design: {
      backgroundId: form.backgroundId || "orb7",
      // Spread rather than assigned, so a design with no accent is exactly
      // the doc the builders produced before accents existed.
      ...(form.accentId ? { accentId: form.accentId } : {}),
      // Same reasoning for the scrim: at 0 the doc carries no overlay keys at
      // all, so an untouched wall is byte-identical to one built before the
      // slider existed. `multiply` with black is a straight darkening — it is
      // the blend the overlay layer already defaults to.
      ...(scrim > 0 ? { overlayColor: "#000000", overlayOpacity: scrim, overlayBlend: "multiply" } : {}),
      texts,
      shapes,
      showLogo: false,
      logoStyle: "white",
      logoPosition: "bottom-center",
    },
    canvasImages,
  };
}

/**
 * Build a Sales Announcement visual — the ticket-deadline and discount posts.
 *
 * Both layouts are left-aligned down the same margin as the panel builder,
 * with one framed photo and an optional diagonal ribbon across the top-right
 * corner. Sizes derive from the SHORTER side `S`, so a figure reads the same
 * across 1:1, 16:9 and 9:16.
 *
 *   countdown → figure + caption stacked top-left, wide photo band at the bottom
 *   discount  → headline, figure, white CTA pill, footer line, portrait photo right
 */
export function buildSalesDesign(form: SalesForm, format: PlatformFormat): SimpleDoc {
  seq = 0;
  const dims = FORMAT_DIMENSIONS[format] ?? FORMAT_DIMENSIONS.square;
  const W = dims.width;
  const H = dims.height;
  const S = Math.min(W, H);
  const vs = S / H; // one line of a font-fraction, expressed in H-fractions

  const texts: TextElement[] = [];
  // Accent circles first, so they sit at the BOTTOM of the shape stack.
  const shapes: ShapeElement[] = accentShapes(form.accentId, W, H, () => uid("shape"));
  const canvasImages: CanvasImage[] = [];

  const lineCount = (s: string) => (s.trim() ? s.split("\n").length : 0);
  // Left-aligned text (x = left edge, y = vertical centre of the block).
  const mkText = (content: string, x: number, y: number, sizeFrac: number, opts: Partial<TextElement> = {}): void => {
    if (!content.trim()) return;
    texts.push({
      id: uid("text"), content, position: { x, y },
      fontSize: Math.round(sizeFrac * S), align: "left",
      weight: 600, font: "onest", color: "#FFFFFF",
      ...opts,
    });
  };
  // Shrink a font until its longest line fits `maxWfrac` of the canvas width.
  const fitFont = (text: string, baseFrac: number, maxWfrac: number, avgChar = 0.56): number => {
    const longest = Math.max(1, ...text.split("\n").map((l) => l.trim().length));
    return Math.min(baseFrac * S, (maxWfrac * W) / (longest * avgChar)) / S;
  };

  // ── Diagonal corner ribbon, top-right ─────────────────────────────────────
  // Geometry is computed in PIXELS: the band is rotated 45° in pixel space, so
  // the cut must be measured there too, else it would skew on 16:9 / 9:16.
  // The band always overshoots both canvas edges, and grows with a long
  // ribbon text so the words never run off the white.
  if (form.ribbon.trim()) {
    const ribbonText = form.ribbon.trim().toUpperCase();
    const ls = Math.round(0.0006 * S);
    const cut = 0.3 * S;        // distance from the corner where the band crosses each edge
    const bandHpx = 0.078 * S;
    // Only the stretch between the two canvas edges is actually visible — the
    // rest of the band hangs off-canvas. The font shrinks to fit that chord, so
    // a long ribbon reads in full instead of running off the corner.
    const visiblePx = cut * Math.SQRT2 - 0.03 * S;
    const fsPx = Math.max(0.012 * S, Math.min(0.03 * S, (visiblePx - Math.max(0, ribbonText.length - 1) * ls) / (ribbonText.length * 0.62)));
    const textWpx = ribbonText.length * fsPx * 0.62 + Math.max(0, ribbonText.length - 1) * ls;
    const lenPx = Math.max(cut * Math.SQRT2 + 0.34 * S, textWpx + 0.1 * S);
    const cx = (W - cut / 2) / W;
    const cy = (cut / 2) / H;
    shapes.push({
      id: uid("shape"), type: "rectangle", x: cx, y: cy,
      width: lenPx / W, height: bandHpx / H,
      fillType: "fill", strokeWidth: 0, colorType: "solid",
      color1: "#FFFFFF", color2: "#FF6B00", opacity: 1, blur: 0, rotation: 45,
      borderRadius: 0,
      simpleRole: "ribbon.band",
    });
    texts.push({
      id: uid("text"), content: ribbonText,
      position: { x: cx, y: cy },
      fontSize: Math.round(fsPx), align: "center",
      weight: 800, uppercase: true, font: "onest",
      color: "#15110E", letterSpacing: ls, rotation: 45,
      simpleRole: "sales.ribbon",
    });
  }

  // The ribbon eats the top-right corner, so text near the top has to stop
  // short of it — without this the discount headline ran under the white band.
  const ribbonGuard = form.ribbon.trim() ? (0.18 * S) / W : 0;

  // ── The photo — an image when uploaded, otherwise the same gradient-outlined
  // frame every other template uses for an empty slot. Both carry the
  // LAYOUT-SPECIFIC role, which is what `salesLayoutOf` reads. ──
  const photoRole = `sales-${form.layout}.photo`;
  const emitPhoto = (cx: number, cy: number, w: number, h: number, radius: number): void => {
    if (form.photo?.src) {
      canvasImages.push({
        id: uid("img"), src: form.photo.src, x: cx, y: cy, width: w, height: h,
        cornerRadius: radius, border: true, borderWidth: 3 / 1500, fit: "cover",
        naturalWidth: form.photo.naturalWidth, naturalHeight: form.photo.naturalHeight,
        simpleRole: photoRole,
      });
    } else {
      shapes.push({
        id: uid("shape"), type: "rectangle", x: cx, y: cy, width: w, height: h,
        fillType: "outline", strokeWidth: 2 / 1500, colorType: "gradient",
        color1: "#FF6B00", color2: "#FF0028", opacity: 1, blur: 0, rotation: 0,
        borderRadius: radius / 100,
        simpleRole: photoRole,
      });
    }
  };

  if (form.layout === "countdown") {
    // ── Countdown: the figure and its caption fill the upper two thirds, the
    // photo runs edge-to-edge along the bottom. ──
    const photoH = (0.26 * S) / H;
    const photoBottom = 0.94;
    const photoW = 0.94 - MARGIN;
    emitPhoto(MARGIN + photoW / 2, photoBottom - photoH / 2, photoW, photoH, 6);

    const textTop = 0.04;
    const textBottom = photoBottom - photoH - 0.03;
    const maxW = 0.94 - MARGIN - ribbonGuard;
    let valueF = fitFont(form.value, 0.42, maxW, 0.68);
    let captionF = fitFont(form.caption, 0.25, maxW);
    // The two blocks are set tight (the reference has the caption almost
    // touching the digits), then scaled down together if they'd reach the photo.
    const gap = -0.035 * vs;
    const blockH = () => lineCount(form.value) * valueF * vs + (form.caption.trim() ? gap + lineCount(form.caption) * captionF * vs : 0);
    const room = textBottom - textTop;
    if (blockH() > room) {
      const k = room / blockH();
      valueF *= k;
      captionF *= k;
    }
    let y = textTop;
    if (form.value.trim()) {
      const h = lineCount(form.value) * valueF * vs;
      mkText(form.value, MARGIN, y + h / 2, valueF, { weight: 500, simpleRole: "sales.value" });
      y += h + gap;
    }
    if (form.caption.trim()) {
      const h = lineCount(form.caption) * captionF * vs;
      mkText(form.caption, MARGIN, y + h / 2, captionF, { weight: 500, simpleRole: "sales.caption" });
    }
  } else {
    // ── Discount: portrait photo card bottom-right, text column down the left. ──
    const photoW = (0.27 * S) / W;
    const photoH = (0.56 * S) / H;
    const photoRight = 0.94;
    const photoBottom = 0.94;
    emitPhoto(photoRight - photoW / 2, photoBottom - photoH / 2, photoW, photoH, 10);

    // The text column clears the photo card; the headline may run wider
    // because it sits above the card's top edge.
    const colW = photoRight - photoW - 0.04 - MARGIN;
    const headW = 0.94 - MARGIN - ribbonGuard;

    let y = 0.1;
    if (form.headline.trim()) {
      const f = fitFont(form.headline, 0.082, headW);
      const h = lineCount(form.headline) * f * vs;
      mkText(form.headline, MARGIN, y + h / 2, f, { weight: 600, simpleRole: "sales.headline" });
      y += h;
    }

    // Figure: centred in the room between the headline and the CTA pill.
    const ctaText = form.cta.trim().toUpperCase();
    const pillH = ctaText ? (0.088 * S) / H : 0;
    const footerF = form.footer.trim() ? 0.026 : 0;
    const footerH = footerF ? footerF * vs : 0;
    const bottomBlock = (ctaText ? pillH + 0.03 : 0) + (footerH ? footerH + 0.03 : 0);
    const figureBottom = photoBottom - bottomBlock;
    let valueF = fitFont(form.value, 0.34, colW, 0.68);
    const captionF = fitFont(form.caption, 0.05, colW);
    const captionH = form.caption.trim() ? lineCount(form.caption) * captionF * vs + 0.012 : 0;
    const figureRoom = figureBottom - y - 0.02;
    if (lineCount(form.value) * valueF * vs + captionH > figureRoom) {
      valueF = Math.max(0.08, (figureRoom - captionH) / (lineCount(form.value) * vs));
    }
    const valueH = form.value.trim() ? lineCount(form.value) * valueF * vs : 0;
    // Centred in the room between the headline and the CTA. Bottom-anchoring it
    // left a tall void in the middle of the 9:16 story format.
    let fy = figureBottom - figureRoom + Math.max(0, (figureRoom - valueH - captionH) / 2);
    if (form.value.trim()) {
      mkText(form.value, MARGIN, fy + valueH / 2, valueF, { weight: 500, simpleRole: "sales.value" });
      fy += valueH;
    }
    if (form.caption.trim()) {
      const h = lineCount(form.caption) * captionF * vs;
      mkText(form.caption, MARGIN, fy + 0.012 + h / 2, captionF, { weight: 500, color: "rgba(255,255,255,0.95)", simpleRole: "sales.caption" });
    }

    // ── CTA pill: white rounded pill, brand-red uppercase text. ──
    if (ctaText) {
      const ls = Math.round(0.0012 * S);
      const padX = 0.055 * S;
      // The pill can't grow past the text column, so a long CTA shrinks its
      // font instead of overflowing the white ("BOOK YOUR TICKET BEFORE…").
      const roomPx = colW * W - padX * 2 - Math.max(0, ctaText.length - 1) * ls;
      const fsFrac = Math.max(0.014, Math.min(0.032, roomPx / (ctaText.length * 0.62) / S));
      const fsPx = fsFrac * S;
      const textWpx = ctaText.length * fsPx * 0.62 + Math.max(0, ctaText.length - 1) * ls;
      const pillW = Math.min((textWpx + padX * 2) / W, colW);
      const pillY = photoBottom - (footerH ? footerH + 0.03 : 0) - pillH / 2;
      shapes.push({
        id: uid("shape"), type: "rectangle",
        x: MARGIN + pillW / 2, y: pillY, width: pillW, height: pillH,
        fillType: "fill", strokeWidth: 0, colorType: "solid",
        color1: "#FFFFFF", color2: "#FF6B00", opacity: 1, blur: 0, rotation: 0,
        borderRadius: 0.5, // a pill, unlike the panel/partner label chip
        simpleRole: "cta.pill",
      });
      // Caps sit high in their line box — nudge down to optically centre them.
      mkText(ctaText, MARGIN + padX / W, pillY + fsFrac * vs * 0.11, fsFrac, {
        weight: 800, uppercase: true, color: "#C4161C", letterSpacing: ls,
        simpleRole: "sales.cta",
      });
    }

    if (form.footer.trim()) {
      mkText(form.footer, MARGIN, photoBottom - footerH / 2, footerF, {
        weight: 600, uppercase: true, color: "rgba(255,255,255,0.92)",
        letterSpacing: Math.round(0.0008 * S), simpleRole: "sales.footer",
      });
    }
  }

  const design: DesignConfig = {
    backgroundId: form.backgroundId || "orb7",
      // Spread rather than assigned, so a design with no accent is exactly
      // the doc the builders produced before accents existed.
      ...(form.accentId ? { accentId: form.accentId } : {}),
    texts,
    shapes,
    // The ribbon already brands the corner — a second logo in it would collide,
    // so the TechBBQ mark only shows when the ribbon is off.
    showLogo: !form.ribbon.trim(),
    logoStyle: "white",
    logoPosition: "top-right",
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
/**
 * Build the Next Session board — the between-sessions holding slide.
 *
 * The composition is a top-down flow down the left edge, matching the design
 * Auri built by hand in the editor (measured off that doc at 1920×1080):
 *
 *   1. a full-bleed translucent banner, "NEXT: <session>" inside it
 *   2. the ON STAGE chip — ALWAYS rendered, it is the board's constant
 *   3. the session title, auto-fitted
 *   4. "Speakers:" then up to four people, each a name plus a role line
 *   5. "Moderator:" then one person, same shape
 *
 * Sizes are fractions of the SHORTER side and vertical spans are converted
 * through `vs`, so the 16:9 original is reproduced exactly while 1:1 and 9:16
 * stay proportional rather than stretched. The people block is measured before
 * it is drawn and scaled down if four speakers plus a moderator would otherwise
 * run into the TechBBQ logo — the board must never overflow, whatever it holds.
 */
export function buildNextDesign(form: NextForm, format: PlatformFormat): SimpleDoc {
  seq = 0;
  const dims = FORMAT_DIMENSIONS[format] ?? FORMAT_DIMENSIONS.square;
  const W = dims.width;
  const H = dims.height;
  const S = Math.min(W, H);
  const vs = S / H;

  const texts: TextElement[] = [];
  const shapes: ShapeElement[] = accentShapes(form.accentId, W, H, () => uid("shape"));
  const canvasImages: CanvasImage[] = [];

  /** Left margin. Measured off the hand-built design (0.0418), not the 0.06
   *  the panel builder uses — this board sits tighter to the edge. */
  const M = 0.042;

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

  const lineCount = (s: string) => (s.trim() ? s.split("\n").length : 0);

  // ── 1. Banner ───────────────────────────────────────────────────────────
  // Full-bleed white wash at 59% — light enough that the gradient still reads
  // through it, opaque enough for near-black text to pass contrast.
  const bannerFs = 0.0278;
  const bannerH = bannerFs * vs * 2.66;
  shapes.push({
    id: uid("shape"), type: "rectangle",
    x: 0.5, y: bannerH / 2, width: 1, height: bannerH,
    fillType: "fill", strokeWidth: 0, colorType: "solid",
    color1: "#FFFFFF", color2: "#FF6B00", opacity: 0.59, blur: 0, rotation: 0,
    borderRadius: 0,
    simpleRole: "next.banner",
  });
  mkText(nextBannerText(form.session, form.time), M, bannerH / 2 + bannerFs * vs * 0.1, bannerFs, {
    weight: 800, uppercase: true, color: "#15110E",
    letterSpacing: Math.max(1, Math.round(0.0009 * S)),
    simpleRole: "next.session",
  });

  // ── 2. ON STAGE chip — the constant. Never conditional on form content. ──
  const STAGE = "ON STAGE";
  const stageFs = 0.0361;
  const stageFsPx = stageFs * S;
  const stageLs = Math.max(1, Math.round(0.0009 * S));
  const chipH = stageFs * vs * 1.63;
  const chipPadL = 0.021 * S;
  const chipPadR = 0.024 * S;
  const stageWpx = STAGE.length * stageFsPx * 0.66 + (STAGE.length - 1) * stageLs;
  const chipW = Math.min((stageWpx + chipPadL + chipPadR) / W, 0.9);
  const chipY = bannerH + chipH / 2 + 0.059;
  shapes.push({
    id: uid("shape"), type: "rectangle",
    x: M + chipW / 2, y: chipY, width: chipW, height: chipH,
    fillType: "fill", strokeWidth: 0, colorType: "solid",
    color1: "#FFFFFF", color2: "#FF6B00", opacity: 1, blur: 0, rotation: 0,
    borderRadius: 0.165,
    simpleRole: "next.stage.chip",
  });
  mkText(STAGE, M + chipPadL / W, chipY + stageFs * vs * 0.11, stageFs, {
    weight: 800, uppercase: true, color: "#15110E", letterSpacing: stageLs,
    simpleRole: "next.stage",
  });

  // ── 3. Title + subtitle ─────────────────────────────────────────────────
  // Auto-fit against the longest manually-broken line so a long title shrinks
  // instead of running off the canvas.
  //
  // The ONE-speaker board is the exception: its cards sit beside the title
  // rather than under it (see the layout table below), so the title has to be
  // told it only owns the left half. Given the full width it would run clean
  // under the moderator's card.
  const speakerCount = Math.min(form.speakers.length, NEXT_MAX_SPEAKERS);
  // The solo BOARD is one speaker plus a moderator. Turn the moderator off and
  // the lone speaker drops to the ordinary bottom row, where it is out of the
  // title's way — so the narrow measure would only shrink the title for nothing.
  const solo = speakerCount === 1 && form.includeModerator;
  const avail = (solo ? SOLO_MOD_X - 0.02 : 0.94) - M;
  const titleTop = chipY + chipH / 2 + 0.015;

  // Both fonts are sized BEFORE either is drawn, because the people row now
  // sits at a fixed height instead of being pushed down by the title. The old
  // builder could shrink the CARDS to make room; a transcribed row cannot move,
  // so the header is what gives. Title and subtitle scale together by one
  // factor, which keeps their relative sizes as the reference has them.
  //
  // The solo board is exempt: its cards sit beside the title, not under it, so
  // a tall header is free there. Its width cap (`avail`) does that job instead.
  const fitTitle = (text: string, capFrac: number, charW: number) =>
    Math.min(capFrac * S, (avail * W) / (Math.max(1, ...text.split("\n").map((l) => l.trim().length)) * charW)) / S;

  // The fireside board (one moderator, one speaker) has its own type scale:
  // 88px title and 38px subtitle, against 120/66 on the wider boards. It is the
  // layout whose title only spans HALF the canvas, so the same 120px would have
  // to shrink itself to fit and would land somewhere arbitrary.
  //
  // These are CAPS, not fixed sizes: a line long enough to cross `avail` still
  // shrinks, because nothing here auto-wraps (text elements are `max-content`
  // and `white-space: pre`, so a line breaks only where Enter was pressed).
  // Break a long title yourself and it renders at the full 88px.
  const titleCap = solo ? 88 / 1080 : 0.1111;
  const subCap = solo ? 38 / 1080 : 0.0611;
  let titleF = form.title.trim() ? fitTitle(form.title, titleCap, 0.52) : 0;
  let subF = form.subtitle.trim() ? fitTitle(form.subtitle, subCap, 0.5) : 0;
  const SUB_GAP = 0.022;
  const headerH = () =>
    (titleF ? lineCount(form.title) * titleF * vs : 0)
    + (subF ? SUB_GAP + lineCount(form.subtitle) * subF * vs * 1.25 : 0);

  if (!solo) {
    // Clearance is generous because the layer closest to the header is the
    // "Moderated by" label, which sits ABOVE the card's top edge.
    const room = NEXT_ROW_TOP - 0.055 - titleTop;
    const h = headerH();
    if (h > room && h > 0) {
      const k = Math.max(0.45, room / h);
      titleF *= k; subF *= k;
    }
  }

  let cursorY = titleTop;
  if (titleF) {
    const blockH = lineCount(form.title) * titleF * vs;
    mkText(form.title, M, cursorY + blockH / 2, titleF, {
      weight: 600, color: "#FFFFFF", lineHeight: 1.0, simpleRole: "headline",
    });
    cursorY += blockH;
  }
  if (subF) {
    const blockH = lineCount(form.subtitle) * subF * vs * 1.25;
    cursorY += SUB_GAP;
    mkText(form.subtitle, M, cursorY + blockH / 2, subF, {
      weight: 400, color: "rgba(255,255,255,0.95)", lineHeight: 1.25, simpleRole: "subtitle",
    });
    cursorY += blockH;
  }

  // ── 4 + 5. People ───────────────────────────────────────────────────────
  // One row of headshots: the moderator on the left, then up to four speakers.
  // Replaces the text-only "Speakers:" / "Moderator:" lists this board shipped
  // with — Auri asked for the panel board's photo row here, with NO role tag on
  // the moderator: it is identified by sitting apart on the left, the way the
  // hand-made panel does it.
  //
  // Auri set the caption sizes in pixels off the 1920×1080 board: name 22,
  // description 17. They are stored as fractions of the SHORTER side so the
  // captions stay the same visual size in every format (the house rule for
  // every font in this file) — which lands on exactly 22/17px at 16:9 and 9:16,
  // and scales up on the 1500px square.
  const speakers = form.speakers.slice(0, NEXT_MAX_SPEAKERS);
  const moderator = form.includeModerator ? form.moderator : null;
  const n = speakers.length;

  // Auri's sizes, in pixels off the 1920×1080 board. Were 22/17 until
  // 2026-08-13. Stored as fractions of the SHORTER side so a caption stays the
  // same visual size in every format, the house rule for every font here.
  const nameFs = 28 / 1080;
  const roleFs = 18 / 1080;

  /** Card aspect (width:height) — portrait, matching the panel's cards. */
  const CARD_AR = 0.9;
  const cardHfromW = (wFrac: number) => (wFrac * (W / H)) / CARD_AR;
  /** Card top edge → caption first line. 41px on the reference board. */
  const CAP_GAP = 41 / 1080;
  /** "Moderated by" sits this far above the moderator's card. */
  const LABEL_GAP = 8 / 1080;
  /** Wrap measure for the moderator's caption — wider than its card, measured
   *  off the references at roughly 400px of 1920. */
  const MOD_CAP_W = 0.2;

  const wrapNext = (text: string, maxWfrac: number, fontFrac: number, avgChar = 0.56): string => {
    const maxChars = Math.max(6, Math.floor((maxWfrac * W) / (fontFrac * S * avgChar)));
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

  /** Name over description, wrapped to the column. Height in H-fractions. */
  const nextCaption = (p: SimplePerson, maxWfrac: number) => {
    const name = wrapNext(p.name.trim() || "Person", maxWfrac, nameFs);
    const role = p.title.trim() ? wrapNext(p.title, maxWfrac, roleFs) : "";
    const nameH = lineCount(name) * nameFs * vs * 1.2;
    const roleH = role ? 0.004 + lineCount(role) * roleFs * vs * 1.25 : 0;
    return { name, role, height: nameH + roleH, nameH };
  };

  /** Draw a caption downward from `topY`, left-aligned at `x`. */
  const emitCaption = (p: SimplePerson, x: number, topY: number, maxWfrac: number, who: string): void => {
    const { name, role, nameH } = nextCaption(p, maxWfrac);
    mkText(name, x, topY + nameH / 2, nameFs, {
      weight: 700, color: "#FFFFFF", lineHeight: 1.2, simpleRole: `${who}.name`,
    });
    if (role) {
      const roleH = lineCount(role) * roleFs * vs * 1.25;
      mkText(role, x, topY + nameH + 0.004 + roleH / 2, roleFs, {
        weight: 400, color: "rgba(255,255,255,0.82)", lineHeight: 1.25, simpleRole: `${who}.secondary`,
      });
    }
  };

  /** The photo, or the gradient-outlined frame that stands in for one. Same
   *  shape the panel emits, so a Next doc's cards retarget the same way. */
  const emitPhoto = (p: SimplePerson, left: number, top: number, w: number, h: number, who: string): void => {
    const cx = left + w / 2;
    const cy = top + h / 2;
    if (p.photo) {
      canvasImages.push({
        id: uid("img"), src: p.photo, x: cx, y: cy, width: w, height: h,
        cornerRadius: 8, border: true, borderWidth: 2 / 1500, fit: "cover",
        // WHITE, explicitly. A CanvasImage with `border: true` and NO
        // borderColor falls through to DynamicTemplate's default, which is the
        // yellow→orange→red gradient — so a FILLED card kept a coloured edge
        // even after the empty frames went white, and the two disagreed on the
        // same row. Both are white now.
        borderColor: "#FFFFFF",
        naturalWidth: p.naturalWidth, naturalHeight: p.naturalHeight,
        simpleRole: `${who}.photo`,
      });
    } else {
      shapes.push({
        id: uid("shape"), type: "rectangle", x: cx, y: cy, width: w, height: h,
        // WHITE, not the orange-red gradient every other board uses for an
        // empty slot. The reference boards are white-outlined and Auri called
        // it out by name; this is the only builder that differs.
        fillType: "outline", strokeWidth: 2 / 1500, colorType: "solid",
        color1: "#FFFFFF", color2: "#FFFFFF", opacity: 1, blur: 0, rotation: 0,
        borderRadius: 0.08,
      });
    }
  };

  if (n || moderator) {
    // Every card is the SAME fixed size on every board — the moderator's
    // included. The old builder derived the width from the count so the row
    // always filled the canvas, which made a 2-speaker board's cards much
    // bigger than a 4-speaker board's. The references are all 250px.
    const cw = NEXT_CARD_W;
    const chh = cardHfromW(cw);

    // Which of the transcribed rows applies. Solo is its own board; the rest
    // read the table, and anything the references do not cover falls back to
    // the right-aligned rule.
    const rowTop = solo ? SOLO_ROW_TOP : NEXT_ROW_TOP;
    const modX = solo ? SOLO_MOD_X : NEXT_MOD_X;
    const speakerXs = solo
      ? [SOLO_SPK_X]
      : (moderator ? NEXT_SPEAKER_X[n] : undefined) ?? rightAlignedRow(n);

    if (moderator) {
      // "Moderated by" above the card — the label the references carry and the
      // previous build deliberately left out. The moderator used to be told
      // apart by sitting alone on the left; it is now named.
      const labelH = nameFs * vs * 1.2;
      mkText("Moderated by", modX, rowTop - LABEL_GAP - labelH / 2, nameFs, {
        weight: 700, color: "#FFFFFF", lineHeight: 1.2, simpleRole: "next.moderatorLabel",
      });
      emitPhoto(moderator, modX, rowTop, cw, chh, "moderator");
      // Caption BELOW the card now, like every speaker. It used to sit to the
      // right, which is what made the moderator's block twice as wide as a
      // speaker's and forced the whole row to be measured differently.
      //
      // It wraps WIDER than its card, though — 0.2 of the width against the
      // card's 0.13. On the references "Managing Director & Co-Head of
      // Secondaries, Stifel" breaks into two lines that both overhang the card,
      // and holding it to the card width instead turns it into four cramped
      // ones. Only the moderator gets this: it is the leftmost card, so the
      // overhang runs into empty canvas rather than into the next speaker.
      emitCaption(moderator, modX, rowTop + chh + CAP_GAP, MOD_CAP_W, "moderator");
    }
    speakers.forEach((p, i) => {
      const x = speakerXs[i] ?? (NEXT_MOD_X + i * (cw + 80 / 1920));
      emitPhoto(p, x, rowTop, cw, chh, `speaker-${i}`);
      emitCaption(p, x, rowTop + chh + CAP_GAP, cw, `speaker-${i}`);
    });
  }

  return {
    format,
    customSize: { width: W, height: H },
    canvasImages,
    design: {
      backgroundId: form.backgroundId,
      accentId: form.accentId,
      texts,
      shapes,
      showLogo: true,
      logoStyle: "white",
      logoPosition: "bottom-right",
      // Measured off the hand-built design — sits tighter into the corner than
      // the bottom-right preset does.
      logoCustomPosition: { x: 0.947, y: 0.939 },
    },
  };
}

/** True for a doc built by `buildStageHostDesign` — read from its own roles, so
 *  a saved library item is recognised without a snapshot. Panel chrome must
 *  never flow between the two panel layouts (their headers are different
 *  compositions), and the sidebar uses it to pick the stage-host fields. */
export function isStageHostDoc(doc: SimpleDoc): boolean {
  const tagged = (r: string | undefined) => Boolean(r?.startsWith("stageHost-"));
  return doc.design.texts.some((t) => tagged(t.simpleRole))
    || doc.canvasImages.some((i) => tagged(i.simpleRole));
}

/**
 * Read the hosts back off a stage-host doc. HOW MANY the canvas shows wins over
 * the snapshot — the same rule the partner wall uses for its logo count, and the
 * reason a two-host design loaded from the library doesn't collapse to one on
 * the first keystroke. Words come from the snapshot when there is one (it keeps
 * the user's own line breaks); the doc's role-tagged layers are the fallback,
 * and its images are always the only source of the headshots.
 */
export function stageHostsFromDoc(
  doc: SimpleDoc,
  saved: SimplePerson[] | undefined,
  withPhoto: (p: SimplePerson, who: string) => SimplePerson,
  flat: (s: string) => string = (s) => s.split("\n").join(" "),
): SimplePerson[] {
  const textByRole = new Map(doc.design.texts.filter((t) => t.simpleRole).map((t) => [t.simpleRole as string, t.content]));
  const roles = [...textByRole.keys(), ...doc.canvasImages.map((i) => i.simpleRole ?? "")];
  const shown = 1 + Math.max(0, ...roles
    .map((r) => /^stageHost-(\d+)\./.exec(r))
    .filter((m): m is RegExpExecArray => Boolean(m))
    .map((m) => Number(m[1])));
  return Array.from({ length: Math.min(shown, STAGE_HOSTS_MAX) }, (_, i) => {
    const held = saved?.[i];
    const person: SimplePerson = held ?? {
      name: flat(textByRole.get(`stageHost-${i}.name`) ?? ""),
      title: flat(textByRole.get(`stageHost-${i}.title`) ?? ""),
      company: flat(textByRole.get(`stageHost-${i}.company`) ?? ""),
      photo: "",
    };
    return withPhoto(person, `stageHost-${i}`);
  });
}

/**
 * Build the stage-host card: one host's photo in a WHITE-outlined frame on the
 * left, and on the right the stage name in the label chip, the host's name,
 * their job title and their company. No headline, no subtitle, no moderator —
 * the whole point is that the screen names the person hosting a stage.
 *
 * 16:9 is the format it was drawn for (a stage screen), so that geometry is
 * measured off Auri's reference. Square and story keep the same elements and
 * the same type scale with the photo stacked ABOVE the words, because a
 * side-by-side split has no room in a portrait canvas.
 */
export function buildStageHostDesign(form: SimpleForm, format: PlatformFormat): SimpleDoc {
  seq = 0;
  const dims = FORMAT_DIMENSIONS[format] ?? FORMAT_DIMENSIONS.square;
  const W = dims.width;
  const H = dims.height;
  // Same contract as the panel builder: font sizes are fractions of the
  // SHORTER side, and `vs` converts a font-fraction into the share of HEIGHT
  // one line of it occupies.
  const S = Math.min(W, H);
  const vs = S / H;
  const hosts = stageHostsOf(form);
  const pair = hosts.length > 1;

  const texts: TextElement[] = [];
  const shapes: ShapeElement[] = accentShapes(form.accentId, W, H, () => uid("shape"));
  const canvasImages: CanvasImage[] = [];

  const mkText = (content: string, x: number, y: number, sizeFrac: number, opts: Partial<TextElement> = {}): void => {
    if (!content.trim()) return;
    texts.push({
      id: uid("text"), content, position: { x, y },
      fontSize: Math.round(sizeFrac * S), align: "left", weight: 600, font: "onest",
      ...opts,
    });
  };
  const lineCount = (t: string) => (t.trim() ? t.split("\n").length : 0);
  /** Shrink a font until the longest line fits the column. */
  const fitFont = (text: string, baseFrac: number, colW: number, avgChar = 0.58): number => {
    const longest = Math.max(1, ...text.split("\n").map((l) => l.trim().length));
    return Math.min(baseFrac * S, (colW * W) / (longest * avgChar)) / S;
  };
  /** Word-wrap `text` so no line is wider than `colW`, honouring any manual
   *  break. Captions WRAP rather than shrink — auto-fitting each line on its own
   *  set the job title and the company at different sizes, which reads as a
   *  mistake (the reference has them equal). */
  const wrapToWidth = (text: string, colW: number, fontFrac: number, avgChar = 0.56): string => {
    const maxChars = Math.max(6, Math.floor((colW * W) / (fontFrac * S * avgChar)));
    return text.split("\n").map((line) => {
      const out: string[] = [];
      let cur = "";
      for (const word of line.trim().split(/\s+/)) {
        const trial = cur ? `${cur} ${word}` : word;
        if (trial.length > maxChars && cur) { out.push(cur); cur = word; }
        else cur = trial;
      }
      if (cur) out.push(cur);
      return out.join("\n");
    }).join("\n");
  };

  // ── Geometry ─────────────────────────────────────────────────────────────
  // ONE host: the reference 16:9 split, photo left and words right (portrait
  // formats stack instead — a side-by-side has no room there).
  // TWO hosts: the chip moves to the top-left corner and the canvas becomes two
  // equal columns, each a photo with its own caption underneath.
  const wide = W > H;
  // Frames are portrait (4:5-ish) in every format, so a headshot never has to
  // be cropped to a letterbox.
  const portraitH = (w: number) => (w * W) / 0.79 / H;
  const single = wide
    ? { left: MARGIN, w: 0.282, h: 0.634, top: 0.183 }
    : format === "story"
      ? { left: MARGIN, w: 0.62, h: 0.44, top: 0.16 }
      // Square is the tightest canvas: the words need the bottom half, so the
      // frame is the smallest here (a taller one pushed the company line off
      // the canvas).
      : { left: MARGIN, w: 0.34, h: 0.43, top: 0.10 };
  // The pair's cell width per format. Wide takes the reference's measurements;
  // portrait splits the usable width evenly with a narrower gutter, since two
  // columns of a 1080-wide canvas are tight already.
  const cellW = wide ? 0.237 : 0.38;
  const gutter = wide ? 0.192 : 0.08;
  const cellH = wide ? 0.535 : portraitH(cellW);
  const pairLeft = (1 - (cellW * 2 + gutter)) / 2; // centred as a block
  const pairTop = wide ? 0.181 : format === "story" ? 0.30 : 0.24;

  // ── Stage name chip. The pair's is a corner label, top-left; a single host's
  //    opens the right-hand column (or sits under the photo when stacked). ───
  const chipLeft = pair || !wide ? MARGIN : 0.40;
  let y = pair ? 0.06 : wide ? 0.234 : single.top + single.h + 0.055;
  if (form.label.trim()) {
    const labelText = form.label.toUpperCase();
    const fsFrac = 0.04;
    const fsPx = fsFrac * S;
    const letterSpacingPx = Math.round(0.0005 * S);
    const padLeft = 0.03 * S;
    const padRight = 0.046 * S;
    const textWpx = labelText.length * fsPx * 0.62 + Math.max(0, labelText.length - 1) * letterSpacingPx;
    const chipH = fsFrac * vs * 1.7;
    const chipW = Math.min((textWpx + padLeft + padRight) / W, 0.94);
    const chipY = y + chipH / 2;
    shapes.push({
      id: uid("shape"), type: "rectangle",
      x: chipLeft + chipW / 2, y: chipY, width: chipW, height: chipH,
      fillType: "fill", strokeWidth: 0, colorType: "solid",
      color1: "#FFFFFF", color2: "#FF6B00", opacity: 1, blur: 0, rotation: 0,
      borderRadius: 0.22,
      simpleRole: "label.chip",
    });
    // Caps sit high in their line box — nudge the text down to optically centre
    // them in the chip.
    mkText(labelText, chipLeft + padLeft / W, chipY + fsFrac * vs * 0.11, fsFrac, {
      weight: 800, uppercase: true, color: "#15110E", letterSpacing: letterSpacingPx,
      simpleRole: "label",
    });
    // Wide has room for the reference's generous air under the chip; stacked
    // formats spend that height on the photo instead. The pair ignores this —
    // its columns are placed against `pairTop`, not flowed under the chip.
    y += chipH + (wide ? 0.075 : 0.045);
  }

  /** One host: the white-outlined photo (or the slot it drops into) plus the
   *  name / job / company block, anchored at (capLeft, capTop). */
  const emitHost = (
    p: SimplePerson, i: number,
    frame: { left: number; w: number; h: number; top: number },
    cap: { left: number; top: number; width: number; nameFrac: number; captionFrac: number },
  ): void => {
    const cx = frame.left + frame.w / 2;
    const cy = frame.top + frame.h / 2;
    if (p.photo) {
      canvasImages.push({
        id: uid("img"), src: p.photo, x: cx, y: cy, width: frame.w, height: frame.h,
        // White, and exactly 2px whatever the canvas: the renderer multiplies
        // borderWidth by canvas WIDTH, so a fixed fraction would be 2px on 1:1
        // and 2.6px on 16:9.
        cornerRadius: 5, border: true, borderColor: "#FFFFFF", borderWidth: 2 / W,
        fit: "cover",
        naturalWidth: p.naturalWidth, naturalHeight: p.naturalHeight,
        simpleRole: `stageHost-${i}.photo`,
      });
    } else {
      shapes.push({
        id: uid("shape"), type: "rectangle", x: cx, y: cy, width: frame.w, height: frame.h,
        fillType: "outline", strokeWidth: 2 / 1500, colorType: "gradient",
        color1: "#FF6B00", color2: "#FF0028", opacity: 1, blur: 0, rotation: 0,
        borderRadius: 0.05,
      });
    }
    let ty = cap.top;
    if (p.name.trim()) {
      const f = fitFont(p.name, cap.nameFrac, cap.width);
      const blockH = lineCount(p.name) * f * vs;
      mkText(p.name, cap.left, ty + blockH / 2, f, {
        weight: 800, color: "#FFFFFF", simpleRole: `stageHost-${i}.name`,
      });
      ty += blockH + (pair ? 0.012 : 0.018);
    }
    for (const [suffix, content] of [["title", p.title], ["company", p.company]] as const) {
      if (!content.trim()) continue;
      const wrapped = wrapToWidth(content, cap.width, cap.captionFrac);
      const blockH = lineCount(wrapped) * cap.captionFrac * vs;
      mkText(wrapped, cap.left, ty + blockH / 2, cap.captionFrac, {
        weight: 500, color: "#FFFFFF", simpleRole: `stageHost-${i}.${suffix}`,
      });
      ty += blockH + 0.004;
    }
  };

  if (pair) {
    // Each caption sits UNDER its own photo, left-aligned with the frame, at a
    // smaller type scale than the single-host card: two columns of the big one
    // would collide in the middle.
    const capTop = pairTop + cellH + (wide ? 0.042 : 0.028);
    hosts.slice(0, STAGE_HOSTS_MAX).forEach((p, i) => {
      const left = pairLeft + i * (cellW + gutter);
      emitHost(p, i, { left, w: cellW, h: cellH, top: pairTop }, {
        // The caption may run a little wider than its frame before it wraps —
        // the gutter is there to absorb it.
        left, top: capTop, width: cellW * 1.2, nameFrac: 0.06, captionFrac: 0.032,
      });
    });
  } else {
    emitHost(hosts[0], 0, single, {
      left: wide ? 0.40 : MARGIN, top: y, width: wide ? 0.54 : 0.88,
      nameFrac: 0.105, captionFrac: 0.049,
    });
  }

  return {
    format,
    customSize: { width: W, height: H },
    canvasImages,
    design: {
      backgroundId: form.backgroundId || "orb7",
      ...(form.accentId ? { accentId: form.accentId } : {}),
      texts,
      shapes,
      showLogo: true,
      logoStyle: "white",
      // Bottom-RIGHT here, unlike the panel: the photo owns the bottom-left
      // corner in the wide layout and the words end well above the baseline on
      // the right.
      logoPosition: "bottom-right",
    },
  };
}

export function buildSimpleDesign(form: SimpleForm, format: PlatformFormat): SimpleDoc {
  // The stage-host card is its own composition, not a variation on the panel's
  // header + cards flow — so it gets its own builder rather than a branch
  // threaded through this one.
  if ((form.panelLayout ?? "discussion") === "stage-host") return buildStageHostDesign(form, format);
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
  // Accent circles first, so they sit at the BOTTOM of the shape stack.
  const shapes: ShapeElement[] = accentShapes(form.accentId, W, H, () => uid("shape"));
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

  // The Host template's headline follows the count: "HOST" for one, "HOSTS"
  // for two — same idea as the partner label's plural rule. Applies only to
  // a moderator-less form whose headline IS the word (any other headline is
  // real copy and passes through verbatim).
  const headline = !form.includeModerator && /^hosts?$/i.test(form.headline.trim())
    ? (form.speakers.length === 1 ? "HOST" : "HOSTS")
    : form.headline;
  if (headline.trim()) {
    const f = fitFont(headline, 0.082);
    const blockH = lineCount(headline) * f * vs;
    mkText(headline, MARGIN, cursorY + blockH / 2, f, { weight: 600, color: "#FFFFFF", simpleRole: "headline" });
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
      // Spread rather than assigned, so a design with no accent is exactly
      // the doc the builders produced before accents existed.
      ...(form.accentId ? { accentId: form.accentId } : {}),
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
  template: "panel" | "partner" | "sales" | "next";
  form?: SimpleForm;
  partner?: PartnerForm;
  sales?: SalesForm;
  next?: NextForm;
}

export function stripFormsForSave(template: "panel" | "partner" | "sales" | "next", form: SimpleForm, partner: PartnerForm, sales?: SalesForm, next?: NextForm): SimpleFormsSnapshot {
  const strip = (p: SimplePerson): SimplePerson => ({ ...p, photo: "", naturalWidth: undefined, naturalHeight: undefined });
  return {
    template,
    form: {
      ...form,
      moderator: strip(form.moderator),
      speakers: form.speakers.map(strip),
      // Same reason as the others: the doc carries these headshots under
      // `stageHost-N.photo`, and a second copy would spend the save quota twice.
      ...(form.stageHosts ? { stageHosts: form.stageHosts.map(strip) } : {}),
    },
    partner,
    // Kept whole, like the partner logos: countdown and discount each own a
    // photo, and the active doc only carries the current layout's slot.
    sales,
    // Stripped for the same reason as the panel's: the board's own photo row
    // (since 2026-08-12) tags every headshot with its role on the doc, so the
    // canvas already carries them and a second copy in the snapshot would spend
    // the save quota twice. `formsFromDoc` rehydrates them by role.
    next: next && { ...next, moderator: strip(next.moderator), speakers: next.speakers.map(strip) },
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
  if (docKindOf(doc) !== "panel") return doc;
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
  if (docKindOf(doc) !== "panel") return doc;

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

/** A partner or sales doc has no people, so role-less MODERATOR/SPEAKER words
 *  on one are leakage from the pre-guard `syncPartnerChrome` bug (panel chrome
 *  carried across a template switch) — drop them so docs contaminated before
 *  the fix heal on their next load. Panel docs keep their words, of course. */
export function stripLeakedPanelWords(doc: SimpleDoc): SimpleDoc {
  if (docKindOf(doc) === "panel") return doc;
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
/** The season the partner walls describe, for the export filename. NOT the
 *  current year: it names the roster, which comes from the Airtable view
 *  "Partner Deliverables 2026", so it changes when that view does and never
 *  because a clock rolled over. */
export const PARTNER_SEASON = 2026;

/** Headline to filename: "Thank you to our Prime partners" becomes
 *  "Thank You Prime Partners".
 *
 *  Two rules, both there to keep the tier legible. The filler between the verb
 *  and the tier carries nothing in a filename, so "to our" and its variants go.
 *  And a word that ALREADY has a capital keeps its own casing — otherwise
 *  "TechBBQ", "LS x DT" and "ProWoc" come out mangled — while the small joining
 *  words stay lowercase so it reads as a title rather than a shout. */
/** Words that carry nothing in a filename. Dropped as WHOLE WORDS by walking the
 *  list rather than by a regex: a word boundary written inside a pattern here is
 *  one keystroke from being the BACKSPACE character instead, which matches
 *  nothing and fails silently — this helper shipped that way once and left every
 *  file called "Thank You to Our Prime Partners". lib/partners.ts avoids regex
 *  word boundaries for the same reason. */
const NAME_FILLER = new Set(["to", "our", "all", "of", "the"]);
/** Small joining words that stay lowercase inside a title. */
const NAME_SMALL = new Set(["a", "an", "and", "at", "by", "for", "in", "of", "on", "the", "to", "with", "x"]);

/** Headline to filename: "Thank you to our Prime partners" becomes
 *  "Thank You Prime Partners".
 *
 *  A word that ALREADY carries a capital keeps its own casing, so "TechBBQ",
 *  "ProWoc" and "DTU" survive; everything else is capitalised unless it is one of
 *  the small joining words. */
function titleCaseName(text: string): string {
  const words = text.split(" ").filter(Boolean);
  // Filler is only dropped from a THANK-YOU headline, where "to our" sits between
  // the verb and the tier and carries nothing: "Thank you to our Prime partners"
  // becomes "Thank You Prime Partners". Anywhere else the small words are part of
  // the sentence — "Meet our pitch finalists" reads wrong as "Meet Pitch
  // Finalists" — so those headlines keep every word and only get their casing
  // tidied.
  const thanks = words[0]?.toLowerCase() === "thank";
  const kept = thanks ? words.filter((w) => !NAME_FILLER.has(w.toLowerCase())) : words;
  const out = kept.length ? kept : words;
  return out
    .map((w, i) => {
      if (/[A-Z]/.test(w)) return w;
      if (i > 0 && NAME_SMALL.has(w.toLowerCase())) return w.toLowerCase();
      return w[0].toUpperCase() + w.slice(1);
    })
    .join(" ");
}

export function simpleExportName(template: "panel" | "partner" | "sales" | "next", format: PlatformFormat, headline: string, salesLabel?: string, partnerLayout?: PartnerLayout): string {
  const fmt = format === "presentation" ? "16x9" : format === "story" ? "9x16" : "1x1";
  const clean = (s: string) => s
    .split("\n").join(" ")
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (template === "partner") {
    // Named after the HEADLINE, so a set of tier walls exported together arrives
    // as "Thank You Prime Partners TechBBQ 2026", "…Main…", "…Core…" rather than
    // eight files called "Thank You Partners" with a number bolted on by the
    // browser (Auri, 2026-08-19). The headline already names the tier — see
    // tierHeadline() in src/data/partnerSets.ts.
    const head = titleCaseName(clean(headline));
    const what = head || (partnerLayout === "thanks" ? "Thank You Partners" : "Partner Announcement");
    // A headline that already says TechBBQ does not need it twice.
    const brand = /\btechbbq\b/i.test(what) ? "" : "TechBBQ ";
    return `${fmt} - ${what} ${brand}${PARTNER_SEASON}`;
  }
  // Sales: the figure and its caption say what the post is — "48 days left".
  if (template === "sales") {
    const label = clean(salesLabel ?? "");
    return label ? `${fmt} - Sale - ${label}` : `${fmt} - Sale`;
  }
  const head = clean(headline);
  // The Next board is named by its session title, like a panel.
  if (template === "next") return head ? `${fmt} - Next - ${head}` : `${fmt} - Next`;
  return head ? `${fmt} - Panel - ${head}` : `${fmt} - Panel`;
}

/**
 * Rebuild the sidebar state for a doc loaded from the team library, so the
 * template toggle and every field match what's on the canvas. Prefers the
 * `SimpleFormsSnapshot` saved with the doc (exact); for docs saved before
 * snapshots existed it reconstructs what it can from the role-tagged layers.
 * Returns null for the form that doesn't belong to the doc's kind, so the
 * caller leaves that side of the state alone.
 */
export function formsFromDoc(kind: string, doc: SimpleDoc, saved?: SimpleFormsSnapshot): { template: "panel" | "partner" | "sales" | "next"; form: SimpleForm | null; partner: PartnerForm | null; sales: SalesForm | null; next: NextForm | null } {
  const template: "panel" | "partner" | "sales" | "next" = saved?.template
    ?? (kind === "partner" ? "partner" : kind === "sales" ? "sales"
      // A Next board saved before snapshots carried the kind is still
      // identifiable from the doc's own `next.*` roles.
      : kind === "next" || isNextDoc(doc) ? "next" : "panel");
  const imgByRole = new Map(doc.canvasImages.filter((i) => i.simpleRole).map((i) => [i.simpleRole as string, i]));
  const textByRole = new Map(doc.design.texts.filter((t) => t.simpleRole).map((t) => [t.simpleRole as string, t.content]));
  const asLogo = (role: string): PartnerLogo | null => {
    const i = imgByRole.get(role);
    return i ? { src: i.src, naturalWidth: i.naturalWidth, naturalHeight: i.naturalHeight } : null;
  };

  if (template === "sales") {
    const base = saved?.sales ?? emptySalesForm();
    // The doc's own photo role witnesses the layout; the snapshot is the only
    // witness for a doc whose photo was never uploaded AND whose frame was
    // hand-deleted (salesLayoutOf then reads the text roles).
    const layout = salesLayoutOf(doc) ?? base.layout;
    const photoImg = imgByRole.get(`sales-${layout}.photo`);
    return {
      template,
      form: null,
      partner: null,
      next: null,
      sales: {
        ...base,
        layout,
        // Text comes from the snapshot when there is one; older/hand-made
        // items are reconstructed from the role-tagged layers.
        value: saved?.sales ? base.value : (textByRole.get("sales.value") ?? base.value),
        caption: saved?.sales ? base.caption : (textByRole.get("sales.caption") ?? base.caption),
        headline: saved?.sales ? base.headline : (textByRole.get("sales.headline") ?? base.headline),
        cta: saved?.sales ? base.cta : (textByRole.get("sales.cta") ?? base.cta),
        footer: saved?.sales ? base.footer : (textByRole.get("sales.footer") ?? base.footer),
        ribbon: saved?.sales ? base.ribbon : (textByRole.get("sales.ribbon") ?? base.ribbon),
        photo: base.photo?.src ? base.photo : (photoImg ? { src: photoImg.src, naturalWidth: photoImg.naturalWidth, naturalHeight: photoImg.naturalHeight } : null),
        backgroundId: doc.design.backgroundId || base.backgroundId,
        accentId: doc.design.accentId ?? base.accentId,
      },
    };
  }

  if (template === "partner") {
    // Snapshots saved before the thank-you wall existed have no headline or
    // logoCount — merging over the defaults keeps those fields defined.
    const base: PartnerForm = { ...emptyPartnerForm(), ...saved?.partner };
    const quad = [0, 1, 2, 3].some((i) => imgByRole.has(`logo-${i}`));
    const duo = [0, 1].some((i) => imgByRole.has(`logo-duo-${i}`));
    // The thank-you wall is witnessed by the doc itself (its slot roles cover
    // empty cells too, so a wall with no logos uploaded still reads as one).
    const thanksRoles = thanksSlotRoles(doc);
    // A doc with no uploaded logos has no image roles to infer from — the
    // saved layout (when present) is the only witness.
    const layout: PartnerLayout = thanksRoles.length ? "thanks"
      : duo ? "duo"
      : quad ? "quad"
      : (imgByRole.has("logo-single") || !saved?.partner) ? "single"
      : base.layout;
    // Snapshots carry the FULL slot array (the layouts share it); the doc's
    // roles only cover the active layout, so they're the legacy fallback.
    const roleLogos = layout === "thanks" ? thanksRoles.map(asLogo)
      : layout === "quad" ? [0, 1, 2, 3].map((i) => asLogo(`logo-${i}`))
      : layout === "duo" ? [0, 1].map((i) => asLogo(`logo-duo-${i}`))
      : [asLogo("logo-single")];
    return {
      template,
      form: null,
      sales: null,
      next: null,
      partner: {
        ...base,
        label: saved?.partner ? base.label : (textByRole.get("label") ?? base.label),
        layout,
        logos: base.logos.some((l) => l?.src) ? base.logos : roleLogos,
        // The grid on the canvas wins over a stale snapshot count: the doc is
        // what the user is looking at, and a mismatch would rebuild the wall
        // to a different size the moment they touch a field. Same for the tier
        // split, which the roles carry.
        logoCount: thanksRoles.length || base.logoCount,
        featuredCount: thanksRoles.length ? thanksLeadCount(doc) : base.featuredCount,
        // Newlines the BUILDER inserted (it wraps an unbroken headline to fill
        // the width) flatten back to spaces, the same contract the panel
        // captions use — else every load would re-freeze the wrap as if the user
        // had typed it. A snapshot, when there is one, carries the exact text.
        headline: saved?.partner
          ? base.headline
          : (textByRole.get("thanks.headline")?.split("\n").join(" ") ?? base.headline),
        // The canvas wins over the snapshot, same as logoCount: the overlay the
        // user is looking at IS the scrim, however it got there (slider, or the
        // editor's own overlay control on a round-trip).
        scrim: doc.design.overlayColor ? (doc.design.overlayOpacity ?? 0) : (base.scrim ?? 0),
        backgroundId: doc.design.backgroundId || base.backgroundId,
        accentId: doc.design.accentId ?? base.accentId,
      },
    };
  }

  if (template === "next") {
    const base = saved?.next ?? emptyNextForm();
    // Builder-inserted newlines flatten back to spaces for the single-line
    // inputs, the same contract the panel captions use. The title keeps its
    // breaks — its input is a textarea and the breaks are the user's own.
    const flatten = (s: string) => s.split("\n").join(" ");
    // Photos come from the doc's role-tagged images, exactly as the panel does
    // it — the snapshot strips them to stay under the save quota, so the canvas
    // is the only place a headshot survives.
    const readPerson = (who: string, fallback: SimplePerson): SimplePerson => {
      const img = imgByRole.get(`${who}.photo`);
      return {
        ...fallback,
        name: flatten(textByRole.get(`${who}.name`) ?? fallback.name),
        title: flatten(textByRole.get(`${who}.secondary`) ?? fallback.title),
        ...(img ? { photo: img.src, naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight } : {}),
      };
    };
    // How many speakers the CANVAS shows wins over a stale snapshot, the same
    // rule the partner wall uses: the doc is what the user is looking at.
    // Image roles count as well as text roles: a speaker who has a photo but no
    // name typed leaves no text layer at all, and reading text alone dropped
    // them from the sidebar.
    const docSpeakers = [...new Set(
      [...doc.design.texts.map((t) => t.simpleRole), ...doc.canvasImages.map((i) => i.simpleRole)]
        .map((r) => /^speaker-(\d+)\./.exec(r ?? "")?.[1])
        .filter((n): n is string => Boolean(n))
        .map(Number),
    )].sort((a, b) => a - b);
    const speakers = saved?.next && !docSpeakers.length
      ? base.speakers
      : docSpeakers.map((i) => readPerson(`speaker-${i}`, base.speakers[i] ?? emptyPerson()));
    // The banner is stored composed on canvas ("UP NEXT: Fireside (14:30)");
    // the two inputs hold the parts. `parseNextBanner` splits it back, and it
    // also rescues docs saved when the session name and the time were ONE
    // field — "Session (XX:XX)" parses into the pair, so an older board opens
    // with its time already in the new input instead of glued to its name.
    const bannerRaw = textByRole.get("next.session");
    const parsed = bannerRaw ? parseNextBanner(flatten(bannerRaw)) : null;
    // A snapshot written BEFORE `time` existed has the whole string in
    // `session` — "Session (XX:XX)" — and no `time` at all. Taking it verbatim
    // would compose "UP NEXT: Session (XX:XX) (XX:XX)" on the next build, so a
    // legacy snapshot gets split the same way the canvas does. Detected by
    // `time` being absent, not by looking for brackets: a CURRENT snapshot with
    // a deliberately empty time must stay empty.
    const legacySnapshot = Boolean(saved?.next) && base.time === undefined;
    const fromSnapshot = legacySnapshot ? parseNextBanner(base.session) : null;
    const session = saved?.next
      ? (fromSnapshot?.session ?? base.session)
      : (parsed?.session ?? base.session);
    const time = saved?.next
      ? (fromSnapshot?.time ?? base.time ?? "")
      : (parsed?.time ?? base.time ?? "");
    const hasModerator = doc.design.texts.some((t) => t.simpleRole?.startsWith("moderator."))
      || doc.canvasImages.some((i) => i.simpleRole?.startsWith("moderator."));
    return {
      template,
      form: null,
      partner: null,
      sales: null,
      next: {
        ...base,
        session,
        time,
        title: saved?.next ? base.title : (textByRole.get("headline") ?? base.title),
        // An empty subtitle emits no text layer, so a doc without one has to
        // read back as "" and not as the sample copy from `base`.
        subtitle: saved?.next ? base.subtitle : (textByRole.get("subtitle") ?? ""),
        speakers: speakers.slice(0, NEXT_MAX_SPEAKERS),
        includeModerator: saved?.next ? base.includeModerator : hasModerator,
        moderator: readPerson("moderator", base.moderator),
        backgroundId: doc.design.backgroundId || base.backgroundId,
        accentId: doc.design.accentId ?? base.accentId,
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
      sales: null,
      next: null,
      form: {
        ...saved.form,
        // The CANVAS decides which panel layout the sidebar shows, the same
        // rule the partner wall uses for its logo count: the doc is what the
        // user is looking at, and a stale snapshot would rebuild it into the
        // other layout on the first keystroke.
        panelLayout: isStageHostDoc(doc) ? "stage-host" : "discussion",
        ...(isStageHostDoc(doc) ? { stageHosts: stageHostsFromDoc(doc, saved.form.stageHosts, withPhoto) } : {}),
        // Old snapshots carry two-field people — fold company into the
        // description so the single sidebar input shows everything.
        moderator: mergePersonDescription(withPhoto(saved.form.moderator, "moderator")),
        speakers: saved.form.speakers.map((p, i) => mergePersonDescription(withPhoto(p, `speaker-${i}`))),
        backgroundId: doc.design.backgroundId || saved.form.backgroundId,
        accentId: doc.design.accentId ?? saved.form.accentId,
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
  // A stage-host doc with no snapshot — a hand-made or pre-snapshot library
  // item — reads back from its own roles.
  if (isStageHostDoc(doc)) {
    return {
      template,
      partner: null,
      sales: null,
      next: null,
      form: {
        ...emptyForm(),
        panelLayout: "stage-host",
        label: textByRole.get("label") ?? "",
        stageHosts: stageHostsFromDoc(doc, undefined, withPhoto, flat),
        backgroundId: doc.design.backgroundId || "orb7",
        accentId: doc.design.accentId,
      },
    };
  }
  return {
    template,
    partner: null,
    sales: null,
    next: null,
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
      accentId: doc.design.accentId,
    },
  };
}
