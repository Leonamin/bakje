import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEventHandler,
  type PointerEventHandler,
} from "react";
import { type ViewerImage } from "./viewer-image";

type ViewerGestureOptions = {
  current: ViewerImage | undefined;
  index: number;
  imageCount: number;
  isOpen: boolean;
  isAnimated: boolean;
  hasLoadedImage: boolean;
  onIndexChange: (index: number) => void;
  onOpenChange: (isOpen: boolean) => void;
};

/** Owns the full pointer session, including animation cancellation and close intent. */
export function useViewerGesture({
  current,
  index,
  imageCount,
  isOpen,
  isAnimated,
  hasLoadedImage,
  onIndexChange,
  onOpenChange,
}: ViewerGestureOptions) {
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const zoomRef = useRef(zoom);
  const positionRef = useRef(position);
  zoomRef.current = zoom;
  positionRef.current = position;
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const hasPinchedRef = useRef(false);
  const pinchRef = useRef<{
    distance: number;
    zoom: number;
    anchorX: number;
    anchorY: number;
  } | null>(null);
  const [hasReducedMotion, setHasReducedMotion] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const shouldAnimate = isAnimated && !hasReducedMotion;
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const settleRef = useRef<Animation | null>(null);
  const offsetRef = useRef(0);
  const lastTapRef = useRef<{ x: number; y: number; time: number } | null>(
    null,
  );
  const gestureRef = useRef<{
    pointerId: number;
    x: number;
    y: number;
    startX: number;
    startY: number;
    startedAt: number;
    canSwipe: boolean;
    hasImageOrigin: boolean;
    hasMoved: boolean;
    isHorizontal: boolean | null;
  } | null>(null);
  const blankRef = useRef<{
    pointerId: number;
    x: number;
    y: number;
    canClose: boolean;
    hasMoved: boolean;
  } | null>(null);
  const canCloseOnClickRef = useRef(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const change = () => setHasReducedMotion(query.matches);
    query.addEventListener("change", change);
    return () => query.removeEventListener("change", change);
  }, []);
  function clearTapAndCloseIntent() {
    lastTapRef.current = null;
    blankRef.current = null;
    canCloseOnClickRef.current = false;
  }

  function cancelSwipeAnimation() {
    const animation = settleRef.current;
    settleRef.current = null;
    animation?.cancel();
    writeOffset(0);
  }

  function resetPointerSession() {
    const pointerIds = [...pointersRef.current.keys()];
    pointersRef.current.clear();
    gestureRef.current = null;
    pinchRef.current = null;
    hasPinchedRef.current = false;
    clearTapAndCloseIntent();
    for (const pointerId of pointerIds) {
      if (viewportRef.current?.hasPointerCapture(pointerId))
        viewportRef.current.releasePointerCapture(pointerId);
    }
  }

  function resetInteraction() {
    cancelSwipeAnimation();
    resetPointerSession();
  }

  useLayoutEffect(() => {
    resetInteraction();
    applyView(1, { x: 0, y: 0 });
  }, [current?.src, current?.id, index, isOpen]);
  useEffect(() => resetInteraction, []);
  function clamp(x: number, y: number, nextZoom = zoom) {
    const viewport = viewportRef.current;
    const image = imageRef.current;
    if (!viewport || !image) return { x: 0, y: 0 };
    const maxX = Math.max(
      0,
      (image.offsetWidth * nextZoom - viewport.clientWidth) / 2,
    );
    const maxY = Math.max(
      0,
      (image.offsetHeight * nextZoom - viewport.clientHeight) / 2,
    );
    return {
      x: Math.max(-maxX, Math.min(maxX, x)),
      y: Math.max(-maxY, Math.min(maxY, y)),
    };
  }
  function applyView(nextZoom: number, nextPosition: { x: number; y: number }) {
    zoomRef.current = nextZoom;
    positionRef.current = nextPosition;
    setZoom(nextZoom);
    setPosition(nextPosition);
  }
  function beginPinch() {
    const points = [...pointersRef.current.values()];
    const viewport = viewportRef.current;
    if (points.length < 2 || !viewport) return;
    cancelSwipeAnimation();
    clearTapAndCloseIntent();
    gestureRef.current = null;
    hasPinchedRef.current = true;
    const [first, second] = points;
    const rect = viewport.getBoundingClientRect();
    const midX = (first.x + second.x) / 2 - (rect.left + rect.width / 2);
    const midY = (first.y + second.y) / 2 - (rect.top + rect.height / 2);
    pinchRef.current = {
      distance: Math.max(1, Math.hypot(first.x - second.x, first.y - second.y)),
      zoom: zoomRef.current,
      anchorX: (midX - positionRef.current.x) / zoomRef.current,
      anchorY: (midY - positionRef.current.y) / zoomRef.current,
    };
  }
  function movePinch() {
    const pinch = pinchRef.current;
    const points = [...pointersRef.current.values()];
    const viewport = viewportRef.current;
    if (!pinch || points.length < 2 || !viewport) return;
    const [first, second] = points;
    const rect = viewport.getBoundingClientRect();
    const nextZoom = Math.max(
      1,
      Math.min(
        4,
        (pinch.zoom * Math.hypot(first.x - second.x, first.y - second.y)) /
          pinch.distance,
      ),
    );
    const midX = (first.x + second.x) / 2 - (rect.left + rect.width / 2);
    const midY = (first.y + second.y) / 2 - (rect.top + rect.height / 2);
    applyView(
      nextZoom,
      clamp(
        midX - pinch.anchorX * nextZoom,
        midY - pinch.anchorY * nextZoom,
        nextZoom,
      ),
    );
  }
  function handleImageTap(event: React.PointerEvent<HTMLDivElement>) {
    const gesture = gestureRef.current;
    const now = performance.now();
    if (
      !gesture ||
      !gesture.hasImageOrigin ||
      gesture.hasMoved ||
      now - gesture.startedAt > 250 ||
      !["touch", "pen"].includes(event.pointerType)
    ) {
      lastTapRef.current = null;
      return;
    }
    const previous = lastTapRef.current;
    if (
      previous &&
      now - previous.time <= 300 &&
      Math.hypot(event.clientX - previous.x, event.clientY - previous.y) <= 32
    ) {
      lastTapRef.current = null;
      const viewport = viewportRef.current;
      if (!viewport) return;
      const rect = viewport.getBoundingClientRect();
      const x = event.clientX - (rect.left + rect.width / 2),
        y = event.clientY - (rect.top + rect.height / 2);
      const oldZoom = zoomRef.current;
      const anchorX = (x - positionRef.current.x) / oldZoom,
        anchorY = (y - positionRef.current.y) / oldZoom;
      const nextZoom = oldZoom > 1 ? 1 : 2;
      changeZoom(nextZoom);
      applyView(
        nextZoom,
        nextZoom === 1
          ? { x: 0, y: 0 }
          : clamp(x - anchorX * nextZoom, y - anchorY * nextZoom, nextZoom),
      );
      gestureRef.current = null;
    } else
      lastTapRef.current = { x: event.clientX, y: event.clientY, time: now };
  }
  function finishPointer(
    event: React.PointerEvent<HTMLDivElement>,
    isCanceled = false,
  ) {
    if (
      !pointersRef.current.has(event.pointerId) &&
      gestureRef.current?.pointerId !== event.pointerId
    )
      return;
    const hasPinched = hasPinchedRef.current;
    pointersRef.current.delete(event.pointerId);
    if (hasPinched) {
      canCloseOnClickRef.current = false;
      if (event.currentTarget.hasPointerCapture(event.pointerId))
        event.currentTarget.releasePointerCapture(event.pointerId);
      pinchRef.current = null;
      if (pointersRef.current.size >= 2) beginPinch();
      else if (pointersRef.current.size === 1) {
        const [pointerId, point] = [...pointersRef.current.entries()][0];
        gestureRef.current = {
          pointerId,
          x: point.x,
          y: point.y,
          startX: positionRef.current.x,
          startY: positionRef.current.y,
          startedAt: performance.now(),
          canSwipe: false,
          hasImageOrigin: false,
          hasMoved: true,
          isHorizontal: null,
        };
      } else {
        gestureRef.current = null;
        hasPinchedRef.current = false;
      }
      return;
    }
    if (isCanceled) lastTapRef.current = null;
    else handleImageTap(event);
    endGesture(event, isCanceled);
  }
  function changeZoom(next: number) {
    resetInteraction();
    const bounded = Math.max(1, Math.min(4, next));
    applyView(
      bounded,
      clamp(positionRef.current.x, positionRef.current.y, bounded),
    );
  }
  useEffect(() => {
    if (!isOpen) return;
    const observer = new ResizeObserver(() =>
      setPosition((point) => clamp(point.x, point.y)),
    );
    if (viewportRef.current) observer.observe(viewportRef.current);
    return () => observer.disconnect();
  }, [zoom, isOpen]);
  useEffect(() => {
    if (!isOpen) return;
    function navigate(event: KeyboardEvent) {
      if (
        event.shiftKey &&
        zoom > 1 &&
        ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)
      ) {
        event.preventDefault();
        setPosition((point) =>
          clamp(
            point.x +
              (event.key === "ArrowLeft"
                ? 40
                : event.key === "ArrowRight"
                  ? -40
                  : 0),
            point.y +
              (event.key === "ArrowUp"
                ? 40
                : event.key === "ArrowDown"
                  ? -40
                  : 0),
          ),
        );
        return;
      }
      if (event.key === "ArrowLeft" && index > 0) {
        event.preventDefault();
        onIndexChange(index - 1);
      }
      if (event.key === "ArrowRight" && index < imageCount - 1) {
        event.preventDefault();
        onIndexChange(index + 1);
      }
    }
    document.addEventListener("keydown", navigate);
    return () => document.removeEventListener("keydown", navigate);
  }, [isOpen, index, imageCount, onIndexChange, zoom]);
  function isBlank(target: EventTarget | null) {
    return (
      target instanceof HTMLElement && target.hasAttribute("data-viewer-blank")
    );
  }
  function writeOffset(offset: number) {
    offsetRef.current = offset;
    if (trackRef.current)
      trackRef.current.style.transform = `translateX(${offset}px)`;
  }
  function settleGesture(nextIndex: number) {
    const track = trackRef.current;
    const width = viewportRef.current?.clientWidth || 0;
    const hasCommitted = nextIndex !== index;
    const target = hasCommitted ? (nextIndex > index ? -width : width) : 0;
    const finish = () => {
      if (hasCommitted) onIndexChange(nextIndex);
      else writeOffset(0);
    };
    if (!track || !shouldAnimate || Math.abs(target - offsetRef.current) < 1) {
      finish();
      return;
    }
    const animation = track.animate(
      [
        { transform: `translateX(${offsetRef.current}px)` },
        { transform: `translateX(${target}px)` },
      ],
      { duration: 180, easing: "cubic-bezier(.2,.7,.2,1)", fill: "forwards" },
    );
    settleRef.current = animation;
    animation.finished
      .then(() => {
        if (settleRef.current !== animation) return;
        settleRef.current = null;
        writeOffset(target);
        animation.cancel();
        finish();
      })
      .catch(() => {});
  }
  function endGesture(
    event: React.PointerEvent<HTMLDivElement>,
    isCanceled = false,
  ) {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    gestureRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    if (zoomRef.current > 1 || !gesture.canSwipe) return;
    const offset = offsetRef.current;
    const width = viewportRef.current?.clientWidth || 0;
    const elapsed = Math.max(1, performance.now() - gesture.startedAt);
    const hasEnoughDistance = Math.abs(offset) >= Math.min(96, width * 0.22);
    const hasFlick = Math.abs(offset) > 32 && Math.abs(offset) / elapsed > 0.55;
    const canCommit =
      !isCanceled && gesture.isHorizontal && (hasEnoughDistance || hasFlick);
    const nextIndex =
      canCommit && offset < 0 && index < imageCount - 1
        ? index + 1
        : canCommit && offset > 0 && index > 0
          ? index - 1
          : index;
    settleGesture(nextIndex);
  }

  const onPointerDownCapture: PointerEventHandler<HTMLDivElement> = (event) => {
    canCloseOnClickRef.current = false;
    if (event.target !== imageRef.current) lastTapRef.current = null;
    blankRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      canClose:
        isBlank(event.target) &&
        pointersRef.current.size === 0 &&
        !hasPinchedRef.current,
      hasMoved: false,
    };
  };
  const onPointerMoveCapture: PointerEventHandler<HTMLDivElement> = (event) => {
    const blank = blankRef.current;
    if (
      blank &&
      blank.pointerId === event.pointerId &&
      Math.abs(event.clientX - blank.x) + Math.abs(event.clientY - blank.y) > 5
    )
      blank.hasMoved = true;
  };
  const onPointerUpCapture: PointerEventHandler<HTMLDivElement> = (event) => {
    const blank = blankRef.current;
    const hit = document.elementFromPoint(event.clientX, event.clientY);
    canCloseOnClickRef.current =
      !!blank &&
      blank.pointerId === event.pointerId &&
      blank.canClose &&
      !blank.hasMoved &&
      !hasPinchedRef.current &&
      isBlank(hit);
    blankRef.current = null;
  };
  const onPointerCancelCapture: PointerEventHandler<HTMLDivElement> = () => {
    clearTapAndCloseIntent();
  };
  const onClick: MouseEventHandler<HTMLDivElement> = (event) => {
    if (event.detail > 0 && canCloseOnClickRef.current) {
      canCloseOnClickRef.current = false;
      onOpenChange(false);
    } else canCloseOnClickRef.current = false;
  };
  const onPointerDown: PointerEventHandler<HTMLDivElement> = (event) => {
    if ((event.target as HTMLElement).closest("button") || !hasLoadedImage)
      return;
    if (settleRef.current) {
      cancelSwipeAnimation();
    }
    const isTouch =
      event.pointerType === "touch" || event.pointerType === "pen";
    if (isTouch) {
      if (pointersRef.current.size === 0) hasPinchedRef.current = false;
      pointersRef.current.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY,
      });
      event.currentTarget.setPointerCapture(event.pointerId);
      if (pointersRef.current.size >= 2) {
        beginPinch();
        return;
      }
    }
    const canSwipe =
      zoomRef.current === 1 &&
      (event.target === imageRef.current || isBlank(event.target)) &&
      isTouch;
    gestureRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      startX: positionRef.current.x,
      startY: positionRef.current.y,
      startedAt: performance.now(),
      canSwipe,
      hasImageOrigin: event.target === imageRef.current,
      hasMoved: false,
      isHorizontal: null,
    };
    if (zoomRef.current > 1 || canSwipe)
      event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onPointerMove: PointerEventHandler<HTMLDivElement> = (event) => {
    if (pointersRef.current.has(event.pointerId))
      pointersRef.current.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY,
      });
    if (pinchRef.current && pointersRef.current.size >= 2) {
      movePinch();
      return;
    }
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    const dx = event.clientX - gesture.x;
    const dy = event.clientY - gesture.y;
    if (Math.hypot(dx, dy) > 8) {
      gesture.hasMoved = true;
      lastTapRef.current = null;
    }
    if (zoomRef.current > 1 || hasPinchedRef.current) {
      applyView(
        zoomRef.current,
        clamp(gesture.startX + dx, gesture.startY + dy, zoomRef.current),
      );
      return;
    }
    if (!gesture.canSwipe) return;
    if (gesture.isHorizontal === null && Math.abs(dx) + Math.abs(dy) > 8)
      gesture.isHorizontal = Math.abs(dx) > Math.abs(dy) * 1.15;
    if (!gesture.isHorizontal) return;
    const hasNeighbor = dx < 0 ? index < imageCount - 1 : index > 0;
    writeOffset(hasNeighbor ? dx : dx * 0.22);
  };
  const onPointerUp: PointerEventHandler<HTMLDivElement> = (event) =>
    finishPointer(event);
  const onPointerCancel: PointerEventHandler<HTMLDivElement> = (event) =>
    finishPointer(event, true);
  const onLostPointerCapture: PointerEventHandler<HTMLDivElement> = (event) =>
    finishPointer(event, true);
  return {
    zoom,
    position,
    shouldAnimate,
    viewportRef,
    trackRef,
    imageRef,
    changeZoom,
    viewerProps: {
      onPointerDownCapture,
      onPointerMoveCapture,
      onPointerUpCapture,
      onPointerCancelCapture,
      onClick,
    },
    viewportProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
      onLostPointerCapture,
    },
  };
}
