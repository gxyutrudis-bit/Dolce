const NUMBER_PATTERN = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i;
const EXPRESSION_NUMBER_PATTERN = /^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?/i;
const MAX_EXPRESSION_LENGTH = 256;
const MAX_EXPRESSION_TOKENS = 128;
const MAX_NESTING_DEPTH = 32;

function parseAmount(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string' || !NUMBER_PATTERN.test(value.trim())) return null;
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : null;
}

function multiplyAmounts(first, second) {
  const amountOne = parseAmount(first);
  const amountTwo = parseAmount(second);
  if (amountOne === null || amountTwo === null) return null;

  const product = amountOne * amountTwo;
  if (!Number.isFinite(product)) return null;
  return { amountOne, amountTwo, product };
}

function calculateExpression(expression) {
  if (typeof expression !== 'string' || expression.length > MAX_EXPRESSION_LENGTH) return null;

  const tokens = [];
  let index = 0;
  while (index < expression.length) {
    const character = expression[index];
    if (/\s/.test(character)) {
      index += 1;
      continue;
    }
    if ('+-*()'.includes(character)) {
      tokens.push(character);
      index += 1;
    } else {
      const match = EXPRESSION_NUMBER_PATTERN.exec(expression.slice(index));
      if (!match) return null;
      const value = Number(match[0]);
      if (!Number.isFinite(value)) return null;
      tokens.push(value);
      index += match[0].length;
    }
    if (tokens.length > MAX_EXPRESSION_TOKENS) return null;
  }
  if (!tokens.length) return null;

  let cursor = 0;
  let nestingDepth = 0;

  function parsePrimary() {
    if (tokens[cursor] === '(') {
      nestingDepth += 1;
      if (nestingDepth > MAX_NESTING_DEPTH) return null;
      cursor += 1;
      const value = parseExpression();
      nestingDepth -= 1;
      if (value === null || tokens[cursor] !== ')') return null;
      cursor += 1;
      return value;
    }
    const value = tokens[cursor];
    if (typeof value !== 'number') return null;
    cursor += 1;
    return value;
  }

  function parseUnary() {
    if (tokens[cursor] === '+') {
      cursor += 1;
      return parseUnary();
    }
    if (tokens[cursor] === '-') {
      cursor += 1;
      const value = parseUnary();
      return value === null ? null : -value;
    }
    return parsePrimary();
  }

  function parseTerm() {
    let value = parseUnary();
    if (value === null) return null;
    while (tokens[cursor] === '*') {
      cursor += 1;
      const right = parseUnary();
      if (right === null) return null;
      value *= right;
      if (!Number.isFinite(value)) return null;
    }
    return value;
  }

  function parseExpression() {
    let value = parseTerm();
    if (value === null) return null;
    while (tokens[cursor] === '+' || tokens[cursor] === '-') {
      const operator = tokens[cursor];
      cursor += 1;
      const right = parseTerm();
      if (right === null) return null;
      value = operator === '+' ? value + right : value - right;
      if (!Number.isFinite(value)) return null;
    }
    return value;
  }

  const result = parseExpression();
  if (result === null || cursor !== tokens.length) return null;
  return { expression: expression.trim(), result };
}

module.exports = { multiplyAmounts, calculateExpression };
