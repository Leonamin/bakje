"use client";

import type { ReactNode } from "react";
import { ToastProvider } from "@/components/goodcase/overlays/toast";
import { OutboxSync } from "@/components/outbox-sync";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ToastProvider layout="stack" direction="down" stackSize={2}>
      {children}
      <OutboxSync />
    </ToastProvider>
  );
}
