import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "박제",
    short_name: "박제",
    description: "X, Threads, Reddit 게시글을 원문째 보관하고 다시 찾는 개인 아카이브",
    start_url: "/",
    display: "standalone",
    background_color: "#141922",
    theme_color: "#141922",
    icons: [{ src: "/icon-512.png", sizes: "512x512", type: "image/png" }],
  };
}
