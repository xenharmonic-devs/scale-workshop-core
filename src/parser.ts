import {ExtendedMonzo} from './monzo';
import {Interval, type IntervalOptions} from './interval';
import {Fraction, PRIMES, PRIME_CENTS} from 'xen-dev-utils';
import {Scale} from './scale';
import {parse} from './sw2-ast';

/**
 * The types of intervals strings can represent.
 */
export enum LINE_TYPE {
  NUMBER = 'number',
  CENTS = 'cents',
  DECIMAL = 'decimal',
  RATIO = 'ratio',
  N_OF_EDO = 'n of edo',
  N_OF_EDJI = 'n of edji',
  MONZO = 'monzo',
  COMPOSITE = 'composite',
  INVALID = 'invalid',
}

// Abstract Syntax Tree hierarchy
type PlainLiteral = {
  type: 'PlainLiteral';
  value: number;
};

type CentsLiteral = {
  type: 'CentsLiteral';
  whole: number | null;
  fractional: string | null;
};

type NumericLiteral = {
  type: 'NumericLiteral';
  whole: number | null;
  fractional: string | null;
};

type FractionLiteral = {
  type: 'FractionLiteral';
  numerator: number;
  denominator: number;
};

type EdjiFraction = {
  type: 'EdjiFraction';
  numerator?: number;
  denominator: number;
  equave: null | PlainLiteral | FractionLiteral;
};

type Monzo = {
  type: 'Monzo';
  components: string[];
};

type UnaryExpression = {
  type: 'UnaryExpression';
  operator: '-';
  operand: Expression;
};

type BinaryExpression = {
  type: 'BinaryExpression';
  operator: '+' | '-';
  left: Expression;
  right: Expression;
};

type Expression =
  | PlainLiteral
  | CentsLiteral
  | NumericLiteral
  | FractionLiteral
  | EdjiFraction
  | Monzo
  | UnaryExpression
  | BinaryExpression;

function parseAst(input: string): Expression {
  return parse(input);
}

/**
 * Determine the type of interval a string represents.
 * @param input String to analyze.
 * @returns The type of interval the string represents.
 */
export function getLineType(input: string) {
  try {
    return getAstType(parseAst(input));
  } catch {
    return LINE_TYPE.INVALID;
  }
}

function getAstType(ast: Expression): LINE_TYPE {
  switch (ast.type) {
    case 'PlainLiteral':
      return LINE_TYPE.NUMBER;
    case 'CentsLiteral':
      return LINE_TYPE.CENTS;
    case 'NumericLiteral':
      return LINE_TYPE.DECIMAL;
    case 'FractionLiteral':
      return LINE_TYPE.RATIO;
    case 'EdjiFraction':
      return ast.equave ? LINE_TYPE.N_OF_EDJI : LINE_TYPE.N_OF_EDO;
    case 'Monzo':
      return LINE_TYPE.MONZO;
    case 'UnaryExpression':
      return getAstType(ast.operand);
    case 'BinaryExpression':
      return LINE_TYPE.COMPOSITE;
  }
}

function parseDegenerateFloat(whole: number | null, fractional: string | null) {
  return parseFloat(`${whole ?? 0}.${fractional ?? ''}`);
}

/**
 * Parse a string to the {@link Interval} it represents.
 * @param input A string to parse.
 * @param numberOfComponents Number of components to use for the {@link Interval} instance's monzo vector part.
 * @param options Formatting options.
 * @param admitBareNumbers Interprete bare numbers as n/1 ratios instead of throwing an error.
 * @param universalMinus Allow unary minus operator in front of every line type.
 * @returns {@link Interval} instance constructed from the input string.
 * @throws An error if the input cannot be interpreted as an interval.
 */
export function parseLine(
  input: string,
  numberOfComponents: number,
  options?: IntervalOptions,
  admitBareNumbers = false,
  universalMinus = true
): Interval {
  const ast = parseAst(input);
  if (!universalMinus && ast.type === 'UnaryExpression') {
    if (ast.operand.type !== 'CentsLiteral') {
      throw new Error('Univeral minus violation');
    }
  }
  if (
    !admitBareNumbers &&
    (ast.type === 'PlainLiteral' ||
      (ast.type === 'UnaryExpression' && ast.operand.type === 'PlainLiteral'))
  ) {
    throw new Error('Bare numbers not allowed');
  }
  return evaluateAst(ast, numberOfComponents, input, options);
}

function evaluateAst(
  ast: Expression,
  numberOfComponents: number,
  name?: string,
  options?: IntervalOptions
): Interval {
  switch (ast.type) {
    case 'PlainLiteral':
      return new Interval(
        ExtendedMonzo.fromFraction(ast.value, numberOfComponents),
        'ratio',
        name,
        options
      );
    case 'CentsLiteral':
      return new Interval(
        ExtendedMonzo.fromCents(
          parseDegenerateFloat(ast.whole, ast.fractional),
          numberOfComponents
        ),
        'cents',
        name,
        options
      );
    case 'NumericLiteral':
      return new Interval(
        ExtendedMonzo.fromValue(
          parseDegenerateFloat(ast.whole, ast.fractional),
          numberOfComponents
        ),
        'decimal',
        name,
        options
      );
    case 'FractionLiteral':
      return new Interval(
        ExtendedMonzo.fromFraction(
          new Fraction(ast.numerator, ast.denominator),
          numberOfComponents
        ),
        'ratio',
        name,
        options
      );
  }
  if (ast.type === 'EdjiFraction') {
    const fractionOfEquave = new Fraction(ast.numerator ?? 0, ast.denominator);
    let equave: Fraction | undefined;
    if (ast.equave?.type === 'PlainLiteral') {
      equave = new Fraction(ast.equave.value);
    } else if (ast.equave?.type === 'FractionLiteral') {
      equave = new Fraction(ast.equave.numerator, ast.equave.denominator);
    }
    if (options === undefined) {
      options = {
        preferredEtDenominator: ast.denominator,
        preferredEtEquave: equave ?? new Fraction(2),
      };
    }
    return new Interval(
      ExtendedMonzo.fromEqualTemperament(
        fractionOfEquave,
        equave,
        numberOfComponents
      ),
      'equal temperament',
      name,
      options
    );
  } else if (ast.type === 'Monzo') {
    const components = ast.components.map(c => new Fraction(c));
    while (components.length < numberOfComponents) {
      components.push(new Fraction(0));
    }
    let residual = new Fraction(1);
    let cents = 0;
    while (components.length > numberOfComponents) {
      const exponent = new Fraction(components.pop()!);
      const factor = new Fraction(PRIMES[components.length]).pow(exponent);
      if (factor === null) {
        cents += exponent.valueOf() * PRIME_CENTS[components.length];
      } else {
        residual = residual.mul(factor);
      }
    }
    return new Interval(
      new ExtendedMonzo(components, residual, cents),
      'monzo',
      name,
      options
    );
  } else if (ast.type === 'UnaryExpression') {
    const operand = evaluateAst(ast.operand, numberOfComponents, name, options);
    operand.monzo = operand.monzo.neg();
    return operand;
  }
  const left = evaluateAst(ast.left, numberOfComponents, undefined, options);
  const right = evaluateAst(ast.right, numberOfComponents, undefined, options);
  if (ast.operator === '+') {
    const result = left.add(right);
    if (name !== undefined) {
      result.name = name;
    }
    return result;
  }
  const result = left.sub(right);
  if (name !== undefined) {
    result.name = name;
  }
  return result;
}

/**
 * Parse a colon-separated string into an array of {@link Interval} instances.
 * To enumerate a {@link Scale} as chord see {@link enumerateChord}.
 * @param input A colon-separated string of substrings to parse.
 * @param numberOfComponents Number of components to use for the {@link Interval} instances' monzo vector part.
 * @param separator Separator to use when splitting the input.
 * @param options Formatting options.
 * @returns An array of {@link Interval} instances constructed from the input string.
 */
export function parseChord(
  input: string,
  numberOfComponents: number,
  separator: string | RegExp = ':',
  options?: IntervalOptions
) {
  // Protect commas and whitespace inside monzos
  input = input.replace(/\[.*?>/g, match => match.replace(/,|\s/g, '¤'));

  const chord: Interval[] = [];
  input.split(separator).forEach(line => {
    // Restore commas (coalescing whitespace is fine)
    line = line.trim().replace(/¤+/g, ',');
    if (!line.length) {
      return;
    }
    chord.push(parseLine(line, numberOfComponents, options, true));
  });
  return chord;
}

/**
 * Parse a newline-separated string into a {@link Scale} instance.
 * @param input Scala-like string to parse into a musical scale.
 * @param numberOfComponents Number of components in monzo vector parts.
 * @param baseFrequency Base frequency of plain 1/1.
 * @param options Formatting options.
 * @returns A {@link Scale} instance constructed from the input string.
 */
export function parseScale(
  input: string,
  numberOfComponents: number,
  baseFrequency = 440.0,
  options?: IntervalOptions
) {
  const intervals = input
    .split('\n')
    .map(line => parseLine(line, numberOfComponents, options));
  return Scale.fromIntervalArray(intervals, baseFrequency);
}

/**
 * Parse a colon- or whitespace-separated string into a {@link Scale} instance.
 * @param input Colon- or whitespace-separated string of substrings to parse.
 * @param numberOfComponents Number of components in monzo vector parts.
 * @param baseFrequency Base frequency of the first interval in the input string.
 * @param options Formatting options.
 * @returns A {@link Scale} instance constructed from the input string.
 */
export function enumerateChord(
  input: string,
  numberOfComponents: number,
  baseFrequency = 440.0,
  options?: IntervalOptions
) {
  const separator = input.includes(':') ? ':' : /\s/;
  const intervals = parseChord(input, numberOfComponents, separator, options);
  return Scale.fromChord(intervals, baseFrequency);
}

/**
 * Convert an interval to its string representation.
 * @param interval {@link Interval} instance to be converted
 * @param admitBareNumbers Interprete bare numbers as n/1 ratios instead of throwing an error.
 * @param universalMinus Allow unary minus operator in front of every line type.
 * @returns String representation of the interval.
 */
export function reverseParseInterval(
  interval: Interval,
  admitBareNumbers = false,
  universalMinus = true
) {
  // Check if the intended name is exact
  try {
    const intended = parseLine(
      interval.name,
      interval.monzo.numberOfComponents,
      interval.options,
      admitBareNumbers,
      universalMinus
    );
    if (intended.equals(interval)) {
      return interval.name;
    }
  } catch {}
  // Fall back to reconstructed string representation
  return interval.toString();
}

/**
 * Convert a scale to an array of strings representing the constituent intervals.
 * @param scale {@link Scale} instance to be converted.
 * @param admitBareNumbers Interprete bare numbers as n/1 ratios instead of throwing an error.
 * @param universalMinus Allow unary minus operator in front of every line type.
 * @returns Array of strings representing the scale.
 */
export function reverseParseScale(
  scale: Scale,
  admitBareNumbers = false,
  universalMinus = true
) {
  const result = scale.intervals
    .slice(1)
    .map(interval =>
      reverseParseInterval(interval, admitBareNumbers, universalMinus)
    );
  result.push(
    reverseParseInterval(scale.equave, admitBareNumbers, universalMinus)
  );
  return result;
}
