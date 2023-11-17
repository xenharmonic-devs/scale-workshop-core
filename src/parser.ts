import {Fraction} from 'xen-dev-utils';
import {parse} from './interval-ast-parser';
import {ExtendedMonzo} from './monzo';
import {
  Quantity,
  frequency,
  ratio,
  pitch,
  mtof,
  ftom,
  nmtof,
  sqrt,
  cbrt,
} from './quantity';
import {MetricPrefix, metricPrefix} from './utils';
import {absoluteToJustIntonation, toJustIntonation} from './fjs';
import {inferEquave, wartsToVal} from './warts';
import {Scale} from './scale';

export type ParsingContext = Map<string, Quantity>;

type VariableDeclaration = {
  type: 'VariableDeclaration';
  name: string;
  value: Expression;
};

type MapDeclaration = {
  type: 'MapDeclaration';
  value: Expression;
};

type PitchAssignment = {
  type: 'PitchAssignment';
  pitch: AbsoluteFJS;
  value: Expression;
};

type VariableAccess = {
  type: 'VariableAccess';
  name: string;
};

type FunctionExpression = {
  type: 'Function';
  name:
    | 'frequency'
    | 'pitch'
    | 'ratio'
    | 'mtof'
    | 'ftom'
    | 'nmtof'
    | 'sqrt'
    | 'cbrt';
  value: Expression;
};

type BinaryExpression = {
  type: 'BinaryExpression';
  operator: '+' | '-' | '*' | '%' | '×' | '÷' | '^' | 'mod' | 'reduce' | 'log';
  left: Expression;
  right: Expression;
};

type UnaryExpression = {
  type: 'UnaryExpression';
  operator: '+' | '-' | '%' | '÷';
  operand: Expression;
};

type NumericLiteral = {
  type: 'Number';
  text: string;
};

type HardDecimal = {
  type: 'HardDecimal';
  amount: string;
};

type EdjiFraction = {
  type: 'EdjiFraction';
  numerator?: string;
  denominator?: string;
  equave?: Expression;
};

type Cent = {
  type: 'Cent';
  hard: boolean;
};

type InverseCent = {
  type: 'InverseCent';
  hard: boolean;
};

type Monzo = {
  type: 'Monzo';
  components: string[];
};

type Val = {
  type: 'Val';
  components: string[];
};

type Warts = {
  type: 'Warts';
  equave: string;
  edo: string;
  warts: string[];
  subgroup: string;
};

type FJS = {
  type: 'FJS';
  quality: string;
  degree: string;
  superscripts: string[];
  subscripts: string[];
};

type AbsoluteFJS = {
  type: 'AbsoluteFJS';
  nominal: string;
  accidentals: string[];
  octave: string;
  superscripts: string[];
  subscripts: string[];
};

type Hertz = {
  type: 'Hertz';
  prefix: MetricPrefix;
  hard: boolean;
};

type Second = {
  type: 'Second';
  prefix: MetricPrefix;
  hard: boolean;
};

type Expression =
  | VariableAccess
  | FunctionExpression
  | BinaryExpression
  | UnaryExpression
  | NumericLiteral
  | HardDecimal
  | EdjiFraction
  | Cent
  | InverseCent
  | Monzo
  | Val
  | Warts
  | FJS
  | AbsoluteFJS
  | Hertz
  | Second;

const ZERO = new Fraction(0);
const ONE = new Fraction(1);
const NEGATIVE_ONE = new Fraction(-1);
const CENT = ExtendedMonzo.fromEqualTemperament(new Fraction(1, 1200));
const INVERSE_CENT = ExtendedMonzo.fromEqualTemperament(new Fraction(1200));
const UNISON = new ExtendedMonzo([]);

function getSize(context: ParsingContext) {
  return Math.round(context.get('#')!.value.valueOf());
}

export function evaluateExpression(
  ast: Expression,
  context: ParsingContext
): Quantity {
  if (ast.type === 'Function') {
    const value = evaluateExpression(ast.value, context);
    switch (ast.name) {
      case 'pitch':
        return pitch(value, context.get('0'));
      case 'ratio':
        return ratio(value, context.get('0'));
      case 'frequency':
        return frequency(value, context.get('0'));
      case 'mtof':
        return mtof(value);
      case 'ftom':
        return ftom(value, context.get('0'));
      case 'nmtof':
        return nmtof(value);
      case 'sqrt':
        return sqrt(value);
      case 'cbrt':
        return cbrt(value);
      default:
        throw new Error(
          `Unrecognized function ${(ast as FunctionExpression).name}`
        );
    }
  } else if (ast.type === 'BinaryExpression') {
    const left = evaluateExpression(ast.left, context);
    const right = evaluateExpression(ast.right, context);
    switch (ast.operator) {
      case '+':
        return left.add(right);
      case '-':
        return left.sub(right);
      case '*':
      case '×':
        return left.mul(right);
      case '%':
      case '÷':
        return left.div(right);
      case '^':
        return left.pow(right);
      case 'mod':
        return left.mod(right);
      case 'reduce':
        return left.reduce(right);
      case 'log':
        return left.log(right);
      default:
        throw new Error(
          `Unrecognized operator ${(ast as BinaryExpression).operator}`
        );
    }
  } else if (ast.type === 'UnaryExpression') {
    const operand = evaluateExpression(ast.operand, context);
    switch (ast.operator) {
      case '+':
        return operand;
      case '-':
        return operand.neg();
      case '%':
      case '÷':
        return operand.inverse();
      default:
        throw new Error(
          `Unrecognized operator ${(ast as UnaryExpression).operator}`
        );
    }
  } else if (ast.type === 'Number') {
    return new Quantity(ExtendedMonzo.fromFraction(ast.text), 'scalar', ZERO);
  } else if (ast.type === 'HardDecimal') {
    return new Quantity(
      ExtendedMonzo.fromValue(parseFloat(ast.amount)),
      'scalar',
      ZERO
    );
  } else if (ast.type === 'EdjiFraction') {
    const numerator = new Fraction(ast.numerator ?? '1');
    const denominator = new Fraction(ast.denominator ?? '12');
    let equave: Fraction | undefined;
    if (ast.equave) {
      const quantity = evaluateExpression(ast.equave, context);
      if (quantity.exponent.equals(ZERO) && quantity.value.isFractional()) {
        equave = quantity.value.toFraction();
      } else {
        const cents = pitch(quantity).value.totalCents();
        return new Quantity(
          ExtendedMonzo.fromCents(
            (cents * numerator.valueOf()) / denominator.valueOf()
          ),
          'pitch',
          ONE
        );
      }
    }
    return new Quantity(
      ExtendedMonzo.fromEqualTemperament(numerator.div(denominator), equave),
      'pitch',
      ONE
    );
  } else if (ast.type === 'Cent') {
    if (ast.hard) {
      return new Quantity(ExtendedMonzo.fromCents(1), 'pitch', ONE);
    }
    return new Quantity(CENT, 'pitch', ONE);
  } else if (ast.type === 'InverseCent') {
    if (ast.hard) {
      return new Quantity(ExtendedMonzo.fromCents(1), 'pitch', NEGATIVE_ONE);
    }
    return new Quantity(INVERSE_CENT, 'pitch', NEGATIVE_ONE);
  } else if (ast.type === 'Monzo' || ast.type === 'Val') {
    return new Quantity(
      new ExtendedMonzo(ast.components.map(c => new Fraction(c))),
      'pitch',
      ast.type === 'Monzo' ? ONE : NEGATIVE_ONE
    );
  } else if (ast.type === 'Warts') {
    const val = wartsToVal(
      ast.equave,
      parseInt(ast.edo, 10),
      ast.warts,
      ast.subgroup
    );
    return new Quantity(val, 'pitch', NEGATIVE_ONE);
  } else if (ast.type === 'FJS') {
    const value = toJustIntonation(
      ast.quality,
      parseFloat(ast.degree.replace('½', '.5')),
      ast.superscripts.map(s => parseInt(s, 10)),
      ast.subscripts.map(s => parseInt(s, 10))
    );
    return new Quantity(value, 'pitch', ONE);
  } else if (ast.type === 'AbsoluteFJS') {
    const value = absoluteToJustIntonation(
      ast.nominal,
      ast.accidentals,
      parseInt(ast.octave),
      ast.superscripts.map(s => parseInt(s, 10)),
      ast.subscripts.map(s => parseInt(s, 10))
    );
    let root = UNISON;
    if (context.has('#root')) {
      root = context.get('#root')!.value;
    }
    return new Quantity(value.div(root), 'pitch', ONE);
  } else if (ast.type === 'Hertz' || ast.type === 'Second') {
    const exponent = ast.type === 'Second' ? ONE : NEGATIVE_ONE;
    if (ast.hard) {
      return new Quantity(
        ExtendedMonzo.fromValue(metricPrefix(ast.prefix).valueOf()),
        'time',
        exponent
      );
    }
    return new Quantity(
      ExtendedMonzo.fromFraction(metricPrefix(ast.prefix)),
      'time',
      exponent
    );
  } else if (ast.type === 'VariableAccess') {
    let name = ast.name;
    if (name.startsWith('-')) {
      const size = getSize(context);
      name = `${size + parseInt(name, 10)}`;
    }
    const value = context.get(name);
    if (value === undefined) {
      throw new Error(`Unrecognized variable $${ast.name}`);
    }
    return value;
  }
  throw new Error(`Unrecognized expression ${(ast as Expression).type}`);
}

export function parseAST(
  input: string
): VariableDeclaration | MapDeclaration | PitchAssignment | Expression {
  return parse(input);
}

export function evaluateAST(
  ast: ReturnType<typeof parseAST>,
  context: ParsingContext
) {
  let rootPich: AbsoluteFJS | undefined;
  if (ast.type === 'VariableDeclaration') {
    context.set(ast.name, evaluateExpression(ast.value, context));
    return;
  } else if (ast.type === 'MapDeclaration') {
    const size = getSize(context);
    for (let i = 1; i < size; ++i) {
      const index = i.toString();
      context.set('', context.get(index)!);
      context.set(index, evaluateExpression(ast.value, context));
    }
    return;
  } else if (ast.type === 'PitchAssignment') {
    rootPich = ast.pitch;
    ast = ast.value;
  }
  const quantity = evaluateExpression(ast, context);
  if (rootPich) {
    const root = evaluateExpression(rootPich, context);
    context.set('#root', root);
  }
  return quantity;
}

function int(n: number) {
  return new Quantity(ExtendedMonzo.fromFraction(n), 'scalar', ZERO);
}

export function parseLines(inputs: string[], baseMidiNote: number) {
  const context: ParsingContext = new Map();
  let numQuantities = 0;

  for (const input of inputs) {
    const ast = parseAST(input);
    context.set('#', int(numQuantities));
    context.set('##', int(baseMidiNote + numQuantities));
    const output = evaluateAST(ast, context);
    if (output) {
      // Vals cannot be converted to frequencies so they act as implicit maps
      if (output.domain === 'pitch' && output.exponent.equals(NEGATIVE_ONE)) {
        const val = output;
        let divisions = val.value.vector[0];
        let equave = new Fraction(2);
        if (ast.type === 'Warts') {
          divisions = new Fraction(ast.edo);
          const equave_ = inferEquave(ast.equave, ast.subgroup);
          if (!equave_) {
            throw new Error('Invalid warts equave');
          }
          equave = equave_;
        }
        const step = new Quantity(
          ExtendedMonzo.fromFraction(equave).pow(divisions.inverse()),
          'pitch',
          ONE
        );
        for (let i = 1; i < numQuantities; ++i) {
          const index = i.toString();
          const quantity = context.get(index)!;
          const numSteps = val.mul(pitch(quantity, context.get('0')!));
          context.set(index, step.mul(numSteps));
        }
        continue;
      }
      if (!numQuantities) {
        // Throws if the quantity is not convertible to a frequency
        frequency(output);
      } else {
        if (ast.type === 'PitchAssignment') {
          throw new Error('Pitch assignment is only valid on the first line');
        }
      }
      context.set(numQuantities.toString(), output);
      numQuantities++;
    }
  }
  context.set('#', int(numQuantities));
  context.set('##', int(baseMidiNote + numQuantities));
  return context;
}

export function parseScale(inputs: string[], baseMidiNote: number) {
  const context = parseLines(inputs, baseMidiNote);
  const numQuantities = getSize(context);
  if (numQuantities < 2) {
    throw new Error(
      'Need at least a base frequence and the interval of equivalence to make a scale'
    );
  }
  const baseFrequency = context.get('0')!;
  const intervalRatios: number[] = [];
  for (let i = 0; i < numQuantities; ++i) {
    intervalRatios.push(
      ratio(context.get(i.toString())!, baseFrequency).value.valueOf()
    );
  }
  const equaveRatio = intervalRatios.pop()!;

  return new Scale(
    intervalRatios,
    equaveRatio,
    frequency(baseFrequency).value.valueOf(),
    baseMidiNote
  );
}
