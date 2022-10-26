import {Fraction} from 'xen-dev-utils';

/**
 * Check if the fraction exactly representable as a `Number`.
 * @param fraction Input fraction.
 * @returns `true` if both numerator, numerator + 1, denominator and denominator + 1 are exactly representable.
 */
export function isSafeFraction(fraction: Fraction) {
  return (
    fraction.n <= Number.MAX_SAFE_INTEGER &&
    fraction.d <= Number.MAX_SAFE_INTEGER
  );
}

/**
 * Convert fraction to a string.
 * @param fraction Input fraction.
 * @param preferredNumerator Preferred numerator if expansion is possible.
 * @param preferredDenominator Preferred denominator if expansion is possible.
 * @returns The fraction formatted as a string.
 */
export function fractionToString(
  fraction: Fraction,
  preferredNumerator?: number,
  preferredDenominator?: number
) {
  const numerator = fraction.n * fraction.s;
  if (preferredNumerator === undefined) {
    if (
      preferredDenominator === undefined ||
      fraction.d === preferredDenominator
    ) {
      return `${numerator}/${fraction.d}`;
    }
    if (preferredDenominator % fraction.d === 0) {
      const multiplier = preferredDenominator / fraction.d;
      return `${numerator * multiplier}/${fraction.d * multiplier}`;
    }
    return `${numerator}/${fraction.d}`;
  }
  if (fraction.n === preferredNumerator) {
    return `${numerator}/${fraction.d}`;
  }
  if (preferredNumerator % fraction.n === 0) {
    const multiplier = preferredNumerator / fraction.n;
    return `${numerator * multiplier}/${fraction.d * multiplier}`;
  }
  return `${numerator}/${fraction.d}`;
}
