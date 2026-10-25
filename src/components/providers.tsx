"use client";

import type { ReactNode } from "react";
import { ToastProvider } from "@/components/goodcase/overlays/toast";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ToastProvider layout="stack" direction="down" stackSize={2}>
      {children}
    </ToastProvider>
  );
}
