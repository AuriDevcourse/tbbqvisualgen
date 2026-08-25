import type { CanvasImage } from "@/components/ImagePlacer";

/** Upload guards, shared by every image entry point so the limits (and the
 *  error wording) stay identical wherever a file is picked. */
export const PHOTO_MAX_BYTES = 10 * 1024 * 1024;
export const PHOTO_ACCEPT = "image/png,image/jpeg,image/webp";
const ALLOWED_TYPES = new Set(PHOTO_ACCEPT.split(","));

export interface LoadedImage {
  /**
   * What goes into `CanvasImage.src`. Either a Blob URL (~57 chars) or, when
   * the upload is refused or fails, a base64 data URL as before.
   *
   * Both forms must keep working indefinitely: templates saved before
   * 2026-08-25 hold data URLs, and an anonymous visitor still produces them.
   * Nothing downstream may assume one or the other.
   */
  dataUrl: string;
  naturalWidth: number;
  naturalHeight: number;
}

/**
 * Store the photo and return its URL, so the saved document carries a pointer
 * instead of ~33% inflated base64.
 *
 * Throws on any refusal — including the 401 an anonymous visitor gets — and the
 * caller falls back to the data URL. That fallback is what keeps the auth gate
 * invisible: a signed-out user gets exactly today's behaviour, with the photo
 * living only in their own session.
 */
async function uploadPhoto(file: File): Promise<string> {
  const res = await fetch("/api/photo", {
    method: "POST",
    headers: { "Content-Type": file.type },
    body: file,
  });
  if (!res.ok) throw new Error(`upload refused: ${res.status}`);
  const { url } = await res.json();
  if (typeof url !== "string" || !url) throw new Error("upload returned no url");
  return url;
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
      img.onload = () => {
        const size = { naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight };
        // Decode first, upload second: a corrupt file is rejected by the <img>
        // above before it can occupy paid storage. Any upload failure resolves
        // with the data URL rather than rejecting, because a working photo the
        // expensive way beats an error message.
        uploadPhoto(file)
          .then((url) => resolve({ dataUrl: url, ...size }))
          .catch(() => resolve({ dataUrl, ...size }));
      };
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
