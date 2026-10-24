// A deliberately small arithmetic specimen for the website, not a research compiler.
export type Operator = '+' | '-' | '*' | '/';
export type Expression =
  | { kind: 'number'; value: number }
  | { kind: 'name'; name: string }
  | { kind: 'unary'; operator: '+' | '-'; operand: Expression }
  | { kind: 'binary'; operator: Operator; left: Expression; right: Expression };
export type Token = { kind: 'number' | 'name' | 'symbol'; text: string; start: number };

export class ExpressionError extends Error {
  position: number;
  constructor(message: string, position: number) {
    super(message);
    this.name = 'ExpressionError';
    this.position = position;
  }
}

export function tokenize(source: string): Token[] {
  if (source.length > 80) throw new ExpressionError('Keep this small study to 80 characters.', 80);
  const tokens: Token[] = [];
  let cursor = 0;
  while (cursor < source.length) {
    if (/\s/.test(source[cursor])) { cursor++; continue; }
    const start = cursor;
    const tail = source.slice(cursor);
    const number = /^(?:\d+(?:\.\d*)?|\.\d+)/.exec(tail);
    const name = /^[A-Za-z_][A-Za-z_0-9]*/.exec(tail);
    if (number) {
      if (!Number.isFinite(Number(number[0]))) throw new ExpressionError('Use a finite number.', start);
      tokens.push({ kind: 'number', text: number[0], start });
      cursor += number[0].length;
    } else if (name) {
      if (name[0].length > 8) throw new ExpressionError('Use variable names of up to 8 characters.', start);
      tokens.push({ kind: 'name', text: name[0], start });
      cursor += name[0].length;
    } else if ('+-*/()'.includes(source[cursor])) {
      tokens.push({ kind: 'symbol', text: source[cursor++], start });
    } else throw new ExpressionError(`Unexpected character “${source[cursor]}”. Try numbers, names, + − * / and parentheses.`, start);
    if (tokens.length > 23) throw new ExpressionError('Try a shorter expression: this specimen supports up to 23 tokens.', start);
  }
  if (!tokens.length) throw new ExpressionError('Write an expression to begin.', 0);
  return tokens;
}

export function parse(tokens: Token[], sourceLength: number): Expression {
  let cursor = 0;
  const precedence: Record<string, number> = { '+': 1, '-': 1, '*': 2, '/': 2 };
  function primary(): Expression {
    const token = tokens[cursor++];
    if (!token) throw new ExpressionError('Expected a number, a variable, or a parenthesized expression.', sourceLength);
    if (token.kind === 'number') return { kind: 'number', value: Number(token.text) };
    if (token.kind === 'name') return { kind: 'name', name: token.text };
    if (token.text === '+' || token.text === '-') return { kind: 'unary', operator: token.text, operand: primary() };
    if (token.text === '(') {
      const value = binary(0);
      if (tokens[cursor]?.text !== ')') throw new ExpressionError('This opening parenthesis needs a closing one.', token.start);
      cursor++;
      return value;
    }
    throw new ExpressionError('Expected a number, a variable, or an opening parenthesis.', token.start);
  }
  function binary(minimum: number): Expression {
    let left = primary();
    while (cursor < tokens.length && (precedence[tokens[cursor].text] ?? -1) >= minimum) {
      const operator = tokens[cursor++].text as Operator;
      const right = binary(precedence[operator] + 1);
      left = { kind: 'binary', operator, left, right };
    }
    return left;
  }
  const tree = binary(0);
  if (cursor < tokens.length) throw new ExpressionError('Expected an operator between expressions.', tokens[cursor].start);
  const depth = (node: Expression): number => node.kind === 'binary' ? 1 + Math.max(depth(node.left), depth(node.right)) : node.kind === 'unary' ? 1 + depth(node.operand) : 0;
  if (depth(tree) > 6) throw new ExpressionError('Try a shallower expression: this drawing supports six levels.', 0);
  return tree;
}

export function foldConstants(node: Expression): Expression {
  if (node.kind === 'unary') {
    const operand = foldConstants(node.operand);
    return operand.kind === 'number' ? { kind: 'number', value: node.operator === '-' ? -operand.value : operand.value } : { ...node, operand };
  }
  if (node.kind !== 'binary') return node;
  const left = foldConstants(node.left), right = foldConstants(node.right);
  if (left.kind === 'number' && right.kind === 'number') {
    // Preserve undefined/non-finite operations instead of inventing a constant.
    if (node.operator === '/' && right.value === 0) return { ...node, left, right };
    const value = node.operator === '+' ? left.value + right.value : node.operator === '-' ? left.value - right.value : node.operator === '*' ? left.value * right.value : left.value / right.value;
    if (Number.isFinite(value)) return { kind: 'number', value };
  }
  return { ...node, left, right };
}

export function formatExpression(node: Expression): string {
  if (node.kind === 'number') return String(Object.is(node.value, -0) ? 0 : node.value);
  if (node.kind === 'name') return node.name;
  if (node.kind === 'unary') return `(${node.operator}${formatExpression(node.operand)})`;
  return `(${formatExpression(node.left)} ${node.operator} ${formatExpression(node.right)})`;
}

export function countNodes(node: Expression): number {
  return node.kind === 'binary' ? 1 + countNodes(node.left) + countNodes(node.right) : node.kind === 'unary' ? 1 + countNodes(node.operand) : 1;
}

export function layoutTree(tree: Expression, canvasWidth = 700) {
  const leaves = (node: Expression): number => node.kind === 'binary' ? leaves(node.left) + leaves(node.right) : node.kind === 'unary' ? leaves(node.operand) : 1;
  const count = leaves(tree);
  const depthOf = (node: Expression): number => node.kind === 'binary' ? 1 + Math.max(depthOf(node.left),depthOf(node.right)) : node.kind === 'unary' ? 1 + depthOf(node.operand) : 0;
  const verticalStep = canvasWidth < 600 ? Math.min(70,290 / Math.max(1,depthOf(tree))) : 48;
  const nodes: { id: number; x: number; y: number; label: string; operator: boolean }[] = [];
  const edges: { x1: number; y1: number; x2: number; y2: number }[] = [];
  let leaf = 0;
  function place(node: Expression, depth: number): { x: number; y: number } {
    const children = node.kind === 'binary' ? [place(node.left, depth + 1), place(node.right, depth + 1)] : node.kind === 'unary' ? [place(node.operand, depth + 1)] : [];
    const x = children.length ? children.reduce((sum, child) => sum + child.x, 0) / children.length : count === 1 ? canvasWidth / 2 : 60 + (leaf++ / (count - 1)) * (canvasWidth - 120);
    const y = 40 + depth * verticalStep;
    const label = node.kind === 'number' ? formatExpression(node) : node.kind === 'name' ? node.name : node.operator === '*' ? '×' : node.operator === '/' ? '÷' : node.operator === '-' ? '−' : '+';
    nodes.push({ id: nodes.length, x, y, label, operator: children.length > 0 });
    children.forEach(child => edges.push({ x1: x, y1: y, x2: child.x, y2: child.y }));
    return { x, y };
  }
  place(tree, 0);
  const bottom = Math.max(...nodes.map(n => n.y));
  // Vertically center a short tree within the drawing; deeper trees keep the full height.
  const offset = Math.max(0, (330 - bottom) / 2 - 12);
  nodes.forEach(n => n.y += offset);
  edges.forEach(e => { e.y1 += offset; e.y2 += offset; });
  return { nodes, edges };
}

export function analyzeExpression(source: string) {
  const tokens = tokenize(source);
  const tree = parse(tokens, source.length);
  const folded = foldConstants(tree);
  return { tokens, tree, folded, before: countNodes(tree), after: countNodes(folded) };
}
