"use client";

import { RotateCw } from "lucide-react";

// Standalone (home-screen) PWAs have no browser reload. A full reload also picks up a new deploy.
export function RefreshButton() {
  return (
    <button
      type="button"
      onClick={() => window.location.reload()}
      aria-label="새로고침"
      className="flex h-11 w-11 items-center justify-center rounded-xl text-[var(--muted)] hover:text-[var(--ink)]"
    >
      <RotateCw size={20} strokeWidth={1.8} />
    </button>
  );
}
