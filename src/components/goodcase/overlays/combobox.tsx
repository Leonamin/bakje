import { useEffect, useId, useRef, useState } from "react";
import { Popover as RPopover } from "radix-ui";
import { Check, ChevronDown } from "lucide-react";
import type { Option } from "./types";

export function Combobox({
  label,
  value,
  onValueChange,
  options,
  isLoading = false,
  isDisabled = false,
}: {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: Option[];
  isLoading?: boolean;
  isDisabled?: boolean;
}) {
  const id = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeValue, setActiveValue] = useState<string | null>(null);
  const isComposing = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const selected = options.find((option) => option.value === value);
  const matches = options.filter((option) =>
    option.label.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
  );
  const available = matches.filter((option) => !option.isDisabled);
  const activeOption =
    available.find((option) => option.value === activeValue) ?? available[0];
  const activeIndex = activeOption ? available.indexOf(activeOption) : -1;
  useEffect(() => {
    setActiveValue(activeOption?.value ?? null);
    if (isOpen && !isLoading && activeOption)
      document
        .getElementById(`${id}-option-${activeIndex}`)
        ?.scrollIntoView({ block: "nearest" });
  }, [activeOption?.value, activeIndex, id, isOpen, isLoading, query]);
  const choose = (option: Option) => {
    onValueChange(option.value);
    setIsOpen(false);
    setQuery("");
    inputRef.current?.focus();
  };
  return (
    <div className="gc-overlay-field">
      <label htmlFor={id}>{label}</label>
      <RPopover.Root
        open={isOpen}
        onOpenChange={(next) => {
          setIsOpen(next);
          if (!next) setQuery("");
        }}
      >
        <RPopover.Anchor asChild>
          <div className="gc-combobox-input">
            <input
              ref={inputRef}
              id={id}
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={isOpen}
              aria-controls={`${id}-list`}
              aria-activedescendant={
                isOpen && !isLoading && available[activeIndex]
                  ? `${id}-option-${activeIndex}`
                  : undefined
              }
              disabled={isDisabled}
              value={isOpen ? query : (selected?.label ?? "")}
              placeholder="검색해서 선택"
              onFocus={() => {
                setQuery("");
                setActiveValue(null);
                setIsOpen(true);
              }}
              onClick={() => {
                if (!isOpen) {
                  setQuery("");
                  setActiveValue(null);
                  setIsOpen(true);
                }
              }}
              onChange={(event) => {
                setQuery(event.target.value);
                setActiveValue(null);
                setIsOpen(true);
              }}
              onCompositionStart={() => {
                isComposing.current = true;
              }}
              onCompositionEnd={() => {
                isComposing.current = false;
              }}
              onKeyDown={(event) => {
                if (isComposing.current || event.nativeEvent.isComposing)
                  return;
                if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                  event.preventDefault();
                  setIsOpen(true);
                  const nextIndex = Math.max(
                    0,
                    Math.min(
                      available.length - 1,
                      activeIndex + (event.key === "ArrowDown" ? 1 : -1),
                    ),
                  );
                  setActiveValue(available[nextIndex]?.value ?? null);
                }
                if (event.key === "Enter" && isOpen) {
                  event.preventDefault();
                  if (!isLoading && activeOption) choose(activeOption);
                }
                if (event.key === "Tab") {
                  setIsOpen(false);
                  setQuery("");
                }
                if (event.key === "Escape") {
                  event.preventDefault();
                  setIsOpen(false);
                  setQuery("");
                }
              }}
            />
            <ChevronDown size={16} />
          </div>
        </RPopover.Anchor>
        <RPopover.Portal>
          <RPopover.Content
            className="gc-floating gc-combobox-list"
            role="presentation"
            sideOffset={6}
            onInteractOutside={(event) => {
              if (event.target === inputRef.current) event.preventDefault();
            }}
            onOpenAutoFocus={(event) => event.preventDefault()}
            onCloseAutoFocus={(event) => event.preventDefault()}
          >
            <div
              id={`${id}-list`}
              role="listbox"
              aria-label={label}
              aria-busy={isLoading}
            >
              {isLoading ? (
                <p role="status">목록을 불러오는 중…</p>
              ) : matches.length === 0 ? (
                <p role="status">검색 결과가 없습니다.</p>
              ) : (
                matches.map((option) => {
                  const index = available.indexOf(option);
                  return (
                    <div
                      key={option.value}
                      id={index >= 0 ? `${id}-option-${index}` : undefined}
                      role="option"
                      aria-selected={option.value === value}
                      aria-disabled={option.isDisabled}
                      className={`gc-option ${index >= 0 && index === activeIndex ? "is-highlighted" : ""}`}
                      onPointerMove={() => {
                        if (index >= 0) setActiveValue(option.value);
                      }}
                      onPointerDown={(event) => event.preventDefault()}
                      onClick={() => {
                        if (!option.isDisabled) choose(option);
                      }}
                    >
                      {option.label}
                      {option.value === value && <Check size={15} />}
                    </div>
                  );
                })
              )}
            </div>
          </RPopover.Content>
        </RPopover.Portal>
      </RPopover.Root>
    </div>
  );
}
