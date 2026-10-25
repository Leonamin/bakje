import { useEffect, useState } from "react";
import { type ViewerImage } from "./viewer-image";

export function GalleryImage({ item }: { item: ViewerImage }) {
  const [hasError, setHasError] = useState(false);
  useEffect(() => setHasError(false), [item.src]);
  return hasError ? (
    <span className="gc-gallery-fallback">이미지 없음</span>
  ) : (
    <img src={item.src} alt="" onError={() => setHasError(true)} />
  );
}
