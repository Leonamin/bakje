"use client";

import { useRef, useState, type ReactNode } from "react";
import { setSourceHidden } from "@/app/actions";
import { useToast } from "@/components/goodcase/overlays/toast";

const INTENT = 8; // px of horizontal travel before a touch counts as a swipe, not a tap
const COMMIT = 90; // px of left travel that hides the post
const EDGE = 20; // iOS back-swipe zone; touches starting here are left alone

/** Touch-only: swipe a library card left to hide it. Mouse and keyboard behave as before. */
export function SwipeHide({ id, children }: { id: number; children: ReactNode }) {
  const { notify } = useToast();
  const [dx, setDx] = useState(0);
  const [drag, setDrag] = useState(false);
  const [gone, setGone] = useState(false);
  const start = useRef<{ x: number; y: number } | null>(null);
  const moved = useRef(false);

  async function hide() {
    setGone(true);
    try {
      await setSourceHidden(id, true);
    } catch {
      setGone(false);
      setDx(0);
      notify({ title: "처리하지 못했습니다", tone: "error" });
      return;
    }
    notify({
      title: "글을 숨겼습니다",
      action: {
        label: "되돌리기",
        onClick: async () => {
          await setSourceHidden(id, false);
          setGone(false);
          setDx(0);
        },
      },
    });
  }

  return (
    <div
      style={{
        touchAction: "pan-y",
        translate: gone ? "-110% 0" : `${dx}px 0`,
        opacity: gone ? 0 : 1 - Math.min(-dx, COMMIT) / (COMMIT * 2.5),
        transition: drag ? "none" : "translate 200ms ease-out, opacity 200ms ease-out",
        pointerEvents: gone ? "none" : undefined,
      }}
      onPointerDown={(e) => {
        if (e.pointerType !== "touch" || e.clientX < EDGE) return;
        start.current = { x: e.clientX, y: e.clientY };
        moved.current = false;
      }}
      onPointerMove={(e) => {
        const s = start.current;
        if (!s) return;
        const mx = e.clientX - s.x;
        if (!drag) {
          if (Math.abs(mx) < INTENT || Math.abs(mx) < Math.abs(e.clientY - s.y)) return;
          moved.current = true;
          setDrag(true);
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {} // ponytail: capture is best effort; the swipe works without it
        }
        setDx(Math.min(0, mx)); // ponytail: left only; right swipe does nothing
      }}
      onPointerUp={() => {
        start.current = null;
        setDrag(false);
        if (dx <= -COMMIT) hide();
        else setDx(0);
      }}
      onPointerCancel={() => {
        start.current = null;
        setDrag(false);
        setDx(0);
      }}
      onClickCapture={(e) => {
        if (moved.current) {
          e.preventDefault();
          e.stopPropagation();
          moved.current = false;
        }
      }}
    >
      {children}
    </div>
  );
}
