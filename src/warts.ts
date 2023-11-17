import {Fraction, PRIMES, primeLimit} from 'xen-dev-utils';
import {ExtendedMonzo, getNumberOfComponents} from './monzo';

function wartToBasis(wart: string, nonPrimes: Fraction[]) {
  if (!wart) {
    return new Fraction(PRIMES[0]);
  }
  const index = wart.charCodeAt(0) - 97;
  if (index < 15) {
    return new Fraction(PRIMES[index]);
  }
  if (index > 15) {
    return new Fraction(nonPrimes[index - 16]);
  }
  return undefined;
}

function parseSubgroup(subgroupString: string) {
  const subgroup: Fraction[] = [];

  if (subgroupString) {
    if (subgroupString.includes('.')) {
      for (const basis of subgroupString.split('.')) {
        subgroup.push(new Fraction(basis));
      }
    } else {
      const index = PRIMES.indexOf(parseInt(subgroupString, 10));
      if (index < 0) {
        throw new Error('Invalid prime limit');
      }
      for (const prime of PRIMES.slice(0, index + 1)) {
        subgroup.push(new Fraction(prime));
      }
    }
  }

  const nonPrimes: Fraction[] = [];
  for (const basis of subgroup) {
    if (basis.d > 1 || !PRIMES.includes(basis.n)) {
      nonPrimes.push(basis);
    }
  }

  if (!subgroup.length) {
    for (let i = 0; i < getNumberOfComponents(); ++i) {
      subgroup.push(new Fraction(PRIMES[i]));
    }
  }

  return [subgroup, nonPrimes];
}

export function inferEquave(equave: string, subgroupString: string) {
  const nonPrimes = parseSubgroup(subgroupString)[1];

  return wartToBasis(equave, nonPrimes);
}

export function wartsToVal(
  equave: string,
  edo: number,
  warts: string[],
  subgroupString: string
) {
  const [subgroup, nonPrimes] = parseSubgroup(subgroupString);

  const equaveFraction = wartToBasis(equave, nonPrimes);

  if (equaveFraction) {
    for (let i = 0; i < subgroup.length; ++i) {
      if (subgroup[i].equals(equaveFraction)) {
        subgroup.unshift(subgroup.splice(i, 1)[0]);
      }
    }
  }

  const scale = edo / Math.log(subgroup[0].valueOf());
  const scaledLogs = subgroup.map(f => scale * Math.log(f.valueOf()));
  const val = scaledLogs.map(Math.round);
  const modification = Array(subgroup.length).fill(0);

  for (const wart of warts) {
    const wartFraction = wartToBasis(wart, nonPrimes);
    if (!wartFraction) {
      continue;
    }
    for (let i = 0; i < subgroup.length; ++i) {
      if (subgroup[i].equals(wartFraction)) {
        modification[i]++;
      }
    }
  }
  for (let i = 0; i < subgroup.length; ++i) {
    let delta = Math.ceil(modification[i] * 0.5);
    if (modification[i] % 2 === 0) {
      delta = -delta;
    }
    if (scaledLogs[i] - val[i] > 0) {
      val[i] += delta;
    } else {
      val[i] -= delta;
    }
  }

  let numberOfComponents = 0;
  for (const basis of subgroup) {
    numberOfComponents = Math.max(primeLimit(basis, true), numberOfComponents);
  }

  let result = new ExtendedMonzo(
    Array(numberOfComponents).fill(new Fraction(0))
  );
  for (let i = 0; i < subgroup.length; ++i) {
    const basis = ExtendedMonzo.fromFraction(
      subgroup[i],
      numberOfComponents
    ).geometricInverse();
    result = result.mul(basis.pow(val[i]));
  }
  return result;
}
