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
 * Convert a slash-separated string into pair of a numerator and a denominator.
 * Compared to `Fraction` has extra support for negative denominators.
 * @param input String to parse.
 * @returns An array of integers `[numerator, denominator]`.
 */
export function stringToNumeratorDenominator(input: string): [number, number] {
  const slashes = input.match(/\//g);
  if (slashes && slashes.length > 1) {
    throw new Error('Too many slashes for a fraction');
  }
  if (slashes === null) {
    return [parseInt(input), 1];
  }
  const [numerator, denominator] = input.split('/');
  return [parseInt(numerator), parseInt(denominator)];
}

export type MetricPrefix =
  | 'Q'
  | 'R'
  | 'Y'
  | 'Z'
  | 'E'
  | 'P'
  | 'T'
  | 'G'
  | 'M'
  | 'k'
  | 'h'
  | 'da'
  | ''
  | 'd'
  | 'c'
  | 'm'
  | 'µ'
  | 'n'
  | 'p'
  | 'f'
  | 'a'
  | 'z'
  | 'y'
  | 'r'
  | 'q';

export function metricPrefix(prefix: MetricPrefix): Fraction {
  switch (prefix) {
    case 'Q':
      return new Fraction(1e30);
    case 'R':
      return new Fraction(1e27);
    case 'Y':
      return new Fraction(1e24);
    case 'Z':
      return new Fraction(1e21);
    case 'E':
      return new Fraction(1e18);
    case 'P':
      return new Fraction(1e15);
    case 'T':
      return new Fraction(1e12);
    case 'G':
      return new Fraction(1e9);
    case 'M':
      return new Fraction(1e6);
    case 'k':
      return new Fraction(1e3);
    case 'h':
      return new Fraction(1e2);
    case 'da':
      return new Fraction(1e1);
    case '':
      return new Fraction(1);
    case 'd':
      return new Fraction(1, 10);
    case 'c':
      return new Fraction(1, 100);
    case 'm':
      return new Fraction(1, 1000);
    case '\u00B5':
      return new Fraction(1, 1e6);
    case 'n':
      return new Fraction(1, 1e9);
    case 'p':
      return new Fraction(1, 1e12);
    case 'f':
      return new Fraction(1, 1e15);
    case 'a':
      return new Fraction(1, 1e18);
    case 'z':
      return new Fraction(1, 1e21);
    case 'y':
      return new Fraction(1, 1e24);
    case 'r':
      return new Fraction(1, 1e27);
    case 'q':
      return new Fraction(1, 1e30);
    default:
      throw new Error(`Unrecognized prefix ${prefix}`);
  }
}
