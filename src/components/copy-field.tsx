"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

/** A value the user has to type into another app, with a one-tap copy. */
export function CopyField({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be refused; the text stays selectable with `select-all`.
    }
  }

  return (
    <div className="flex items-center gap-2 rounded-xl border border-[var(--line-strong)] bg-[#11161e] py-1 pl-3 pr-1">
      <code className="min-w-0 flex-1 select-all break-all font-mono text-[12px] leading-relaxed text-[var(--accent-strong)]">
        {value}
      </code>
      <button
        type="button"
        onClick={copy}
        aria-label={`${label} 복사`}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[var(--muted)] hover:text-[var(--ink)]"
      >
        {copied ? <Check size={18} className="text-[var(--accent)]" /> : <Copy size={18} />}
      </button>
    </div>
  );
}
