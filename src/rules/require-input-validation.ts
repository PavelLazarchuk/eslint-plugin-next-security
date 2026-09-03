import type { AstNode } from '../types';
import { calleePath, collectCalls, containsNode, startOf } from '../utils/ast';
import { createRule } from '../utils/createRule';
import { collectImports, isModuleCallee } from '../utils/names';
import { collectServerActions } from '../utils/server-actions';
import { stringArray } from '../utils/settings';

const DEFAULT_METHODS = ['parse', 'safeParse', 'parseAsync', 'safeParseAsync'];

const BUILTIN_ROOTS = new Set(['JSON', 'Date', 'Number', 'Math', 'String', 'Boolean']);

export default createRule({
    name: 'require-input-validation',
    description: 'Require Server Action input to be validated before it reaches the data layer',
    settings: ['dataLayer', 'validators'],
    schemaProperties: { validatorMethods: stringArray },
    defaultOptions: { validatorMethods: DEFAULT_METHODS },
    messages: {
        missingValidation:
            'Server Action {{name}} passes its input to {{sink}} without a schema check — validate it with {{validators}} first.',
    },
    create(context, config) {
        const dataLayer = config.dataLayer as string[];
        const validators = config.validators as string[];
        if (dataLayer.length === 0 || validators.length === 0) return {};

        const methods = new Set(config.validatorMethods as string[]);

        return {
            'Program:exit'(program: unknown) {
                const imports = collectImports(program as AstNode);

                for (const action of collectServerActions(context.sourceCode)) {
                    if (((action.node.params as AstNode[]) ?? []).length === 0) continue;

                    const calls = collectCalls(action.node);
                    const sink = calls.find(call =>
                        isModuleCallee(call.callee as AstNode, imports, dataLayer)
                    );
                    if (sink === undefined) continue;

                    const isValidator = (call: AstNode): boolean => {
                        const path = calleePath(call.callee as AstNode);
                        const root = path[0];
                        const last = path[path.length - 1];
                        const builtin =
                            root !== undefined && BUILTIN_ROOTS.has(root) && !imports.has(root);

                        if (!builtin && last !== undefined && methods.has(last)) return true;
                        return isModuleCallee(call.callee as AstNode, imports, validators);
                    };

                    const validated = calls.some(
                        call =>
                            isValidator(call) &&
                            (startOf(call) < startOf(sink) || containsNode(sink, call))
                    );
                    if (validated) continue;

                    context.report({
                        node: sink as never,
                        messageId: 'missingValidation',
                        data: {
                            name: action.name === null ? `(${action.kind})` : `"${action.name}"`,
                            sink: `${calleePath(sink.callee as AstNode).join('.')}()`,
                            validators: validators.join(', '),
                        },
                    });
                }
            },
        };
    },
});
