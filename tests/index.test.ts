import { describe, expect, it } from 'vitest';
import { Linter } from 'eslint';
import type { Linter as LinterTypes } from 'eslint';
import plugin from '../src/index';
import { docsUrl, pointAt } from '../src/utils/createRule';
import { RECOMMENDED_SEVERITIES } from '../src/configs/recommended';

const RULES = [
    'require-auth-guard',
    'no-data-layer-outside-dal',
    'no-sync-server-action-export',
    'no-raw-formdata-to-db',
    'require-input-validation',
];

const settings = {
    'next-security': {
        guards: ['requireUser'],
        dal: ['src/data/**'],
        dataLayer: ['@/db'],
    },
};

function legacyRules(name: string): Partial<LinterTypes.RulesRecord> {
    return (plugin.configs?.[name] as LinterTypes.LegacyConfig).rules ?? {};
}

function flatRules(name: string): Partial<LinterTypes.RulesRecord> {
    const [config] = plugin.configs?.[`flat/${name}`] as LinterTypes.Config[];
    return config?.rules ?? {};
}

function severity(entry: unknown): unknown {
    return Array.isArray(entry) ? entry[0] : entry;
}

function verify(code: string, config: string, filename = 'src/app/actions.js') {
    return new Linter().verify(
        code,
        [
            ...(plugin.configs?.[`flat/${config}`] as LinterTypes.Config[]),
            { languageOptions: { ecmaVersion: 2022, sourceType: 'module' }, settings },
        ],
        filename
    );
}

describe('plugin', () => {
    it('exposes every rule', () => {
        expect(Object.keys(plugin.rules ?? {})).toEqual(RULES);
    });

    it.each(['recommended', 'strict'])('lists every rule in the %s configs', name => {
        const expected = RULES.map(rule => `next-security/${rule}`).sort();

        expect(Object.keys(legacyRules(name)).sort()).toEqual(expected);
        expect(Object.keys(flatRules(name)).sort()).toEqual(expected);
    });

    it('keeps recommended at warn except for the structural DAL rule', () => {
        for (const [rule, expected] of Object.entries(RECOMMENDED_SEVERITIES)) {
            expect(severity(legacyRules('recommended')[`next-security/${rule}`])).toBe(expected);
            expect(severity(flatRules('recommended')[`next-security/${rule}`])).toBe(expected);
        }
        expect(RECOMMENDED_SEVERITIES['no-data-layer-outside-dal']).toBe('error');
    });

    it('raises every rule to error in strict', () => {
        for (const entry of Object.values(flatRules('strict')))
            expect(severity(entry)).toBe('error');
        for (const entry of Object.values(legacyRules('strict')))
            expect(severity(entry)).toBe('error');
    });

    it('turns the type-aware and ordering checks on in strict', () => {
        expect(flatRules('strict')['next-security/no-raw-formdata-to-db']).toEqual([
            'error',
            { typed: true },
        ]);
        expect(flatRules('strict')['next-security/require-auth-guard']).toEqual([
            'error',
            { requireGuardFirst: true },
        ]);
    });

    it('marks every rule as recommended', () => {
        for (const rule of Object.values(plugin.rules ?? {})) {
            const meta = typeof rule === 'object' ? rule.meta : undefined;
            expect(meta?.docs?.recommended).toBe(true);
        }
    });

    it('points every rule at its own docs page', () => {
        for (const [name, rule] of Object.entries(plugin.rules ?? {})) {
            const url = typeof rule === 'object' ? rule.meta?.docs?.url : undefined;
            expect(url).toBe(
                `https://github.com/PavelLazarchuk/eslint-plugin-next-security/blob/main/docs/rules/${name}.md`
            );
        }
    });

    it.each(['recommended', 'strict'])('ships a legacy and a flat %s config', name => {
        expect(plugin.configs?.[name]).toMatchObject({ plugins: ['next-security'] });
        expect(Array.isArray(plugin.configs?.[`flat/${name}`])).toBe(true);
    });

    it('reads its settings through the flat recommended config', () => {
        const messages = verify(
            `'use server';
            import { db } from '@/db';
            export function create(formData) {
                return db.insert(Object.fromEntries(formData));
            }`,
            'recommended'
        );

        expect(messages.map(message => message.ruleId)).toEqual([
            'next-security/no-data-layer-outside-dal',
            'next-security/require-auth-guard',
            'next-security/no-sync-server-action-export',
            'next-security/require-input-validation',
            'next-security/no-raw-formdata-to-db',
        ]);
        expect(messages.map(message => message.severity)).toEqual([2, 1, 1, 1, 1]);
    });

    it('reports everything as an error through the flat strict config', () => {
        const messages = verify(
            `'use server';
            import { db } from '@/db';
            export async function create(formData) {
                return db.insert(Object.fromEntries(formData));
            }`,
            'strict'
        );

        expect(messages.every(message => message.severity === 2)).toBe(true);
        expect(messages.length).toBeGreaterThan(0);
    });

    it('points a report at the start of a node, or at the file when there is no location', () => {
        expect(
            pointAt({
                type: 'Fake',
                loc: { start: { line: 3, column: 4 }, end: { line: 3, column: 9 } },
            })
        ).toEqual({ line: 3, column: 4 });
        expect(pointAt({ type: 'Fake' })).toEqual({ line: 1, column: 0 });
        expect(docsUrl('require-auth-guard')).toMatch(/docs\/rules\/require-auth-guard\.md$/);
    });

    it('stays quiet inside the data access layer', () => {
        const messages = verify(`import { db } from '@/db';`, 'recommended', 'src/data/users.js');

        expect(messages).toEqual([]);
    });
});
