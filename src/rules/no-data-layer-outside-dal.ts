import type { AstNode } from '../types';
import { isType } from '../utils/ast';
import { createRule } from '../utils/createRule';
import { matchesModule, matchesPath, normalizeFilename } from '../utils/paths';

function moduleSource(node: AstNode): { value: string; node: AstNode } | null {
    const source = node.source;
    if (!isType(source, 'Literal') || typeof source.value !== 'string') return null;

    return { value: source.value, node: source };
}

export default createRule({
    name: 'no-data-layer-outside-dal',
    description: 'Disallow importing the data layer outside the data access layer',
    settings: ['dal', 'dataLayer'],
    messages: {
        importOutsideDal:
            'Import of "{{source}}" reaches the database from outside the data access layer ({{dal}}) — go through the DAL instead.',
    },
    create(context, config) {
        const dal = config.dal as string[];
        const dataLayer = config.dataLayer as string[];
        if (dal.length === 0 || dataLayer.length === 0) return {};

        const filename = normalizeFilename(context.filename, context.cwd);
        if (filename === null || matchesPath(filename, dal)) return {};

        const check = (node: unknown): void => {
            const source = moduleSource(node as AstNode);
            if (source === null || !matchesModule(source.value, dataLayer)) return;

            context.report({
                node: source.node as never,
                messageId: 'importOutsideDal',
                data: { source: source.value, dal: dal.join(', ') },
            });
        };

        return {
            ImportDeclaration: check,
            ImportExpression: check,
            ExportNamedDeclaration: check,
            ExportAllDeclaration: check,
        };
    },
});
