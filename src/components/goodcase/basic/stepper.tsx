import { Minus, Plus } from "lucide-react";
import { useId, useState, useEffect } from "react";
import { IconButton } from "./button";
import { Input } from "./input";
import type { FieldProps } from "./field";
import { createStepperRange } from "./stepper-value";

export type StepperProps = FieldProps & {
  value: number;
  onValueChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  isDisabled?: boolean;
  isReadOnly?: boolean;
  id?: string;
  name?: string;
};

export function Stepper({
  label,
  value,
  onValueChange,
  min = 0,
  max,
  step = 1,
  isDisabled = false,
  isReadOnly = false,
  description,
  error,
  id,
  name,
}: StepperProps) {
  const generated = useId();
  const inputId = id ?? generated;
  const range = createStepperRange(min, max, step);
  const currentValue = range.normalize(value);
  const [draft, setDraft] = useState<{
    text: string;
    sourceValue: number;
  } | null>(null);
  // The draft is only an in-progress edit; rejected and delayed commits keep displaying value.
  useEffect(
    () => setDraft(null),
    [currentValue, min, max, step, isDisabled, isReadOnly],
  );
  const hasDraft = draft !== null && draft.sourceValue === currentValue;
  const inputValue = hasDraft ? draft.text : String(currentValue);
  const hasDraftNumber =
    inputValue.trim() !== "" && Number.isFinite(Number(inputValue));
  const draftValue = hasDraftNumber
    ? range.normalize(Number(inputValue))
    : currentValue;
  const canDecrease =
    !isDisabled && !isReadOnly && range.move(draftValue, -1) < draftValue;
  const canIncrease =
    !isDisabled && !isReadOnly && range.move(draftValue, 1) > draftValue;
  const apply = (next: number) => {
    const normalized = range.normalize(next);
    setDraft(null);
    if (normalized !== value) onValueChange(normalized);
  };
  return (
    <div className="gc-field gc-stepper">
      <label htmlFor={inputId}>{label}</label>
      <div
        className="gc-stepper-control"
        data-disabled={isDisabled || undefined}
      >
        <IconButton
          label={`${label} 줄이기`}
          disabled={!canDecrease}
          onClick={() => apply(range.move(draftValue, -1))}
        >
          <Minus size={18} aria-hidden="true" />
        </IconButton>
        <Input
          id={inputId}
          name={name}
          type="number"
          inputMode="decimal"
          className="gc-stepper-input"
          value={inputValue}
          min={range.min}
          max={range.max}
          step={range.step}
          disabled={isDisabled}
          readOnly={isReadOnly}
          aria-invalid={!!error}
          aria-describedby={
            error || description ? `${inputId}-help` : undefined
          }
          onChange={(event) =>
            setDraft({ text: event.target.value, sourceValue: currentValue })
          }
          onBlur={() => {
            if (!isDisabled && !isReadOnly) apply(draftValue);
          }}
          onKeyDown={(event) => {
            if (isDisabled || isReadOnly) return;
            if (event.key === "ArrowUp" || event.key === "ArrowDown") {
              event.preventDefault();
              apply(range.move(draftValue, event.key === "ArrowUp" ? 1 : -1));
            } else if (event.key === "Home") {
              event.preventDefault();
              apply(range.min);
            } else if (event.key === "End" && range.max !== undefined) {
              event.preventDefault();
              apply(range.max);
            } else if (event.key === "Enter") {
              event.preventDefault();
              apply(draftValue);
            }
          }}
        />
        <IconButton
          label={`${label} 늘리기`}
          disabled={!canIncrease}
          onClick={() => apply(range.move(draftValue, 1))}
        >
          <Plus size={18} aria-hidden="true" />
        </IconButton>
      </div>
      {(error || description) && (
        <small
          id={`${inputId}-help`}
          className={error ? "gc-error" : "gc-help"}
        >
          {error || description}
        </small>
      )}
    </div>
  );
}
