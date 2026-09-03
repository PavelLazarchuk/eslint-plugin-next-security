import type { Rule } from 'eslint';
import type { JSONSchema4 } from 'json-schema';
import type { AstNode, Position } from '../types';
import {
    SETTINGS_SCHEMA,
    type NextSecuritySettings,
    type RuleOptions,
    readSettings,
} from './settings';

export type SettingName = keyof NextSecuritySettings;

export type ResolvedConfig = NextSecuritySettings & RuleOptions;

export interface SecurityRuleConfig {
    name: string;
    description: string;
    type?: 'problem' | 'suggestion';
    settings?: SettingName[];
    schemaProperties?: Record<string, JSONSchema4>;
    defaultOptions?: RuleOptions;
    messages: Record<string, string>;
    create(context: Rule.RuleContext, config: ResolvedConfig): Rule.RuleListener;
}

export function docsUrl(name: string): string {
    return `https://github.com/PavelLazarchuk/eslint-plugin-next-security/blob/main/docs/rules/${name}.md`;
}

export function createRule(config: SecurityRuleConfig): Rule.RuleModule {
    const defaultOptions: RuleOptions = { ...config.defaultOptions };
    const properties: Record<string, JSONSchema4> = {
        ...Object.fromEntries((config.settings ?? []).map(name => [name, SETTINGS_SCHEMA[name]])),
        ...config.schemaProperties,
    };
    const schema: JSONSchema4[] =
        Object.keys(properties).length === 0
            ? []
            : [{ type: 'object', properties, additionalProperties: false }];

    return {
        meta: {
            type: config.type ?? 'problem',
            docs: {
                description: config.description,
                url: docsUrl(config.name),
                recommended: true,
            },
            schema,
            // Honoured by ESLint 9+; merged in below as well, for hosts down to the peer range.
            ...(schema.length === 0 ? {} : { defaultOptions: [defaultOptions] }),
            messages: config.messages,
        },
        create(context) {
            const resolved = readSettings(context.settings, context.options[0], defaultOptions);
            return config.create(context, resolved);
        },
    };
}

export function pointAt(node: AstNode): Position {
    return node.loc?.start ?? { line: 1, column: 0 };
}
