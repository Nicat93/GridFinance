/** Evaluate the calculator's numeric arithmetic grammar without executing code. */
export function evaluateArithmetic(expression: string): number {
  if (typeof expression !== 'string' || expression.length > 256) throw new Error('Invalid expression');
  const tokens: string[] = [];
  let i = 0;
  while (i < expression.length) {
    const ch = expression[i];
    if (/\s/.test(ch)) { i++; continue; }
    if ('+-*/()'.includes(ch)) { tokens.push(ch); i++; continue; }
    if (/[0-9.]/.test(ch)) {
      const start = i++;
      while (i < expression.length && /[0-9.]/.test(expression[i])) i++;
      const number = expression.slice(start, i);
      if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(number) || !Number.isFinite(Number(number))) throw new Error('Invalid number');
      tokens.push(number);
      continue;
    }
    throw new Error('Invalid character');
  }

  let cursor = 0;
  const primary = (): number => {
    const token = tokens[cursor++];
    if (token === '+') return primary();
    if (token === '-') return -primary();
    if (token === '(') {
      const value = sum();
      if (tokens[cursor++] !== ')') throw new Error('Missing closing parenthesis');
      return value;
    }
    if (!token || !/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(token)) throw new Error('Expected a number');
    return Number(token);
  };
  const product = (): number => {
    let value = primary();
    while (tokens[cursor] === '*' || tokens[cursor] === '/') {
      const op = tokens[cursor++];
      const rhs = primary();
      if (op === '/' && rhs === 0) throw new Error('Division by zero');
      value = op === '*' ? value * rhs : value / rhs;
      if (!Number.isFinite(value)) throw new Error('Result is not finite');
    }
    return value;
  };
  const sum = (): number => {
    let value = product();
    while (tokens[cursor] === '+' || tokens[cursor] === '-') {
      const op = tokens[cursor++];
      const rhs = product();
      value = op === '+' ? value + rhs : value - rhs;
      if (!Number.isFinite(value)) throw new Error('Result is not finite');
    }
    return value;
  };
  if (!tokens.length) throw new Error('Empty expression');
  const result = sum();
  if (cursor !== tokens.length) throw new Error('Unexpected token');
  return result;
}
