import {Fraction, mtof as mtof_, ftom as ftom_} from 'xen-dev-utils';
import {ExtendedMonzo} from './monzo';

export type Domain = 'time' | 'scalar' | 'pitch';

const ZERO = new Fraction(0);
const ONE = new Fraction(1);
const NEGATIVE_ONE = new Fraction(-1);

export class Quantity {
  value: ExtendedMonzo;
  domain: Domain;
  exponent: Fraction;

  constructor(value: ExtendedMonzo, domain: Domain, exponent: Fraction) {
    if (exponent.equals(ZERO)) {
      domain = 'scalar';
    }
    if (domain === 'scalar' && exponent.compare(ZERO)) {
      throw new Error('The scalar domain must have an exponent of 0');
    }
    this.value = value;
    this.domain = domain;
    this.exponent = exponent;
  }

  neg(): Quantity {
    if (this.domain === 'pitch') {
      return new Quantity(this.value.inverse(), this.domain, this.exponent);
    }
    return new Quantity(this.value.neg(), this.domain, this.exponent);
  }

  inverse(): Quantity {
    if (this.domain === 'pitch') {
      return new Quantity(
        this.value.geometricInverse(),
        this.domain,
        this.exponent.neg()
      );
    }
    return new Quantity(this.value.inverse(), this.domain, this.exponent.neg());
  }

  add(other: Quantity): Quantity {
    if (other.domain !== this.domain) {
      throw new Error(
        `Domains must match in addition. ${this.domain} != ${other.domain}`
      );
    }
    if (other.exponent.compare(this.exponent)) {
      throw new Error(
        `Exponents must match in addition ${this.exponent.toFraction()} != ${other.exponent.toFraction()}`
      );
    }
    if (this.domain === 'pitch') {
      return new Quantity(
        this.value.mul(other.value),
        this.domain,
        this.exponent
      );
    }
    return new Quantity(
      this.value.add(other.value),
      this.domain,
      this.exponent
    );
  }

  sub(other: Quantity): Quantity {
    return this.add(other.neg());
  }

  mul(other: Quantity): Quantity {
    if (this.domain === 'pitch') {
      if (other.exponent.equals(ZERO)) {
        return new Quantity(
          this.value.pow(other.value),
          this.domain,
          this.exponent
        );
      }
      if (other.domain !== 'pitch') {
        throw new Error(
          `Incompatible domains ${this.domain} != ${other.domain}`
        );
      }
      if (this.exponent.add(other.exponent).compare(ZERO)) {
        throw new Error('Pitch exponents must add to zero in dot product');
      }
      return new Quantity(
        ExtendedMonzo.fromFraction(this.value.dot(other.value)),
        'scalar',
        ZERO
      );
    }
    if (other.domain === 'pitch') {
      return other.mul(this);
    }
    const domain = this.domain === 'scalar' ? other.domain : this.domain;
    return new Quantity(
      this.value.mul(other.value),
      domain,
      this.exponent.add(other.exponent)
    );
  }

  div(other: Quantity): Quantity {
    if (
      this.domain === 'pitch' &&
      other.domain === 'pitch' &&
      this.exponent.equals(other.exponent)
    ) {
      return new Quantity(
        ExtendedMonzo.fromValue(
          this.value.totalCents() / other.value.totalCents()
        ),
        'scalar',
        ZERO
      );
    }
    return this.mul(other.inverse());
  }

  pow(other: Quantity): Quantity {
    if (other.exponent.compare(ZERO)) {
      throw new Error('Only scalar powers supported');
    }
    if (this.domain === 'pitch') {
      throw new Error('Cannot exponentiate in the pitch domain');
    }
    return new Quantity(
      this.value.pow(other.value),
      this.domain,
      this.exponent.equals(ZERO)
        ? this.exponent
        : this.exponent.mul(other.value.toFraction())
    );
  }

  log(other: Quantity): Quantity {
    if (this.exponent.compare(ZERO) || other.exponent.compare(ZERO)) {
      throw new Error('Only scalar powers supported');
    }
    return new Quantity(
      this.value.log(other.value),
      this.domain,
      this.exponent
    );
  }

  mod(other: Quantity): Quantity {
    if (other.domain !== this.domain) {
      throw new Error(
        `Domains must match in modulo. ${this.domain} != ${other.domain}`
      );
    }
    if (other.exponent.compare(this.exponent)) {
      throw new Error(
        `Exponents must match in modulo ${this.exponent.toFraction()} != ${other.exponent.toFraction()}`
      );
    }
    if (this.domain === 'pitch') {
      return new Quantity(
        this.value.reduce(other.value),
        this.domain,
        this.exponent
      );
    }
    return new Quantity(
      this.value.mmod(other.value),
      this.domain,
      this.exponent
    );
  }

  reduce(other: Quantity): Quantity {
    if (this.domain !== 'scalar' || other.domain !== 'scalar') {
      throw new Error(
        `Only scalars can be reduced. Have domains ${this.domain} agains ${other.domain}`
      );
    }
    return new Quantity(
      this.value.reduce(other.value),
      this.domain,
      this.exponent
    );
  }
}

export function normalizeFrequency(quantity: Quantity) {
  if (quantity.domain !== 'time') {
    throw new Error(
      'Only time domain quantities can be normalized to frequencies'
    );
  }
  return new Quantity(
    quantity.value.pow(quantity.exponent.inverse().neg()),
    'time',
    NEGATIVE_ONE
  );
}

export function ratio(quantity: Quantity, baseFrequency?: Quantity) {
  if (quantity.domain === 'pitch') {
    return new Quantity(quantity.value, 'scalar', ZERO);
  }
  if (quantity.exponent.equals(ZERO)) {
    return quantity;
  }
  if (!baseFrequency) {
    throw new Error('Base frequency required for this conversion');
  }
  return normalizeFrequency(quantity).div(normalizeFrequency(baseFrequency));
}

export function frequency(quantity: Quantity, baseFrequency?: Quantity) {
  if (quantity.domain === 'time') {
    return normalizeFrequency(quantity);
  }
  if (!baseFrequency) {
    throw new Error('Base frequency required for this conversion');
  }
  return normalizeFrequency(baseFrequency).mul(ratio(quantity));
}

export function pitch(quantity: Quantity, baseFrequency?: Quantity): Quantity {
  if (quantity.domain === 'pitch') {
    return quantity;
  }
  if (quantity.exponent.equals(ZERO)) {
    return new Quantity(quantity.value, 'pitch', ONE);
  }
  return pitch(ratio(quantity, baseFrequency));
}

export function mtof(index: Quantity) {
  if (index.domain !== 'scalar') {
    throw new Error('Can only convert scalar midi to frequency');
  }
  return new Quantity(
    ExtendedMonzo.fromValue(mtof_(index.value.valueOf())),
    'time',
    NEGATIVE_ONE
  );
}

export function ftom(freq: Quantity, baseFrequency?: Quantity) {
  freq = frequency(freq, baseFrequency);
  const [index, offset] = ftom_(freq.value.valueOf());
  return new Quantity(
    ExtendedMonzo.fromValue(index + offset / 100),
    'scalar',
    ZERO
  );
}

// In nanometers per second.
const SPEED_OF_LIGHT = 299792458e9;
export function nmtof(wavelength: Quantity) {
  if (wavelength.domain !== 'scalar') {
    throw new Error('Can only interprete scalars as nanometers');
  }
  const frequency = SPEED_OF_LIGHT / wavelength.value.valueOf();
  return new Quantity(ExtendedMonzo.fromValue(frequency), 'time', NEGATIVE_ONE);
}

const HALF = new Quantity(ExtendedMonzo.fromFraction('1/2'), 'scalar', ZERO);
const THIRD = new Quantity(ExtendedMonzo.fromFraction('1/3'), 'scalar', ZERO);

export function sqrt(quantity: Quantity) {
  return quantity.pow(HALF);
}

export function cbrt(quantity: Quantity) {
  return quantity.pow(THIRD);
}
