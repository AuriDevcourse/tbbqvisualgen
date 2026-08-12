"use client";

import { ImagePlacer } from "@/components/ImagePlacer";
import type { CanvasImage } from "@/components/ImagePlacer";

interface StepImagesProps {
  canvasImages: CanvasImage[];
  selectedImageId: string | null;
  setSelectedImageId: (next: string | null) => void;
  addCanvasImage: (img: CanvasImage) => void;
  updateCanvasImage: (id: string, patch: Partial<CanvasImage>) => void;
  removeCanvasImage: (id: string) => void;
}

export function StepImages({
  canvasImages, selectedImageId, setSelectedImageId,
  addCanvasImage, updateCanvasImage, removeCanvasImage,
}: StepImagesProps) {
  // The photo background is managed in the Canvas step. Listing it here too
  // would offer radius / border / size controls that break its full-bleed fit.
  const placedImages = canvasImages.filter((ci) => !ci.isBackdrop);
  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-2">
        <span className="text-[10px] font-medium text-white/65 uppercase tracking-[0.18em]">Images on canvas</span>
        {canvasImages.length !== placedImages.length && (
          <p className="text-[10px] text-white/55">
            Your photo background is set in the Canvas step.
          </p>
        )}
        <ImagePlacer
          images={placedImages}
          selectedId={selectedImageId}
          onAdd={addCanvasImage}
          onUpdate={updateCanvasImage}
          onRemove={removeCanvasImage}
          onSelect={setSelectedImageId}
        />
      </section>
    </div>
  );
}
