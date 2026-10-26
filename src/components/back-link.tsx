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
        if (window.history.length > 1) {
          e.preventDefault();
          router.back();
        }
      }}
    >
      {children}
    </Link>
  );
}
