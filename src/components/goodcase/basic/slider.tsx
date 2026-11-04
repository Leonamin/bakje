import { useId, useState, type CSSProperties } from "react";
import type { FieldProps } from "./field";

export type SliderProps = FieldProps & {
  value: number;
  onValueChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  valueText?: string;
  size?: "regular" | "thick";
  hasMarks?: boolean;
  isDisabled?: boolean;
};
export function Slider({
  label,
  value,
  onValueChange,
  min = 0,
  max = 100,
  step = 1,
  valueText = String(value),
  size = "regular",
  hasMarks = false,
  isDisabled = false,
  description,
  error,
}: SliderProps) {
  const id = useId();
  const [isDragging, setIsDragging] = useState(false);
  const [hoverRatio, setHoverRatio] = useState<number>();
  const ratio =
    max > min ? Math.min(1, Math.max(0, (value - min) / (max - min))) : 0;
  // ponytail: dots assume (max-min) is a multiple of step; otherwise the last dot is off.
  const markCount =
    hasMarks && step > 0 && max > min ? Math.round((max - min) / step) : 0;
  return (
    <div className={`gc-field gc-slider gc-slider-${size}`}>
      <div className="gc-slider-heading">
        <label htmlFor={id}>{label}</label>
        <output htmlFor={id} aria-hidden="true">
          {valueText}
        </output>
      </div>
      <input
        id={id}
        className="gc-slider-input"
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        disabled={isDisabled}
        data-marks={markCount > 0 || undefined}
        data-dragging={(isDragging && !isDisabled) || undefined}
        onPointerDown={(event) => {
          if (isDisabled || !event.isPrimary || event.button !== 0) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          setIsDragging(true);
        }}
        onPointerMove={(event) => {
          // Touch has no hover; the dot would only flicker while dragging.
          if (markCount < 1 || isDisabled || event.pointerType === "touch")
            return;
          // Snap to the nearest step; thumb centre travels thumb/2 .. width - thumb/2.
          const el = event.currentTarget;
          const rect = el.getBoundingClientRect();
          const thumb =
            parseFloat(
              getComputedStyle(el).getPropertyValue("--gc-slider-thumb-size"),
            ) || 0;
          const raw =
            (event.clientX - rect.left - thumb / 2) / (rect.width - thumb);
          const next =
            Math.round(Math.min(1, Math.max(0, raw)) * markCount) / markCount;
          setHoverRatio((current) => (current === next ? current : next));
        }}
        onPointerLeave={() => setHoverRatio(undefined)}
        onPointerUp={() => setIsDragging(false)}
        onPointerCancel={() => setIsDragging(false)}
        onLostPointerCapture={() => setIsDragging(false)}
        onBlur={() => setIsDragging(false)}
        aria-valuetext={valueText}
        aria-invalid={!!error}
        aria-describedby={error || description ? `${id}-help` : undefined}
        style={
          {
            "--gc-slider-ratio": ratio,
            "--gc-slider-mark-count": markCount || undefined,
            "--gc-slider-hover-ratio": hoverRatio,
          } as CSSProperties
        }
        onChange={(event) => onValueChange(Number(event.target.value))}
      />
      {(error || description) && (
        <small id={`${id}-help`} className={error ? "gc-error" : "gc-help"}>
          {error || description}
        </small>
      )}
    </div>
  );
}
