import type { ReactNode } from "react";
import { HoverCard as RHoverCard } from "radix-ui";

/** 마우스를 올리고 delay(ms)가 지나면 뜨는 보조 카드. 터치에서는 열리지 않는다. */
export function HoverCard({
  trigger,
  children,
  delay = 500,
}: {
  trigger: ReactNode;
  children: ReactNode;
  delay?: number;
}) {
  return (
    <RHoverCard.Root openDelay={delay} closeDelay={100}>
      <RHoverCard.Trigger asChild>{trigger}</RHoverCard.Trigger>
      <RHoverCard.Portal>
        <RHoverCard.Content className="gc-floating" sideOffset={8} collisionPadding={12}>
          {children}
        </RHoverCard.Content>
      </RHoverCard.Portal>
    </RHoverCard.Root>
  );
}
