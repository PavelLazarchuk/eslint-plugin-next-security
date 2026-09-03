import type { AstNode, ServerAction } from '../types';
import { calleePath, collectCalls, startOf } from '../utils/ast';
import { createRule, docsUrl, pointAt } from '../utils/createRule';
import { collectImports, matchesCallee, parseNames, type ImportBinding } from '../utils/names';
import { collectServerActions, parameterNames } from '../utils/server-actions';
import { stringArray } from '../utils/settings';

const IGNORED_ROOTS = new Set(['console']);

function significantCalls(
    action: ServerAction,
    calls: AstNode[],
    ignore: (call: AstNode) => boolean
): AstNode[] {
    const parameters = parameterNames(action.node);

    return calls.filter(call => {
        const root = calleePath(call.callee as AstNode)[0];
        if (root !== undefined && (parameters.has(root) || IGNORED_ROOTS.has(root))) return false;
        return !ignore(call);
    });
}

export default createRule({
    name: 'require-auth-guard',
    description: 'Require an authorization guard in every Server Action',
    settings: ['guards', 'wrappers'],
    schemaProperties: { requireGuardFirst: { type: 'boolean' }, ignoreNames: stringArray },
    defaultOptions: { requireGuardFirst: false, ignoreNames: [] },
    messages: {
        missingGuard:
            'Server Action {{name}} is a public HTTP endpoint with no authorization guard — call {{expected}} inside it, or wrap it in a configured wrapper.',
        lateGuard:
            'The authorization guard in Server Action {{name}} runs after other work — move it above the first call.',
        guardsNotConfigured: `next-security/require-auth-guard is inactive: this file declares Server Actions but no guards are configured. Set settings['next-security'].guards to the functions that authorize a request — ${docsUrl(
            'require-auth-guard'
        )}`,
    },
    create(context, config) {
        const guards = parseNames(config.guards as string[]);
        const wrappers = parseNames(config.wrappers as string[]);
        const ignoreNames = new Set(config.ignoreNames as string[]);
        const requireGuardFirst = config.requireGuardFirst === true;
        const expected = [...(config.guards as string[]), ...(config.wrappers as string[])].join(
            ', '
        );

        const displayName = (action: ServerAction): string =>
            action.name === null ? `(${action.kind})` : `"${action.name}"`;

        const isWrapped = (action: ServerAction, imports: Map<string, ImportBinding>): boolean =>
            action.wrapperCalls.some(call =>
                matchesCallee(call.callee as AstNode, imports, wrappers)
            );

        return {
            'Program:exit'(program: unknown) {
                const ast = program as AstNode;
                const actions = collectServerActions(context.sourceCode);
                if (actions.length === 0) return;

                if (guards.length === 0 && wrappers.length === 0) {
                    context.report({ loc: pointAt(ast), messageId: 'guardsNotConfigured' });
                    return;
                }
                const imports = collectImports(ast);
                const isGuard = (call: AstNode): boolean =>
                    matchesCallee(call.callee as AstNode, imports, guards);

                for (const action of actions) {
                    if (isWrapped(action, imports)) continue;
                    if (action.name !== null && ignoreNames.has(action.name)) continue;

                    const calls = collectCalls(action.node);
                    const guardCall = calls.find(isGuard) ?? null;

                    if (guardCall === null) {
                        context.report({
                            loc: pointAt(action.node),
                            messageId: 'missingGuard',
                            data: { name: displayName(action), expected },
                        });
                        continue;
                    }
                    if (!requireGuardFirst) continue;

                    const first = significantCalls(action, calls, isGuard)[0];
                    if (first !== undefined && startOf(first) < startOf(guardCall))
                        context.report({
                            loc: pointAt(guardCall),
                            messageId: 'lateGuard',
                            data: { name: displayName(action) },
                        });
                }
            },
        };
    },
});
