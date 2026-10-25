"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LibraryBig, Plus, Search } from "lucide-react";

const ITEMS = [
  { href: "/", label: "라이브러리", icon: LibraryBig, match: (p: string) => p === "/" || p.startsWith("/sources") },
  { href: "/search", label: "검색", icon: Search, match: (p: string) => p.startsWith("/search") },
  { href: "/add", label: "수집", icon: Plus, match: (p: string) => p.startsWith("/add") },
];

export function TopBar() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-40 hidden border-b border-[var(--line)] bg-[color-mix(in_srgb,var(--accent-bg)_92%,transparent)] backdrop-blur-md md:block">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-6">
        <Link href="/" className="flex items-baseline gap-2.5">
          <span className="text-[15px] font-semibold tracking-tight">아카이브</span>
          <span className="mono">post archive</span>
        </Link>
        <nav className="ml-auto flex items-center gap-1">
          {ITEMS.map((item) => {
            const active = item.match(pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex h-9 items-center gap-2 rounded-md px-3 text-[13px] transition-colors ${
                  active
                    ? "bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] text-[var(--accent-strong)]"
                    : "text-[var(--muted)] hover:text-[var(--ink)]"
                }`}
              >
                <item.icon size={15} strokeWidth={1.8} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="bottom-nav md:hidden" aria-label="주요 화면">
      <ul className="flex">
        {ITEMS.map((item) => {
          const active = item.match(pathname);
          return (
            <li key={item.href} className="relative flex-1">
              <Link
                href={item.href}
                data-active={active}
                className="bottom-nav-item relative"
                aria-current={active ? "page" : undefined}
              >
                <span className="nav-mark" aria-hidden="true" />
                <item.icon size={20} strokeWidth={1.7} />
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
