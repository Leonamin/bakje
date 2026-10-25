type Decimal = { coefficient: bigint; exponent: number };

function decimal(value: number): Decimal {
  const [base, exponent = "0"] = String(value).toLowerCase().split("e");
  const [integer, fraction = ""] = base.split(".");
  return {
    coefficient: BigInt(`${integer}${fraction}`),
    exponent: Number(exponent) - fraction.length,
  };
}

function scaledInteger(value: Decimal, precision: number) {
  return value.coefficient * 10n ** BigInt(value.exponent + precision);
}

function numberFromInteger(value: bigint, precision: number) {
  // Convert after applying the exponent, so a large intermediate integer cannot overflow.
  return Number(`${value}e-${precision}`);
}

/** A min-anchored decimal grid shared by buttons, keyboard and direct edits. */
export function createStepperRange(
  min: number,
  max: number | undefined,
  step: number,
) {
  const minimum = Number.isFinite(min) ? min : 0;
  const increment = Number.isFinite(step) && step > 0 ? step : 1;
  const limit =
    max !== undefined && Number.isFinite(max)
      ? Math.max(minimum, max)
      : undefined;
  const minimumDecimal = decimal(minimum);
  const incrementDecimal = decimal(increment);
  // Number.MAX_VALUE bounds arithmetic even when the public control has no max.
  const limitDecimal = decimal(limit ?? Number.MAX_VALUE);
  const precision = Math.max(
    0,
    -minimumDecimal.exponent,
    -incrementDecimal.exponent,
    -limitDecimal.exponent,
  );
  const minimumInteger = scaledInteger(minimumDecimal, precision);
  const incrementInteger = scaledInteger(incrementDecimal, precision);
  const lastIndex =
    (scaledInteger(limitDecimal, precision) - minimumInteger) /
    incrementInteger;
  const atIndex = (index: bigint) =>
    numberFromInteger(minimumInteger + index * incrementInteger, precision);
  const upperBound = atIndex(lastIndex);

  const indexOf = (next: number) => {
    if (!Number.isFinite(next) || next <= minimum) return 0n;
    if (next >= upperBound) return lastIndex;
    const nextDecimal = decimal(next);
    const workingPrecision = Math.max(precision, -nextDecimal.exponent);
    const multiplier = 10n ** BigInt(workingPrecision - precision);
    const difference =
      scaledInteger(nextDecimal, workingPrecision) -
      minimumInteger * multiplier;
    const divisor = incrementInteger * multiplier;
    const nearest =
      difference / divisor + (2n * (difference % divisor) >= divisor ? 1n : 0n);
    return nearest > lastIndex ? lastIndex : nearest;
  };

  return {
    min: minimum,
    max: limit === undefined ? undefined : upperBound,
    step: increment,
    normalize: (next: number) => atIndex(indexOf(next)),
    move: (current: number, direction: -1 | 1) => {
      const nextIndex = indexOf(current) + BigInt(direction);
      if (nextIndex < 0n) return minimum;
      if (nextIndex > lastIndex) return upperBound;
      return atIndex(nextIndex);
    },
  };
}
