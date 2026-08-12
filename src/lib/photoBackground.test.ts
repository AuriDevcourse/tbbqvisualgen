import { describe, expect, it } from "vitest";
import { reconcileLayerOrder, splitImageLayerIds } from "@/types/template";
import { DEFAULT_SCRIM, makePhotoBackground } from "@/lib/photoBackground";

const loaded = { dataUrl: "data:image/png;base64,AAAA", naturalWidth: 900, naturalHeight: 600 };

describe("makePhotoBackground", () => {
  it("covers the whole canvas with sharp corners", () => {
    const bg = makePhotoBackground(loaded);
    expect([bg.x, bg.y, bg.width, bg.height]).toEqual([0.5, 0.5, 1, 1]);
    expect(bg.fit).toBe("cover");
    expect(bg.cornerRadius).toBe(0);
    expect(bg.border).toBe(false);
  });

  it("marks itself as the backdrop and carries a readability scrim", () => {
    const bg = makePhotoBackground(loaded);
    expect(bg.isBackdrop).toBe(true);
    expect(bg.scrimBottom).toBe(DEFAULT_SCRIM);
  });

  it("keeps the source pixel size for the crop editor", () => {
    const bg = makePhotoBackground(loaded);
    expect([bg.naturalWidth, bg.naturalHeight]).toEqual([900, 600]);
  });
});

describe("splitImageLayerIds", () => {
  it("separates backdrops from ordinary photos, preserving order", () => {
    const { backdrops, photos } = splitImageLayerIds([
      { id: "a" },
      { id: "bg-1", isBackdrop: true },
      { id: "b" },
    ]);
    expect(backdrops).toEqual(["image:bg-1"]);
    expect(photos).toEqual(["image:a", "image:b"]);
  });

  it("handles an undefined list", () => {
    expect(splitImageLayerIds(undefined)).toEqual({ backdrops: [], photos: [] });
  });
});

describe("default stack with a photo background", () => {
  // Mirrors DynamicTemplate's defaultOrder: backdrops sit below the accents and
  // the color overlay, so text and the logo always land on top of the photo.
  const buildDefaultOrder = (images: { id: string; isBackdrop?: boolean }[], textIds: string[]) => {
    const { backdrops, photos } = splitImageLayerIds(images);
    return [...backdrops, "overlay", ...photos, ...textIds.map((t) => `text:${t}`), "tbbqLogo"];
  };

  it("puts the photo background at the very bottom", () => {
    const order = buildDefaultOrder([{ id: "bg-1", isBackdrop: true }, { id: "head" }], ["t1"]);
    expect(order).toEqual(["image:bg-1", "overlay", "image:head", "text:t1", "tbbqLogo"]);
  });

  it("keeps text above the photo after reconciling a stored order", () => {
    const stored = ["overlay", "text:t1", "tbbqLogo"]; // saved before any photo existed
    const order = reconcileLayerOrder(
      stored,
      buildDefaultOrder([{ id: "bg-1", isBackdrop: true }], ["t1"]),
    );
    expect(order.indexOf("image:bg-1")).toBeLessThan(order.indexOf("text:t1"));
    expect(order.indexOf("image:bg-1")).toBeLessThan(order.indexOf("tbbqLogo"));
  });
});
