"use client";

import { useState } from "react";
import { Play } from "lucide-react";
import { ImageViewer, type ViewerImage } from "@/components/goodcase/composed/image-viewer";
import type { MediaRow } from "@/lib/types";

export function MediaGallery({ media }: { media: MediaRow[] }) {
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState(false);

  const usable = media.filter((m) => m.status === "ok" && m.local_path);
  const images = usable.filter((m) => m.kind === "image");
  const clips = usable.filter((m) => m.kind !== "image");

  const viewerImages: ViewerImage[] = images.map((m, i) => ({
    id: String(m.id),
    src: `/api/media/${m.local_path}`,
    alt: `게시글 이미지 ${i + 1}`,
  }));

  return (
    <div className="space-y-3">
      {images.length > 0 ? (
        <div
          className={
            images.length === 1
              ? "grid grid-cols-1 overflow-hidden rounded-2xl"
              : "grid grid-cols-2 gap-1 overflow-hidden rounded-2xl"
          }
        >
          {images.map((m, i) => (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                setIndex(i);
                setOpen(true);
              }}
              className={`media-tile group relative ${images.length === 1 ? "max-h-[560px]" : "aspect-[3/4]"}`}
              aria-label={`이미지 ${i + 1} 크게 보기`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/media/${m.local_path}`}
                alt=""
                loading={i < 2 ? "eager" : "lazy"}
                className={images.length === 1 ? "max-h-[560px] w-full object-contain" : "h-full w-full object-cover"}
              />
              {i === 3 && images.length > 4 ? (
                <span className="absolute inset-0 flex items-center justify-center bg-black/55 text-[20px] font-semibold text-white">
                  +{images.length - 4}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}

      {clips.map((m) => (
        <figure key={m.id} className="media-tile overflow-hidden rounded-2xl">
          {m.status === "too_large" ? (
            <div className="flex h-32 items-center justify-center px-4 text-center text-[14px] text-[var(--muted)]">
              30MB를 넘어 저장하지 않았습니다 ·{" "}
              <a href={m.remote_url} target="_blank" rel="noreferrer" className="ml-1 text-[var(--accent)] underline">
                원본 보기
              </a>
            </div>
          ) : m.status === "failed" ? (
            <div className="flex h-32 items-center justify-center px-4 text-center text-[14px] text-[var(--muted)]">
              다운로드 실패 ·{" "}
              <a href={m.remote_url} target="_blank" rel="noreferrer" className="ml-1 text-[var(--accent)] underline">
                원본 보기
              </a>
            </div>
          ) : (
            <video
              controls
              preload="metadata"
              playsInline
              poster={m.poster_path ? `/api/media/${m.poster_path}` : undefined}
              className="max-h-[520px] w-full bg-black"
            >
              <source src={`/api/media/${m.local_path}`} />
            </video>
          )}
          {m.kind === "gif" ? (
            <figcaption className="absolute bottom-2 left-2 flex items-center gap-1 rounded-md bg-black/60 px-2 py-0.5 text-[12px] text-white">
              <Play size={12} fill="currentColor" />
              GIF
            </figcaption>
          ) : null}
        </figure>
      ))}

      {images.length > 0 ? (
        <ImageViewer
          images={viewerImages}
          index={index}
          isOpen={open}
          onOpenChange={setOpen}
          onIndexChange={setIndex}
        />
      ) : null}
    </div>
  );
}
