import {describe, it, expect} from 'vitest';
import {parse} from '../interval-ast-parser';

describe('Interval Abstract Syntax Tree Parser', () => {
  it('parses decimals', () => {
    const ast = parse('81.80');
    expect(ast.type).toBe('Number');
    expect(ast.text).toBe('81.80');
  });

  it('parses fractions', () => {
    const ast = parse('81/80');
    expect(ast.type).toBe('Number');
    expect(ast.text).toBe('81/80');
  });

  it('parses plain numbers', () => {
    const ast = parse('42');
    expect(ast.type).toBe('Number');
    expect(ast.text).toBe('42');
  });

  it('parses scientific notation', () => {
    const ast = parse('1.23e-45');
    expect(ast.type).toBe('Number');
    expect(ast.text).toBe('1.23e-45');
  });

  it('parses partial decimals (right)', () => {
    const ast = parse('2.');
    expect(ast.type).toBe('Number');
    expect(ast.text).toBe('2.');
  });

  it('parses partial decimals (left)', () => {
    const ast = parse('.4');
    expect(ast.type).toBe('Number');
    expect(ast.text).toBe('.4');
  });

  it('parses edo fractions', () => {
    const ast = parse('3\\5');
    expect(ast.type).toBe('BinaryExpression');
    expect(ast.left).toEqual({type: 'Number', text: '3'});
    const edji = ast.right;
    expect(edji.type).toBe('EdjiFraction');
    expect(edji.denominator).toBe('5');
    expect(edji.equave).toBeFalsy();
  });

  it('parses fractional edo fractions', () => {
    const ast = parse('\\3.5');
    expect(ast.type).toBe('EdjiFraction');
    expect(ast.denominator).toBe('3.5');
    expect(ast.equave).toBeFalsy();
  });

  it('parses edji fractions', () => {
    const ast = parse('\\13<3>');
    expect(ast.type).toBe('EdjiFraction');
    expect(ast.denominator).toBe('13');
    expect(ast.equave).toEqual({type: 'Number', text: '3'});
  });

  it('parses negative edji', () => {
    const ast = parse('-4\\7');
    expect(ast).toEqual({
      type: 'UnaryExpression',
      operator: '-',
      operand: {
        type: 'BinaryExpression',
        operator: '×',
        left: {type: 'Number', text: '4'},
        right: {type: 'EdjiFraction', denominator: '7', equave: null},
      },
    });
  });

  it('parses monzos', () => {
    const ast = parse('[-4, 4, -1>');
    expect(ast.type).toBe('Monzo');
    expect(ast.components).toEqual(['-4', '4', '-1']);
  });

  it('parses vals', () => {
    const ast = parse('<12 19 28 -7/2]');
    expect(ast.type).toBe('Val');
    expect(ast.components).toEqual(['12', '19', '28', '-7/2']);
  });

  it('parses warts (patent with implicit subgroup)', () => {
    const ast = parse('12@');
    expect(ast).toEqual({
      type: 'Warts',
      equave: '',
      edo: '12',
      warts: [],
      subgroup: '',
    });
  });

  it('parses warts (explicit deviation and subgroup)', () => {
    const ast = parse('a17c@2.3.5');
    expect(ast).toEqual({
      type: 'Warts',
      edo: '17',
      equave: 'a',
      warts: ['c'],
      subgroup: '2.3.5',
    });
  });

  it('parses cents', () => {
    const ast = parse('9.8 c');
    expect(ast.type).toBe('BinaryExpression');
    expect(ast.left).toEqual({type: 'Number', text: '9.8'});
    expect(ast.right).toEqual({type: 'Cent', hard: false});
  });

  it('parses negative cents', () => {
    const ast = parse('-c');
    expect(ast.type).toBe('UnaryExpression');
    expect(ast.operator).toBe('-');
    expect(ast.operand).toEqual({type: 'Cent', hard: false});
  });

  it('parses hard cents', () => {
    const ast = parse('9.8 c!');
    expect(ast.type).toBe('BinaryExpression');
    expect(ast.left).toEqual({type: 'Number', text: '9.8'});
    expect(ast.right).toEqual({type: 'Cent', hard: true});
  });

  it('parses hard decimals', () => {
    const ast = parse('3.141592653!');
    expect(ast.type).toBe('HardDecimal');
    expect(ast.amount).toBe('3.141592653');
  });

  it.each([
    ['P5', 'P', '5'],
    ['M3', 'M', '3'],
    ['A9', 'A', '9'],
    ['dd11', 'dd', '11'],
    ['m-2', 'm', '-2'],
  ])('parses pythagorean %s', (interval, quality, degree) => {
    const ast = parse(interval);
    expect(ast.type).toBe('FJS');
    expect(ast.quality).toBe(quality);
    expect(ast.degree).toBe(degree);
    expect(ast.superscripts).toHaveLength(0);
    expect(ast.subscripts).toHaveLength(0);
  });

  it.each([
    ['n3', 'n', '3'],
    ['sd4', 'sd', '4'],
    ['sAA10', 'sAA', '10'],
  ])('parses semipythagorean %s', (interval, quality, degree) => {
    const ast = parse(interval);
    expect(ast.type).toBe('FJS');
    expect(ast.quality).toBe(quality);
    expect(ast.degree).toBe(degree);
    expect(ast.superscripts).toHaveLength(0);
    expect(ast.subscripts).toHaveLength(0);
  });

  it.each([
    ['sd7.5', 'sd', '7.5'],
    ['n2.5', 'n', '2.5'],
    ['M4½', 'M', '4½'],
  ])('parses semiquartal %s', (interval, quality, degree) => {
    const ast = parse(interval);
    expect(ast.type).toBe('FJS');
    expect(ast.quality).toBe(quality);
    expect(ast.degree).toBe(degree);
    expect(ast.superscripts).toHaveLength(0);
    expect(ast.subscripts).toHaveLength(0);
  });

  it.each([
    ['qA1', 'qA', '1'],
    ['Qd4', 'Qd', '4'],
    ['sM3', 'sM', '3'],
  ])('parses demisemipythagorean %s', (interval, quality, degree) => {
    const ast = parse(interval);
    expect(ast.type).toBe('FJS');
    expect(ast.quality).toBe(quality);
    expect(ast.degree).toBe(degree);
    expect(ast.superscripts).toHaveLength(0);
    expect(ast.subscripts).toHaveLength(0);
  });

  it.each([
    ['M3^5', 'M', '3', ['5'], []],
    ['A1^5,5', 'A', '1', ['5', '5'], []],
    ['M2_7', 'M', '2', [], ['7']],
  ])('parses FJS %s', (interval, quality, degree, superscripts, subscripts) => {
    const ast = parse(interval);
    expect(ast.type).toBe('FJS');
    expect(ast.quality).toBe(quality);
    expect(ast.degree).toBe(degree);
    expect(ast.superscripts).toEqual(superscripts);
    expect(ast.subscripts).toEqual(subscripts);
  });

  it('parses exponentiation without confusing it with FJS', () => {
    const expected = {
      type: 'BinaryExpression',
      operator: '^',
      left: {
        type: 'FJS',
        quality: 'n',
        degree: '3',
        superscripts: [],
        subscripts: [],
      },
      right: {type: 'Number', text: '2'},
    };
    const left = parse('(n3)^2');
    expect(left).toEqual(expected);
    const right = parse('n3^(2)');
    expect(right).toEqual(expected);
  });

  it('parses negative decimals (unary)', () => {
    const ast = parse('-(1.23)');
    expect(ast.type).toBe('UnaryExpression');
    expect(ast.operator).toBe('-');
    expect(ast.operand).toEqual({type: 'Number', text: '1.23'});
  });

  it('parses unary inverted numbers', () => {
    const ast = parse('%5');
    expect(ast.type).toBe('UnaryExpression');
    expect(ast.operator).toBe('%');
    expect(ast.operand).toEqual({type: 'Number', text: '5'});
  });

  it('parses inverted monzos', () => {
    const ast = parse('-[1, -1>');
    expect(ast.type).toBe('UnaryExpression');
    expect(ast.operator).toBe('-');
    expect(ast.operand).toEqual({type: 'Monzo', components: ['1', '-1']});
  });

  it('parses negated parenthesis', () => {
    const ast = parse('-(7/5)');
    expect(ast.type).toBe('UnaryExpression');
    expect(ast.operator).toBe('-');
    expect(ast.operand).toEqual({type: 'Number', text: '7/5'});
  });

  it('parses addition', () => {
    const ast = parse('1 + 2');
    expect(ast.type).toBe('BinaryExpression');
    expect(ast.operator).toBe('+');
    expect(ast.left).toEqual({type: 'Number', text: '1'});
    expect(ast.right).toEqual({type: 'Number', text: '2'});
  });

  it('parses multiplication with addition', () => {
    const ast = parse(`
      1 +  // One plus
      2*3  //   six.
    `);
    expect(ast).toEqual({
      type: 'BinaryExpression',
      operator: '+',
      left: {type: 'Number', text: '1'},
      right: {
        type: 'BinaryExpression',
        operator: '*',
        left: {type: 'Number', text: '2'},
        right: {type: 'Number', text: '3'},
      },
    });
  });

  it('parses exponentiation with fractions taking precedence', () => {
    // Neutral our beloved
    const ast = parse('3/2^1/2  // <3');
    expect(ast).toEqual({
      type: 'BinaryExpression',
      operator: '^',
      left: {type: 'Number', text: '3/2'},
      right: {type: 'Number', text: '1/2'},
    });
  });

  it('parses variable declaration', () => {
    const ast = parse(
      '$sqrt_IslandComma = [1 -1.5 -1 0 0 1>  // Wow comments work too!'
    );
    expect(ast.type).toBe('VariableDeclaration');
    expect(ast.name).toBe('sqrt_IslandComma');
    expect(ast.value).toEqual({
      type: 'Monzo',
      components: ['1', '-1.5', '-1', '0', '0', '1'],
    });
    expect(ast.quoted).toBe(false);
  });

  it('parses variable declaration (FJS-like)', () => {
    const ast = parse('$F# = 4/3');
    expect(ast.type).toBe('VariableDeclaration');
    expect(ast.name).toBe('F#');
    expect(ast.value).toEqual({
      type: 'Number',
      text: '4/3',
    });
    expect(ast.quoted).toBe(false);
  });

  it('parses variable access (user defined)', () => {
    const ast = parse('n2½ - $sqrt_IslandComma');
    expect(ast.type).toBe('BinaryExpression');
    expect(ast.right.type).toBe('VariableAccess');
    expect(ast.right.name).toBe('sqrt_IslandComma');
    expect(ast.right.quoted).toBe(false);
  });

  it('parses variable access (empty = previous)', () => {
    const ast = parse('$ + 1\\6');
    expect(ast.type).toBe('BinaryExpression');
    expect(ast.left.type).toBe('VariableAccess');
    expect(ast.left.name).toBe('');
    expect(ast.left.quoted).toBe(false);
  });

  it('parses variable access (index = scale degree)', () => {
    const ast = parse('5/4 * $11');
    expect(ast.type).toBe('BinaryExpression');
    expect(ast.right.type).toBe('VariableAccess');
    expect(ast.right.name).toBe('11');
    expect(ast.right.quoted).toBe(false);
  });

  it('parses quoted variable definition', () => {
    const ast = parse('"You don\'t need to worry about * or anything!" = 1');
    expect(ast.type).toBe('VariableDeclaration');
    expect(ast.name).toBe("You don't need to worry about * or anything!");
    expect(ast.value).toEqual({type: 'Number', text: '1'});
    expect(ast.quoted).toBe(true);
  });

  it('parses quoted variable access', () => {
    const ast = parse('"Ptolemy\'s comma" + P5');
    expect(ast.type).toBe('BinaryExpression');
    expect(ast.left.type).toBe('VariableAccess');
    expect(ast.left.name).toBe("Ptolemy's comma");
    expect(ast.left.quoted).toBe(true);
  });

  it('parses hertz', () => {
    const ast = parse('220Hz');
    expect(ast).toEqual({
      type: 'BinaryExpression',
      operator: '×',
      left: {type: 'Number', text: '220'},
      right: {type: 'Hertz', prefix: '', hard: false},
    });
  });

  it('parses parenthesized scalar multiplication', () => {
    const ast = parse('(1 + 2) Hz');
    expect(ast).toEqual({
      type: 'BinaryExpression',
      operator: '×',
      left: {
        type: 'BinaryExpression',
        operator: '+',
        left: {type: 'Number', text: '1'},
        right: {type: 'Number', text: '2'},
      },
      right: {type: 'Hertz', prefix: '', hard: false},
    });
  });

  it('parses negated parenthesized scalar multiplication', () => {
    const ast = parse('-(3*5+7^11)c');
    expect(ast.type).toBe('UnaryExpression');
  });

  it('parses absolute FJS', () => {
    const ast = parse('Bb4^7');
    expect(ast).toEqual({
      type: 'AbsoluteFJS',
      nominal: 'B',
      accidentals: ['b'],
      octave: '4',
      superscripts: ['7'],
      subscripts: [],
    });
  });

  it('thinks A4 is an augmented fourth', () => {
    const ast = parse('A4');
    expect(ast.type).toBe('FJS');
  });

  it('thinks a4 is an absolute pitch', () => {
    const ast = parse('a4');
    expect(ast.type).toBe('AbsoluteFJS');
  });

  it('thinks A=4 is an absolute pitch', () => {
    const ast = parse('A=4');
    expect(ast.type).toBe('AbsoluteFJS');
  });

  it('parses compound absolute pythagorean accidentals', () => {
    const ast = parse('Esb4');
    expect(ast).toEqual({
      type: 'AbsoluteFJS',
      nominal: 'E',
      accidentals: ['sb'],
      octave: '4',
      superscripts: [],
      subscripts: [],
    });
  });

  it('parses pitch assignment', () => {
    const ast = parse('A4 = 440Hz');
    expect(ast).toEqual({
      type: 'PitchAssignment',
      pitch: {
        type: 'AbsoluteFJS',
        nominal: 'A',
        accidentals: [],
        octave: '4',
        superscripts: [],
        subscripts: [],
      },
      value: {
        type: 'BinaryExpression',
        operator: '×',
        left: {type: 'Number', text: '440'},
        right: {type: 'Hertz', prefix: '', hard: false},
      },
    });
  });
});
