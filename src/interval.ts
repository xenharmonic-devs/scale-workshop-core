import {ExtendedMonzo} from './monzo';
import {fractionToString, isSafeFraction} from './utils';
import {Fraction} from 'xen-dev-utils';

/** Interval formatting options. */
export type IntervalOptions = {
  /** Prevent formatting as a monzo. */
  forbidMonzo?: boolean;
  /** Prevent formatting as a composite interval. */
  forbidComposite?: boolean;
  /** Preferred numerator when formatted as a fraction. */
  preferredNumerator?: number;
  /** Preferred denominator when formatted as a fraction. */
  preferredDenominator?: number;
  /** Preferred denomimator when formatted as equal temperament. */
  preferredEtDenominator?: number;
  /** Preferred equave when formatted as equal temperament. */
  preferredEtEquave?: Fraction;
  /** Number of digits after the decimal point when formatted as cents offset. */
  centsFractionDigits?: number;
  /** Number of digits after the decimal comma when formatted as frequency-space ratio. */
  decimalFractionDigits?: number;
};

/**
 * Merge two formatting options.
 * @param a Base options.
 * @param b New options. Takes priority for duplicate keys.
 * @returns Options merged from `a` and `b`.
 */
function mergeOptions(a: IntervalOptions, b: IntervalOptions) {
  const result = Object.assign({}, a);
  Object.keys(b).forEach(key => {
    const value = b[key as keyof IntervalOptions];
    if (value !== undefined) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (result as any)[key] = value;
    }
  });
  return result;
}

/** Interval formatting type. */
export type IntervalType =
  | 'cents'
  | 'decimal'
  | 'monzo'
  | 'equal temperament'
  | 'ratio'
  | 'any';

/**
 * Musical interval with preferred text formatting.
 * Used for scale lines in format-aware scale generation.
 * Note that the line type and formatting options are preferences and cannot always be enforced.
 */
export class Interval {
  monzo: ExtendedMonzo;
  type: IntervalType;
  name: string;
  options: IntervalOptions;

  /**
   * Construct a new interval.
   * @param monzo Extended monzo representing the pitch information.
   * @param type Formatting type.
   * @param name Arbitrary name for the interval, usually a short-form without a cents offset.
   * @param options Formatting options.
   */
  constructor(
    monzo: ExtendedMonzo,
    type: IntervalType,
    name?: string,
    options?: IntervalOptions
  ) {
    this.monzo = monzo;
    this.type = type;
    this.options = options || {};
    this.name = name || this.toString();
  }

  /**
   * Unison that is compatible with the interval.
   * @returns The interval multiplied by zero in pitch-space.
   */
  zeroed() {
    return new Interval(this.monzo.mul(0), this.type, undefined, this.options);
  }

  /**
   * Rescale the interval in pitch-space and store the offset as cents.
   * @param scalar Scaling factor.
   * @returns The rescaled interval where only the cents offset differs from the original.
   */
  stretch(scalar: number) {
    return new Interval(
      this.monzo.stretch(scalar),
      this.type,
      this.name,
      this.options
    );
  }

  /**
   * Return a pitch-space negative of the interval.
   * @returns The frequency-space inverse of the interval.
   */
  neg() {
    const options = Object.assign({}, this.options);
    options.preferredDenominator = this.options.preferredNumerator;
    options.preferredNumerator = this.options.preferredDenominator;

    return new Interval(this.monzo.neg(), this.type, undefined, options);
  }

  /**
   * Combine the interval with another in pitch-space.
   * @param other Another interval.
   * @returns The product of the intervals in frequency-space.
   */
  add(other: Interval): Interval {
    const monzo = this.monzo.add(other.monzo);
    const options = mergeOptions(this.options, other.options);
    if (this.type === 'cents') {
      if (other.type === 'cents') {
        return new Interval(monzo, other.type, undefined, options);
      } else {
        return new Interval(monzo, other.type, other.name, options);
      }
    }
    if (other.type === 'cents') {
      return new Interval(monzo, this.type, this.name, options);
    }
    if (this.type === 'monzo') {
      if (other.type === 'monzo' || other.type === 'equal temperament') {
        return new Interval(monzo, this.type, undefined, options);
      }
      if (other.type === 'ratio' && other.monzo.residual.equals(1)) {
        return new Interval(monzo, this.type, undefined, options);
      }
      return new Interval(monzo, 'any', undefined, options);
    }
    if (other.type === 'monzo') {
      return other.add(this);
    }
    if (this.type === other.type) {
      return new Interval(monzo, this.type, undefined, options);
    }
    return new Interval(monzo, 'any', undefined, options);
  }

  /**
   * Subtract another interval from this one in pitch-space.
   * @param other Another interval.
   * @returns This interval divided by the other in frequency-space.
   */
  sub(other: Interval) {
    return this.add(other.neg());
  }

  /**
   * Rescale the interval in pitch-space.
   * @param scalar Scaling factor.
   * @returns The rescaled interval.
   */
  mul(scalar: number | Fraction) {
    let type = this.type;
    if (this.type === 'ratio' && scalar instanceof Fraction && scalar.d !== 1) {
      type = 'equal temperament';
    }
    return new Interval(this.monzo.mul(scalar), type, undefined, this.options);
  }

  /**
   * Inverse rescale the interval in pitch-space.
   * @param scalar Inverse scaling factor.
   * @returns The rescaled interval.
   */
  div(scalar: number | Fraction) {
    let type = this.type;
    if (this.type === 'ratio') {
      if (typeof scalar === 'number' && scalar !== 1) {
        type = 'equal temperament';
      }
      if (scalar instanceof Fraction && scalar.n !== 1) {
        type = 'equal temperament';
      }
    }
    return new Interval(this.monzo.div(scalar), type, undefined, this.options);
  }

  /**
   * Calculate modulus with respect to another interval.
   * @param other Another interval.
   * @returns This modulo the other.
   */
  mmod(other: Interval) {
    const otherCents = other.monzo.totalCents();
    if (otherCents === 0) {
      throw Error('Modulo by unison');
    }
    const floorDiv = Math.floor(this.monzo.totalCents() / otherCents);
    return this.sub(other.mul(floorDiv));
  }

  /**
   * Check if this interval has the same size as another.
   * @param other Another interval.
   * @returns `true` if the intervals are of equal size.
   */
  equals(other: Interval) {
    return this.monzo.equals(other.monzo);
  }

  /**
   * Compare this interval with another.
   * @param other Another interval.
   * @returns Result < 0 if other is larger than this. Result > 0 if other is smaller than this. Result == 0 if other is equal to this in size.
   */
  compare(other: Interval) {
    return this.monzo.compare(other.monzo);
  }

  /**
   * Convert the interval to cents.
   * @returns Size of the interval in cents.
   */
  totalCents() {
    return this.monzo.totalCents();
  }

  /**
   * Find the closest approximation of the interval in a harmonic series.
   * @param denominator Denominator of the harmonic series.
   * @returns The closest approximant in the series.
   */
  approximateHarmonic(denominator: number) {
    const options = Object.assign({}, this.options);
    options.preferredDenominator = denominator;
    return new Interval(
      this.monzo.approximateHarmonic(denominator),
      'ratio',
      undefined,
      options
    );
  }

  /**
   * Find the closest approximation of the interval in a subharmonic series.
   * @param numerator Numerator of the subharmonic series.
   * @returns The closest approximant in the series.
   */
  approximateSubharmonic(numerator: number) {
    const options = Object.assign({}, this.options);
    options.preferredNumerator = numerator;
    return new Interval(
      this.monzo.approximateSubharmonic(numerator),
      'ratio',
      undefined,
      options
    );
  }

  /**
   * Add a random cents offset to the interval.
   * @param maxCents Maximum possible offset.
   * @returns The interval with a random cents offset.
   */
  vary(maxCents: number) {
    const offset = (Math.random() * 2 - 1) * maxCents;
    const monzo = this.monzo;
    return new Interval(
      new ExtendedMonzo(monzo.vector, monzo.residual, monzo.cents + offset),
      this.type,
      this.name,
      this.options
    );
  }

  /**
   * Merge formatting options with another.
   * @param options New options. Takes priority over existing keys.
   * @returns The interval with the new formatting options.
   */
  mergeOptions(options: IntervalOptions) {
    return new Interval(
      this.monzo.clone(),
      this.type,
      this.name,
      mergeOptions(this.options, options)
    );
  }

  /**
   * Convert the interval to another type.
   * @param type The new formatting type.
   * @param options New formatting options.
   * @returns The interval with the new formatting type and options.
   */
  asType(type: IntervalType, options?: IntervalOptions) {
    return new Interval(
      this.monzo.clone(),
      type,
      undefined,
      options || this.options
    );
  }

  /**
   * Check if the interval is combination of fractional, equal temperament or cents parts.
   * @returns `true` if the interval is not simply fractional, equal temperament or pure cents.
   */
  isComposite() {
    return this.monzo.isComposite();
  }

  /**
   * Monzo representation of the interval.
   * Example: `'[-4, 4, -1>'`
   * @returns The interval formatted as a monzo.
   */
  monzoString() {
    let result = '[';
    for (let i = 0; i < this.monzo.vector.length; ++i) {
      result += this.monzo.vector[i].toFraction();
      if (i < this.monzo.vector.length - 1) {
        result += ', ';
      }
    }
    while (result.endsWith(', 0')) {
      result = result.slice(0, -3);
    }
    return result + '>';
  }

  /**
   * Cents representation the interval.
   * Example: `'700.0'`
   * @param offset Only represent the cents offset.
   * @returns The interval formatted as a decimal cents string.
   */
  centsString(offset = false) {
    let fractionDigits = this.options.centsFractionDigits;
    let cents: number;
    let operation = '';
    if (offset) {
      cents = this.monzo.cents;
      if (cents < 0) {
        operation = ' - ';
        cents = -cents;
      } else if (cents > 0) {
        operation = ' + ';
      } else {
        return '';
      }
    } else {
      cents = this.monzo.toCents();
    }
    if (cents === Math.round(cents)) {
      fractionDigits = undefined;
    }
    let result: string;
    if (fractionDigits === undefined) {
      result = cents.toString();
    } else {
      result = cents.toFixed(fractionDigits);
    }
    if (!result.includes('.')) {
      return operation + result + '.';
    }
    while (result[result.length - 1] === '0') {
      result = result.slice(0, -1);
    }
    return operation + result;
  }

  /**
   * Frequency-space ratio representation of the interval.
   * Example: `'1,5'`
   * @returns The interval formatted as a decimal ratio in frequency-space.
   */
  decimalString() {
    let fractionDigits = this.options.decimalFractionDigits;
    const value = this.monzo.valueOf();
    if (value === Math.round(value)) {
      fractionDigits = undefined;
    }
    let result;
    if (fractionDigits === undefined) {
      result = value.toString();
    } else {
      result = value.toFixed(fractionDigits);
    }
    if (!result.includes('.')) {
      return result + ',';
    }
    while (result[result.length - 1] === '0') {
      result = result.slice(0, -1);
    }
    return result.replace('.', ',');
  }

  /**
   * Equal temperament representation of the interval.
   * Example: `'7\12'`
   * @returns The interval formatted as an N-of-EDO or a generic EDJI.
   */
  equalTemperamentString() {
    const preferredDenominator = this.options.preferredEtDenominator;
    const preferredEquave = this.options.preferredEtEquave || new Fraction(2);
    let [fractionOfEquave, equave] = this.monzo.toEqualTemperament();
    if (equave.equals(1)) {
      equave = preferredEquave;
    } else {
      for (let power = 2; power < 10; ++power) {
        if (equave.pow(power).equals(preferredEquave)) {
          fractionOfEquave = fractionOfEquave.div(power);
          equave = preferredEquave;
          break;
        }
        if (preferredEquave.pow(power).equals(equave)) {
          fractionOfEquave = fractionOfEquave.mul(power);
          equave = preferredEquave;
          break;
        }
      }
    }

    const result = fractionToString(
      fractionOfEquave,
      undefined,
      preferredDenominator
    ).replace('/', '\\');
    if (equave.equals(2)) {
      return result;
    }
    return result + `<${equave.toFraction()}>`;
  }

  /**
   * Format the interval according the interval type and formatting options.
   * Also known as reverse parsing.
   * May produce composite lines if there is no other option.
   * May fall back to cents if composites are not allowed.
   * @returns The interval formatted as a string.
   * @warns Prints warnings if fallback formats are triggered.
   */
  toString(): string {
    const options = this.options;
    const cents = () => this.centsString();

    if (this.type === 'cents') {
      return cents();
    }

    if (this.type === 'decimal') {
      return this.decimalString();
    }

    if (this.type === 'ratio') {
      const maybeFraction = this.monzo.clone();
      maybeFraction.cents = 0;

      if (maybeFraction.isFractional()) {
        const fraction = maybeFraction.toFraction();
        if (isSafeFraction(fraction)) {
          return (
            fractionToString(
              fraction,
              options.preferredNumerator,
              options.preferredDenominator
            ) + this.centsString(true)
          );
        }
        if (options.forbidMonzo) {
          return cents();
        }
      } else {
        console.warn('Failed to represent ratio line. Falling back.');
      }
    }

    if (this.type === 'equal temperament') {
      const maybeEt = this.monzo.clone();
      maybeEt.cents = 0;

      if (maybeEt.isEqualTemperament()) {
        const [fractionOfEquave, equave] = maybeEt.toEqualTemperament();
        if (isSafeFraction(fractionOfEquave) && isSafeFraction(equave)) {
          const et = new Interval(
            maybeEt,
            'equal temperament',
            'dummy',
            this.options
          );
          return et.equalTemperamentString() + this.centsString(true);
        }
        if (options.forbidMonzo) {
          return cents();
        }
      } else {
        console.warn(
          'Failed to represent equal temperament line. Falling back.'
        );
      }
    }

    // Monzos and fallback for unsafe ratios and equal temperaments with residue
    if (!this.monzo.cents) {
      if (this.monzo.residual.equals(1)) {
        return this.monzoString();
      }
      if (options.forbidComposite) {
        return cents();
      }
      if (isSafeFraction(this.monzo.residual)) {
        if (this.type === 'monzo') {
          console.warn('Failed to represent monzo. Displaying residue.');
        }
        return (
          this.monzoString() +
          ' + ' +
          fractionToString(
            this.monzo.residual,
            options.preferredNumerator,
            options.preferredDenominator
          )
        );
      } else {
        return cents();
      }
    }
    if (options.forbidComposite) {
      return cents();
    }
    if (this.monzo.residual.equals(1)) {
      return this.monzoString() + this.centsString(true);
    }
    if (this.type === 'monzo') {
      console.warn('Failed to represent monzo. Displaying residue and offset.');
    }
    return (
      this.monzoString() +
      ' + ' +
      fractionToString(
        this.monzo.residual,
        options.preferredNumerator,
        options.preferredDenominator
      ) +
      this.centsString(true)
    );
  }
}
