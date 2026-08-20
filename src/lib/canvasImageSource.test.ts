import { describe, expect, it } from "vitest";
import type { CanvasImage } from "@/components/ImagePlacer";
import { replaceSourceIn, replaceSourcePatch } from "@/lib/canvasImageSource";

const loaded = { dataUrl: "data:image/png;base64,NEW", naturalWidth: 1200, naturalHeight: 800 };

/** A framed headshot mid-template: every field below is a deliberate choice
 *  the user made, and every one of them has to survive a picture swap. */
const framed: CanvasImage = {
  id: "img-1",
  src: "data:image/png;base64,OLD",
  x: 0.72,
  y: 0.68,
  width: 0.13,
  height: 0.26,
  cornerRadius: 8,
  border: true,
  borderColor: "#FFFFFF",
  borderWidth: 1 / 1500,
  fit: "cover",
  padding: 0.01,
  backdropColor: "#101010",
  backdropBlur: 0.004,
  opacity: 0.9,
  scrimBottom: 0.4,
  naturalWidth: 400,
  naturalHeight: 400,
  simpleRole: "logo-0",
  groupId: "g1",
  locked: true,
  crop: { x: 0.1, y: 0.1, width: 0.5, height: 0.5 },
};

describe("replaceSourcePatch", () => {
  it("names only the source fields, so the box is untouched", () => {
    expect(Object.keys(replaceSourcePatch(loaded)).sort()).toEqual([
      "crop", "naturalWidth", "naturalHeight", "src",
    ].sort());
  });

  it("clears the crop — the old rect is in fractions of the OLD source", () => {
    expect(replaceSourcePatch(loaded).crop).toBeUndefined();
  });

  it("carries the new source's pixel size, not the old one", () => {
    const patch = replaceSourcePatch(loaded);
    expect([patch.naturalWidth, patch.naturalHeight]).toEqual([1200, 800]);
  });
});

describe("replaceSourceIn", () => {
  it("keeps every styling property of the frame", () => {
    const [next] = replaceSourceIn([framed], "img-1", loaded);
    expect(next.src).toBe(loaded.dataUrl);
    // The frame, verbatim.
    expect([next.x, next.y, next.width, next.height]).toEqual([0.72, 0.68, 0.13, 0.26]);
    expect(next.border).toBe(true);
    expect(next.borderColor).toBe("#FFFFFF");
    expect(next.borderWidth).toBe(1 / 1500);
    expect(next.cornerRadius).toBe(8);
    expect(next.fit).toBe("cover");
    expect(next.padding).toBe(0.01);
    expect(next.backdropColor).toBe("#101010");
    expect(next.backdropBlur).toBe(0.004);
    expect(next.opacity).toBe(0.9);
    expect(next.scrimBottom).toBe(0.4);
    expect(next.simpleRole).toBe("logo-0");
    expect(next.groupId).toBe("g1");
    expect(next.locked).toBe(true);
    // The id has to survive too, or selection and layer order break.
    expect(next.id).toBe("img-1");
  });

  it("leaves other images alone", () => {
    const other: CanvasImage = { ...framed, id: "img-2", src: "data:image/png;base64,OTHER" };
    const out = replaceSourceIn([framed, other], "img-1", loaded);
    expect(out[1]).toBe(other);
  });

  it("is a no-op when the id is not on the canvas", () => {
    const out = replaceSourceIn([framed], "nope", loaded);
    expect(out[0]).toBe(framed);
  });
});
