import type { AstNode } from '../types';
import { createRule, pointAt } from '../utils/createRule';
import { collectExportedFunctions, isUseServerFile } from '../utils/server-actions';

export default createRule({
    name: 'no-sync-server-action-export',
    description: 'Require every export of a `use server` module to be async',
    type: 'suggestion',
    messages: {
        syncExport:
            'Export {{name}} of a "use server" module is not async — Next.js only accepts async functions as Server Actions.',
    },
    create(context) {
        return {
            'Program:exit'(program: unknown) {
                const ast = program as AstNode;
                if (!isUseServerFile(ast)) return;

                for (const { node, name } of collectExportedFunctions(ast)) {
                    if (node.async === true) continue;

                    context.report({
                        loc: pointAt(node),
                        messageId: 'syncExport',
                        data: { name: name === null ? '(anonymous)' : `"${name}"` },
                    });
                }
            },
        };
    },
});
