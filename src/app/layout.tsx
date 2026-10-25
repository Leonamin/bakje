import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "아카이브",
  description: "X, Threads, Reddit 게시글 개인 아카이브",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <header className="border-b hairline">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
            <Link href="/" className="flex items-baseline gap-2.5">
              <span className="text-[15px] font-semibold tracking-tight">아카이브</span>
              <span className="meta">personal post archive</span>
            </Link>
            <nav className="flex items-center gap-4 text-[13px] text-[var(--color-dim)]">
              <Link href="/" className="hover:text-[var(--color-ink)]">
                라이브러리
              </Link>
              <Link
                href="/add"
                className="rounded-md border border-[var(--color-line)] bg-[#171719] px-3 py-1.5 text-[var(--color-ink)] hover:bg-[#202024]"
              >
                수집
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-5 py-8">{children}</main>
      </body>
    </html>
  );
}
