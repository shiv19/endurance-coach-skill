/**
 * Normalize a numeric input to a positive integer using a fallback when the input is missing or invalid.
 *
 * @param value - The numeric input to normalize; may be `undefined`, `NaN`, or non-positive
 * @param fallback - The fallback positive integer to return when `value` is missing, `NaN`, or <= 0
 * @returns The floored integer of `value` when `value` is greater than 0, otherwise `fallback`
 */
export function toPositiveInt(value: number | undefined, fallback: number): number {
  if (value === undefined || Number.isNaN(value)) return fallback;
  const floored = Math.floor(value);
  return floored > 0 ? floored : fallback;
}
