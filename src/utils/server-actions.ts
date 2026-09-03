import type { AstNode, FunctionNode, ServerAction } from '../types';
import {
    asNode,
    directives,
    identifierName,
    functionName,
    isFunction,
    isNode,
    isType,
    unwrapExpression,
    walk,
} from './ast';

export interface SourceCodeLike {
    ast: unknown;
}

export interface ExportedFunction {
    node: FunctionNode;
    name: string | null;
}

const USE_SERVER = 'use server';

function hasUseServer(body: unknown): boolean {
    return directives(body).includes(USE_SERVER);
}

export function isUseServerFile(ast: AstNode): boolean {
    return hasUseServer(ast.body);
}

export function isInlineServerAction(node: AstNode): boolean {
    return isFunction(node) && hasUseServer((node.body as AstNode | undefined)?.body);
}

function actionFunction(expression: unknown): FunctionNode | null {
    const node = unwrapExpression(isNode(expression) ? expression : null);
    if (node === null) return null;
    if (isFunction(node)) return node;

    if (node.type === 'CallExpression') {
        for (const argument of node.arguments as AstNode[]) {
            const fn = actionFunction(argument);
            if (fn !== null) return fn;
        }
    }
    return null;
}

function localBinding(ast: AstNode, name: string): FunctionNode | null {
    for (const statement of ast.body as AstNode[]) {
        if (isType(statement, 'FunctionDeclaration') && identifierName(statement.id) === name)
            return statement;

        if (!isType(statement, 'VariableDeclaration')) continue;

        for (const declarator of statement.declarations as AstNode[]) {
            if (identifierName(declarator.id) !== name) continue;

            const fn = actionFunction(declarator.init);
            if (fn !== null) return fn;
        }
    }
    return null;
}

function fromDeclaration(declaration: unknown, out: ExportedFunction[]): void {
    if (isType(declaration, 'FunctionDeclaration')) {
        out.push({ node: declaration, name: identifierName(declaration.id) });
        return;
    }
    if (!isType(declaration, 'VariableDeclaration')) return;

    for (const declarator of declaration.declarations as AstNode[]) {
        const fn = actionFunction(declarator.init);
        if (fn !== null) out.push({ node: fn, name: identifierName(declarator.id) });
    }
}

export function collectExportedFunctions(ast: AstNode): ExportedFunction[] {
    const out: ExportedFunction[] = [];

    for (const statement of ast.body as AstNode[]) {
        if (isType(statement, 'ExportDefaultDeclaration')) {
            const fn = actionFunction(statement.declaration);
            if (fn !== null) out.push({ node: fn, name: 'default' });
            continue;
        }
        if (!isType(statement, 'ExportNamedDeclaration')) continue;

        if (isNode(statement.declaration)) {
            fromDeclaration(statement.declaration, out);
            continue;
        }

        if (statement.source !== null && statement.source !== undefined) continue;

        for (const specifier of statement.specifiers as AstNode[]) {
            const local = identifierName(specifier.local);
            if (local === null) continue;

            const fn = localBinding(ast, local);
            if (fn !== null)
                out.push({ node: fn, name: identifierName(specifier.exported) ?? local });
        }
    }
    return out;
}

function enclosingCalls(node: AstNode, parents: Map<AstNode, AstNode | null>): AstNode[] {
    const calls: AstNode[] = [];
    let child = node;
    let parent = parents.get(node) ?? null;

    while (parent !== null) {
        if (parent.type === 'CallExpression') {
            if (!((parent.arguments as AstNode[]) ?? []).includes(child)) break;
            calls.push(parent);
        } else if (!parent.type.startsWith('TS')) {
            break;
        }
        child = parent;
        parent = parents.get(parent) ?? null;
    }
    return calls;
}

/**
 * Every Server Action in a file: the exports of a `'use server'` module and the inline actions a
 * Server Component hands to the client. Both are public HTTP endpoints.
 */
export function collectServerActions(sourceCode: SourceCodeLike): ServerAction[] {
    const ast = asNode(sourceCode.ast);
    const parents = new Map<AstNode, AstNode | null>();
    const inline: AstNode[] = [];
    const propNames = new Set<string>();
    const propNodes = new Set<AstNode>();

    walk(ast, (node, parent) => {
        parents.set(node, parent);
        if (isInlineServerAction(node)) inline.push(node);

        if (node.type !== 'JSXExpressionContainer' || parent?.type !== 'JSXAttribute') return;

        walk(node, inner => {
            if (inner.type === 'Identifier') propNames.add(inner.name as string);
            if (isFunction(inner)) propNodes.add(inner);
        });
    });

    const actions = new Map<AstNode, ServerAction>();
    const add = (node: FunctionNode, name: string | null, kind: 'file' | 'inline'): void => {
        if (actions.has(node)) return;

        const resolved = name ?? functionName(node, parents.get(node) ?? null);
        actions.set(node, {
            node,
            name: resolved,
            kind,
            exported: kind === 'file',
            passedAsProp:
                propNodes.has(node) || (resolved !== null && propNames.has(resolved)) || false,
            wrapperCalls: enclosingCalls(node, parents),
        });
    };

    if (isUseServerFile(ast))
        for (const { node, name } of collectExportedFunctions(ast)) add(node, name, 'file');

    for (const node of inline) add(node, null, 'inline');

    return [...actions.values()];
}
