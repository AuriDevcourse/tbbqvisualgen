import type { CanvasImage } from "@/components/ImagePlacer";

/** Upload guards, shared by every image entry point so the limits (and the
 *  error wording) stay identical wherever a file is picked. */
export const PHOTO_MAX_BYTES = 10 * 1024 * 1024;
export const PHOTO_ACCEPT = "image/png,image/jpeg,image/webp";
const ALLOWED_TYPES = new Set(PHOTO_ACCEPT.split(","));

export interface LoadedImage {
  dataUrl: string;
  naturalWidth: number;
  naturalHeight: number;
}

/**
 * Read a picked file into a dataURL plus its natural pixel size.
 * Rejects with a user-facing message when the type or size is wrong — the
 * type check runs on the actual File.type, not the input's `accept` attribute
 * (which a drag-and-drop bypasses).
 */
export function readImageFile(file: File): Promise<LoadedImage> {
  return new Promise((resolve, reject) => {
    if (!ALLOWED_TYPES.has(file.type)) {
      reject(new Error(`"${file.name}" is not a PNG, JPG or WebP`));
      return;
    }
    if (file.size > PHOTO_MAX_BYTES) {
      reject(new Error(`"${file.name}" is too large — max 10MB`));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`Could not read "${file.name}"`));
    reader.onload = (e) => {
      const dataUrl = e.target?.result;
      if (typeof dataUrl !== "string") {
        reject(new Error(`Could not read "${file.name}"`));
        return;
      }
      const img = new Image();
      img.onerror = () => reject(new Error(`"${file.name}" is not a readable image`));
      img.onload = () => resolve({ dataUrl, naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight });
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}

/** Default bottom-darkening for a photo background. Strong enough that white
 *  text over a bright stage shot still clears 4.5:1, gentle enough that the
 *  photo doesn't look muddy. */
export const DEFAULT_SCRIM = 0.55;

/**
 * A photo that covers the whole canvas and sits below every other layer.
 * `isBackdrop` is what marks it: the layer stack pins those to the bottom and
 * the canvas step shows it as "the background" instead of an ordinary photo.
 * Sharp corners and cover-fit, so it reads as the background rather than a
 * card floating on one.
 */
export function makePhotoBackground(loaded: LoadedImage): CanvasImage {
  return {
    id: `bg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    src: loaded.dataUrl,
    x: 0.5,
    y: 0.5,
    width: 1,
    height: 1,
    cornerRadius: 0,
    border: false,
    fit: "cover",
    naturalWidth: loaded.naturalWidth,
    naturalHeight: loaded.naturalHeight,
    isBackdrop: true,
    scrimBottom: DEFAULT_SCRIM,
  };
}
