import type { Metadata, Viewport } from "next";
import { Providers } from "@/components/providers";
import { BottomNav, TopBar } from "@/components/app-nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "아카이브 — 개인 게시글 보관소",
  description: "X, Threads, Reddit 게시글을 원문째 보관하고 다시 찾는 개인 아카이브",
};

export const viewport: Viewport = {
  themeColor: "#141922",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <Providers>
          <div className="app-shell">
            <TopBar />
            <main className="app-main">{children}</main>
            <BottomNav />
          </div>
        </Providers>
      </body>
    </html>
  );
}
