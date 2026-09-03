import type { JSONSchema4 } from 'json-schema';

export const SETTINGS_KEY = 'next-security';

export interface NextSecuritySettings {
    guards: string[];
    wrappers: string[];
    validators: string[];
    dal: string[];
    dataLayer: string[];
}

export const DEFAULT_SETTINGS: NextSecuritySettings = {
    guards: [],
    wrappers: [],
    validators: ['zod', 'valibot'],
    dal: [],
    dataLayer: [],
};

export const stringArray: JSONSchema4 = {
    type: 'array',
    items: { type: 'string' },
    uniqueItems: true,
};

export const SETTINGS_SCHEMA: Record<keyof NextSecuritySettings, JSONSchema4> = {
    guards: stringArray,
    wrappers: stringArray,
    validators: stringArray,
    dal: stringArray,
    dataLayer: stringArray,
};

export type RuleOptions = Record<string, unknown>;

function record(value: unknown): RuleOptions {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
        ? (value as RuleOptions)
        : {};
}

function stringList(value: unknown): string[] | null {
    if (!Array.isArray(value)) return null;
    return value.filter((entry): entry is string => typeof entry === 'string');
}

export function readSettings(
    settings: unknown,
    options: unknown,
    defaultOptions: RuleOptions = {}
): NextSecuritySettings & RuleOptions {
    const shared = record(record(settings)[SETTINGS_KEY]);
    const own = record(options);
    const resolved: RuleOptions = { ...DEFAULT_SETTINGS, ...defaultOptions, ...shared, ...own };

    for (const key of Object.keys(SETTINGS_SCHEMA))
        resolved[key] = stringList(resolved[key]) ?? [
            ...DEFAULT_SETTINGS[key as keyof NextSecuritySettings],
        ];

    return resolved as NextSecuritySettings & RuleOptions;
}
