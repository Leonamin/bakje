import type { ReactNode } from "react";

export function Grid({
  children,
  minWidth = 180,
}: {
  children: ReactNode;
  minWidth?: number;
}) {
  return (
    <div
      className="gc-grid"
      style={{
        gridTemplateColumns: `repeat(auto-fit,minmax(min(100%, ${minWidth}px),1fr))`,
      }}
    >
      {children}
    </div>
  );
}
