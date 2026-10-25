import { useId } from "react";

export function RadioGroup({
  label,
  value,
  options,
  onValueChange,
  isDisabled = false,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onValueChange: (value: string) => void;
  isDisabled?: boolean;
}) {
  const name = useId();
  return (
    <fieldset className="gc-radio" disabled={isDisabled}>
      <legend>{label}</legend>
      {options.map((option) => (
        <label className="gc-choice" key={option.value}>
          <input
            className="gc-radio-input"
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            onChange={() => onValueChange(option.value)}
          />
          {option.label}
        </label>
      ))}
    </fieldset>
  );
}
