import type { ReactNode } from "react";

export function Stack({
  children,
  direction = "column",
  gap = 16,
}: {
  children: ReactNode;
  direction?: "row" | "column";
  gap?: number;
}) {
  return (
    <div className="gc-stack" style={{ flexDirection: direction, gap }}>
      {children}
    </div>
  );
}
