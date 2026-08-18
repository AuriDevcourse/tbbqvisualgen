import type { PresetVariant } from "@/data/presets";
import type { DesignConfig, PlatformFormat } from "@/types/template";
import type { CanvasImage } from "@/components/ImagePlacer";

/**
 * Shapes stored in the shared editor library. They live here rather than in the
 * hooks that use them because lib/sharedEditorLibrary needs them too, and
 * importing them from the hooks would make the module graph circular.
 */

/** A saved template — full document snapshot + a thumbnail dataURL. */
export interface SavedTemplate {
  id: string;
  name: string;
  /** ms since epoch. */
  createdAt: number;
  thumbnail?: string;
  doc: {
    format: PlatformFormat;
    customSize: { width: number; height: number };
    design: DesignConfig;
    canvasImages: CanvasImage[];
  };
}

/** Customisations layered on a BUILT-IN preset. Built-ins ship in source and
 *  can't be mutated, so renames, folder moves and format variants live in this
 *  block instead, keyed by the built-in's id. */
export interface PresetOverride {
  name?: string;
  /** Team-saved format-specific layouts. Layered on top of (and winning over)
   *  the preset's own `variants` map at load time. */
  variants?: Partial<Record<PlatformFormat, PresetVariant>>;
  /** Override for the preset's folder/group, set when someone moves a built-in
   *  preset to a different folder via the UI. */
  group?: string;
}
