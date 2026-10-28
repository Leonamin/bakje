"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

/** Goes back in history so the search query and filters survive; falls back to the library when there is nothing to go back to. */
export function BackLink({ fallback = "/", className, label, children }: { fallback?: string; className?: string; label: string; children: ReactNode }) {
  const router = useRouter();
  return (
    <Link
      href={fallback}
      aria-label={label}
      className={className}
      onClick={(e) => {
        if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        // history.length also counts blank/external pages on direct entry.
        // Prefer the same-origin history check when the browser supports it.
        const navigation = (window as Window & { navigation?: { canGoBack: boolean } }).navigation;
        if (navigation?.canGoBack ?? window.history.length > 1) {
          e.preventDefault();
          router.back();
        }
      }}
    >
      {children}
    </Link>
  );
}
