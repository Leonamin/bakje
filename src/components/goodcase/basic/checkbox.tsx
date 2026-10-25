import { useRef, useEffect } from "react";

export function Checkbox({
  label,
  isChecked,
  isMixed = false,
  isDisabled = false,
  shouldHideLabel = false,
  onCheckedChange,
}: {
  label: string;
  isChecked: boolean;
  isMixed?: boolean;
  isDisabled?: boolean;
  shouldHideLabel?: boolean;
  onCheckedChange: (isChecked: boolean) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = isMixed;
  }, [isMixed]);
  return (
    <label className="gc-choice">
      <input
        className="gc-checkbox-input"
        type="checkbox"
        ref={ref}
        checked={isChecked}
        disabled={isDisabled}
        onChange={(event) => onCheckedChange(event.target.checked)}
      />
      <span className={shouldHideLabel ? "gc-sr-only" : undefined}>
        {label}
      </span>
    </label>
  );
}
