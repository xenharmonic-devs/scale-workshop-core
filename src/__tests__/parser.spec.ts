import {describe, it, expect} from 'vitest';

import {
  ParsingContext,
  parseAST,
  evaluateAST,
  parseLines,
  parseScale,
} from '../parser';
import {ratio, Quantity} from '../quantity';
import {ExtendedMonzo} from '../monzo';
import {Fraction} from 'xen-dev-utils';

const CONTEXT: ParsingContext = new Map();

function parse(input: string) {
  const quantity = evaluateAST(parseAST(input), CONTEXT);
  if (!quantity) {
    expect(quantity).toBeTruthy();
    throw new Error('Failed to parse');
  }
  return quantity;
}

function expectFraction(quantity: Quantity, text: string, domain = 'scalar') {
  expect(quantity.domain).toBe(domain);
  if (domain === 'scalar') {
    expect(quantity.exponent.equals(0)).toBe(true);
  } else {
    expect(quantity.exponent.equals(1)).toBe(true);
  }
  expect(quantity.value.isFractional()).toBe(true);
  const fraction = quantity.value.toFraction();
  expect(fraction.equals(text), `${fraction.toFraction()} != ${text}`).toBe(
    true
  );
}

function expectEdji(quantity: Quantity, fraction: string, equave_: string) {
  expect(quantity.domain).toBe('pitch');
  expect(quantity.exponent.equals(1)).toBe(true);
  expect(quantity.value.isEqualTemperament()).toBe(true);
  const {fractionOfEquave, equave} = quantity.value.toEqualTemperament();
  expect(
    fractionOfEquave.equals(fraction),
    `${fractionOfEquave.toFraction()} != ${fraction}`
  ).toBe(true);
  expect(equave.equals(equave_), `${equave.toFraction()} != ${equave_}`).toBe(
    true
  );
}

function expectMonzo(quantity: Quantity, components: string[]) {
  expect(quantity.domain).toBe('pitch');
  expect(quantity.exponent.equals(1)).toBe(true);
  expect(quantity.value.residual.equals(1)).toBe(true);
  expect(quantity.value.cents).toBe(0);
  for (let i = 0; i < components.length; ++i) {
    expect(quantity.value.vector[i].equals(components[i])).toBe(true);
  }
}

function expectFrequency(
  quantity: Quantity,
  value: number,
  numDigits?: number
) {
  expect(quantity.domain).toBe('time');
  expect(quantity.exponent.equals(-1)).toBe(true);
  expect(quantity.value.valueOf()).toBeCloseTo(value, numDigits);
}

describe('Line parser', () => {
  it('parses bare numbers', () => {
    const quantity = parse('42');
    expectFraction(quantity, '42/1');
  });

  it('parses the cursed tritone', () => {
    const quantity = parse('14e-1');
    expectFraction(quantity, '7/5');
  });

  it('parses negative fractions and interpretes them as negative frequency ratios', () => {
    const quantity = parse('-1/2');
    expectFraction(quantity, '1/-2');
  });

  it('parses N-of-EDO (negative)', () => {
    const quantity = parse('-2\\5');
    expectEdji(quantity, '-2/5', '2');
  });

  it('parses N-of-EDO (negative EDO)', () => {
    const quantity = parse('2\\-5');
    expectEdji(quantity, '-2/5', '2');
  });

  it('parses generalized N-of-EDO (fraction equave)', () => {
    const quantity = parse('5\\11<7/3>');
    expectEdji(quantity, '5/11', '7/3');
  });

  it('parses generalized N-of-EDO (integer equave)', () => {
    const quantity = parse('-7\\13<5>');
    expectEdji(quantity, '-7/13', '5/1');
  });

  it('parses monzos', () => {
    const quantity = parse('[-1, 2, 3/2, 0>');
    expectMonzo(quantity, ['-1', '2', '3/2']);
  });

  it('parses composites (positive offset)', () => {
    const quantity = parse('3\\5 + 5c!')!;
    expect(quantity.value.cents).toBeCloseTo(5);
    quantity.value.cents = 0;
    expectEdji(quantity, '3/5', '2');
  });

  it('parses composites (negative offset)', () => {
    const quantity = parse('pitch(3/2) - 1.955 c!');
    expect(quantity.value.cents).toBeCloseTo(-1.955);
    quantity.value.cents = 0;
    expectFraction(ratio(quantity), '3/2');
  });

  it('parses large composites', () => {
    const quantity = parse('3\\15 + pitch(103/101) + 6.9¢!');
    expect(quantity.value.vector[0].equals('1/5'));
    expect(quantity.value.residual.equals('103/101'));
    expect(quantity.value.cents).toBeCloseTo(6.9);
  });

  it('has good vibes lol', () => {
    const quantity = parse('432Hz');
    expectFrequency(quantity, 432);
  });

  it('has high vibes', () => {
    const quantity = parse('2 kHz');
    expectFrequency(quantity, 2000);
  });

  it('can parse periods of oscillation', () => {
    const quantity = parse('frequency(0.25ms)');
    expectFrequency(quantity, 4000);
  });

  it('can convert midi scalars to frequency', () => {
    const quantity = parse('mtof(69)');
    expectFrequency(quantity, 440);
  });

  it('can do spectroscopy', () => {
    const quantity = parse('nmtof(121.56701)');
    expectFrequency(quantity, 2.47e15, -13);
  });

  it('supports omitting leading zeros (cents)', () => {
    const quantity = parse('.25c');
    expect(quantity.value.totalCents()).toBe(0.25);
  });

  it('supports omitting leading zeros (decimals)', () => {
    const quantity = parse('.5');
    expect(quantity.value.valueOf()).toBeCloseTo(0.5);
  });

  it('supports omitting trailing zeros', () => {
    const quantity = parse('2.');
    expect(quantity.value.valueOf()).toBeCloseTo(2);
  });

  it('supports completely omitted zeros', () => {
    const quantity = parse('.');
    expect(quantity.value.valueOf()).toBe(0);
  });

  it('parses hard decimals', () => {
    const quantity = parse('3.14!');
    expect(quantity.value.valueOf()).toBeCloseTo(3.14);
  });

  it('parses exponentiation', () => {
    const quantity = parse('5 ^ 3');
    expectFraction(quantity, '125');
  });

  it('parses reduction', () => {
    const quantity = parse('11 reduce 3');
    expectFraction(quantity, '11/9');
  });

  it('can temper a major seventh in 12edo', () => {
    const quantity = parse('<12 19 28] * pitch(15/8) * \\12');
    expectEdji(quantity, '11/12', '2');
  });

  it('can temper a major third in 17c', () => {
    const quantity = parse('17c@ * M3^5 * \\17');
    expectEdji(quantity, '6/17', '2');
  });

  it('can (over)temper a major third in 17cc', () => {
    const quantity = parse('17cc@ * M3^5 * \\17');
    expectEdji(quantity, '4/17', '2');
  });

  it('parses pythagorean intervals', () => {
    const quantity = parse('M2');
    expectFraction(quantity, '9/8', 'pitch');
  });

  it('parses semiquartal intervals', () => {
    const quantity = parse('n2½');
    expectMonzo(quantity, ['1', '-0.5']);
  });

  it('parses semioctave intervals', () => {
    const quantity = parse('M4.5');
    expectMonzo(quantity, ['0.5']);
  });

  it('parses quarter-augmented intervals', () => {
    const quantity = parse('sM2');
    expectMonzo(quantity, ['-0.25', '0.25']);
  });

  it('parses FJS intervals', () => {
    const quantity = parse('M3^5');
    expectFraction(quantity, '5/4', 'pitch');
  });

  it('parses neutral FJS intervals', () => {
    const quantity = parse('n7^29');
    expectFraction(quantity, '29/16', 'pitch');
  });

  it('parses the lower case nominal "a" as an absolute pitch (implicit C4 = 1/1)', () => {
    const quantity = parse('a4');
    expectFraction(quantity, '27/16', 'pitch');
  });

  it('parses negative fractions', () => {
    const quantity = parse('-5/3');
    expectFraction(quantity, '-5/3');
  });

  it('parses the square root', () => {
    const quantity = parse('sqrt(3)');
    expect(quantity.value.valueOf()).toBe(Math.sqrt(3));
  });

  it('parses the cube root', () => {
    const quantity = parse('cbrt(5)');
    expect(quantity.value.valueOf()).toBe(Math.cbrt(5));
  });

  it('can undo exponentiation', () => {
    const quantity = parse('(3^5) log 3');
    expectFraction(quantity, '5');
  });

  it('can assign variables', () => {
    const context = new Map();
    const ast = parseAST('$foo = 11/7');
    const nothing = evaluateAST(ast, context);
    expect(nothing).toBe(undefined);
    expect(context.has('foo')).toBe(true);
    expectFraction(context.get('foo')!, '11/7');
  });

  it('can access variables', () => {
    const two = new Quantity(
      ExtendedMonzo.fromFraction(2),
      'scalar',
      new Fraction(0)
    );
    const three = new Quantity(
      ExtendedMonzo.fromFraction(3),
      'scalar',
      new Fraction(0)
    );
    const context = new Map([
      ['foo', two],
      ['bar', three],
    ]);
    const ast = parseAST('$foo + $bar');
    const quantity = evaluateAST(ast, context);
    expect(quantity).toBeTruthy();
    expectFraction(quantity!, '5');
  });

  it('can map over scale lines', () => {
    const baseFrequency = new Quantity(
      ExtendedMonzo.fromFraction(420),
      'time',
      new Fraction(-1)
    );
    const seven = new Quantity(
      ExtendedMonzo.fromFraction(7),
      'scalar',
      new Fraction(0)
    );
    const eleven = new Quantity(
      ExtendedMonzo.fromFraction(11),
      'scalar',
      new Fraction(0)
    );
    const size = new Quantity(
      ExtendedMonzo.fromFraction(3),
      'scalar',
      new Fraction(0)
    );
    const context = new Map([
      ['0', baseFrequency],
      ['1', seven],
      ['2', eleven],
      ['#', size],
    ]);
    const ast = parseAST('= $ + 1');
    const quantity = evaluateAST(ast, context);
    expect(quantity).toBe(undefined);
    expectFrequency(context.get('0')!, 420);
    expectFraction(context.get('1')!, '8');
    expectFraction(context.get('2')!, '12');
  });
});

describe('Lines parser', () => {
  it('can create harmonics from context variables', () => {
    const context = parseLines(['mtof($##)', '$#', '$#', '$#', '$#'], 69);
    expectFrequency(context.get('0')!, 440);
    expectFraction(context.get('1')!, '1/1');
    expectFraction(context.get('2')!, '2/1');
    expectFraction(context.get('3')!, '3/1');
    expectFraction(context.get('4')!, '4/1');
  });

  it('can build a circle of fifths using context backreferences', () => {
    const context = parseLines(
      ['2616dHz', 'P5', '($-1 + P5) mod P8', '$-1 + P5', '($-1 + P5) mod P8'],
      60
    );
    expectFrequency(context.get('0')!, 261.6);
    expectFraction(context.get('1')!, '3/2', 'pitch');
    expectFraction(context.get('2')!, '9/8', 'pitch');
    expectFraction(context.get('3')!, '27/16', 'pitch');
    expectFraction(context.get('4')!, '81/64', 'pitch');
  });

  it('can build scales with explicit root pitch', () => {
    const context = parseLines(['A4 = 440 Hz', 'B4', 'C5_5', 'E5', 'A♮5'], 69);
    expectFrequency(context.get('0')!, 440);
    expectFraction(context.get('1')!, '9/8', 'pitch');
    expectFraction(context.get('2')!, '6/5', 'pitch');
    expectFraction(context.get('3')!, '3/2', 'pitch');
    expectFraction(context.get('4')!, '2/1', 'pitch');
  });

  it('automatically tempers just intonation', () => {
    const context = parseLines(
      ['1kHz', '19/18', '1.5kHz', '15/8', 'P8', '12@19'],
      100
    );
    expectFrequency(context.get('0')!, 1000);
    expectEdji(context.get('1')!, '1/12', '2');
    expectEdji(context.get('2')!, '7/12', '2');
    expectEdji(context.get('3')!, '11/12', '2');
    expectEdji(context.get('4')!, '12/12', '2');
  });

  it('respects warts equaves in automatic tempering', () => {
    const context = parseLines(['777GHz', '7/5', '3', 'b13@'], 9001);
    expectFrequency(context.get('0')!, 777e9);
    expectEdji(context.get('1')!, '4/13', '3');
    expectEdji(context.get('2')!, '13/13', '3');
  });
});

describe('Scale parser', () => {
  it('supports time domain values as the base frequency', () => {
    const scale = parseScale(['10ms', 'P8'], 50);
    expect(scale.baseFrequency).toBeCloseTo(100);
  });

  it('can parse the Lyman scale and play it at audible frequencies', () => {
    const scale = parseScale(
      [
        'nmtof(121.56701)',
        'nmtof(102.57220)',
        'nmtof(97.253650)',
        'nmtof(94.974287)',
        'nmtof(93.780331)',
        'nmtof(93.0748142)',
        'nmtof(92.6225605)',
        'nmtof(92.3150275)',
        'nmtof(92.0963006)',
        'nmtof(91.9351334)',
        'nmtof(91.1753)  // Lyman limit',
        '1\\2  // Extra padding to get octaves',
      ],
      1003
    );
    expect(scale.getFrequency(69)).toBeCloseTo(440, -2);

    const freqs = scale.getFrequencyRange(60, 60 + 23);
    for (const freq of freqs) {
      expect(freq).toBeGreaterThan(350);
      expect(freq).toBeLessThan(720);
    }
    expect(freqs[0]).toBeCloseTo(0.5 * freqs.pop()!);
  });

  it('handles negative ratios', () => {
    const scale = parseScale(
      ['100 Hz', '-8/7', '$-1 * -8/7', '$-1 * -8/7', '2/1'],
      11
    );
    expect(scale.getRatio(11)).toBeCloseTo(1);
    expect(scale.getRatio(12)).toBeCloseTo(-8 / 7);
    expect(scale.getRatio(13)).toBeCloseTo(64 / 49);
    expect(scale.getRatio(14)).toBeCloseTo(-512 / 343);
    expect(scale.getRatio(15)).toBeCloseTo(2);
  });
});

/*

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
*/

/*
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
*/
