import {describe, it, expect} from 'vitest';

import {
  enumerateChord,
  parseChord,
  parseLine as parseLine_,
  parseScale,
  reverseParseScale,
} from '../parser';
import {ExtendedMonzo} from '../monzo';
import {Interval} from '../interval';
import {arraysEqual, Fraction} from 'xen-dev-utils';
import {Scale} from '../scale';

const DEFAULT_NUMBER_OF_COMPONENTS = 25;

function parseLine(input: string) {
  return parseLine_(input, DEFAULT_NUMBER_OF_COMPONENTS);
}

describe('Line parser', () => {
  it("doesn't parse bare numbers", () => {
    expect(() => parseLine('42')).toThrow();
  });

  it('parses negative fractions and interpretes them as inverses', () => {
    const result = parseLine('-1/2');
    expect(
      result.equals(
        new Interval(
          ExtendedMonzo.fromFraction(
            new Fraction(2),
            DEFAULT_NUMBER_OF_COMPONENTS
          ),
          'ratio'
        )
      )
    ).toBeTruthy();
  });

  it("doesn't parse negative fractions with universal minus disabled", () => {
    expect(() =>
      parseLine_('-1/2', DEFAULT_NUMBER_OF_COMPONENTS, undefined, false, false)
    ).toThrow();
  });

  it('parses N-of-EDO (negative)', () => {
    const result = parseLine('-2\\5');
    expect(
      result.equals(
        new Interval(
          ExtendedMonzo.fromEqualTemperament(
            new Fraction(-2, 5),
            new Fraction(2),
            DEFAULT_NUMBER_OF_COMPONENTS
          ),
          'equal temperament'
        )
      )
    ).toBeTruthy();
    expect(result.name).toBe('-2\\5');
    expect(result.type).toBe('equal temperament');
  });

  it('parses N-of-EDO (negative EDO)', () => {
    const result = parseLine('2\\-5');
    expect(
      result.equals(
        new Interval(
          ExtendedMonzo.fromEqualTemperament(
            new Fraction(2, 5),
            new Fraction(1, 2),
            DEFAULT_NUMBER_OF_COMPONENTS
          ),
          'equal temperament'
        )
      )
    ).toBeTruthy();
    expect(result.name).toBe('2\\-5');
    expect(result.type).toBe('equal temperament');
  });

  it('parses generalized N-of-EDO (fraction equave)', () => {
    const result = parseLine('5\\11<7/3>');
    expect(
      result.equals(
        new Interval(
          ExtendedMonzo.fromEqualTemperament(
            new Fraction(5, 11),
            new Fraction(7, 3),
            DEFAULT_NUMBER_OF_COMPONENTS
          ),
          'equal temperament'
        )
      )
    ).toBeTruthy();
    expect(result.type).toBe('equal temperament');
  });

  it('parses generalized N-of-EDO (integer equave)', () => {
    const result = parseLine('-7\\13<5>');
    expect(
      result.equals(
        new Interval(
          ExtendedMonzo.fromEqualTemperament(
            new Fraction(-7, 13),
            new Fraction(5),
            DEFAULT_NUMBER_OF_COMPONENTS
          ),
          'equal temperament'
        )
      )
    ).toBeTruthy();
    expect(result.type).toBe('equal temperament');
  });

  it('parses monzos', () => {
    const result = parseLine('[-1, 2, 3/2, 0>');
    const components = [new Fraction(-1), new Fraction(2), new Fraction(3, 2)];
    while (components.length < DEFAULT_NUMBER_OF_COMPONENTS) {
      components.push(new Fraction(0));
    }
    expect(
      result.equals(new Interval(new ExtendedMonzo(components), 'monzo'))
    ).toBeTruthy();
    expect(result.name).toBe('[-1, 2, 3/2, 0>');
    expect(result.type).toBe('monzo');
  });

  it('parses composites (positive offset)', () => {
    const result = parseLine('3\\5 + 5.');
    expect(result.monzo.cents).toBeCloseTo(5);
    expect(result.name).toBe('3\\5');
    expect(result.type).toBe('equal temperament');
    result.monzo.cents = 0;
    const expected = new Interval(
      ExtendedMonzo.fromEqualTemperament(
        new Fraction(3, 5),
        new Fraction(2),
        DEFAULT_NUMBER_OF_COMPONENTS
      ),
      'equal temperament'
    );
    expect(result.equals(expected)).toBeTruthy();
  });

  it('parses composites (negative offset)', () => {
    const result = parseLine('3/2 - 1.955');
    expect(result.monzo.cents).toBeCloseTo(-1.955);
    expect(result.name).toBe('3/2');
    expect(result.type).toBe('ratio');
    result.monzo.cents = 0;
    const expected = new Interval(
      ExtendedMonzo.fromFraction(
        new Fraction(3, 2),
        DEFAULT_NUMBER_OF_COMPONENTS
      ),
      'ratio'
    );
    expect(result.equals(expected)).toBeTruthy();
  });

  it('parses ambiguous composites (unary minus vs. negative offset)', () => {
    const result = parseLine('3/1 + [-1>');
    expect(result.name).toBe('3/1 + [-1>');
    expect(result.type).toBe('monzo');
    expect(
      result.equals(
        new Interval(
          ExtendedMonzo.fromFraction(
            new Fraction(3, 2),
            DEFAULT_NUMBER_OF_COMPONENTS
          ),
          'ratio'
        )
      )
    ).toBeTruthy();
  });

  it('parses composites (any)', () => {
    const result = parseLine('3\\15 + 103/101 + 6.9');
    expect(result.name).toBe('3\\15 + 103/101 + 6.9');
    expect(result.type).toBe('any');
    const vector = Array(DEFAULT_NUMBER_OF_COMPONENTS).fill(new Fraction(0));
    vector[0] = new Fraction(3, 15);
    expect(
      result.equals(
        new Interval(
          new ExtendedMonzo(vector, new Fraction(103, 101), 6.9),
          'any'
        )
      )
    ).toBeTruthy();
  });

  it('infers interval preferences for equal temperament', () => {
    const et = parseLine('1\\12');
    expect(et.add(et).name).toBe('2\\12');

    const genEt = parseLine('3\\15<9>');
    expect(genEt.sub(genEt).name).toBe('0\\15<9>');
  });

  it("doesn't infer preferences for ratios", () => {
    const ratio = parseLine('4/24');
    expect(ratio.zeroed().name).toBe('1/1');
  });

  it('optionally admits bare numbers', () => {
    const ratio = parseLine_(
      '3',
      DEFAULT_NUMBER_OF_COMPONENTS,
      undefined,
      true
    );
    expect(ratio.type).toBe('ratio');
    expect(ratio.monzo.valueOf()).toBe(3);
  });

  it('supports omitting leading zeros', () => {
    const quarterCents = parseLine('.25');
    const half = parseLine(',5');
    expect(quarterCents.totalCents()).toBe(0.25);
    expect(half.monzo.valueOf()).toBeCloseTo(0.5);
  });

  it('supports omitting trailing zeros', () => {
    const cent = parseLine('1.');
    const two = parseLine('2,');
    expect(cent.totalCents()).toBe(1);
    expect(two.monzo.valueOf()).toBeCloseTo(2);
  });

  it('supports completely omitted zeros', () => {
    const noCents = parseLine('.');
    const zero = parseLine(',');
    expect(noCents.totalCents()).toBe(0);
    expect(zero.monzo.valueOf()).toBe(0);
  });
});

describe('Chord parser', () => {
  it('parses all line types and bare numbers', () => {
    const scale = Scale.fromChord(
      parseChord(
        '2 : 1300.1 : 2,7 : 7/3 : 11\\9 : 7\\8<3> : [0 1> : 3/1 - 1. : 4',
        DEFAULT_NUMBER_OF_COMPONENTS
      )
    );
    expect(
      scale
        .getMonzo(0)
        .equals(ExtendedMonzo.fromFraction(1, DEFAULT_NUMBER_OF_COMPONENTS))
    ).toBeTruthy();
    scale.baseFrequency = 1000;
    const expected = [
      1059.52, 1350, 1166.67, 1166.53, 1307.53, 1500, 1499.13, 2000,
    ];
    for (let i = 0; i < scale.size; ++i) {
      expect(scale.getFrequency(i + 1)).toBeCloseTo(expected[i]);
    }
  });

  it('supports whitespace as a separator', () => {
    const cpsFactors = parseChord(
      '1 3\t5\n7',
      DEFAULT_NUMBER_OF_COMPONENTS,
      /\s/
    );
    expect(cpsFactors[0].monzo.valueOf()).toBeCloseTo(1);
    expect(cpsFactors[1].monzo.valueOf()).toBeCloseTo(3);
    expect(cpsFactors[2].monzo.valueOf()).toBeCloseTo(5);
    expect(cpsFactors[3].monzo.valueOf()).toBeCloseTo(7);
  });

  it('parses mixed comma-separated monzos with comma-separated components', () => {
    const monzos = parseChord(
      '[0, 0, 0>, [-2, 0, 1>,[-1, 1, 0>:[1 0 0>',
      3,
      /,|:/
    ).map(interval =>
      interval.monzo.vector.map(component => component.valueOf())
    );
    expect(arraysEqual(monzos[0], [0, 0, 0])).toBeTruthy();
    expect(arraysEqual(monzos[1], [-2, 0, 1])).toBeTruthy();
    expect(arraysEqual(monzos[2], [-1, 1, 0])).toBeTruthy();
    expect(arraysEqual(monzos[3], [1, 0, 0])).toBeTruthy();
  });

  it('parses space-separated monzos with space-separated components', () => {
    const monzos = parseChord('[0 0 0> [1 1 -1> [-1 1 0>', 3, /\s/).map(
      interval => interval.monzo.vector.map(component => component.valueOf())
    );
    expect(arraysEqual(monzos[0], [0, 0, 0])).toBeTruthy();
    expect(arraysEqual(monzos[1], [1, 1, -1])).toBeTruthy();
    expect(arraysEqual(monzos[2], [-1, 1, 0])).toBeTruthy();
  });
});

describe('Scale parse', () => {
  it('parses a Scale-like string even with trailing whitespace', () => {
    const input = ['9/8', ' 7\\12', '2,0  '].join('\n');
    const scale = parseScale(input, DEFAULT_NUMBER_OF_COMPONENTS);
    expect(
      scale
        .getMonzo(0)
        .equals(ExtendedMonzo.fromFraction(1, DEFAULT_NUMBER_OF_COMPONENTS))
    ).toBeTruthy();
    expect(
      scale
        .getMonzo(1)
        .equals(ExtendedMonzo.fromFraction('9/8', DEFAULT_NUMBER_OF_COMPONENTS))
    ).toBeTruthy();
    expect(
      scale
        .getMonzo(2)
        .equals(
          ExtendedMonzo.fromEqualTemperament(
            '7/12',
            2,
            DEFAULT_NUMBER_OF_COMPONENTS
          )
        )
    ).toBeTruthy();
    expect(
      scale
        .getMonzo(3)
        .equals(ExtendedMonzo.fromCents(1200, DEFAULT_NUMBER_OF_COMPONENTS))
    ).toBeTruthy();
  });

  it('parses with preferences', () => {
    const input = [
      '5/4 - 0.31',
      '4/3 + 7.797',
      '3/2 + 2.095',
      '2/1 + 6.595',
    ].join('\n');
    const scale = parseScale(input, DEFAULT_NUMBER_OF_COMPONENTS, 440, {
      centsFractionDigits: 3,
    }).rotate();
    expect(scale.getName(2)).toBe('6/5 + 2.405');
  });
});

describe('Chord enumerator', () => {
  it('parses a colon-separated string', () => {
    const scale = enumerateChord('4:5:6:7:8', DEFAULT_NUMBER_OF_COMPONENTS);
    expect(scale.getFrequency(0)).toBeCloseTo(440);
    expect(scale.getFrequency(1)).toBeCloseTo(550);
    expect(scale.getFrequency(2)).toBeCloseTo(660);
    expect(scale.getFrequency(3)).toBeCloseTo(770);
    expect(scale.getFrequency(4)).toBeCloseTo(880);
    expect(scale.getFrequency(5)).toBeCloseTo(1100);
  });

  it('parses a space-separated string', () => {
    const scale = enumerateChord(
      '1\\15 1\\4 1\\2 3',
      DEFAULT_NUMBER_OF_COMPONENTS
    );
    expect(scale.getFrequency(0)).toBeCloseTo(440);
    expect(scale.getFrequency(1)).toBeCloseTo(499.62);
    expect(scale.getFrequency(2)).toBeCloseTo(594.15);
    expect(scale.getFrequency(3)).toBeCloseTo(1260.39);
  });
});

describe('Reverse parser', () => {
  it('preserves intended names when possible', () => {
    const scale = Scale.fromIntervalArray([
      new Interval(
        ExtendedMonzo.fromFraction(new Fraction(13, 12), 15),
        'ratio',
        '13/8 - 3/2'
      ),
      new Interval(ExtendedMonzo.fromFraction(new Fraction(2), 15), 'ratio'),
    ]);
    const lines = reverseParseScale(scale);
    expect(arraysEqual(lines, ['13/8 - 3/2', '2/1'])).toBeTruthy();
  });

  it('replaces intended names when parsing is impossible', () => {
    const scale = Scale.fromIntervalArray([
      new Interval(
        ExtendedMonzo.fromFraction(new Fraction(13, 12), 15),
        'ratio',
        'Bob'
      ),
      new Interval(ExtendedMonzo.fromFraction(new Fraction(2), 15), 'ratio'),
    ]);
    const lines = reverseParseScale(scale);
    expect(arraysEqual(lines, ['13/12', '2/1'])).toBeTruthy();
  });

  it('replaces intended names when they are parseable but incorrect', () => {
    const scale = Scale.fromIntervalArray([
      new Interval(
        ExtendedMonzo.fromFraction(new Fraction(13, 12), 15),
        'ratio',
        '14/13'
      ),
      new Interval(ExtendedMonzo.fromFraction(new Fraction(2), 15), 'ratio'),
    ]);
    const lines = reverseParseScale(scale);
    expect(arraysEqual(lines, ['13/12', '2/1'])).toBeTruthy();
  });
});
