import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Dialog } from "../overlays/dialog";
import { Button } from "../basic/button";
import { GalleryImage } from "./gallery-image";
import { useViewerGesture } from "./use-viewer-gesture";
import { type ViewerImage } from "./viewer-image";
export type { ViewerImage } from "./viewer-image";
export function ImageViewer({
  images,
  index,
  isOpen,
  onOpenChange,
  onIndexChange,
  trigger,
  isAnimated = true,
}: {
  images: ViewerImage[];
  index: number;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onIndexChange: (index: number) => void;
  trigger?: ReactNode;
  isAnimated?: boolean;
}) {
  const [state, setState] = useState<"loading" | "success" | "error" | "empty">(
    "loading",
  );
  const [retry, setRetry] = useState(0);
  const closeRef = useRef<HTMLButtonElement>(null);
  const filmstripRef = useRef<HTMLDivElement>(null);
  const current = images[index];
  const {
    zoom,
    position,
    shouldAnimate,
    viewportRef,
    trackRef,
    imageRef,
    changeZoom,
    viewerProps,
    viewportProps,
  } = useViewerGesture({
    current,
    index,
    imageCount: images.length,
    isOpen,
    isAnimated,
    hasLoadedImage: state === "success",
    onIndexChange,
    onOpenChange,
  });
  useLayoutEffect(() => {
    setState(current ? "loading" : "empty");
  }, [current?.src, current?.id, index, isOpen]);
  useEffect(() => {
    if (!isOpen || !current) return;
    const image = imageRef.current;
    if (image?.complete) setState(image.naturalWidth > 0 ? "success" : "error");
  }, [current?.src, current?.id, index, isOpen, retry]);
  useEffect(() => {
    if (isOpen)
      filmstripRef.current
        ?.querySelector<HTMLElement>('[aria-current="true"]')
        ?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [index, isOpen]);
  return (
    <Dialog
      trigger={trigger}
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title="이미지 보기"
      description={current?.alt || "이미지 없음"}
      initialFocusRef={closeRef}
      className="gc-viewer-dialog"
    >
      <div
        className="gc-viewer"
        {...viewerProps}
        data-animated={shouldAnimate}
        data-viewer-blank
      >
        <div className="gc-viewer-toolbar">
          <span className="gc-viewer-counter" aria-live="polite">
            {current ? index + 1 : 0} / {images.length}
          </span>
          <div className="gc-viewer-tools">
            <Button
              variant="secondary"
              disabled={zoom <= 1 || state !== "success"}
              aria-label="축소"
              onClick={() => changeZoom(zoom - 0.5)}
            >
              −
            </Button>
            <span className="gc-viewer-zoom">{Math.round(zoom * 100)}%</span>
            <Button
              variant="secondary"
              disabled={zoom >= 4 || state !== "success"}
              aria-label="확대"
              onClick={() => changeZoom(zoom + 0.5)}
            >
              +
            </Button>
            <Button variant="secondary" onClick={() => changeZoom(1)}>
              초기화
            </Button>
            <span className="gc-viewer-toolbar-divider" />
            <Button
              ref={closeRef}
              variant="secondary"
              className="gc-viewer-close"
              aria-label="닫기"
              onClick={() => onOpenChange(false)}
            >
              ×
            </Button>
          </div>
        </div>
        <div
          ref={viewportRef}
          className="gc-viewer-viewport"
          {...viewportProps}
          data-viewer-blank
          style={{ touchAction: "none", cursor: zoom > 1 ? "grab" : "default" }}
        >
          {state === "empty" && (
            <p className="gc-viewer-message" role="status">
              표시할 이미지가 없습니다.
            </p>
          )}
          {state === "loading" && (
            <p className="gc-viewer-message" role="status">
              이미지를 불러오는 중…
            </p>
          )}
          {state === "error" && (
            <div className="gc-viewer-message" role="alert">
              <p>이미지를 불러오지 못했습니다.</p>
              <Button
                variant="secondary"
                onClick={() => {
                  setState("loading");
                  setRetry(retry + 1);
                }}
              >
                다시 시도
              </Button>
            </div>
          )}
          <div
            ref={trackRef}
            className="gc-viewer-swipe-track"
            data-viewer-blank
          >
            {images[index - 1] && (
              <div
                className="gc-viewer-image-layer gc-viewer-page-previous"
                aria-hidden="true"
              >
                <img src={images[index - 1].src} alt="" draggable={false} />
              </div>
            )}
            {current && (
              <div
                key={`${current.id}-${index}-${current.src}-${retry}`}
                className="gc-viewer-image-layer gc-viewer-image-current"
                data-viewer-blank
                data-page-index={index}
              >
                <img
                  ref={imageRef}
                  src={current.src}
                  alt={current.alt}
                  draggable={false}
                  onLoad={() => setState("success")}
                  onError={() => setState("error")}
                  style={{
                    visibility: state === "success" ? "visible" : "hidden",
                    transform: `translate(${position.x}px,${position.y}px) scale(${zoom})`,
                  }}
                />
              </div>
            )}
            {images[index + 1] && (
              <div
                className="gc-viewer-image-layer gc-viewer-page-next"
                aria-hidden="true"
              >
                <img src={images[index + 1].src} alt="" draggable={false} />
              </div>
            )}
          </div>
          <Button
            variant="secondary"
            className="gc-viewer-nav gc-viewer-nav-previous"
            aria-label="← 이전"
            disabled={index <= 0 || !current}
            onClick={() => onIndexChange(index - 1)}
          >
            ‹
          </Button>
          <Button
            variant="secondary"
            className="gc-viewer-nav gc-viewer-nav-next"
            aria-label="다음 →"
            disabled={!current || index >= images.length - 1}
            onClick={() => onIndexChange(index + 1)}
          >
            ›
          </Button>
        </div>
        <div className="gc-viewer-caption" data-viewer-blank>
          <p>{current?.alt || "이미지 없음"}</p>
        </div>
        <div
          ref={filmstripRef}
          className="gc-viewer-filmstrip"
          aria-label="이미지 썸네일 목록"
          data-viewer-blank
        >
          {images.map((image, imageIndex) => (
            <Button
              key={`${image.id}-${imageIndex}`}
              variant="secondary"
              className="gc-viewer-thumbnail"
              aria-label={`${imageIndex + 1}번 이미지: ${image.alt}`}
              aria-current={imageIndex === index ? "true" : undefined}
              onClick={() => onIndexChange(imageIndex)}
            >
              <GalleryImage item={image} />
            </Button>
          ))}
        </div>
        <p className="gc-viewer-hint">
          이미지 두 번 탭으로 확대·초기화 · 두 손가락으로 확대·축소 · 좌우
          스와이프 · 빈 공간이나 Escape로 닫기
        </p>
      </div>
    </Dialog>
  );
}
