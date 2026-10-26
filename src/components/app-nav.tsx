"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/logo";
import { LibraryBig, Plus, Search, Settings } from "lucide-react";

const ITEMS = [
  { href: "/", label: "라이브러리", icon: LibraryBig, match: (p: string) => p === "/" || p.startsWith("/sources") },
  { href: "/add", label: "수집", icon: Plus, match: (p: string) => p.startsWith("/add"), capture: true },
  { href: "/search", label: "검색", icon: Search, match: (p: string) => p.startsWith("/search") },
];

export function TopBar() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-40 hidden border-b border-[var(--line)] bg-[color-mix(in_srgb,var(--accent-bg)_92%,transparent)] backdrop-blur-md md:block">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-6">
        <Link href="/" className="flex items-center gap-2 text-[16px] font-semibold tracking-tight">
          <Logo size={24} />
          박제
        </Link>
        <nav className="ml-auto flex items-center gap-1">
          {ITEMS.map((item) => {
            const active = item.match(pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex h-10 items-center gap-2 rounded-xl px-3 text-[14px] transition-colors ${
                  item.capture
                    ? "bg-[var(--accent)] font-semibold text-[var(--gc-on-accent)]"
                    : active
                      ? "bg-[var(--surface-2)] text-[var(--ink)]"
                      : "text-[var(--muted)] hover:text-[var(--ink)]"
                }`}
              >
                <item.icon size={16} strokeWidth={2} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <Link
          href="/settings"
          aria-label="설정"
          aria-current={pathname.startsWith("/settings") ? "page" : undefined}
          className="-ml-4 flex h-10 w-10 items-center justify-center rounded-xl text-[var(--muted)] hover:text-[var(--ink)] aria-[current=page]:text-[var(--ink)]"
        >
          <Settings size={18} strokeWidth={1.8} />
        </Link>
      </div>
    </header>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  // The detail screen puts its own actions in this spot.
  if (pathname.startsWith("/sources/")) return null;
  return (
    <nav className="bottom-nav md:hidden" aria-label="주요 화면">
      <ul className="grid grid-cols-3">
        {ITEMS.map((item) => {
          const active = item.match(pathname);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                data-active={active}
                data-capture={item.capture ?? false}
                className="bottom-nav-item"
                aria-current={active ? "page" : undefined}
              >
                {item.capture ? (
                  <span className="bottom-nav-fab">
                    <item.icon size={26} strokeWidth={2.2} />
                  </span>
                ) : (
                  <item.icon size={22} strokeWidth={1.8} />
                )}
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
