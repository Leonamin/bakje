import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Providers } from "@/components/providers";
import { BottomNav, TopBar } from "@/components/app-nav";
import { NavigationProgress } from "@/components/navigation-state";
import "./globals.css";

// ponytail: one 2MB variable file, cached after first load; switch to Pretendard's dynamic subset if first paint on mobile data hurts.
const pretendard = localFont({
  src: "./fonts/PretendardVariable.woff2",
  weight: "45 920",
  display: "swap",
  variable: "--font-pretendard",
});

export const metadata: Metadata = {
  title: "박제 — 개인 게시글 보관소",
  description: "X, Threads, Reddit 게시글을 원문째 보관하고 다시 찾는 개인 아카이브",
  appleWebApp: { capable: true, title: "박제", statusBarStyle: "black" },
};

export const viewport: Viewport = {
  themeColor: "#141922",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={pretendard.variable}>
      <body>
        <Providers>
          <NavigationProgress />
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
