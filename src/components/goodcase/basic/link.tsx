import type { AnchorHTMLAttributes } from "react";

export function Link({
  children,
  shouldLookLikeButton = false,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & {
  shouldLookLikeButton?: boolean;
}) {
  return (
    <a
      {...props}
      className={`gc-link ${shouldLookLikeButton ? "gc-link-button" : ""} ${props.className ?? ""}`}
    >
      {children}
    </a>
  );
}
