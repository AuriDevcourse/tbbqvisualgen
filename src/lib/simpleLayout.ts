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
    label: "",
    headline: "",
    subtitle: "",
    includeModerator: true,
    moderator: emptyPerson(),
    speakers: [emptyPerson(), emptyPerson(), emptyPerson()],
    backgroundId: "orb5",
  };
}

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
 * Build a TechBBQ panel visual from the simple form, matching the hand-made
 * house style: everything LEFT-aligned down the left margin — headline
 * (weight 600) + subtitle (weight 400) at the top, the session label as a
 * WHITE PILL with dark uppercase text, then a row of rounded-rectangle
 * portrait headshots (moderator first), each with name (600) + job title +
 * company (400) beneath it. Logo bottom-left. Photos become rounded images;
 * empty people get a rounded placeholder frame.
 */
export function buildSimpleDesign(form: SimpleForm, format: PlatformFormat): SimpleDoc {
  const dims = FORMAT_DIMENSIONS[format] ?? FORMAT_DIMENSIONS.square;
  const W = dims.width;
  const H = dims.height;

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
      fontSize: Math.round(sizeFrac * W),
      align: "left",
      weight: 600,
      font: "onest",
      ...opts,
    });
  };

  // Auto-fit a font so the longest line fits within `maxWfrac` of the canvas
  // width — text doesn't wrap (no max-width), so long headlines would overflow.
  const avail = 0.94 - MARGIN;
  const fitFont = (text: string, baseFrac: number, avgChar = 0.55): number => {
    const longest = Math.max(1, ...text.split("\n").map((l) => l.trim().length));
    const maxPx = (avail * W) / (longest * avgChar);
    return Math.min(baseFrac * W, maxPx) / W;
  };

  // ── Header: headline, subtitle, session label — flowed top-down so a
  // multi-line (manually broken) headline never collides with what follows. ──
  const lineCount = (s: string) => (s.trim() ? s.split("\n").length : 0);
  let cursorY = 0.115; // top edge of the header content block

  if (form.headline.trim()) {
    const f = fitFont(form.headline, 0.082);
    const blockH = lineCount(form.headline) * f;
    mkText(form.headline, MARGIN, cursorY + blockH / 2, f, { weight: 600, color: "#FFFFFF" });
    cursorY += blockH + 0.03;
  }
  if (form.subtitle.trim()) {
    // Smaller than before but higher-contrast so it stays readable.
    const f = fitFont(form.subtitle, 0.036);
    const blockH = lineCount(form.subtitle) * f;
    mkText(form.subtitle, MARGIN, cursorY + blockH / 2, f, { weight: 500, color: "rgba(255,255,255,0.95)" });
    cursorY += blockH + 0.028;
  }

  // ── Session label — a rounded-RECTANGLE chip (not a pill). Uses asymmetric
  // padding (text sits a touch left, with extra breathing room on the right)
  // and accounts for letter-spacing so the text never crowds the right edge. ──
  if (form.label.trim()) {
    const labelText = form.label.toUpperCase();
    const fsFrac = 0.036;
    const fsPx = fsFrac * W;
    const letterSpacingPx = Math.round(0.0016 * W);
    const padLeft = 0.03 * W;
    const padRight = 0.046 * W; // more padding on the right of the text
    const textWpx = labelText.length * fsPx * 0.66 + Math.max(0, labelText.length - 1) * letterSpacingPx;
    const chipHfrac = 0.062;
    const chipWfrac = Math.min((textWpx + padLeft + padRight) / W, 0.94);
    const chipY = cursorY + chipHfrac / 2;
    shapes.push({
      id: uid("shape"), type: "rectangle",
      x: MARGIN + chipWfrac / 2, y: chipY, width: chipWfrac, height: chipHfrac,
      fillType: "fill", strokeWidth: 0, colorType: "solid",
      color1: "#FFFFFF", color2: "#FF6B00", opacity: 1, blur: 0, rotation: 0,
      borderRadius: 0.22, // rounded rectangle, not a pill
    });
    // Vertically nudge the cap-height text to sit optically centred in the chip.
    mkText(labelText, MARGIN + padLeft / W, chipY - fsFrac * 0.06, fsFrac, {
      weight: 800, uppercase: true, color: "#15110E", letterSpacing: letterSpacingPx,
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
    mkText(role.toUpperCase(), left + 0.02, top + h - fsFrac * 0.95, fsFrac, {
      weight: 800, uppercase: true, color: "#FFFFFF",
      letterSpacing: Math.round(0.0012 * W),
      shadow: "0 2px 8px rgba(0,0,0,0.8), 0 0 3px rgba(0,0,0,0.9)",
    });
  };

  // Height of a name/title/company caption block (for above-anchored captions).
  const captionHeight = (p: SimplePerson, nameFrac: number): number => {
    const titleFrac = nameFrac * 0.72;
    let hgt = nameFrac;
    if (p.title.trim()) hgt += 0.006 + lineCount(p.title) * titleFrac;
    if (p.company.trim()) hgt += 0.004 + titleFrac;
    return hgt;
  };

  // Render a caption block downward from topY, left-aligned at x.
  const captionBlock = (p: SimplePerson, x: number, topY: number, nameFrac: number): void => {
    const titleFrac = nameFrac * 0.72;
    let ty = topY + nameFrac / 2;
    mkText(p.name, x, ty, nameFrac, { weight: 700, color: "#FFFFFF" });
    ty += nameFrac / 2;
    if (p.title.trim()) {
      ty += 0.006 + titleFrac / 2;
      mkText(p.title, x, ty, titleFrac, { weight: 400, color: "rgba(255,255,255,0.82)" });
      ty += titleFrac * (lineCount(p.title) - 0.5);
    }
    if (p.company.trim()) {
      ty += 0.004 + titleFrac / 2;
      mkText(p.company, x, ty, titleFrac, { weight: 500, color: "rgba(255,255,255,0.64)" });
    }
  };

  if (moderator) {
    // ── Panel layout (matches the hand-made "Panel Discussion" reference) ──
    // Big moderator card on the left with its caption to the RIGHT; speakers
    // step gradually UPWARD to the right, each with its caption ABOVE the card.
    const modW = 0.28;
    const modTop = areaTop + 0.01;
    const modH = Math.min(0.30, 0.80 - modTop); // portrait card, not squished
    emitPhoto(moderator, areaLeft, modTop, modW, modH);
    emitRoleLabel("Moderator", areaLeft, modTop, modW, modH, 0.019);
    const modCapX = areaLeft + modW + 0.03;
    // Moderator caption text is the SAME size as speakers' — the moderator is
    // emphasised by the bigger card, not bigger text (matches the reference).
    captionBlock(moderator, modCapX, modTop + 0.006, 0.02);

    const n = speakerList.length;
    if (n > 0) {
      const spkAreaLeft = modCapX;
      const spkAreaRight = areaRight;
      const spkGap = 0.02;
      const spkW = n <= 3 ? 0.185 : Math.max(0.12, (spkAreaRight - spkAreaLeft - spkGap * (n - 1)) / n);
      const spkH = (spkW * W) / 0.9 / H; // ~0.9 aspect (w:h) → portrait, un-squished
      const step = n > 1 ? (spkAreaRight - spkAreaLeft - spkW) / (n - 1) : 0;
      const bottomBase = 0.94;
      // Higher steps for later speakers so their captions clear the moderator
      // caption band; the first (leftmost) speaker sits lowest, under it.
      const ascend = Math.min(0.11, n > 1 ? (bottomBase - 0.48) / (n - 1) : 0);
      speakerList.forEach((p, i) => {
        const cardLeft = spkAreaLeft + i * step;
        const cardBottom = bottomBase - i * ascend;
        const cardTop = cardBottom - spkH;
        const capH = captionHeight(p, 0.018);
        captionBlock(p, cardLeft, cardTop - 0.014 - capH, 0.018);
        emitPhoto(p, cardLeft, cardTop, spkW, spkH);
        emitRoleLabel("Speaker", cardLeft, cardTop, spkW, spkH, 0.015);
      });
    }
  } else if (speakerList.length > 0) {
    // ── Speakers-only grid (matches the "Speakers" reference) ──
    // Up to 3 columns with captions overlaid on the photos, filling the height.
    const n = speakerList.length;
    const peopleBottom = 0.9;
    const cols = n <= 3 ? n : n === 4 ? 2 : 3;
    const nameFrac = n <= 4 ? 0.024 : 0.02;
    const rows = Math.ceil(n / cols);
    const gapPx = 0.024 * W;
    const rowGapPx = 0.02 * H;
    const cellWpx = ((areaRight - areaLeft) * W - gapPx * (cols - 1)) / cols;
    const availHpx = ((peopleBottom - areaTop) * H - rowGapPx * (rows - 1)) / rows;
    const photoWpx = cellWpx;
    const photoHpx = Math.max(cellWpx * 0.55, Math.min(availHpx, cellWpx * 1.28));
    speakerList.forEach((p, i) => {
      const c = i % cols;
      const r = Math.floor(i / cols);
      const left = areaLeft + (c * (cellWpx + gapPx)) / W;
      const top = areaTop + (r * (photoHpx + rowGapPx)) / H;
      const w = photoWpx / W;
      const h = photoHpx / H;
      emitPhoto(p, left, top, w, h);
      // Overlaid caption over a soft scrim, bottom-left.
      const titleFrac = nameFrac * 0.72;
      const secondary = [p.title.trim(), p.company.trim()].filter(Boolean).join(", ");
      const scrimH = nameFrac * 3.4;
      shapes.push({
        id: uid("shape"), type: "rectangle",
        x: left + w / 2, y: top + h - scrimH / 2, width: w, height: scrimH,
        fillType: "fill", strokeWidth: 0, colorType: "solid",
        color1: "rgba(0,0,0,0.55)", color2: "#000000", opacity: 1, blur: 0, rotation: 0,
        borderRadius: 0.08,
      });
      const padL = left + 0.016;
      let ty = top + h - (secondary ? titleFrac / 2 + 0.02 : 0.03);
      if (secondary) {
        mkText(secondary, padL, ty, titleFrac, { weight: 400, color: "rgba(255,255,255,0.88)" });
        ty -= titleFrac / 2 + nameFrac / 2 + 0.006;
      } else {
        ty -= nameFrac / 2;
      }
      mkText(p.name, padL, ty, nameFrac, { weight: 700, color: "#FFFFFF" });
    });
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
