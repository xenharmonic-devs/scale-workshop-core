import {
  Fraction,
  PRIME_CENTS,
  mmod,
  toMonzo,
  valueToCents,
} from 'xen-dev-utils';
import {ExtendedMonzo} from './monzo';
import {absoluteFromParts, fromParts} from './pythagorean';

const RADIUS_OF_TOLERANCE = valueToCents(65 / 63);

const NFJS_RADIUS = 13.5 * PRIME_CENTS[0] - 8.5 * PRIME_CENTS[1];

const FIFTH = PRIME_CENTS[1] - PRIME_CENTS[0];

function distance(a: number, b: number) {
  return Math.abs(mmod(a - b + 600, 1200) - 600);
}

function masterAlgorithm(primeCents: number) {
  let pythagoras = 0;
  let k = 0;
  if (distance(primeCents, pythagoras) < RADIUS_OF_TOLERANCE) {
    return k;
  }
  // eslint-disable-next-line no-constant-condition
  while (true) {
    pythagoras += FIFTH;
    k++;
    if (distance(primeCents, pythagoras) < RADIUS_OF_TOLERANCE) {
      return k;
    }
    if (distance(primeCents, -pythagoras) < RADIUS_OF_TOLERANCE) {
      return -k;
    }
  }
}

function neutralMaster(primeCents: number) {
  let pythagoras = 0;
  if (distance(primeCents, pythagoras) < NFJS_RADIUS) {
    return 0;
  }
  for (let k = 1; k <= 6; ++k) {
    pythagoras += FIFTH;
    if (distance(primeCents, pythagoras) < NFJS_RADIUS) {
      return k;
    }
    if (distance(primeCents, -pythagoras) < NFJS_RADIUS) {
      return -k;
    }
  }
  pythagoras = 0.5 * FIFTH;
  for (let k = 1; k <= 6; ++k) {
    if (distance(primeCents, pythagoras) < NFJS_RADIUS) {
      return k - 0.5;
    }
    if (distance(primeCents, -pythagoras) < NFJS_RADIUS) {
      return 0.5 - k;
    }
    pythagoras += FIFTH;
  }
  throw new Error('Unable to locate NFJS region');
}

function* commaGenerator(
  master: typeof masterAlgorithm
): Generator<ExtendedMonzo> {
  let i = 2;
  while (i < PRIME_CENTS.length) {
    const threes = -master(PRIME_CENTS[i]);
    let twos = threes;
    let commaCents =
      PRIME_CENTS[i] + twos * PRIME_CENTS[0] + threes * PRIME_CENTS[1];
    while (commaCents > 600) {
      commaCents -= PRIME_CENTS[0];
      twos--;
    }
    while (commaCents < -600) {
      commaCents += PRIME_CENTS[0];
      twos++;
    }
    const monzo = Array(i + 1).fill(0);
    monzo[0] = twos;
    monzo[1] = threes;
    monzo[i] = 1;
    yield new ExtendedMonzo(monzo.map(c => new Fraction(c)));
    i++;
  }
}

const formalCommas = [
  ExtendedMonzo.fromFraction(1),
  ExtendedMonzo.fromFraction(1),
];

const neutralCommas = [
  ExtendedMonzo.fromFraction(1),
  ExtendedMonzo.fromFraction(1),
];

const commaIterator = commaGenerator(masterAlgorithm);

const neutralIterator = commaGenerator(neutralMaster);

export function getFormalComma(index: number) {
  while (index >= formalCommas.length) {
    const iterand = commaIterator.next();
    if (iterand.done) {
      throw new Error('Out of primes');
    }
    formalCommas.push(iterand.value);
  }
  return formalCommas[index];
}

export function getNeutralComma(index: number) {
  while (index >= neutralCommas.length) {
    const iterand = neutralIterator.next();
    if (iterand.done) {
      throw new Error('Out of primes');
    }
    neutralCommas.push(iterand.value);
  }
  return neutralCommas[index];
}

export function toJustIntonation(
  quality: string,
  degree: number,
  superscripts: number[],
  subscripts: number[]
) {
  let result = fromParts(quality, degree);
  let getComma = getFormalComma;
  if (result.vector[0].d > 1 && result.vector[1].d > 1) {
    getComma = getNeutralComma;
  }
  for (const s of superscripts) {
    const monzo = toMonzo(s);
    for (let i = 0; i < monzo.length; ++i) {
      result = result.mul(getComma(i).pow(monzo[i]));
    }
  }
  for (const s of subscripts) {
    const monzo = toMonzo(s);
    for (let i = 0; i < monzo.length; ++i) {
      result = result.div(getComma(i).pow(monzo[i]));
    }
  }
  return result;
}

export function absoluteToJustIntonation(
  nominal: string,
  accidentals: string[],
  octave: number,
  superscripts: number[],
  subscripts: number[]
) {
  let result = absoluteFromParts(nominal, accidentals, octave);
  let getComma = getFormalComma;
  if (result.vector[0].d > 1 && result.vector[1].d > 1) {
    getComma = getNeutralComma;
  }
  for (const s of superscripts) {
    const monzo = toMonzo(s);
    for (let i = 0; i < monzo.length; ++i) {
      result = result.mul(getComma(i).pow(monzo[i]));
    }
  }
  for (const s of subscripts) {
    const monzo = toMonzo(s);
    for (let i = 0; i < monzo.length; ++i) {
      result = result.div(getComma(i).pow(monzo[i]));
    }
  }
  return result;
}
