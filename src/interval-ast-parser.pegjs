{{
  function VariableDeclaration(id, value, quoted) {
    return {
      type: 'VariableDeclaration',
      name: id,
      value,
      quoted
    }
  }

  function VariableAccess(id, quoted) {
    return {
      type: 'VariableAccess',
      name: id,
      quoted
    }
  }

  function MapDeclaration(value) {
    return {
      type: 'MapDeclaration',
      value
    }
  }

  function PitchAssignment(pitch, value) {
    return {
      type: 'PitchAssignment',
      pitch,
      value
    }
  }

  const functionList = ['frequency', 'ratio', 'pitch', 'mtof', 'ftom', 'nmtof', 'sqrt', 'cbrt'];

  function FunctionExpression(id, value) {
    if (functionList.includes(id)) {
      return {
        type: 'Function',
        name: id,
        value
      }
    }
  }

  function BinaryExpression(operator, left, right) {
    return {
      type: 'BinaryExpression',
      operator,
      left,
      right
    }
  }

  function UnaryExpression(operator, operand) {
    return {
      type: 'UnaryExpression',
      operator,
      operand
    }
  }

  function NumericLiteral(text) {
    return {
      type: 'Number',
      text
    }
  }

  function EdjiFraction(denominator, equave) {
    return {
      type: 'EdjiFraction',
      denominator,
      equave
    }
  }

  function Monzo(components) {
    return {
      type: 'Monzo',
      components
    }
  }

  function Val(components) {
    return {
      type: 'Val',
      components
    }
  }

  function Warts(equave, edo, warts, subgroup) {
    return {
      type: 'Warts',
      equave,
      edo,
      warts,
      subgroup
    }
  }

  function Hertz(prefix, hard) {
    return {
      type: 'Hertz',
      prefix: prefix ?? '',
      hard: !!hard
    }
  }

  function Second(prefix, hard) {
    return {
      type: 'Second',
      prefix: prefix ?? '',
      hard: !!hard
    }
  }

  function Cent(hard) {
    return {
      type: 'Cent',
      hard: !!hard
    }
  }

  function InverseCent(hard) {
    return {
      type: 'InverseCent',
      hard: !!hard
    }
  }

  function HardDecimal(amount) {
    return {
      type: 'HardDecimal',
      amount
    }
  }

  function Pythagorean(quality, degree) {
    return  {
      type: 'Pythagorean',
      quality,
      degree
    }
  }

  function FJS(pythagorean, superscripts, subscripts) {
    return {
      type: 'FJS',
      quality: pythagorean.quality,
      degree: pythagorean.degree,
      superscripts: superscripts ?? [],
      subscripts: subscripts ?? []
    }
  }

  function AbsolutePitch(nominal, accidentals, octave) {
    return {
      type: 'AbsolutePitch',
      nominal,
      accidentals,
      octave
    }
  }

  function AbsoluteFJS(pitch, superscripts, subscripts) {
    return {
      type: 'AbsoluteFJS',
      nominal: pitch.nominal,
      accidentals: pitch.accidentals,
      octave: pitch.octave,
      superscripts: superscripts ?? [],
      subscripts: subscripts ?? []
    }
  }

  function operatorReducer (result, element) {
    const left = result;
    const right = element[3];
    const op = element[1];

    return BinaryExpression(op, left, right);
  }
}}

Start
  = DollarVariableDeclaration
  / QuotedVariableDeclaration
  / PitchAssignment
  / MapDeclaration
  / Expression

SourceCharacter
  = .

WhiteSpace "whitespace"
  = "\t"
  / "\v"
  / "\f"
  / " "
  / "\u00A0"
  / "\uFEFF"
  / Zs
  / LineTerminator

// Separator, Space
Zs = [\u0020\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]

LineTerminator
  = [\n\r\u2028\u2029]

SingleLineComment
  = "//" (!LineTerminator SourceCharacter)*

_ 'separator'
  = (WhiteSpace / SingleLineComment)*

EOS
  = SingleLineComment?

// TODO: Expand and make sure that there aren't any non-glyphs here.
VariableID
  = $(![#0-9] [!#$&0-9@A-Z_¡-ÖØ-öø-˫]i+)

DollarVariableDeclaration
  = _ '$' id: VariableID _ '=' value: Expression { return VariableDeclaration(id, value, false) }

QuotedVariableDeclaration
  = _ '"' id: $(!'"' .)* '"' _ '=' value: Expression { return VariableDeclaration(id, value, true)}

MapDeclaration
  = _ '=' value: Expression { return MapDeclaration(value) }

PitchAssignment
  = _ pitch: AbsoluteFJS _ '=' value: Expression { return PitchAssignment(pitch, value) }

Expression
  = head:Term tail:(_ ('+' / '-') _ Term)* EOS {
      return tail.reduce(operatorReducer, head);
    }

Term
  = head:Factor tail:(_ ('*' / '%' / '×' / '÷' / 'mod' / 'reduce' / 'log') _ Factor)* {
      return tail.reduce(operatorReducer, head);
    }

Factor
  = head:Group tail:(_ ('^') _ Factor)* {
      return tail.reduce(operatorReducer, head);
    }

Group
  = _ @(UnaryExpression / Primary) _

ScalarMultiple
  = scalar: ScalarLike _ quantity: Quantity { return BinaryExpression('×', scalar, quantity) }

ScalarLike
  = ParenthesizedExpression
  / HardDecimal
  / Number

Quantity
  = Warts
  / Function
  / FJS
  / AbsoluteFJS
  / Monzo
  / Val
  / EdjiFraction
  / Hertz
  / Second
  / Cent
  / InverseCent
  / DollarVariableAccess
  / QuotedVariableAccess

Primary = Quantity / ScalarMultiple / ScalarLike

UnaryExpression
  = operator: ('+' / '-' / '%' / '÷') operand: Primary { return UnaryExpression(operator, operand) }

PlainDigits
  = $[0-9]+

DecimalDigits
  = $([0-9]* '.' [0-9]*)

FractionDigits
  = $([0-9]* '/' [0-9]*)

SignedNumber
  = $([+-]? (DecimalDigits / FractionDigits / PlainDigits))

ScientificExponent
  = 'e'i [+-]? PlainDigits

Number
  = (DecimalDigits / FractionDigits / PlainDigits) ScientificExponent? { return NumericLiteral(text()) }

EdjiFraction
  = '\\' denominator:SignedNumber? equave:EquaveExpression? { return EdjiFraction(denominator, equave) }

EquaveExpression
  = '<' _ @Expression _ '>'

Monzo
  = '[' numbers:(_ @SignedNumber _ ','? _)* '>' { return Monzo(numbers) }

Val
  = '<' numbers:(_ @SignedNumber _ ','? _)* ']' { return Val(numbers) }

Warts
  = equave: $[a-z]? edo: $[0-9]+ warts: [a-z]* '@' subgroup: $[0-9/.]* { return Warts(equave, edo, warts, subgroup) }

MetricPrefix
  = $('Q' / 'R' / 'Y' / 'Z' / 'E' / 'P' / 'T' / 'G' / 'M' / 'k' / 'h' / 'da' / 'd' / 'c' / 'm' / 'µ' / 'n' / 'p' / 'f' / 'a' / 'z' / 'y' / 'r' / 'q')

Hertz
  = prefix: MetricPrefix? 'Hz' hard: '!'? { return Hertz(prefix, hard) }

Second
  = prefix: MetricPrefix? 's' hard: '!'? { return Second(prefix, hard) }

Cent
  = ('c' / '¢') hard: '!'? { return Cent(hard) }

InverseCent
  = '€' hard: '!'? { return InverseCent(hard) }

HardDecimal
  = amount: Number '!' { return HardDecimal(amount.text) }

Demisemi
  = $('¼' / 'q' / '½' / 's' / '¾' / 'Q')

Demisemipythagorean
  = quality: $($(Demisemi? 'd'+) / 'm' / 'sm' / '½m' / 'n' / 'P' / '½M' / 'sM' / 'M' / $(Demisemi? 'A'+)) degree: $('-'? [1-9] [0-9]*) { return Pythagorean(quality, degree) }

Semiquartal
  = quality: $($(Demisemi? 'd'+) / 'm' / 'n' / 'M' / $(Demisemi? 'A'+)) degree: $('-'? [1-9] [0-9]* $('½' / '.5')) { return Pythagorean(quality, degree) }

CommaSeparatedDigits
  = elements: (@PlainDigits @(',' @PlainDigits)*) { return elements.slice(0, 1).concat(elements[1]) }

FJS
  = pythagorean: (Semiquartal / Demisemipythagorean)
    superscripts: ('^' @CommaSeparatedDigits)?
    subscripts: ('_' @CommaSeparatedDigits)?
  { return FJS(pythagorean, superscripts, subscripts) }

Accidental
  = $([𝄪x♯#𝄲‡t♮=𝄳d♭b𝄫] / $(Demisemi [♯#♭b]) )

AbsolutePitch
  = nominal: [aA-G] accidentals: Accidental* octave: SignedNumber { return AbsolutePitch(nominal, accidentals, octave) }

AbsoluteFJS
  = pitch: AbsolutePitch
    superscripts: ('^' @CommaSeparatedDigits)?
    subscripts: ('_' @CommaSeparatedDigits)?
  { return AbsoluteFJS(pitch, superscripts, subscripts) }

ID
  = $[a-z]+

Function
  = id:ID expr:ParenthesizedExpression { return FunctionExpression(id, expr) }

DollarVariableAccess
  = '$' id:(@VariableID / $('-'? [0-9]+) / $'#'+ / '') { return VariableAccess(id, false) }

QuotedVariableAccess
  = '"' id:$(!'"' .)* '"' { return VariableAccess(id, true) }

ParenthesizedExpression
  = '(' _ @Expression _ ')'
