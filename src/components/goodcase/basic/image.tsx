import { useState, useEffect } from "react";

export function Image({
  src,
  alt,
  aspectRatio = "4 / 3",
  className = "",
}: {
  src: string;
  alt: string;
  aspectRatio?: string;
  className?: string;
}) {
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  useEffect(() => {
    setHasError(false);
    setIsLoaded(false);
  }, [src]);
  return (
    <div className={`gc-image ${className}`} style={{ aspectRatio }}>
      {hasError ? (
        <span
          role="img"
          aria-label={alt ? `${alt} — 이미지 로드 실패` : "이미지 로드 실패"}
        >
          이미지를 불러올 수 없어요
        </span>
      ) : (
        <>
          <img
            src={src}
            alt={alt}
            onError={() => setHasError(true)}
            onLoad={() => setIsLoaded(true)}
          />
          {!isLoaded && (
            <span className="gc-image-placeholder" aria-hidden="true">
              불러오는 중
            </span>
          )}
        </>
      )}
    </div>
  );
}
