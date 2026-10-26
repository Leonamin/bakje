"use client";

import { RotateCw } from "lucide-react";
import { IconButton } from "@/components/goodcase/basic/button";

// Standalone (home-screen) PWAs have no browser reload. A full reload also picks up a new deploy.
export function RefreshButton() {
  return (
    <IconButton label="새로고침" onClick={() => window.location.reload()}>
      <RotateCw size={20} strokeWidth={1.8} />
    </IconButton>
  );
}
