import type { AstNode } from '../types';
import { containsNode, identifierName, isNode } from './ast';

export function asVariables(value: unknown): Variable[] {
    return value as Variable[];
}

export interface Reference {
    identifier: AstNode;
    isRead(): boolean;
}

export interface Variable {
    name: string;
    references: Reference[];
    defs?: { name: AstNode }[];
}

export interface Scope {
    variables: Variable[];
    upper: Scope | null;
}

export interface TaintQuery {
    roots: Variable[];
    isSink(call: AstNode): boolean;
    declaredVariables(node: AstNode): Variable[];
    getScope(node: AstNode): Scope;
    isTransparentCall?(call: AstNode): boolean;
    within: AstNode;
}

export interface TaintFlow {
    sink: AstNode;
    argument: AstNode;
    source: string;
}

const TRANSPARENT = new Set([
    'AwaitExpression',
    'TemplateLiteral',
    'SpreadElement',
    'ArrayExpression',
    'ObjectExpression',
    'SequenceExpression',
    'ChainExpression',
    'TSAsExpression',
    'TSSatisfiesExpression',
    'TSNonNullExpression',
    'TSTypeAssertion',
]);

function resolveVariable(scope: Scope | null, name: string): Variable | null {
    let current = scope;

    while (current !== null) {
        const found = current.variables.find(variable => variable.name === name);
        if (found) return found;
        current = current.upper;
    }
    return null;
}

export function traceTaint(query: TaintQuery): TaintFlow[] {
    const { roots, isSink, isTransparentCall, declaredVariables, getScope, within } = query;
    const queue = [...roots];
    const seen = new Set<Variable>(roots);
    const flows: TaintFlow[] = [];
    const reported = new Set<AstNode>();

    const enqueue = (variable: Variable | null): void => {
        if (variable === null || seen.has(variable)) return;
        seen.add(variable);
        queue.push(variable);
    };

    const record = (sink: AstNode, argument: AstNode, source: string): void => {
        if (reported.has(argument)) return;
        reported.add(argument);
        flows.push({ sink, argument, source });
    };

    while (queue.length > 0) {
        const variable = queue.shift();
        if (!variable) break;

        for (const reference of variable.references) {
            if (!reference.isRead()) continue;

            const identifier = reference.identifier;

            if (!containsNode(within, identifier)) continue;

            let current: AstNode = identifier;
            let parent = isNode(current.parent) ? current.parent : null;

            while (parent !== null) {
                if (TRANSPARENT.has(parent.type)) {
                    // fall through to the step below
                } else if (parent.type === 'Property') {
                    if (parent.value !== current) break;
                } else if (parent.type === 'ConditionalExpression') {
                    if (parent.test === current) break;
                } else if (parent.type === 'LogicalExpression') {
                    if (parent.left !== current && parent.right !== current) break;
                } else if (parent.type === 'MemberExpression') {
                    if (parent.object !== current) break;
                } else if (parent.type === 'CallExpression') {
                    if (parent.callee !== current) {
                        if (isSink(parent)) {
                            record(parent, current, variable.name);
                            break;
                        }
                        if (isTransparentCall?.(parent) !== true) break;
                    }
                } else if (parent.type === 'VariableDeclarator') {
                    for (const declared of declaredVariables(parent)) enqueue(declared);
                    break;
                } else if (parent.type === 'AssignmentExpression') {
                    const target = parent.left as AstNode;
                    enqueue(resolveVariable(getScope(target), identifierName(target) ?? ''));
                    break;
                } else {
                    break;
                }

                current = parent;
                parent = isNode(current.parent) ? current.parent : null;
            }
        }
    }
    return flows;
}
