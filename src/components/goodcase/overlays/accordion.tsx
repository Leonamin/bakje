import type { ReactNode } from "react";
import { Accordion as RAccordion } from "radix-ui";
import { ChevronDown } from "lucide-react";

export function Accordion({
  items,
  hasAnimation = true,
}: {
  items: {
    value: string;
    title: string;
    content: ReactNode;
    isDisabled?: boolean;
  }[];
  hasAnimation?: boolean;
}) {
  return (
    <RAccordion.Root
      type="multiple"
      className={`gc-accordion${hasAnimation ? " gc-accordion-animated" : ""}`}
    >
      {items.map((item) => (
        <RAccordion.Item
          key={item.value}
          value={item.value}
          disabled={item.isDisabled}
        >
          <RAccordion.Header>
            <RAccordion.Trigger>
              {item.title}
              <ChevronDown size={16} />
            </RAccordion.Trigger>
          </RAccordion.Header>
          <RAccordion.Content>
            <div>{item.content}</div>
          </RAccordion.Content>
        </RAccordion.Item>
      ))}
    </RAccordion.Root>
  );
}
