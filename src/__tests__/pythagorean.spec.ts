import {describe, it, expect} from 'vitest';
import {absoluteFromParts, fromParts} from '../pythagorean';

describe('Pythagorean interval construction from parts', () => {
  it.each([
    // Basic
    ['d', 2, 19, -12],
    ['d', 6, 18, -11],
    ['d', 3, 16, -10],
    ['d', 7, 15, -9],
    ['d', 4, 13, -8],
    ['d', 1, 11, -7],
    ['d', 5, 10, -6],
    ['m', 2, 8, -5],
    ['m', 6, 7, -4],
    ['m', 3, 5, -3],
    ['m', 7, 4, -2],
    ['P', 4, 2, -1],
    ['P', 1, 0, 0],
    ['P', 5, -1, 1],
    ['M', 2, -3, 2],
    ['M', 6, -4, 3],
    ['M', 3, -6, 4],
    ['M', 7, -7, 5],
    ['A', 4, -9, 6],
    ['A', 1, -11, 7],
    ['A', 5, -12, 8],
    ['A', 2, -14, 9],
    ['A', 6, -15, 10],
    ['A', 3, -17, 11],
    ['A', 7, -18, 12],
    // Compound
    ['P', 8, 1, 0],
    // Negative
    ['M', -2, 3, -2],
    // Double augmented
    ['AA', 1, -22, 14],
    ['dd', 1, 22, -14],
    // Neutral
    ['sd', 2, 13.5, -8.5],
    ['sd', 6, 12.5, -7.5],
    ['sd', 3, 10.5, -6.5],
    ['sd', 7, 9.5, -5.5],
    ['sd', 4, 7.5, -4.5],
    ['sd', 1, 5.5, -3.5],
    ['sd', 5, 4.5, -2.5],
    ['n', 2, 2.5, -1.5],
    ['n', 6, 1.5, -0.5],
    ['n', 3, -0.5, 0.5],
    ['n', 7, -1.5, 1.5],
    ['sA', 4, -3.5, 2.5],
    ['sA', 1, -5.5, 3.5],
    ['sA', 5, -6.5, 4.5],
    ['sA', 2, -8.5, 5.5],
    ['sA', 6, -9.5, 6.5],
    ['sA', 3, -11.5, 7.5],
    ['sA', 7, -12.5, 8.5],
    // Tonesplitters
    ['sd', 2.5, 6.5, -4],
    ['n', 6.5, 5.5, -3],
    ['n', 3.5, 3.5, -2],
    ['n', 7.5, 2.5, -1],
    ['n', 4.5, 0.5, 0],
    ['n', 1.5, -1.5, 1],
    ['n', 5.5, -2.5, 2],
    ['n', 2.5, -4.5, 3],
    ['sA', 6.5, -5.5, 4],
    // Semiquartal
    ['d', 2.5, 12, -7.5],
    ['m', 6.5, 11, -6.5],
    ['m', 3.5, 9, -5.5],
    ['m', 7.5, 8, -4.5],
    ['m', 4.5, 6, -3.5],
    ['m', 1.5, 4, -2.5],
    ['m', 5.5, 3, -1.5],
    ['m', 2.5, 1, -0.5],
    ['M', 6.5, 0, 0.5],
    ['M', 3.5, -2, 1.5],
    ['M', 7.5, -3, 2.5],
    ['M', 4.5, -5, 3.5],
    ['M', 1.5, -7, 4.5],
    ['M', 5.5, -8, 5.5],
    ['M', 2.5, -10, 6.5],
    ['A', 6.5, -11, 7.5],
    // Quarter augmented
    ['qA', 1, -2.75, 1.75],
    ['QA', 1, -8.25, 5.25],
    ['sm', 3, 2.25, -1.25],
    ['sM', 3, -3.25, 2.25],
  ])('constructs %s%s', (quality, degree, twos, threes) => {
    const monzo = fromParts(quality, degree);
    expect(
      monzo.vector[0].equals(twos),
      `${monzo.vector[0].valueOf()} != ${twos}`
    ).toBe(true);
    expect(
      monzo.vector[1].equals(threes),
      `${monzo.vector[1].valueOf()} != ${threes}`
    ).toBe(true);
    expect(monzo.residual.equals(1)).toBe(true);
    expect(monzo.cents).toBeCloseTo(0);
  });
});

describe('Absolute Pythagorean interval construction from parts', () => {
  it.each([
    ['C', [], 4, 0, 0],
    ['F', [], 4, 2, -1],
    ['G', [], 4, -1, 1],
    ['B', ['b'], 3, 3, -2],
    ['E', ['d'], 4, -0.5, 0.5],
    ['C', ['q#'], 4, -2.75, 1.75],
    ['C', ['='], 5, 1, 0],
  ])('constructs %s%s', (nominal, accidentals, octave, twos, threes) => {
    const monzo = absoluteFromParts(nominal, accidentals, octave);
    expect(
      monzo.vector[0].equals(twos),
      `${monzo.vector[0].valueOf()} != ${twos}`
    ).toBe(true);
    expect(
      monzo.vector[1].equals(threes),
      `${monzo.vector[1].valueOf()} != ${threes}`
    ).toBe(true);
    expect(monzo.residual.equals(1)).toBe(true);
    expect(monzo.cents).toBeCloseTo(0);
  });
});
