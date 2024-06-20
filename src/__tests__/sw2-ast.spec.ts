import {describe, it, expect} from 'vitest';
import {parse} from '../sw2-ast';

describe('Scale Workshop 2 Abstract Syntax Tree Parser', () => {
  it('parses plain numbers as plain literals ', () => {
    const ast = parse('81');
    expect(ast.type).toBe('PlainLiteral');
    expect(ast.value).toBe(81);
  });

  it('parses dot-separated numbers as cents literals', () => {
    const ast = parse('81.80');
    expect(ast.type).toBe('CentsLiteral');
    expect(ast.whole).toBe(81);
    expect(ast.fractional).toBe('80');
    expect(ast.location).toEqual({
      source: undefined,
      start: {offset: 0, line: 1, column: 1},
      end: {offset: 5, line: 1, column: 6},
    });
  });

  it('parses comma-separated numbers as numeric literals', () => {
    const ast = parse('81,80');
    expect(ast.type).toBe('NumericLiteral');
    expect(ast.whole).toBe(81);
    expect(ast.fractional).toBe('80');
  });

  it('parses leading zeroes in the fractional part of cents literals', () => {
    const ast = parse('.00123');
    expect(ast.type).toBe('CentsLiteral');
    expect(ast.whole).toBe(null);
    expect(ast.fractional).toBe('00123');
  });

  it('parses leading zeroes in the fractional part of numeric literals', () => {
    const ast = parse(',00123');
    expect(ast.type).toBe('NumericLiteral');
    expect(ast.whole).toBe(null);
    expect(ast.fractional).toBe('00123');
  });

  it('parses slash-separated numbers as fraction literals', () => {
    const ast = parse('81/80');
    expect(ast.type).toBe('FractionLiteral');
    expect(ast.numerator).toBe(81);
    expect(ast.denominator).toBe(80);
  });

  it('parses backslash-separated numbers as EDJI fractions', () => {
    const ast = parse('5\\7');
    expect(ast.type).toBe('EdjiFraction');
    expect(ast.numerator).toBe(5);
    expect(ast.denominator).toBe(7);
    expect(ast.equave).toBe(null);
  });

  it('parses EDJI fractions with explicit equaves', () => {
    const ast = parse('6\\13<3>');
    expect(ast.type).toBe('EdjiFraction');
    expect(ast.numerator).toBe(6);
    expect(ast.denominator).toBe(13);
    expect(ast.equave.type).toBe('PlainLiteral');
    expect(ast.equave.value).toBe(3);
  });

  it('parses space-separated numbers between a square and an angle bracket as monzos', () => {
    const ast = parse('[-4 4 -1>');
    expect(ast.type).toBe('Monzo');
    expect(ast.components).toEqual(['-4', '4', '-1']);
  });

  it('parses comma-separated numbers between a square and an angle bracket as monzos', () => {
    const ast = parse('[-4, 4, -1>');
    expect(ast.type).toBe('Monzo');
    expect(ast.components).toEqual(['-4', '4', '-1']);
  });

  it('parses unary negated EDJI', () => {
    const ast = parse('-1\\12');
    expect(ast.type).toBe('UnaryExpression');
    expect(ast.operator).toBe('-');
    expect(ast.operand.type).toBe('EdjiFraction');
    expect(ast.operand.numerator).toBe(1);
    expect(ast.operand.denominator).toBe(12);
    expect(ast.operand.equave).toBe(null);
  });

  it('parses binary added numbers and cents', () => {
    const ast = parse('2 + 1.23');
    expect(ast.type).toBe('BinaryExpression');
    expect(ast.operator).toBe('+');
    expect(ast).toEqual({
      type: 'BinaryExpression',
      operator: '+',
      left: {
        type: 'PlainLiteral',
        value: 2,
        location: {
          source: undefined,
          start: {offset: 0, line: 1, column: 1},
          end: {offset: 1, line: 1, column: 2},
        },
      },
      right: {
        type: 'CentsLiteral',
        whole: 1,
        fractional: '23',
        location: {
          source: undefined,
          start: {offset: 4, line: 1, column: 5},
          end: {offset: 8, line: 1, column: 9},
        },
      },
      location: {
        source: undefined,
        start: {offset: 0, line: 1, column: 1},
        end: {offset: 8, line: 1, column: 9},
      },
    });
  });

  it('parses binary subtracted numbers and cents', () => {
    const ast = parse('2 - 1.23');
    expect(ast.type).toBe('BinaryExpression');
    expect(ast.operator).toBe('-');
  });
});
