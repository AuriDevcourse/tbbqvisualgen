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

/**
 * Build a TechBBQ panel visual from the simple form: label + headline +
 * subtitle at the top, a centered row of headshots (moderator + speakers)
 * each with role · name · title · company, and the logo bottom-center. Photos
 * become circular CanvasImages; people without a photo get a placeholder ring.
 */
export function buildSimpleDesign(form: SimpleForm, format: PlatformFormat): SimpleDoc {
  const dims = FORMAT_DIMENSIONS[format] ?? FORMAT_DIMENSIONS.square;
  const W = dims.width;
  const H = dims.height;
  const u = W; // font/size unit — text scales with canvas width

  const texts: TextElement[] = [];
  const shapes: ShapeElement[] = [];
  const canvasImages: CanvasImage[] = [];

  const mkText = (
    content: string,
    x: number,
    y: number,
    sizeFrac: number,
    opts: Partial<TextElement> = {},
  ): void => {
    if (!content.trim()) return;
    texts.push({
      id: uid("text"),
      content,
      position: { x, y },
      fontSize: Math.round(sizeFrac * u),
      align: "center",
      weight: 700,
      font: "onest",
      ...opts,
    });
  };

  // ── Header block ──────────────────────────────────────────────────────────
  mkText(form.label.toUpperCase(), 0.5, 0.11, 0.022, {
    weight: 700,
    gradient: true,
    letterSpacing: Math.round(0.004 * u),
  });
  mkText(form.headline, 0.5, 0.19, 0.07, { weight: 800 });
  mkText(form.subtitle, 0.5, 0.27, 0.03, { weight: 500, color: "rgba(255,255,255,0.8)" });

  // ── People row ──────────────────────────────────────────────────────────
  const people: (SimplePerson & { role: string })[] = [];
  if (hasContent(form.moderator)) people.push({ ...form.moderator, role: "MODERATOR" });
  for (const s of form.speakers) if (hasContent(s)) people.push({ ...s, role: "SPEAKER" });

  const count = people.length;
  if (count > 0) {
    const rowSpan = 0.86;
    const slot = rowSpan / count;
    // Circle diameter in px, then back to per-axis fractions so it's a true
    // circle regardless of canvas aspect ratio.
    const dPx = Math.min(slot * 0.62 * W, 0.2 * W, 0.34 * H);
    const wFrac = dPx / W;
    const hFrac = dPx / H;
    const photoCy = 0.54;
    const top = photoCy - hFrac / 2;
    const bottom = photoCy + hFrac / 2;

    people.forEach((p, i) => {
      const cx = (1 - rowSpan) / 2 + slot * (i + 0.5);

      if (p.photo) {
        canvasImages.push({
          id: uid("img"),
          src: p.photo,
          x: cx,
          y: photoCy,
          width: wFrac,
          height: hFrac,
          cornerRadius: 50,
          border: true,
          fit: "cover",
          naturalWidth: p.naturalWidth,
          naturalHeight: p.naturalHeight,
        });
      } else {
        shapes.push({
          id: uid("shape"),
          type: "circle",
          x: cx,
          y: photoCy,
          width: wFrac,
          height: hFrac,
          fillType: "fill",
          strokeWidth: 0.003,
          colorType: "solid",
          color1: "rgba(255,255,255,0.10)",
          color2: "#FF6B00",
          opacity: 1,
          blur: 0,
          rotation: 0,
        });
      }

      // Role tag above the photo; name/title/company below.
      mkText(p.role, cx, top - 0.03, 0.013, { weight: 700, gradient: true, letterSpacing: Math.round(0.003 * u) });
      let ty = bottom + 0.045;
      mkText(p.name, cx, ty, 0.019, { weight: 800 });
      ty += 0.032;
      mkText(p.title, cx, ty, 0.0135, { weight: 500, color: "rgba(255,255,255,0.78)" });
      ty += 0.026;
      mkText(p.company, cx, ty, 0.0135, { weight: 600, color: "rgba(255,255,255,0.6)" });
    });
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
