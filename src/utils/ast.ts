import type { AstNode } from '../types';

const SKIP_KEYS = new Set(['parent', 'loc', 'range', 'start', 'end']);

/** ESLint's published AST types are narrower than the structural nodes this plugin walks. */
export function asNode(value: unknown): AstNode {
    return value as AstNode;
}

export function isNode(value: unknown): value is AstNode {
    return (
        typeof value === 'object' && value !== null && typeof (value as AstNode).type === 'string'
    );
}

export interface TypedNode<K extends string = string> extends AstNode {
    type: K;
}

export function isType<K extends string>(value: unknown, type: K): value is TypedNode<K> {
    return isNode(value) && value.type === type;
}

export function identifierName(value: unknown): string | null {
    return isType(value, 'Identifier') && typeof value.name === 'string' ? value.name : null;
}

const FUNCTION_TYPES = new Set([
    'FunctionDeclaration',
    'FunctionExpression',
    'ArrowFunctionExpression',
]);

export function isFunction(node: unknown): boolean {
    return isNode(node) && FUNCTION_TYPES.has(node.type);
}

export function childNodes(node: AstNode): AstNode[] {
    const children: AstNode[] = [];

    for (const [key, value] of Object.entries(node)) {
        if (SKIP_KEYS.has(key)) continue;

        if (Array.isArray(value)) {
            for (const entry of value) if (isNode(entry)) children.push(entry);
        } else if (isNode(value)) {
            children.push(value);
        }
    }
    return children;
}

export function walk(root: AstNode, visit: (node: AstNode, parent: AstNode | null) => void): void {
    const stack: { node: AstNode; parent: AstNode | null }[] = [{ node: root, parent: null }];

    while (stack.length > 0) {
        const entry = stack.pop() as { node: AstNode; parent: AstNode | null };

        visit(entry.node, entry.parent);
        for (const child of childNodes(entry.node)) stack.push({ node: child, parent: entry.node });
    }
}

const TRANSPARENT_EXPRESSIONS = new Set([
    'ChainExpression',
    'TSAsExpression',
    'TSSatisfiesExpression',
    'TSNonNullExpression',
    'TSTypeAssertion',
    'TSInstantiationExpression',
]);

export function unwrapExpression(node: AstNode | null | undefined): AstNode | null {
    let current: AstNode | null = isNode(node) ? node : null;

    while (current !== null && TRANSPARENT_EXPRESSIONS.has(current.type))
        current = isNode(current.expression) ? current.expression : null;

    return current;
}

export function functionName(node: AstNode, parent: AstNode | null): string | null {
    const own = identifierName(node.id);
    if (own !== null || parent === null) return own;

    if (parent.type === 'VariableDeclarator') return identifierName(parent.id);
    if (parent.type === 'Property') return identifierName(parent.key);
    return null;
}

export function directives(body: unknown): string[] {
    if (!Array.isArray(body)) return [];

    const found: string[] = [];
    for (const statement of body) {
        if (!isType(statement, 'ExpressionStatement')) break;
        if (!isType(statement.expression, 'Literal')) break;

        const { value } = statement.expression;
        if (typeof value !== 'string') break;

        found.push(value);
    }
    return found;
}

/** The dotted path of a callee: `z.string().parse` answers `['z', 'string', 'parse']`. */
export function calleePath(callee: AstNode | null): string[] {
    const current = unwrapExpression(callee);
    if (current === null) return [];

    const own = identifierName(current);
    if (own !== null) return [own];

    if (current.type === 'MemberExpression') {
        const head = calleePath(asNode(current.object));
        if (current.computed === true) return head;

        const name = identifierName(current.property);
        return name === null ? head : [...head, name];
    }
    if (current.type === 'CallExpression') return calleePath(asNode(current.callee));

    return [];
}

/** Every call inside a subtree, in source order. */
export function collectCalls(root: AstNode): AstNode[] {
    const calls: AstNode[] = [];

    walk(root, node => {
        if (node.type === 'CallExpression') calls.push(node);
    });
    return calls.sort((a, b) => startOf(a) - startOf(b));
}

export function startOf(node: AstNode): number {
    return node.range?.[0] ?? 0;
}
