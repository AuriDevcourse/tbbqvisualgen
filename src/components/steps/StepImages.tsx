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
  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-2">
        <span className="text-[10px] font-medium text-white/65 uppercase tracking-[0.18em]">Images on canvas</span>
        <ImagePlacer
          images={canvasImages}
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
