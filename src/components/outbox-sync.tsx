"use client";

import { useEffect } from "react";
import { useToast } from "@/components/goodcase/overlays/toast";
import { flushOutbox } from "@/lib/outbox";

/**
 * Sends waiting links whenever any page opens, regains focus, or comes back
 * online. Also registers the offline shell so capture opens without a network.
 */
export function OutboxSync() {
  const { notify } = useToast();

  useEffect(() => {
    // Dev builds change chunk names on every edit; a cached shell would only get in the way.
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);

  useEffect(() => {
    async function flush() {
      const result = await flushOutbox();
      if (!result) return;
      if (result.sent > 0) {
        notify({ title: `대기 중이던 링크 ${result.sent}개를 보냈습니다`, tone: "success" });
      }
      if (result.rejected > 0) {
        notify({ title: `지원하지 않는 링크 ${result.rejected}개는 제외했습니다`, tone: "warning" });
      }
    }
    function onVisible() {
      if (document.visibilityState === "visible") flush();
    }

    flush();
    window.addEventListener("online", flush);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("online", flush);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [notify]);

  return null;
}
