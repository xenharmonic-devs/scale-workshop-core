import {
  centsToValue,
  Fraction,
  FractionValue,
  gcd,
  lcm,
  primeLimit,
  PRIMES,
  PRIME_CENTS,
  toMonzoAndResidual,
  valueToCents,
} from 'xen-dev-utils';

export type FractionalMonzo = Fraction[];

/**
 * Check if two fractional monzos are equal.
 * @param a The first monzo.
 * @param b The second monzo.
 * @returns `true` if the two values are equal.
 */
function monzosEqual(a: FractionalMonzo, b: FractionalMonzo) {
  if (a === b) {
    return true;
  }
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; ++i) {
    if (!a[i].equals(b[i])) {
      return false;
    }
  }
  return true;
}

/**
 * Check if a number is a power of two.
 * @param n Real number to check.
 * @returns `true` if `n` is a power of two.
 */
function isPowerOfTwo(n: number) {
  if (n >= 1 && n < 0x100000000) {
    return n && !(n & (n - 1));
  }
  return Math.log2(n) % 1 === 0;
}

/**
 * Fractional monzo with multiplicative residue and arbitrary cents offset.
 *
 * Used to represent musical intervals like 5/3, 7\12 (N-of-EDO) or arbitrary intervals measured in cents.
 */
export class ExtendedMonzo {
  vector: FractionalMonzo;
  residual: Fraction;
  cents: number;

  /**
   * Construct a fractional monzo with multiplicative residue and arbitrary cents offset.
   * @param vector Fractional monzo part.
   * @param residual Multiplicative residue that is too complex to fit in the vector part.
   * @param cents Cents offset.
   */
  constructor(vector: FractionalMonzo, residual?: Fraction, cents = 0) {
    if (isNaN(cents)) {
      throw new Error('Invalid cents value');
    }
    if (residual === undefined) {
      residual = new Fraction(1);
    }
    this.vector = vector;
    this.residual = residual;
    this.cents = cents;
  }

  /**
   * Construct an extended monzo from a rational number.
   * @param fraction Rational number to convert.
   * @param numberOfComponents Number of components in the monzo vector part.
   * @returns Extended monzo representing the just intonation interval.
   */
  static fromFraction(fraction: FractionValue, numberOfComponents: number) {
    const [vector, residual] = toMonzoAndResidual(fraction, numberOfComponents);
    return new ExtendedMonzo(
      vector.map(c => new Fraction(c)),
      residual
    );
  }

  /**
   * Construct an extended monzo from an interval measured in cents.
   * @param cents The amount of cents to convert. An octave (2/1) divided into 12 semitones 100 cents each.
   * @param numberOfComponents Number of components in the monzo vector part.
   * @returns Extended monzo with a zero vector part and the specified cents offset.
   */
  static fromCents(cents: number, numberOfComponents: number) {
    const vector: FractionalMonzo = [];
    while (vector.length < numberOfComponents) {
      vector.push(new Fraction(0));
    }
    return new ExtendedMonzo(vector, undefined, cents);
  }

  /**
   * Construct an extended monzo from a pitch-space fraction of a frequency-space fraction.
   * @param fractionOfEquave Fraction of the equave measured in pitch-space.
   * @param equave Equave measured in frequency-space. Defaults to the octave (2/1).
   * @param numberOfComponents Number of components in the monzo vector part.
   * @returns Extended monzo representing N-of-EDO (default) or a generic EDJI interval.
   */
  static fromEqualTemperament(
    fractionOfEquave: Fraction,
    equave?: Fraction,
    numberOfComponents?: number
  ) {
    if (equave === undefined) {
      equave = new Fraction(2);
    }
    if (numberOfComponents === undefined) {
      numberOfComponents = PRIMES.indexOf(primeLimit(equave)) + 1;
    }
    const [equaveVector, residual] = toMonzoAndResidual(
      equave,
      numberOfComponents
    );
    if (!residual.equals(1)) {
      throw new Error('Unable to convert equave to monzo');
    }
    const vector = equaveVector.map(component =>
      fractionOfEquave.mul(component)
    );
    return new ExtendedMonzo(vector);
  }

  /**
   * Constuct an extended monzo from a value measured in frequency-space.
   * @param value Musical ratio in frequency-space.
   * @param numberOfComponents Number of components in the monzo vector part.
   * @returns Extended monzo with a zero vector part and the specified value converted to a cents offset.
   */
  static fromValue(value: number, numberOfComponents: number) {
    const vector: FractionalMonzo = [];
    while (vector.length < numberOfComponents) {
      vector.push(new Fraction(0));
    }
    return new ExtendedMonzo(vector, undefined, valueToCents(value));
  }

  /**
   * Number of components in the monzo vector part.
   */
  get numberOfComponents() {
    return this.vector.length;
  }

  /**
   * Create a deep copy of this extended monzo.
   * @returns A clone with independent vector part.
   */
  clone() {
    const vector: FractionalMonzo = [];
    this.vector.forEach(component => {
      vector.push(new Fraction(component));
    });
    return new ExtendedMonzo(vector, new Fraction(this.residual), this.cents);
  }

  /**
   * Convert the extended monzo to a fraction in frequency-space.
   * @returns Musical ratio as a fraction in frequency-space.
   * @throws An error if the extended monzo cannot be represented as a ratio.
   */
  toFraction() {
    if (this.cents !== 0) {
      throw new Error('Unable to convert irrational number to fraction');
    }
    let result = this.residual;
    this.vector.forEach((component, i) => {
      const factor = new Fraction(PRIMES[i]).pow(component);
      if (factor === null) {
        throw new Error('Unable to convert irrational number to fraction');
      }
      result = result.mul(factor);
    });
    return result;
  }

  /**
   * Convert the extended monzo to cents.
   * @returns Size of the extended monzo in cents.
   */
  toCents() {
    return this.totalCents();
  }

  /**
   * Convert the extended monzo to pitch-space fraction of a frequency-space fraction.
   * @returns Pair of the pitch-space fraction and the equave as a frequency-space fraction.
   * @throws An error if the extended monzo cannot be represented as an EDJI interval.
   */
  toEqualTemperament(): [Fraction, Fraction] {
    if (this.cents !== 0) {
      throw new Error(
        'Unable to convert non-algebraic number to equal temperament'
      );
    }
    if (!this.residual.equals(1)) {
      throw new Error(
        'Unable to convert non-representable fraction to equal temperament'
      );
    }
    if (this.vector.length === 0) {
      // At this point we know it's the zero monzo.
      return [new Fraction(0), new Fraction(1)];
    }
    let denominator = 1;
    this.vector.forEach(component => {
      denominator = lcm(denominator, component.d);
    });
    let numerator = 0;
    this.vector.forEach(component => {
      numerator = gcd(numerator, component.mul(denominator).n);
    });
    if (numerator === 0) {
      return [new Fraction(0), new Fraction(1)];
    }
    const fractionOfEquave = new Fraction(numerator, denominator);
    const equave = this.div(fractionOfEquave).toFraction();

    if (equave.compare(1) < 0) {
      return [fractionOfEquave.neg(), equave.inverse()];
    }

    return [fractionOfEquave, equave];
  }

  /**
   * Convert the extended monzo to a simple monzo with integer coefficients.
   * @returns Array of prime exponents.
   * @throws An error if the extended monzo cannot be represented as sufficiently simple ratio in frequency-space.
   */
  toIntegerMonzo(): number[] {
    if (!this.residual.equals(1)) {
      throw new Error('Cannot convert monzo with residual to integers');
    }
    if (this.cents) {
      throw new Error('Cannot convert monzo with offset to integers');
    }
    const result: number[] = [];
    this.vector.forEach(component => {
      if (component.d !== 1) {
        throw new Error('Cannot convert fractional monzo to integers');
      }
      result.push(component.valueOf());
    });
    return result;
  }

  /**
   * Check if the extended monzo represents a musical fraction.
   * @returns `true` if the extended monzo can be interpreted as a ratio in frequency-space.
   */
  isFractional() {
    if (this.cents !== 0) {
      return false;
    }
    for (let i = 0; i < this.numberOfComponents; ++i) {
      if (this.vector[i].d !== 1) {
        return false;
      }
    }
    return true;
  }

  /**
   * Check if the extended monzo represents a generic EDJI interval.
   * @returns `true` if the extended monzo can be interpreted as pitch-space fraction of a frequency-space fraction.
   */
  isEqualTemperament() {
    if (this.cents !== 0) {
      return false;
    }
    if (!this.residual.equals(1)) {
      return false;
    }
    return true;
  }

  /**
   * Check if the extended monzo is pure cents.
   * @returns `true` if the extended monzo has no vector or residual.
   */
  isCents() {
    for (let i = 0; i < this.numberOfComponents; ++i) {
      if (!this.vector[i].equals(0)) {
        return false;
      }
    }
    if (!this.residual.equals(1)) {
      return false;
    }
    return true;
  }

  /**
   * Check if the extended monzo is combination of fractional, equal temperament or cents parts.
   * @returns `true` if the extended monzo is not simply fractional, equal temperament or pure cents.
   */
  isComposite() {
    if (this.isFractional()) {
      return false;
    }
    if (this.isEqualTemperament()) {
      return false;
    }
    if (this.isCents()) {
      return false;
    }
    return true;
  }

  /**
   * Check if the extended monzo is a power of two in frequency space.
   * @returns `true` if the extended monzo is a power of two.
   */
  isPowerOfTwo() {
    if (this.cents !== 0) {
      return false;
    }
    if (!this.vector.length) {
      return isPowerOfTwo(this.residual.n) && isPowerOfTwo(this.residual.d);
    }
    if (!this.residual.equals(1)) {
      return false;
    }
    for (let i = 1; i < this.vector.length; ++i) {
      if (!this.vector[i].equals(0)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Return a pitch-space negative of the extended monzo.
   * @returns The frequency-space inverse of the extended monzo.
   */
  neg() {
    const vector = this.vector.map(component => component.neg());
    const residual = this.residual.inverse();
    return new ExtendedMonzo(vector, residual, -this.cents);
  }

  /**
   * Combine the extended monzo with another in pitch-space.
   * @param other Another extended monzo.
   * @returns The product of the extended monzos in frequency-space.
   */
  add(other: ExtendedMonzo): ExtendedMonzo {
    if (this.vector.length < other.vector.length) {
      return other.add(this);
    }
    const vector = [];
    for (let i = 0; i < other.vector.length; ++i) {
      vector.push(this.vector[i].add(other.vector[i]));
    }
    while (vector.length < this.vector.length) {
      vector.push(new Fraction(this.vector[vector.length]));
    }
    const residual = this.residual.mul(other.residual);
    return new ExtendedMonzo(vector, residual, this.cents + other.cents);
  }

  /**
   * Subtract another extended monzo from this one in pitch-space.
   * @param other Another extended monzo.
   * @returns This monzo divided by the other monzo in frequency-space.
   */
  sub(other: ExtendedMonzo) {
    const vector = [];
    if (this.vector.length <= other.vector.length) {
      for (let i = 0; i < this.vector.length; ++i) {
        vector.push(this.vector[i].sub(other.vector[i]));
      }
      while (vector.length < other.vector.length) {
        vector.push(other.vector[vector.length].neg());
      }
    } else {
      for (let i = 0; i < other.vector.length; ++i) {
        vector.push(this.vector[i].sub(other.vector[i]));
      }
      while (vector.length < this.vector.length) {
        vector.push(new Fraction(this.vector[vector.length]));
      }
    }
    const residual = this.residual.div(other.residual);
    return new ExtendedMonzo(vector, residual, this.cents - other.cents);
  }

  /**
   * Rescale the extended monzo in pitch-space.
   * @param scalar Scaling factor.
   * @returns The rescaled extended monzo.
   */
  mul(scalar: number | Fraction): ExtendedMonzo {
    if (typeof scalar === 'number') {
      scalar = new Fraction(scalar);
    }
    const vector = this.vector.map(component => component.mul(scalar));
    let residual: Fraction | null | undefined = this.residual.pow(scalar);
    let cents = this.cents;
    if (residual === null) {
      cents += valueToCents(this.residual.valueOf());
      residual = undefined;
    }
    cents *= scalar.valueOf();
    return new ExtendedMonzo(vector, residual, cents);
  }

  /**
   * Inverse rescale the extended monzo in pitch-space.
   * @param scalar Inverse scaling factor.
   * @returns The rescaled extended monzo.
   */
  div(scalar: number | Fraction): ExtendedMonzo {
    if (typeof scalar === 'number') {
      scalar = new Fraction(scalar);
    }
    const vector = this.vector.map(component => component.div(scalar));
    let residual: Fraction | null | undefined = this.residual.pow(
      scalar.inverse()
    );
    let cents = this.cents;
    if (residual === null) {
      cents += valueToCents(this.residual.valueOf());
      residual = undefined;
    }
    cents /= scalar.valueOf();
    return new ExtendedMonzo(vector, residual, cents);
  }

  // Same as mul, but the offset is accumulated in cents
  /**
   * Rescale the extended monzo in pitch-space and store the offset as cents.
   * @param scalar Scaling factor.
   * @returns The rescaled extended monzo where only the cents offset differs from the original.
   */
  stretch(scalar: number): ExtendedMonzo {
    const offset = this.totalCents() * (scalar - 1);
    return new ExtendedMonzo(this.vector, this.residual, this.cents + offset);
  }

  /**
   * Pitch-space absolute value of the extended monzo.
   * @returns The extended monzo unchanged or negated if negative originally.
   */
  abs() {
    if (this.totalCents() < 0) {
      return this.neg();
    }
    return this;
  }

  // Consistent with Fraction.js
  /**
   * Calculate truncated modulus with respect to another extended monzo.
   * @param other Another extended monzo.
   * @returns This modulo the other truncated towards zero cents.
   */
  mod(other: ExtendedMonzo) {
    const truncDiv = Math.trunc(this.totalCents() / other.totalCents());
    return this.sub(other.mul(truncDiv));
  }

  // Consistent with Mathematics
  /**
   * Calculate modulus with respect to another extended monzo.
   * @param other Another extended monzo.
   * @returns This modulo the other.
   */
  mmod(other: ExtendedMonzo) {
    const otherCents = other.totalCents();
    if (otherCents === 0) {
      throw Error('Modulo by unison');
    }
    const floorDiv = Math.floor(this.totalCents() / otherCents);
    return this.sub(other.mul(floorDiv));
  }

  /**
   * Check for strict equality between this and another extended monzo.
   * @param other Another extended monzo.
   * @returns `true` if the extended monzos share the same vector, residua and cents offset.
   */
  strictEquals(other: ExtendedMonzo) {
    return (
      monzosEqual(this.vector, other.vector) &&
      this.residual.equals(other.residual) &&
      this.cents === other.cents
    );
  }

  /**
   * Convert the extended monzo to cents.
   * @returns Size of the extended monzo in cents.
   */
  totalCents() {
    let total = this.cents + valueToCents(this.residual.valueOf());
    this.vector.forEach(
      (component, i) => (total += component.valueOf() * PRIME_CENTS[i])
    );
    return total;
  }

  /**
   * Convert the extended monzo to frequency-space ratio.
   * @returns The frequency-space multiplier corresponding to this extended monzo.
   */
  valueOf() {
    return centsToValue(this.totalCents());
  }

  /**
   * Gets an array of the extended monzo representing a continued fraction. The first element always contains the whole part.
   * @returns Array of continued fraction coefficients.
   */
  toContinued() {
    if (this.isFractional()) {
      return this.toFraction().toContinued();
    }
    return new Fraction(this.valueOf()).toContinued();
  }

  /**
   * Check if this extended monzo has the same size as another.
   * @param other Another extended monzo.
   * @returns `true` if the extended monzos are of equal size.
   */
  equals(other: ExtendedMonzo) {
    return this.totalCents() === other.totalCents();
  }

  /**
   * Compare this extended monzo with another.
   * @param other Another extended monzo.
   * @returns Result < 0 if other is larger than this. Result > 0 if other is smaller than this. Result == 0 if other is equal to this in size.
   */
  compare(other: ExtendedMonzo) {
    return this.totalCents() - other.totalCents();
  }

  /**
   * Find the closest approximation of the extended monzo in a harmonic series.
   * @param denominator Denominator of the harmonic series.
   * @returns The closest approximant in the series.
   */
  approximateHarmonic(denominator: number) {
    const numerator = Math.round(this.valueOf() * denominator);
    return ExtendedMonzo.fromFraction(
      new Fraction(numerator, denominator),
      this.numberOfComponents
    );
  }

  /**
   * Find the closest approximation of the extended monzo in a subharmonic series.
   * @param numerator Numerator of the subharmonic series.
   * @returns The closest approximant in the series.
   */
  approximateSubharmonic(numerator: number) {
    const denominator = Math.round(numerator / this.valueOf());
    return ExtendedMonzo.fromFraction(
      new Fraction(numerator, denominator),
      this.numberOfComponents
    );
  }

  /**
   * Simplify the extended monzo under the given threshold
   * @param eps Error threshold, default = 0.001
   * @returns Simple approximant of the extended monzo.
   */
  approximateSimple(eps?: number) {
    const fraction = new Fraction(this.valueOf()).simplify(eps);
    return ExtendedMonzo.fromFraction(fraction, this.numberOfComponents);
  }

  /**
   * Obtain a convergent of this extended monzo.
   * @param depth How many continued fraction coefficients to use after the whole part.
   * @returns Approximant of the extended monzo.
   */
  getConvergent(depth: number) {
    const continuedFraction = this.toContinued().slice(0, depth + 1);
    let result = new Fraction(continuedFraction[continuedFraction.length - 1]);
    for (let i = continuedFraction.length - 2; i >= 0; i--) {
      result = result.inverse().add(continuedFraction[i]);
    }
    return ExtendedMonzo.fromFraction(result, this.numberOfComponents);
  }
}
