import type { ReactNode } from "react";

export function Typography({
  children,
  variant = "body",
}: {
  children: ReactNode;
  variant?: "title" | "heading" | "body" | "caption";
}) {
  return variant === "title" ? (
    <h2 className="gc-type-title">{children}</h2>
  ) : variant === "heading" ? (
    <h3 className="gc-type-heading">{children}</h3>
  ) : (
    <p className={`gc-type-${variant}`}>{children}</p>
  );
}
