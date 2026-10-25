import { useRef, useState } from "react";
import { Button } from "../basic/button";
import { ImageViewer, type ViewerImage } from "./image-viewer";
import { GalleryImage } from "./gallery-image";

export function ImageGallery({ images }: { images: ViewerImage[] }) {
  const [index, setIndex] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  return (
    <div>
      <div className="gc-image-gallery">
        {images.map((item, imageIndex) => (
          <Button
            className="gc-gallery-item"
            key={item.id}
            onClick={(e) => {
              triggerRef.current = e.currentTarget;
              setIndex(imageIndex);
              setIsOpen(true);
            }}
          >
            <GalleryImage item={item} />
            <span>{item.alt}</span>
          </Button>
        ))}
      </div>
      <ImageViewer
        images={images}
        index={index}
        onIndexChange={setIndex}
        isOpen={isOpen}
        onOpenChange={(next) => {
          setIsOpen(next);
          if (!next) requestAnimationFrame(() => triggerRef.current?.focus());
        }}
      />
    </div>
  );
}
