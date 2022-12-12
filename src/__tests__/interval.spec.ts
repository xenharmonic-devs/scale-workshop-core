import {describe, it, expect} from 'vitest';

import {ExtendedMonzo} from '../monzo';
import {Interval, IntervalOptions} from '../interval';
import {Fraction} from 'xen-dev-utils';

describe('Scale line reverse parsing', () => {
  it('includes a denominator with integers', () => {
    const monzo = ExtendedMonzo.fromFraction(3, 2);
    const interval = new Interval(monzo, 'ratio');
    expect(interval.toString()).toBe('3/1');
  });

  it('can represent fractions', () => {
    const monzo = ExtendedMonzo.fromFraction(new Fraction(2347868, 1238973), 3);
    const interval = new Interval(monzo, 'ratio');
    expect(interval.toString()).toBe('2347868/1238973');
  });

  it('can represent unsafe fractions', () => {
    const monzo = new ExtendedMonzo([
      new Fraction(9999999999),
      new Fraction(-77777777777777),
    ]);
    const interval = new Interval(monzo, 'ratio');
    expect(interval.toString()).toBe('[9999999999, -77777777777777>');
  });

  it('can represent equal temperament', () => {
    const monzo = ExtendedMonzo.fromEqualTemperament(
      new Fraction(1, 5),
      new Fraction(4),
      1
    );
    const interval = new Interval(monzo, 'equal temperament');
    expect(interval.toString()).toBe('2\\5');
  });

  it('can represent equal temperament (preferred equave)', () => {
    const monzo = ExtendedMonzo.fromEqualTemperament(
      new Fraction(1, 5),
      new Fraction(4),
      1
    );
    const interval = new Interval(monzo, 'equal temperament', undefined, {
      preferredEtEquave: new Fraction(4),
    });
    expect(interval.name).toBe('1\\5<4>');
    expect(interval.toString()).toBe('1\\5<4>');
  });

  it('can represent equal temperament (smaller preferred equave)', () => {
    const monzo = ExtendedMonzo.fromEqualTemperament(
      new Fraction(1, 5),
      new Fraction(9),
      2
    );
    const interval = new Interval(monzo, 'equal temperament', undefined, {
      preferredEtEquave: new Fraction(3),
    });
    expect(interval.name).toBe('2\\5<3>');
    expect(interval.toString()).toBe('2\\5<3>');
  });

  it('can represent equal temperament (negative)', () => {
    const monzo = ExtendedMonzo.fromEqualTemperament(
      new Fraction(-3, 5),
      new Fraction(2),
      1
    );
    const interval = new Interval(monzo, 'equal temperament');
    expect(interval.toString()).toBe('-3\\5');
  });

  it('can represent generalized N-of-EDO (EDT)', () => {
    const monzo = ExtendedMonzo.fromEqualTemperament(
      new Fraction(7, 11),
      new Fraction(3),
      2
    );
    const interval = new Interval(monzo, 'equal temperament');
    expect(interval.toString()).toBe('7\\11<3>');
  });

  it('can represent generalized N-of-EDO (EDF)', () => {
    const monzo = ExtendedMonzo.fromEqualTemperament(
      new Fraction(7, 11),
      new Fraction(3, 2),
      2
    );
    const interval = new Interval(monzo, 'equal temperament');
    expect(interval.toString()).toBe('7\\11<3/2>');
  });

  it('can represent integer cents', () => {
    const monzo = ExtendedMonzo.fromCents(1234, 1);
    const interval = new Interval(monzo, 'cents');
    expect(interval.toString()).toBe('1234.');
  });

  it('can represent fractional cents', () => {
    const monzo = ExtendedMonzo.fromCents(1234.5671, 1);
    const interval = new Interval(monzo, 'cents', undefined, {
      centsFractionDigits: 4,
    });
    expect(interval.toString()).toBe('1234.5671');
  });

  it('can represent composite intervals (equal temperament)', () => {
    const monzo = new ExtendedMonzo([new Fraction(3, 5)], undefined, 7.7);
    const interval = new Interval(monzo, 'equal temperament', '3\\5');
    expect(interval.toString()).toBe('3\\5 + 7.7');
  });

  it('can represent composite intervals (fractions)', () => {
    const monzo = new ExtendedMonzo(
      [new Fraction(0)],
      new Fraction(5, 3),
      3.14
    );
    const interval = new Interval(monzo, 'ratio', '5/3');
    expect(interval.toString()).toBe('5/3 + 3.14');
  });

  it('can represent composite intervals (negative offset)', () => {
    const monzo = new ExtendedMonzo(
      [new Fraction(0)],
      new Fraction(5, 3),
      -3.14
    );
    const interval = new Interval(monzo, 'ratio', '5/3');
    expect(interval.toString()).toBe('5/3 - 3.14');
  });

  it('supports numerator preferences', () => {
    const monzo = ExtendedMonzo.fromFraction(new Fraction(5, 3), 3);
    const interval = new Interval(monzo, 'ratio', undefined, {
      preferredNumerator: 10,
    });
    expect(interval.name).toBe('10/6');
    expect(interval.toString()).toBe('10/6');
  });

  it('supports denominator preferences', () => {
    const monzo = ExtendedMonzo.fromFraction(new Fraction(5, 3), 3);
    const interval = new Interval(monzo, 'ratio', undefined, {
      preferredDenominator: 9,
    });
    expect(interval.name).toBe('15/9');
    expect(interval.toString()).toBe('15/9');
  });

  it('supports edo preferences (octaves)', () => {
    const monzo = ExtendedMonzo.fromFraction(new Fraction(1, 4), 3);
    const interval = new Interval(monzo, 'equal temperament', undefined, {
      preferredEtDenominator: 11,
    });
    expect(interval.name).toBe('-22\\11');
    expect(interval.toString()).toBe('-22\\11');
  });

  it('supports edo preferences (generic)', () => {
    const monzo = ExtendedMonzo.fromEqualTemperament(
      new Fraction(1, 4),
      new Fraction(2),
      1
    );
    const interval = new Interval(monzo, 'equal temperament', undefined, {
      preferredEtDenominator: 12,
    });
    expect(interval.toString()).toBe('3\\12');
  });

  it('supports edo preferences (negative)', () => {
    const monzo = ExtendedMonzo.fromEqualTemperament(
      new Fraction(1, 3),
      new Fraction(1, 2),
      1
    );
    const interval = new Interval(monzo, 'equal temperament', undefined, {
      preferredEtDenominator: -3,
    });
    expect(interval.toString()).toBe('1\\-3');
  });

  it('supports equal temperament denominator preferences (EDT)', () => {
    const monzo = ExtendedMonzo.fromEqualTemperament(
      new Fraction(1, 5),
      new Fraction(3),
      2
    );
    const interval = new Interval(monzo, 'equal temperament', undefined, {
      preferredEtDenominator: 10,
    });
    expect(interval.toString()).toBe('2\\10<3>');
  });

  it('has reasonable formatting on addition', () => {
    const options: IntervalOptions = {
      decimalFractionDigits: 2,
      centsFractionDigits: 2,
    };

    const cents = new Interval(
      ExtendedMonzo.fromCents(1234.5, 2),
      'cents',
      undefined,
      options
    );
    const decimal = new Interval(
      ExtendedMonzo.fromValue(1.5, 2),
      'decimal',
      undefined,
      options
    );
    const monzo = new Interval(
      new ExtendedMonzo([new Fraction(-1, 2), new Fraction(2, 3)]),
      'monzo'
    );
    const ratio = new Interval(ExtendedMonzo.fromFraction('16/9', 2), 'ratio');
    const combination = new Interval(
      new ExtendedMonzo(
        [new Fraction(2), new Fraction(-1)],
        new Fraction(1),
        2.5
      ),
      'any',
      undefined,
      options
    );
    const intervals = [cents, decimal, monzo, ratio, combination];
    let result = '';
    for (const first of intervals) {
      result += '|';
      for (const second of intervals) {
        result += first.add(second).toString() + ';';
      }
    }
    expect(result).toBe(
      '|2469.;3,06;[-1/2, 2/3> + 1234.5;16/9 + 1234.5;[2, -1> + 1237.;' +
        '|3,06;2,25;[-1/2, 2/3> + 701.96;16/9 + 701.96;[2, -1> + 704.46;' +
        '|[-1/2, 2/3> + 1234.5;[-1/2, 2/3> + 701.96;[-1, 4/3>;[7/2, -4/3>;[3/2, -1/3> + 2.5;' +
        '|16/9 + 1234.5;16/9 + 701.96;[7/2, -4/3>;256/81;[6, -3> + 2.5;' +
        '|[2, -1> + 1237.;[2, -1> + 704.46;[3/2, -1/3> + 2.5;[6, -3> + 2.5;[4, -2> + 5.;'
    );
  });
});
