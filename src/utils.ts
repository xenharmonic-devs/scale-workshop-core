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

/**
 * Convert fraction to a string.
 * @param preferredNumerator Preferred numerator if expansion is possible.
 * @param preferredDenominator Preferred denominator if expansion is possible.
 * @returns The fraction formatted as a string.
 */
export function bigNumeratorDenominatorToString(
  numerator: bigint,
  denominator: bigint,
  preferredNumerator?: bigint,
  preferredDenominator?: bigint
) {
  if (preferredNumerator === undefined) {
    if (
      preferredDenominator === undefined ||
      denominator === preferredDenominator
    ) {
      return `${numerator}/${denominator}`;
    }
    if (preferredDenominator % denominator === BigInt(0)) {
      const multiplier = preferredDenominator / denominator;
      return `${numerator * multiplier}/${denominator * multiplier}`;
    }
    return `${numerator}/${denominator}`;
  }
  if (numerator === preferredNumerator) {
    return `${numerator}/${denominator}`;
  }
  if (preferredNumerator % numerator === BigInt(0)) {
    const multiplier = preferredNumerator / numerator;
    return `${numerator * multiplier}/${denominator * multiplier}`;
  }
  return `${numerator}/${denominator}`;
}

/**
 * Convert a slash-separated string into pair of a numerator and a denominator.
 * Compared to `Fraction` has extra support for negative denominators.
 * @param input String to parse.
 * @returns An array of integers `[numerator, denominator]`.
 */
export function stringToNumeratorDenominator(input: string): [bigint, bigint] {
  const slashes = input.match(/\//g);
  if (slashes && slashes.length > 1) {
    throw new Error('Too many slashes for a fraction');
  }
  if (slashes === null) {
    return [BigInt(input), BigInt(1)];
  }
  const [numerator, denominator] = input.split('/');
  return [BigInt(numerator), BigInt(denominator)];
}
