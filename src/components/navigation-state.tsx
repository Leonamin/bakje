"use client";
import { useCallback, useEffect, useState, useSyncExternalStore, useTransition, type ComponentProps, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

// One shared "something is loading" flag, so search, shuffle and page links all show the same feedback.
let active = 0;
const listeners = new Set<() => void>();
const bump = (delta: number) => { active += delta; listeners.forEach(notify => notify()); };
const subscribe = (notify: () => void) => { listeners.add(notify); return () => { listeners.delete(notify); }; };

/** push(href) inside a transition; the pending state is reported to every useNavigating(). */
export function useNavigate() {
  const router = useRouter();
  const [pending, start] = useTransition();
  useEffect(() => { if (!pending) return; bump(1); return () => bump(-1); }, [pending]);
  return useCallback((href: string, { scroll = false } = {}) => start(() => router.push(href, { scroll })), [router]);
}

/** True only after `delay` ms, so fast navigations never flash a loader. */
export function useNavigating(delay = 300) {
  const busy = useSyncExternalStore(subscribe, () => active > 0, () => false);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!busy) { setShown(false); return; }
    const timer = setTimeout(() => setShown(true), delay);
    return () => clearTimeout(timer);
  }, [busy, delay]);
  return shown;
}

/** A normal link (new tab, copy address still work) whose plain click navigates in a tracked transition. */
export function NavLink({ href, scroll = true, onClick, ...props }: Omit<ComponentProps<typeof Link>, "href" | "scroll"> & { href: string; scroll?: boolean }) {
  const navigate = useNavigate();
  return <Link {...props} href={href} onClick={event => {
    onClick?.(event);
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault(); navigate(href, { scroll });
  }} />;
}

export function NavigationProgress() {
  return useNavigating() ? <div role="progressbar" aria-label="불러오는 중" className="nav-progress" /> : null;
}

/** Dims the results it wraps while a tracked navigation is loading. */
export function Busy({ children }: { children: ReactNode }) {
  const busy = useNavigating();
  return <div aria-busy={busy} className={`transition-opacity duration-150 ${busy ? "pointer-events-none opacity-50" : ""}`}>{children}</div>;
}
