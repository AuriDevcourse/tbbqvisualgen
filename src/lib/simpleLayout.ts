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
  moderator: SimplePerson;
  speakers: SimplePerson[];
  backgroundId: string;
}

export function emptyForm(): SimpleForm {
  return {
    label: "",
    headline: "",
    subtitle: "",
    moderator: emptyPerson(),
    speakers: [emptyPerson(), emptyPerson()],
    backgroundId: "orb5",
  };
}

const hasContent = (p: SimplePerson) => !!(p.name.trim() || p.company.trim() || p.title.trim() || p.photo);

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

  // ── Header: headline, subtitle ────────────────────────────────────────────
  mkText(form.headline, MARGIN, 0.145, fitFont(form.headline, 0.078), { weight: 600, color: "#FFFFFF" });
  mkText(form.subtitle, MARGIN, 0.255, fitFont(form.subtitle, 0.042), { weight: 400, color: "rgba(255,255,255,0.82)" });

  // ── Session label as a white pill with dark uppercase text ────────────────
  if (form.label.trim()) {
    const labelText = form.label.toUpperCase();
    const fsFrac = 0.038;
    const fsPx = fsFrac * W;
    const padX = 0.026 * W; // horizontal padding inside the pill
    const textWpx = labelText.length * fsPx * 0.62; // rough uppercase-bold width
    const pillWfrac = Math.min((textWpx + padX * 2) / W, 0.9);
    const pillHfrac = 0.058;
    const pillY = 0.35;
    shapes.push({
      id: uid("shape"),
      type: "rectangle",
      x: MARGIN + pillWfrac / 2, // center-anchored → left edge at MARGIN
      y: pillY,
      width: pillWfrac,
      height: pillHfrac,
      fillType: "fill",
      strokeWidth: 0.004,
      colorType: "solid",
      color1: "#FFFFFF",
      color2: "#FF6B00",
      opacity: 1,
      blur: 0,
      rotation: 0,
      borderRadius: 0.5, // pill
    });
    mkText(labelText, MARGIN + padX / W, pillY, fsFrac, {
      weight: 700,
      uppercase: true,
      color: "#15110E",
      letterSpacing: Math.round(0.002 * W),
    });
  }

  // ── People row: moderator first, then speakers ────────────────────────────
  const people: SimplePerson[] = [];
  if (hasContent(form.moderator)) people.push(form.moderator);
  for (const s of form.speakers) if (hasContent(s)) people.push(s);

  const count = people.length;
  if (count > 0) {
    const rowLeft = MARGIN;
    const rowW = 0.94 - rowLeft;
    const cell = rowW / count;
    // Portrait card ~0.78 aspect (width:height), like the hand-made layout.
    // Sized by cell width, but the HEIGHT is capped so the photo + the three
    // text lines always clear the logo — otherwise a wide/short canvas (16:9)
    // makes the cards tall enough to push names off the bottom.
    let photoWpx = Math.min(cell * 0.82 * W, 0.2 * W);
    let photoHpx = photoWpx / 0.78;
    const maxPhotoHpx = 0.28 * H;
    if (photoHpx > maxPhotoHpx) { photoHpx = maxPhotoHpx; photoWpx = photoHpx * 0.78; }
    const wFrac = photoWpx / W;
    const hFrac = photoHpx / H;
    const photoTop = 0.46;
    const cy = photoTop + hFrac / 2;

    people.forEach((p, i) => {
      const cx = rowLeft + cell * i + wFrac / 2; // left-packed in each cell
      const leftEdge = cx - wFrac / 2;

      if (p.photo) {
        canvasImages.push({
          id: uid("img"),
          src: p.photo,
          x: cx,
          y: cy,
          width: wFrac,
          height: hFrac,
          cornerRadius: 12,
          border: false,
          fit: "cover",
          naturalWidth: p.naturalWidth,
          naturalHeight: p.naturalHeight,
        });
      } else {
        shapes.push({
          id: uid("shape"),
          type: "rectangle",
          x: cx,
          y: cy,
          width: wFrac,
          height: hFrac,
          fillType: "outline",
          strokeWidth: 0.004,
          colorType: "solid",
          color1: "rgba(255,255,255,0.28)",
          color2: "#FF6B00",
          opacity: 1,
          blur: 0,
          rotation: 0,
          borderRadius: 0.12,
        });
      }

      // Name + title + company beneath, left-aligned to the photo's left edge.
      let ty = cy + hFrac / 2 + 0.035;
      mkText(p.name, leftEdge, ty, 0.021, { weight: 700, color: "#FFFFFF" });
      ty += 0.032;
      mkText(p.title, leftEdge, ty, 0.016, { weight: 400, color: "rgba(255,255,255,0.78)" });
      const titleLines = p.title.trim() ? p.title.split("\n").length : 0;
      ty += 0.026 * Math.max(1, titleLines);
      mkText(p.company, leftEdge, ty, 0.016, { weight: 500, color: "rgba(255,255,255,0.6)" });
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
