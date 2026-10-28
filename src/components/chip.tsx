import type { ComponentProps } from "react";
import { Button } from "@/components/goodcase/basic/button";

/** The one pill-shaped toggle/action used by library filters. `active` makes it a toggle (aria-pressed + highlight). */
export function Chip({ active, className = "", ...props }: Omit<ComponentProps<typeof Button>, "variant"> & { active?: boolean }) {
  return <Button {...props} variant="secondary" aria-pressed={active} data-active={active} className={`chip shrink-0 ${className}`} />;
}
