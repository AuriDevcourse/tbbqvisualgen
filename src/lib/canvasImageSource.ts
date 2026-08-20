import type { CanvasImage } from "@/components/ImagePlacer";
import type { LoadedImage } from "./photoBackground";

/**
 * Swap the PICTURE inside an existing image box, keeping the box.
 *
 * WHY THIS EXISTS: the only way to change a picture used to be remove-then-add.
 * That threw away everything about the box — position, size, corner radius,
 * border colour and stroke, fit mode, padding, backdrop, opacity, scrim, group
 * — and dropped a fresh 35%-wide image at canvas centre. On a template where
 * three headshots sit in styled frames, changing one face meant rebuilding it.
 *
 * So this returns a PATCH, not a new image: every field it does not name keeps
 * whatever the box already had.
 *
 * `crop` is the one thing that cannot survive, and is explicitly cleared. A
 * crop rect is stored in fractions of the SOURCE image, so carrying it to a
 * different photo crops an arbitrary window of it — and the zoom control is
 * built on the same rect, so a stale one shows the new photo at a random
 * magnification. Cleared means the new picture cover-fits the same frame,
 * which is what "put this picture in that box" should do.
 */
export function replaceSourcePatch(loaded: LoadedImage): Partial<CanvasImage> {
  return {
    src: loaded.dataUrl,
    naturalWidth: loaded.naturalWidth,
    naturalHeight: loaded.naturalHeight,
    crop: undefined,
  };
}

/** Apply {@link replaceSourcePatch} to one image in a list, by id. */
export function replaceSourceIn(
  images: CanvasImage[],
  id: string,
  loaded: LoadedImage,
): CanvasImage[] {
  return images.map((img) => (img.id === id ? { ...img, ...replaceSourcePatch(loaded) } : img));
}
