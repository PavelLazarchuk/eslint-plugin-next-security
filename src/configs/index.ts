import type { ESLint, Linter } from 'eslint';
import { RECOMMENDED_SEVERITIES } from './recommended';
import { STRICT_OPTIONS, STRICT_SEVERITIES } from './strict';

export const PLUGIN_NAME = 'next-security';

function ruleRecord(
    severities: Record<string, Linter.StringSeverity>,
    options: Record<string, unknown[]> = {}
): Linter.RulesRecord {
    return Object.fromEntries(
        Object.entries(severities).map(([name, severity]) => [
            `${PLUGIN_NAME}/${name}`,
            options[name] ? [severity, ...options[name]] : severity,
        ])
    );
}

/** `.eslintrc` forms — referenced through `extends: ['plugin:next-security/<name>']`. */
export function legacyConfigs(): Record<string, Linter.LegacyConfig> {
    return {
        recommended: { plugins: [PLUGIN_NAME], rules: ruleRecord(RECOMMENDED_SEVERITIES) },
        strict: { plugins: [PLUGIN_NAME], rules: ruleRecord(STRICT_SEVERITIES, STRICT_OPTIONS) },
    };
}

/** Flat-config forms — spread into `eslint.config.js`. */
export function flatConfigs(plugin: ESLint.Plugin): Record<string, Linter.Config[]> {
    const flat = (rules: Linter.RulesRecord): Linter.Config[] => [
        { plugins: { [PLUGIN_NAME]: plugin }, rules },
    ];

    return {
        'flat/recommended': flat(ruleRecord(RECOMMENDED_SEVERITIES)),
        'flat/strict': flat(ruleRecord(STRICT_SEVERITIES, STRICT_OPTIONS)),
    };
}
