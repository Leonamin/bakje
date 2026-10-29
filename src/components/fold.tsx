import { ChevronDown } from "lucide-react";

/** Collapsible section: icon chevron instead of the browser's native marker. */
export function Fold({ title, className = "", summaryClassName = "text-[15px] font-semibold", onToggle, children }: {
  title: string; className?: string; summaryClassName?: string; onToggle?: (open: boolean) => void; children: React.ReactNode;
}) {
  return <details className={`group ${className}`} onToggle={onToggle && (e => onToggle(e.currentTarget.open))}>
    <summary className={`flex cursor-pointer list-none items-center justify-between gap-2 [&::-webkit-details-marker]:hidden ${summaryClassName}`}>
      {title}<ChevronDown size={18} aria-hidden className="shrink-0 text-[var(--muted)] transition-transform group-open:rotate-180" />
    </summary>
    {children}
  </details>;
}
