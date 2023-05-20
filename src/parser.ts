import {ExtendedMonzo} from './monzo';
import {stringToNumeratorDenominator} from './utils';
import {Interval, type IntervalOptions} from './interval';
import {Fraction} from 'xen-dev-utils';
import {Scale} from './scale';

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

// `true`, when the input is a string of digits
// for example: '19'
function isNumber(input: string): boolean {
  return /^\d+$/.test(input.trim());
}

// `true`, when the input has digits at the beginning, followed by a dot, ending with any number of digits
// for example: '700.00', '-700.'
function isCent(input: string): boolean {
  return /^-?\d*\.\d*$/.test(input.trim());
}

// `true`, when the input has numbers at the beginning, followed by a comma, ending with any number of digits
// for example: '1,25'
function isCommaDecimal(input: string): boolean {
  return /^\d*,\d*$/.test(input.trim());
}

// `true`, when the input has digits at the beginning and the end, separated by a single slash
// for example: '3/2'
function isRatio(input: string) {
  return /^\d+\/\d+$/.test(input.trim());
}

// `true`, when the input has digits at the beginning and the end, separated by a single backslash
// for example: '7\12', '-7\12'
function isNOfEdo(input: string) {
  return /^-?\d+\\-?\d+$/.test(input.trim());
}

// `true`, when input looks like N-of-EDO followed by a fraction or a number in angle brackets
// for example: '7\11<3/2>', '-7\13<5>'
function isNOfEdji(input: string) {
  return /^-?\d+\\-?\d+<\d+(\/\d+)?>$/.test(input.trim());
}

// `true`, when input has a square bracket followed by a comma/space separated list of numbers or fractions followed by and angle bracket
// for example: '[-4, 4, -1>'
function isMonzo(input: string) {
  return /^\[(-?\d+(\/-?\d+)?[\s,]*)*>$/.test(input.trim());
}

// `true`, when input is not a combination of simpler line types.
function isNonComposite(input: string) {
  return (
    isCent(input) ||
    isCommaDecimal(input) ||
    isNOfEdo(input) ||
    isRatio(input) ||
    isNOfEdji(input) ||
    isMonzo(input)
  );
}

function isSubtractive(input: string) {
  let prefix: string | undefined;
  const parts = input.split('-');
  for (let i = 0; i < parts.length; ++i) {
    if (prefix === undefined) {
      prefix = parts[i];
    } else {
      prefix += '-' + parts[i];
    }
    if (isNonComposite(prefix.trim())) {
      prefix = undefined;
    }
  }
  return !prefix?.length;
}

// `true`, when input is a combination of simpler line types.
// for example: '3/2 - 1.955'
function isComposite(input: string) {
  if (!input.includes('-') && !input.includes('+')) {
    return false;
  }
  const parts = input.split('+');
  for (let i = 0; i < parts.length; ++i) {
    const part = parts[i].trim();
    if (!isSubtractive(part)) {
      return false;
    }
  }
  return true;
}

/**
 * Determine the type of interval a string represents.
 * @param input String to analyze.
 * @returns The type of interval the string represents.
 */
export function getLineType(input: string) {
  if (isCent(input)) {
    return LINE_TYPE.CENTS;
  }
  if (isCommaDecimal(input)) {
    return LINE_TYPE.DECIMAL;
  }
  if (isNOfEdo(input)) {
    return LINE_TYPE.N_OF_EDO;
  }
  if (isRatio(input)) {
    return LINE_TYPE.RATIO;
  }
  if (isNOfEdji(input)) {
    return LINE_TYPE.N_OF_EDJI;
  }
  if (isMonzo(input)) {
    return LINE_TYPE.MONZO;
  }
  if (isComposite(input)) {
    return LINE_TYPE.COMPOSITE;
  }
  if (isNumber(input)) {
    return LINE_TYPE.NUMBER;
  }

  return LINE_TYPE.INVALID;
}

function parseNumber(
  input: string,
  numberOfComponents: number,
  options?: IntervalOptions
) {
  const number = parseInt(input);
  return new Interval(
    ExtendedMonzo.fromFraction(number, numberOfComponents),
    'ratio',
    input,
    options
  );
}

function parseCents(
  input: string,
  numberOfComponents: number,
  options?: IntervalOptions
) {
  if (input.trim() === '.') {
    return new Interval(
      ExtendedMonzo.fromCents(0, numberOfComponents),
      'cents',
      input,
      options
    );
  }
  const cents = parseFloat(input);
  if (isNaN(cents)) {
    throw new Error(`Failed to parse ${input} to cents`);
  }
  return new Interval(
    ExtendedMonzo.fromCents(cents, numberOfComponents),
    'cents',
    input,
    options
  );
}

function parseDecimal(
  input: string,
  numberOfComponents: number,
  options?: IntervalOptions
) {
  if (input.trim() === ',') {
    return new Interval(
      ExtendedMonzo.fromValue(0, numberOfComponents),
      'decimal',
      input,
      options
    );
  }
  const value = parseFloat(input.replace(',', '.'));
  if (isNaN(value)) {
    throw new Error(`Failed to parse ${input} to decimal`);
  }
  return new Interval(
    ExtendedMonzo.fromValue(value, numberOfComponents),
    'decimal',
    input,
    options
  );
}

function parseNOfEdo(
  input: string,
  numberOfComponents: number,
  options?: IntervalOptions
) {
  const [numerator, denominator] = stringToNumeratorDenominator(
    input.replace('\\', '/')
  );
  const octave = new Fraction(2);
  if (options === undefined) {
    options = {
      preferredEtDenominator: denominator,
      preferredEtEquave: octave,
    };
  }
  return new Interval(
    ExtendedMonzo.fromEqualTemperament(
      new Fraction(numerator, denominator),
      octave,
      numberOfComponents
    ),
    'equal temperament',
    input,
    options
  );
}

function parseNOfEdji(
  input: string,
  numberOfComponents: number,
  options?: IntervalOptions
) {
  const [nOfEdo, equavePart] = input.split('<');
  const [numerator, denominator] = stringToNumeratorDenominator(
    nOfEdo.replace('\\', '/')
  );
  const equave = new Fraction(equavePart.slice(0, -1));
  if (options === undefined) {
    options = {
      preferredEtDenominator: denominator,
      preferredEtEquave: equave,
    };
  }
  return new Interval(
    ExtendedMonzo.fromEqualTemperament(
      new Fraction(numerator, denominator),
      equave,
      numberOfComponents
    ),
    'equal temperament',
    input,
    options
  );
}

function parseMonzo(
  input: string,
  numberOfComponents: number,
  options?: IntervalOptions
) {
  const components: Fraction[] = [];
  input
    .slice(1, -1)
    .replace(/,/g, ' ')
    .split(/\s/)
    .forEach(token => {
      token = token.trim();
      if (token.length) {
        const [numerator, denominator] = stringToNumeratorDenominator(token);
        components.push(new Fraction(numerator, denominator));
      }
    });
  if (components.length > numberOfComponents) {
    throw new Error('Not enough components to represent monzo');
  }
  while (components.length < numberOfComponents) {
    components.push(new Fraction(0));
  }
  return new Interval(new ExtendedMonzo(components), 'monzo', input, options);
}

function parseRatio(
  input: string,
  numberOfComponents: number,
  options?: IntervalOptions,
  inferPreferences = false
) {
  if (inferPreferences && options === undefined) {
    const [numerator, denominator] = stringToNumeratorDenominator(input);
    options = {
      preferredNumerator: numerator,
      preferredDenominator: denominator,
    };
  }
  return new Interval(
    ExtendedMonzo.fromFraction(new Fraction(input), numberOfComponents),
    'ratio',
    input,
    options
  );
}

function parseSubtractive(
  input: string,
  numberOfComponents: number,
  options?: IntervalOptions
): [Interval, boolean] {
  let centCount = 0;
  let prefix: string | undefined;
  const parts = input.split('-');
  const results: Interval[] = [];
  for (let i = 0; i < parts.length; ++i) {
    if (prefix === undefined) {
      prefix = parts[i];
    } else {
      prefix += '-' + parts[i];
    }
    if (isNonComposite(prefix.trim())) {
      if (isCent(prefix.trim())) {
        centCount++;
      }
      results.push(parseLine(prefix.trim(), numberOfComponents, options));
      prefix = undefined;
    }
  }
  if (prefix?.length || !results.length) {
    throw new Error(`Failed to parse composite part ${input}`);
  }
  if (results.length === 1) {
    return [results[0], false];
  }
  return [
    results[0].sub(results.slice(1).reduce((a, b) => a.add(b))),
    results.length === 2 && centCount > 0,
  ];
}

function parseComposite(
  input: string,
  numberOfComponents: number,
  options?: IntervalOptions
) {
  const parts = input.split('+');
  // Special handling for cent offsets: Use name of the primary interval
  if (parts.length === 1) {
    const [result, hasOffset] = parseSubtractive(
      parts[0],
      numberOfComponents,
      options
    );
    if (hasOffset) {
      return result;
    }
  }
  if (
    parts.length === 2 &&
    (isCent(parts[0].trim()) || isCent(parts[1].trim()))
  ) {
    return parseLine(parts[0].trim(), numberOfComponents).add(
      parseLine(parts[1].trim(), numberOfComponents)
    );
  }

  const result = parts
    .map(part => parseSubtractive(part, numberOfComponents, options)[0])
    .reduce((a, b) => a.add(b));
  result.name = input;
  return result;
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
  if (universalMinus && input.startsWith('-')) {
    return parseLine(
      input.slice(1),
      numberOfComponents,
      options,
      admitBareNumbers,
      universalMinus
    ).neg();
  }
  const lineType = getLineType(input);
  switch (lineType) {
    case LINE_TYPE.CENTS:
      return parseCents(input, numberOfComponents, options);
    case LINE_TYPE.DECIMAL:
      return parseDecimal(input, numberOfComponents, options);
    case LINE_TYPE.N_OF_EDO:
      return parseNOfEdo(input, numberOfComponents, options);
    case LINE_TYPE.RATIO:
      return parseRatio(input, numberOfComponents, options);
    case LINE_TYPE.N_OF_EDJI:
      return parseNOfEdji(input, numberOfComponents, options);
    case LINE_TYPE.MONZO:
      return parseMonzo(input, numberOfComponents, options);
    case LINE_TYPE.COMPOSITE:
      return parseComposite(input, numberOfComponents, options);
    default:
      if (admitBareNumbers && lineType === LINE_TYPE.NUMBER) {
        return parseNumber(input, numberOfComponents, options);
      }
      throw new Error(`Failed to parse ${input}`);
  }
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
  // Protect commas inside monzos
  input = input.replace(/\[.*?>/g, match => match.replace(/,/g, '¤'));

  const chord: Interval[] = [];
  input.split(separator).forEach(line => {
    // Restore commas
    line = line.trim().replace(/¤/g, ',');
    if (!line.length) {
      return;
    }
    if (isNumber(line)) {
      chord.push(parseNumber(line, numberOfComponents, options));
    } else {
      chord.push(parseLine(line, numberOfComponents, options));
    }
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
