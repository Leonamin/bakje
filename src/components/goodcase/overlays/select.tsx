"use client";

import { useId } from "react";
import { Select as RSelect } from "radix-ui";
import { Check, ChevronDown } from "lucide-react";
import type { Option } from "./types";

export function Select({
  label,
  value,
  onValueChange,
  options,
  isDisabled = false,
  placeholder = "선택하세요",
  className,
}: {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: Option[];
  isDisabled?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const id = useId();
  // Radix reserves an empty item value for its placeholder. Encode every
  // option so callers can use "" for an explicit "all"/reset option too.
  const encode = (value: string) => `option:${value}`;
  const selected = value || options.some((option) => option.value === "")
    ? encode(value)
    : "";
  return (
    <div className={`gc-overlay-field ${className ?? ""}`}>
      <label id={id}>{label}</label>
      <RSelect.Root
        value={selected}
        onValueChange={(next) => onValueChange(next.slice("option:".length))}
        disabled={isDisabled}
      >
        <RSelect.Trigger className="gc-select" aria-labelledby={id}>
          <RSelect.Value placeholder={placeholder} />
          <RSelect.Icon>
            <ChevronDown size={16} />
          </RSelect.Icon>
        </RSelect.Trigger>
        <RSelect.Portal>
          <RSelect.Content
            className="gc-floating gc-select-content"
            position="popper"
            sideOffset={6}
          >
            <RSelect.ScrollUpButton>↑</RSelect.ScrollUpButton>
            <RSelect.Viewport>
              {options.map((option) => (
                <RSelect.Item
                  className="gc-option"
                  data-value={option.value}
                  key={option.value}
                  value={encode(option.value)}
                  disabled={option.isDisabled}
                >
                  <RSelect.ItemText>{option.label}</RSelect.ItemText>
                  <RSelect.ItemIndicator>
                    <Check size={15} />
                  </RSelect.ItemIndicator>
                </RSelect.Item>
              ))}
            </RSelect.Viewport>
            <RSelect.ScrollDownButton>↓</RSelect.ScrollDownButton>
          </RSelect.Content>
        </RSelect.Portal>
      </RSelect.Root>
    </div>
  );
}
