import type { ReactElement } from "react";
import { HoverCard } from "@/components/goodcase/overlays/hover-card";

/** 카드에 마우스를 0.5초 올리면 썸네일을 원본 비율로 보여 준다. src가 없으면 카드를 그대로 둔다. */
export function ThumbPreview({ src, children }: { src: string | null | undefined; children: ReactElement }) {
  if (!src) return children;
  return <HoverCard trigger={children}>
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={src} alt="" className="block max-h-[360px] max-w-[360px] rounded-lg object-contain" />
  </HoverCard>;
}
