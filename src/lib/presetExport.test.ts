import { describe, it, expect } from "vitest";
import { buildPresetFromDoc } from "./presetExport";
import { PRESETS, resolvePresetForFormat, type Preset } from "@/data/presets";
import { uniqueShapeIds, type DesignConfig } from "@/types/template";
import type { CanvasImage } from "@/components/ImagePlacer";

/** Every snapshot a preset can load: its default block plus each variant. */
function snapshots(p: Preset): { label: string; design: DesignConfig }[] {
  const out = [{ label: `${p.id}/default`, design: p.design }];
  for (const [format, v] of Object.entries(p.variants ?? {})) {
    if (v) out.push({ label: `${p.id}/${format}`, design: v.design });
  }
  return out;
}

function duplicateIds(ids: string[]): string[] {
  const seen = new Set<string>();
  const dupes = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) dupes.add(id);
    seen.add(id);
  }
  return [...dupes];
}

/**
 * Shape ids have to be unique WITHIN a snapshot, because that is what
 * `replacePlaceholderWithImage` looks a clicked placeholder up by. Two shapes
 * sharing an id means clicking the second one finds the FIRST one's
 * coordinates, so the photo lands in the wrong rectangle and both rectangles
 * vanish — the "it adds a new image, not inside" bug.
 */
describe("shape id uniqueness", () => {
  it("holds for every built-in preset snapshot", () => {
    const offenders: string[] = [];
    for (const p of PRESETS) {
      for (const { label, design } of snapshots(p)) {
        const dupes = duplicateIds((design.shapes ?? []).map((s) => s.id));
        if (dupes.length) offenders.push(`${label}: ${dupes.join(", ")}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

const IMG = (id: string, x: number): CanvasImage => ({
  id,
  src: "data:image/png;base64,AAAA",
  x,
  y: 0.5,
  width: 0.2,
  height: 0.2,
  border: false,
});

describe("buildPresetFromDoc", () => {
  /**
   * The regression this file exists for. Load a 4-slot panel preset, fill the
   * last two slots with photos, save it back as a preset: the two leftover
   * placeholder shapes still carry `shape-placeholder-1` and `-2`, and the two
   * photos were converted to placeholders numbered from 1 again.
   */
  it("does not reuse an id already taken by a leftover placeholder shape", () => {
    const design = {
      shapes: [
        { id: "shape-placeholder-1", type: "rectangle", x: 0.1, y: 0.5, width: 0.2, height: 0.2, fillType: "fill", strokeWidth: 0.004, colorType: "solid", color1: "#fff", color2: "#000", opacity: 1, blur: 0, rotation: 0, imagePlaceholder: { label: "PHOTO" } },
        { id: "shape-placeholder-2", type: "rectangle", x: 0.3, y: 0.5, width: 0.2, height: 0.2, fillType: "fill", strokeWidth: 0.004, colorType: "solid", color1: "#fff", color2: "#000", opacity: 1, blur: 0, rotation: 0, imagePlaceholder: { label: "PHOTO" } },
      ],
    } as unknown as DesignConfig;

    const preset = buildPresetFromDoc(
      { format: "square", customSize: { width: 1500, height: 1500 }, design, canvasImages: [IMG("img-a", 0.6), IMG("img-b", 0.8)] },
      { id: "user-1", name: "n", description: "d" },
    );

    const ids = (preset.design.shapes ?? []).map((s) => s.id);
    expect(duplicateIds(ids)).toEqual([]);
    expect(ids).toHaveLength(4);
  });

  it("keeps each new placeholder at its source image's position", () => {
    const design = { shapes: [] } as unknown as DesignConfig;
    const preset = buildPresetFromDoc(
      { format: "square", customSize: { width: 1500, height: 1500 }, design, canvasImages: [IMG("img-a", 0.25), IMG("img-b", 0.75)] },
      { id: "user-1", name: "n", description: "d" },
    );
    expect((preset.design.shapes ?? []).map((s) => s.x)).toEqual([0.25, 0.75]);
    expect(preset.canvasImages).toEqual([]);
  });
});

const SLOT = (id: string, x: number) => ({
  id,
  type: "rectangle",
  x,
  y: 0.5,
  width: 0.2,
  height: 0.2,
  fillType: "fill",
  strokeWidth: 0.004,
  colorType: "solid",
  color1: "#fff",
  color2: "#000",
  opacity: 1,
  blur: 0,
  rotation: 0,
  imagePlaceholder: { label: "PHOTO" },
});

describe("uniqueShapeIds", () => {
  it("keeps the first occurrence and renames the rest", () => {
    const { shapes, renamed } = uniqueShapeIds([{ id: "a" }, { id: "a" }, { id: "a" }, { id: "b" }]);
    expect(shapes.map((s) => s.id)).toEqual(["a", "a-2", "a-3", "b"]);
    expect(renamed.get(1)).toEqual({ from: "a", to: "a-2" });
    expect(renamed.has(0)).toBe(false);
  });

  it("skips a suffix that is itself already taken", () => {
    const { shapes } = uniqueShapeIds([{ id: "a" }, { id: "a-2" }, { id: "a" }]);
    expect(shapes.map((s) => s.id)).toEqual(["a", "a-2", "a-3"]);
  });

  it("returns the same array contents when there is nothing to fix", () => {
    const { shapes, renamed } = uniqueShapeIds([{ id: "a" }, { id: "b" }]);
    expect(shapes.map((s) => s.id)).toEqual(["a", "b"]);
    expect(renamed.size).toBe(0);
  });
});

/**
 * Presets already sitting in the shared library carry the duplicate ids the old
 * `buildPresetFromDoc` minted, so the repair has to happen when they load.
 * Without this, the person who reported the bug would have to re-save every
 * preset they had built.
 */
describe("resolvePresetForFormat repairs saved presets", () => {
  const broken = (shapes: unknown[]): Preset => ({
    id: "user-broken",
    name: "broken",
    description: "d",
    format: "square",
    customSize: { width: 1500, height: 1500 },
    design: { shapes } as unknown as DesignConfig,
    canvasImages: [],
  });

  it("de-duplicates shape ids coming out of a preset's default block", () => {
    const resolved = resolvePresetForFormat(broken([SLOT("shape-placeholder-1", 0.2), SLOT("shape-placeholder-1", 0.8)]), "square");
    const ids = (resolved.design.shapes ?? []).map((s) => s.id);
    expect(ids).toEqual(["shape-placeholder-1", "shape-placeholder-1-2"]);
    // The second slot must keep its OWN geometry — using the first one's is the
    // bug: the photo lands in the wrong rectangle.
    expect((resolved.design.shapes ?? []).map((s) => s.x)).toEqual([0.2, 0.8]);
  });

  it("de-duplicates inside a variant and inside a saved override", () => {
    const p = broken([SLOT("s-1", 0.1)]);
    p.variants = { presentation: { customSize: { width: 1920, height: 1080 }, design: { shapes: [SLOT("s-1", 0.2), SLOT("s-1", 0.9)] } as unknown as DesignConfig, canvasImages: [] } };
    expect((resolvePresetForFormat(p, "presentation").design.shapes ?? []).map((s) => s.id)).toEqual(["s-1", "s-1-2"]);

    const override = { customSize: { width: 1500, height: 1500 }, design: { shapes: [SLOT("s-9", 0.2), SLOT("s-9", 0.7)] } as unknown as DesignConfig, canvasImages: [] };
    expect((resolvePresetForFormat(p, "square", { square: override }).design.shapes ?? []).map((s) => s.id)).toEqual(["s-9", "s-9-2"]);
  });

  it("leaves a clean preset untouched", () => {
    const p = broken([SLOT("a", 0.2), SLOT("b", 0.8)]);
    expect(resolvePresetForFormat(p, "square").design).toBe(p.design);
  });
});

describe("buildPresetFromDoc layerOrder", () => {
  it("points each photo's layer entry at the placeholder that replaced it", () => {
    const design = {
      shapes: [SLOT("shape-placeholder-1", 0.1)],
      layerOrder: ["overlay", "image:img-a", "shape:shape-placeholder-1", "tbbqLogo"],
    } as unknown as DesignConfig;

    const preset = buildPresetFromDoc(
      { format: "square", customSize: { width: 1500, height: 1500 }, design, canvasImages: [IMG("img-a", 0.6)] },
      { id: "user-1", name: "n", description: "d" },
    );

    // img-a became the renamed placeholder, and keeps its slot in the stack.
    expect(preset.design.layerOrder).toEqual([
      "overlay",
      "shape:shape-placeholder-1-2",
      "shape:shape-placeholder-1",
      "tbbqLogo",
    ]);
    expect((preset.design.shapes ?? []).map((s) => s.id)).toEqual([
      "shape-placeholder-1",
      "shape-placeholder-1-2",
    ]);
  });
});
