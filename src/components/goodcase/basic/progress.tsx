import { useId, useRef, useState, useLayoutEffect } from "react";

export function Progress({
  label,
  value,
  size = "regular",
}: {
  label: string;
  value?: number;
  size?: "thin" | "regular" | "thick";
}) {
  const labelId = useId();
  const meterRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const numberRef = useRef<HTMLSpanElement>(null);
  const [placement, setPlacement] = useState<{
    mode: "inside" | "outside" | "below";
    left: number;
  }>({ mode: "below", left: 0 });
  const normalized =
    value === undefined || !Number.isFinite(value)
      ? undefined
      : Math.min(100, Math.max(0, value));
  const isIndeterminate = normalized === undefined;
  const percentage =
    normalized === undefined ? undefined : `${Math.round(normalized)}%`;
  useLayoutEffect(() => {
    if (size !== "thick" || normalized === undefined) return;
    const track = trackRef.current;
    const number = numberRef.current;
    const meter = meterRef.current;
    if (!track || !number || !meter) return;
    let isActive = true;
    function measure() {
      if (!isActive || !track || !number || !meter) return;
      // Measure the actual styled text plus its token padding, even when the below fallback wraps.
      const previousMaxWidth = number.style.maxWidth;
      const previousWhiteSpace = number.style.whiteSpace;
      const previousPadding = number.style.paddingInline;
      const gap = parseFloat(getComputedStyle(meter).rowGap) || 0;
      number.style.paddingInline = `${gap}px`;
      number.style.maxWidth = "none";
      number.style.whiteSpace = "nowrap";
      const textWidth = number.getBoundingClientRect().width;
      number.style.maxWidth = previousMaxWidth;
      number.style.whiteSpace = previousWhiteSpace;
      number.style.paddingInline = previousPadding;
      const trackWidth = track.getBoundingClientRect().width;
      const fillWidth = (trackWidth * normalized!) / 100;
      const mode =
        fillWidth >= textWidth
          ? "inside"
          : trackWidth - fillWidth >= textWidth + gap
            ? "outside"
            : "below";
      const left =
        mode === "inside"
          ? fillWidth / 2
          : mode === "outside"
            ? fillWidth + gap
            : 0;
      setPlacement((current) =>
        current.mode === mode && Math.abs(current.left - left) < 0.01
          ? current
          : { mode, left },
      );
    }
    measure();
    const resize = new ResizeObserver(measure);
    resize.observe(track);
    resize.observe(number);
    const mutation = new MutationObserver(measure);
    // Theme, density, font and token overrides can change without changing the track width.
    for (
      let ancestor: HTMLElement | null = meter;
      ancestor;
      ancestor = ancestor.parentElement
    )
      mutation.observe(ancestor, {
        attributes: true,
        attributeFilter: ["class", "style", "data-theme", "data-density"],
      });
    document.fonts.addEventListener("loadingdone", measure);
    void document.fonts.ready.then(measure);
    return () => {
      isActive = false;
      resize.disconnect();
      mutation.disconnect();
      document.fonts.removeEventListener("loadingdone", measure);
    };
  }, [size, normalized, percentage]);
  return (
    <div className={`gc-progress gc-progress-${size}`}>
      <div className="gc-progress-label">
        <span id={labelId}>{label}</span>
        {size !== "thick" && percentage && (
          <span aria-hidden="true">{percentage}</span>
        )}
      </div>
      <div
        ref={meterRef}
        className={`gc-progress-meter gc-progress-number-${placement.mode}`}
      >
        <div
          ref={trackRef}
          className={`gc-progress-track ${isIndeterminate ? "gc-progress-indeterminate" : ""}`}
          role="progressbar"
          aria-labelledby={labelId}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={normalized}
          aria-valuetext={isIndeterminate ? "처리 중" : percentage}
        >
          <span
            className="gc-progress-fill"
            style={isIndeterminate ? undefined : { width: `${normalized}%` }}
          />
        </div>
        {size === "thick" && percentage && (
          <span
            ref={numberRef}
            className="gc-progress-number"
            style={
              placement.mode === "below" ? undefined : { left: placement.left }
            }
            aria-hidden="true"
          >
            {percentage}
          </span>
        )}
      </div>
    </div>
  );
}
