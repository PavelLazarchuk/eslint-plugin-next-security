import type { AstNode, ServerAction } from '../types';
import { calleePath, isType } from '../utils/ast';
import { createRule } from '../utils/createRule';
import { collectImports, isModuleCallee } from '../utils/names';
import { collectServerActions } from '../utils/server-actions';
import { stringArray } from '../utils/settings';
import { asVariables, traceTaint, type Scope, type Variable } from '../utils/taint';

interface TypeServices {
    program?: { getTypeChecker(): { typeToString(type: unknown): string } };
    getTypeAtLocation?(node: unknown): unknown;
}

const FORM_DATA_NAME = /form-?data/i;
const FORM_DATA_METHODS = new Set(['get', 'getAll', 'has', 'entries', 'keys', 'values', 'forEach']);

const DEFAULT_TRANSFORMS = [
    'Object.fromEntries',
    'Object.entries',
    'Object.values',
    'Array.from',
    'structuredClone',
];

function typeName(services: TypeServices | undefined, node: AstNode): string | null {
    if (!services?.program || typeof services.getTypeAtLocation !== 'function') return null;

    try {
        return services.program.getTypeChecker().typeToString(services.getTypeAtLocation(node));
    } catch {
        return null;
    }
}

function usesFormDataApi(variable: Variable): boolean {
    return variable.references.some(reference => {
        const parent = reference.identifier.parent;
        if (!isType(parent, 'MemberExpression') || parent.object !== reference.identifier)
            return false;

        const property = parent.property as AstNode;
        return isType(property, 'Identifier') && FORM_DATA_METHODS.has(property.name as string);
    });
}

function parameterNames(action: ServerAction): Set<string> {
    const names = new Set<string>();

    for (const parameter of (action.node.params as AstNode[]) ?? [])
        if (isType(parameter, 'Identifier')) names.add(parameter.name as string);

    return names;
}

export default createRule({
    name: 'no-raw-formdata-to-db',
    description: 'Disallow passing raw FormData values into data layer calls',
    settings: ['dataLayer'],
    schemaProperties: { typed: { type: 'boolean' }, transforms: stringArray },
    defaultOptions: { typed: false, transforms: DEFAULT_TRANSFORMS },
    messages: {
        rawFormData:
            'Raw request input "{{source}}" reaches {{sink}} unvalidated — parse it into a typed object before it touches the database.',
    },
    create(context, config) {
        const dataLayer = config.dataLayer as string[];
        if (dataLayer.length === 0) return {};

        const typed = config.typed === true;
        const transforms = new Set(config.transforms as string[]);
        const { sourceCode } = context;
        const services = sourceCode.parserServices as TypeServices | undefined;

        const isFormData = (variable: Variable): boolean => {
            const identifier = variable.defs?.[0]?.name;

            if (typed && identifier) {
                const name = typeName(services, identifier);
                if (name !== null) return FORM_DATA_NAME.test(name);
            }
            return FORM_DATA_NAME.test(variable.name) || usesFormDataApi(variable);
        };

        return {
            'Program:exit'(program: unknown) {
                const imports = collectImports(program as AstNode);

                for (const action of collectServerActions(sourceCode)) {
                    const parameters = parameterNames(action);
                    const roots = asVariables(
                        sourceCode.getDeclaredVariables(action.node as never)
                    ).filter(variable => parameters.has(variable.name) && isFormData(variable));

                    if (roots.length === 0) continue;

                    const flows = traceTaint({
                        roots,
                        within: action.node,
                        isSink: call => isModuleCallee(call.callee as AstNode, imports, dataLayer),
                        isTransparentCall: call =>
                            transforms.has(calleePath(call.callee as AstNode).join('.')),
                        declaredVariables: node =>
                            asVariables(sourceCode.getDeclaredVariables(node as never)),
                        getScope: node => sourceCode.getScope(node as never) as unknown as Scope,
                    });

                    for (const flow of flows)
                        context.report({
                            node: flow.argument as never,
                            messageId: 'rawFormData',
                            data: {
                                source: flow.source,
                                sink: `${calleePath(flow.sink.callee as AstNode).join('.')}()`,
                            },
                        });
                }
            },
        };
    },
});
