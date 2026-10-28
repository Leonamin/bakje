"use client";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

type Selection = { selecting: boolean; selected: number[]; setSelected: React.Dispatch<React.SetStateAction<number[]>>; start: (ids?: number[]) => void; exit: () => void };
const Context = createContext<Selection | null>(null);

/** Selection lives above both the toolbar (toggle button) and the list. It resets when `resetKey` (the query without page/shuffle) changes. */
export function SelectionProvider({ resetKey, children }: { resetKey: string; children: ReactNode }) {
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);
  const [previous, setPrevious] = useState(resetKey);
  if (previous !== resetKey) { setPrevious(resetKey); setSelecting(false); setSelected([]); }
  const start = useCallback((ids: number[] = []) => { setSelecting(true); setSelected(ids); }, []);
  const exit = useCallback(() => { setSelecting(false); setSelected([]); }, []);
  const value = useMemo(() => ({ selecting, selected, setSelected, start, exit }), [selecting, selected, start, exit]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useSelection() {
  const value = useContext(Context);
  if (!value) throw new Error("useSelection must be used inside SelectionProvider");
  return value;
}
