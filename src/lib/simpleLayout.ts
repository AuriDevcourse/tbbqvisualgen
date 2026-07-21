// Turns the simple-mode form into a full canvas doc (design + images), reusing
// the same rendering engine as the pro editor. Pure function — no React.
import { FORMAT_DIMENSIONS, type DesignConfig, type PlatformFormat, type TextElement, type ShapeElement } from "@/types/template";
import type { CanvasImage } from "@/components/ImagePlacer";

export interface SimplePerson {
  name: string;
  title: string;
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
  return `${doc.format}|${doc.customSize.width}x${doc.customSize.height}|${roles.join(",")}|imgs:${imgRoles.join(",") || "none"}`;
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

  // Retargeting only moves WORDS across — an image change (uploading, swapping
  // or removing a photo/logo) has no tuned layer to land on, so the tuned doc
  // would keep rendering its old images and the edit would silently vanish.
  // The slot role is part of the identity: a quad-grid swap or a single↔quad
  // switch reuses the same srcs, and only the roles reveal the change.
  const imageKey = (d: SimpleDoc) => d.canvasImages.map((i) => `${i.simpleRole ?? ""}=${i.src}`).join(" ");
  if (imageKey(tuned) !== imageKey(rebuilt)) return null;

  const roleOf = (d: SimpleDoc) =>
    new Map(d.design.texts.filter((t) => t.simpleRole).map((t) => [t.simpleRole as string, t.content]));

  const want = roleOf(rebuilt);
  const have = roleOf(tuned);
  if (want.size !== have.size) return null;
  for (const role of want.keys()) if (!have.has(role)) return null;

  return {
    ...tuned,
    design: {
      ...tuned.design,
      // The background is a form choice, not a hand-placed layer — carry the
      // CURRENT pick across, else switching backgrounds does nothing while a
      // tuned design is active.
      backgroundId: rebuilt.design.backgroundId,
      texts: tuned.design.texts.map((t) =>
        t.simpleRole && want.has(t.simpleRole) ? { ...t, content: want.get(t.simpleRole) as string } : t,
      ),
    },
  };
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
  /** "single" = one big logo; "quad" = four logos in a 2×2 grid. */
  layout: "single" | "quad";
  /** Slot 0 for single, slots 0–3 for quad. A missing/empty slot renders as
   *  an outlined placeholder frame. */
  logos: (PartnerLogo | null)[];
  backgroundId: string;
}

export function emptyPartnerForm(): PartnerForm {
  return { label: "Partner Announcement", layout: "single", logos: [], backgroundId: "orb5" };
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
    moderator: { name: "Pierre Leroy", title: "Managing Director & Co-Head of Secondaries", company: "at Stifel", photo: "/samples/pierre-leroy.jpg" },
    speakers: [
      { name: "Andrei Xydas", title: "Principal", company: "Lightrock", photo: "/samples/andrei-xydas.jpg" },
      { name: "Nicholas Sando", title: "Partner, Secondaries", company: "Molten", photo: "/samples/nicholas-sando.jpg" },
      { name: "Omolade Adebisi", title: "Principal & Head of Secondaries", company: "ISOMER Capital", photo: "/samples/omolade-adebisi.jpg" },
    ],
    backgroundId: "orb5",
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
    const labelText = form.label.toUpperCase();
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
  } else {
    emitLogo(form.logos[0], 0.5, centerY, (0.62 * S) / W, (0.32 * S) / H, "logo-single");
  }

  const design: DesignConfig = {
    backgroundId: form.backgroundId || "orb5",
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
  const emitPhoto = (p: SimplePerson, left: number, top: number, w: number, h: number): void => {
    const cx = left + w / 2;
    const cy = top + h / 2;
    if (p.photo) {
      canvasImages.push({
        id: uid("img"), src: p.photo, x: cx, y: cy, width: w, height: h,
        cornerRadius: 8, border: true, borderWidth: 2 / 1500, fit: "cover",
        scrimBottom: 0.5, // subtle bottom fade so overlaid labels/text read
        naturalWidth: p.naturalWidth, naturalHeight: p.naturalHeight,
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
    const totalW = (areaRight - areaLeft) - gap * (m - 1);
    const unit = totalW / (1.3 + (m - 1)); // moderator = 1.3 units wide
    let x = areaLeft;
    people.forEach((p, i) => {
      const isMod = i === 0;
      const uw = isMod ? unit * 1.3 : unit;
      let cw = uw;
      let ch = cardHfromW(cw, 0.85);
      if (ch > bandH) { ch = bandH; cw = cardWfromH(ch, 0.85); }
      const top = rowBottom - ch;
      const nameFrac = isMod ? 0.02 : 0.018;
      const capH = captionHeight(p, nameFrac, cw);
      captionBlock(p, x, top - 0.012 - capH, nameFrac, cw, isMod ? "moderator" : `speaker-${i - 1}`);
      emitPhoto(p, x, top, cw, ch);
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
    emitPhoto(moderator, areaLeft, modTop, modW, modH);
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
      let spkW = n <= 3 ? 0.185 : Math.max(0.12, (spkAreaRight - spkAreaLeft - spkGap * (n - 1)) / n);
      let spkH = cardHfromW(spkW, 0.9); // portrait, un-squished
      if (spkH > bandH) { spkH = bandH; spkW = cardWfromH(spkH, 0.9); } // fit the band
      const step = n > 1 ? (spkAreaRight - spkAreaLeft - spkW) / (n - 1) : 0;
      const ascend = n > 1 ? (bandH - spkH) / (n - 1) : 0;
      speakerList.forEach((p, i) => {
        const cardLeft = spkAreaLeft + i * step;
        const cardBottom = spkBottom - i * ascend;
        const cardTop = cardBottom - spkH;
        const capMaxW = i < n - 1 ? Math.max(spkW, step * 0.9) : Math.max(spkW, spkAreaRight - cardLeft);
        const capH = captionHeight(p, 0.018, capMaxW);
        captionBlock(p, cardLeft, cardTop - 0.012 - capH, 0.018, capMaxW, `speaker-${i}`);
        emitPhoto(p, cardLeft, cardTop, spkW, spkH);
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
      const cols = total <= 3 ? total : total === 4 ? 2 : 3;
      const nameFrac = total <= 4 ? 0.024 : 0.02;
      const rows = Math.ceil(total / cols);
      const gapPx = 0.024 * W;
      const rowGapPx = 0.024 * H;
      const cellWpx = ((areaRight - areaLeft) * W - gapPx * (cols - 1)) / cols;
      const availHpx = ((peopleBottom - areaTop) * H - rowGapPx * (rows - 1)) / rows;
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
        emitPhoto(p, left, top, w, h);
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
    backgroundId: form.backgroundId || "orb5",
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
