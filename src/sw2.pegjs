{{
  function PlainLiteral(value, location) {
    return {
      type: 'PlainLiteral',
      value,
      location,
    };
  }

  function CentsLiteral(whole, fractional, location) {
    return {
      type: 'CentsLiteral',
      whole,
      fractional,
      location,
    };
  }

  function NumericLiteral(whole, fractional, location) {
    return {
      type: 'NumericLiteral',
      whole,
      fractional,
      location,
    };
  }

  function FractionLiteral(numerator, denominator, location) {
    return  {
      type: 'FractionLiteral',
      numerator,
      denominator,
      location,
    };
  }

  function EdjiFraction(numerator, denominator, equave, location) {
    return {
      type: 'EdjiFraction',
      numerator,
      denominator,
      equave,
      location,
    };
  }

  function Monzo(components, location) {
    return {
      type: 'Monzo',
      components,
      location,
    }
  }

  function BinaryExpression(operator, left, right, location) {
    return {
      type: 'BinaryExpression',
      operator,
      left,
      right,
      location,
    };
  }

  function UnaryExpression(operator, operand, location) {
    return {
      type: 'UnaryExpression',
      operator,
      operand,
      location,
    }
  }

  function operatorReducer (result, element, location) {
    const left = result;
    const [op, right] = element;

    return BinaryExpression(op, left, right, location);
  }
}}

Start
  = Expression

SourceCharacter
  = .

Whitespace "whitespace"
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

_ = Whitespace*

Expression
  = head:Term tail:(_ @('+' / '-') _ @Term)* {
      const loc = location();
      return tail.reduce((result, element) => operatorReducer(result, element, loc), head);
    }

Term
  = _ @(UnaryExpression / Primary) _

Primary
  = DotDecimal
  / CommaDecimal
  / SlashFraction
  / BackslashFraction
  / Monzo
  / PlainNumber

Integer = num:$[0-9]+ { return parseInt(num, 10) }

SignedInteger
  = sign:'-'? value:Integer { return sign ? -value : value }

DotDecimal
  = whole:Integer? '.' fractional:$[0-9]* { return CentsLiteral(whole, fractional, location()) }

CommaDecimal
  = whole:Integer? ',' fractional:$[0-9]* { return NumericLiteral(whole, fractional, location()) }

SlashFraction
  = numerator:Integer '/' denominator:Integer { return FractionLiteral(numerator, denominator, location()) }

PlainNumber
  = value:Integer { return PlainLiteral(value, location()) }

EquaveExpression
  = '<' _ @(SlashFraction / PlainNumber) _ '>'

BackslashFraction
  = numerator:Integer? '\\' denominator:SignedInteger equave:EquaveExpression? {
    return EdjiFraction(numerator, denominator, equave, location());
  }

Component
  = $([+-]? (SlashFraction / PlainNumber))

Monzo
  = '[' components:Component|.., _ ','? _| '>' { return Monzo(components, location()) }

UnaryExpression
  = operator:'-' operand:Primary { return UnaryExpression(operator, operand, location()) }
