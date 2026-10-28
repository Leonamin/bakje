import {
  useCallback,
  useRef,
  type ReactNode,
  type RefObject,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { Dialog as RDialog } from "radix-ui";
import { X } from "lucide-react";

export type DialogProps = {
  trigger?: ReactNode;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  shouldCloseOnOutsideClick?: boolean;
  isOpen?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
  initialFocusRef?: RefObject<HTMLElement | null>;
  className?: string;
  shouldCloseOnEscape?: boolean;
};

function loopModalFocus(event: KeyboardEvent<HTMLDivElement>) {
  if (
    event.key !== "Tab" ||
    event.altKey ||
    event.ctrlKey ||
    event.metaKey ||
    event.defaultPrevented ||
    !event.currentTarget.contains(event.target as Node)
  )
    return;
  const modal = event.currentTarget;
  const candidates = Array.from(
    modal.querySelectorAll<HTMLElement>("*"),
  ).filter(
    (element) =>
      element.tabIndex >= 0 &&
      !element.matches(":disabled") &&
      !element.closest("[hidden], [inert]") &&
      element.getClientRects().length > 0 &&
      getComputedStyle(element).visibility === "visible",
  );
  const first = candidates[0];
  const last = candidates.at(-1);
  if (!first || !last) {
    event.preventDefault();
    modal.focus();
    return;
  }
  const edge = event.shiftKey ? first : last;
  if (modal.ownerDocument.activeElement !== edge) return;
  // A nested Popover temporarily pauses Radix's parent scope until deferred cleanup.
  // Keep only the modal's Tab boundaries synchronous; portalled child scopes own their keys.
  event.preventDefault();
  (event.shiftKey ? last : first).focus();
}

const DRAG_SLOP = 6;
// Buttons may start a drag: pointer capture retargets the release, so a drag
// never clicks them. Text fields keep their own selection gestures.
const NO_DRAG = "input, textarea, select, [role=slider], [contenteditable]";

/**
 * Drag-to-dismiss for the phone bottom sheet. Drags start on the handle/header,
 * or anywhere in the body while it is scrolled to the top and the finger moves
 * down; an upward move hands control back to native scrolling.
 */
function useSheetDrag(isDrawer: boolean) {
  const contentRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const dragRef = useRef<{
    id: number;
    y: number;
    x: number;
    t: number;
    dy: number;
    isDragging: boolean;
  } | null>(null);

  function setOffset(dy: number) {
    const sheet = contentRef.current;
    if (!sheet) return;
    sheet.style.translate = dy ? `0 ${dy}px` : "";
    const overlay = overlayRef.current;
    if (!overlay) return;
    overlay.style.transition = sheet.hasAttribute("data-dragging") ? "none" : "";
    overlay.style.opacity = dy
      ? String(Math.max(0, 1 - dy / sheet.offsetHeight))
      : "";
  }

  function end(event: PointerEvent<HTMLDivElement>, isCanceled: boolean) {
    const drag = dragRef.current;
    if (!drag || drag.id !== event.pointerId) return;
    dragRef.current = null;
    const sheet = contentRef.current;
    if (!drag.isDragging || !sheet) return;
    delete sheet.dataset.dragging;
    const velocity = drag.dy / Math.max(1, performance.now() - drag.t);
    const shouldClose =
      !isCanceled &&
      (drag.dy > Math.min(140, sheet.offsetHeight * 0.3) ||
        (drag.dy > 40 && velocity > 0.6));
    // Closing keeps the dragged offset; the exit keyframes start from it.
    if (shouldClose) closeRef.current?.click();
    else setOffset(0);
  }

  // iOS starts a native scroll (and cancels the pointer) unless the touch move
  // is claimed while a sheet drag is pending or active. React's touch
  // listeners are passive, so this one is attached directly.
  const sheetRef = useCallback((node: HTMLDivElement | null) => {
    contentRef.current = node;
    if (!node) return;
    const claim = (event: TouchEvent) => {
      const drag = dragRef.current;
      if (
        drag &&
        event.cancelable &&
        (drag.isDragging || event.touches[0].clientY > drag.y)
      )
        event.preventDefault();
    };
    node.addEventListener("touchmove", claim, { passive: false });
    return () => node.removeEventListener("touchmove", claim);
  }, []);

  if (!isDrawer)
    return { sheetRef: contentRef, overlayRef, closeRef, dragProps: {} };
  return {
    sheetRef,
    overlayRef,
    closeRef,
    dragProps: {
      onPointerDown(event: PointerEvent<HTMLDivElement>) {
        const target = event.target as HTMLElement;
        if (
          !event.isPrimary ||
          event.button !== 0 ||
          !matchMedia("(max-width: 767px)").matches ||
          target.closest(NO_DRAG)
        )
          return;
        const body = target.closest<HTMLElement>(".gc-modal-body");
        if (body && body.scrollTop > 0) return;
        dragRef.current = {
          id: event.pointerId,
          y: event.clientY,
          x: event.clientX,
          t: performance.now(),
          dy: 0,
          isDragging: false,
        };
      },
      onPointerMove(event: PointerEvent<HTMLDivElement>) {
        const drag = dragRef.current;
        if (!drag || drag.id !== event.pointerId) return;
        const dy = event.clientY - drag.y;
        if (!drag.isDragging) {
          const dx = event.clientX - drag.x;
          if (Math.abs(dy) < DRAG_SLOP && Math.abs(dx) < DRAG_SLOP) return;
          if (dy <= 0 || Math.abs(dx) > dy) {
            dragRef.current = null;
            return;
          }
          drag.isDragging = true;
          drag.y = event.clientY;
          drag.t = performance.now();
          event.currentTarget.setPointerCapture(event.pointerId);
          event.currentTarget.dataset.dragging = "";
          return;
        }
        drag.dy = Math.max(0, dy);
        setOffset(drag.dy);
      },
      onPointerUp: (event: PointerEvent<HTMLDivElement>) => end(event, false),
      onPointerCancel: (event: PointerEvent<HTMLDivElement>) => end(event, true),
    },
  };
}

function Modal({
  trigger,
  title,
  description,
  children,
  footer,
  shouldCloseOnOutsideClick = true,
  isOpen,
  onOpenChange,
  initialFocusRef,
  className,
  shouldCloseOnEscape = true,
  isDrawer = false,
}: DialogProps & { isDrawer?: boolean }) {
  const { sheetRef, overlayRef, closeRef, dragProps } = useSheetDrag(isDrawer);
  const openerRef = useRef<HTMLElement | null>(null);
  return (
    <RDialog.Root open={isOpen} onOpenChange={onOpenChange}>
      {trigger && <RDialog.Trigger asChild>{trigger}</RDialog.Trigger>}
      <RDialog.Portal>
        <RDialog.Overlay ref={overlayRef} className="gc-modal-overlay" />
        <RDialog.Content
          ref={sheetRef}
          {...dragProps}
          className={`gc-modal ${isDrawer ? "gc-drawer" : ""} ${className ?? ""}`}
          {...(!description ? { "aria-describedby": undefined } : {})}
          onKeyDownCapture={loopModalFocus}
          onOpenAutoFocus={(event) => {
            openerRef.current = document.activeElement as HTMLElement | null;
            if (initialFocusRef?.current) {
              event.preventDefault();
              initialFocusRef.current.focus();
            }
          }}
          // Radix only returns focus to its own Trigger; controlled dialogs opened
          // by an app button would otherwise drop focus to <body>.
          onCloseAutoFocus={(event) => {
            if (trigger || !openerRef.current?.isConnected) return;
            event.preventDefault();
            openerRef.current.focus();
          }}
          onEscapeKeyDown={(event) => {
            if (!shouldCloseOnEscape) event.preventDefault();
          }}
          onPointerDownOutside={(event) => {
            if (!shouldCloseOnOutsideClick) event.preventDefault();
          }}
        >
          {isDrawer && <div className="gc-drawer-handle" aria-hidden="true" />}
          <header>
            <RDialog.Title>{title}</RDialog.Title>
            {description && (
              <RDialog.Description>{description}</RDialog.Description>
            )}
            <RDialog.Close
              ref={closeRef}
              className="gc-overlay-close"
              aria-label="닫기"
            >
              <X size={20} />
            </RDialog.Close>
          </header>
          {children ? <div className="gc-modal-body">{children}</div> : null}
          {footer && <footer>{footer}</footer>}
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  );
}
export function Dialog(props: DialogProps) {
  return <Modal {...props} />;
}
export function Drawer(props: DialogProps) {
  return <Modal {...props} isDrawer />;
}
export function DialogClose({ children }: { children: ReactNode }) {
  return <RDialog.Close asChild>{children}</RDialog.Close>;
}
