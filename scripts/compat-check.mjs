/**
 * Runs the built plugin against whichever ESLint the workspace currently has installed, so the
 * `eslint: >=8.57.0` peer range is a promise the CI matrix keeps rather than a hope.
 */
import assert from 'node:assert/strict';
import { Linter } from 'eslint';
import plugin from '../dist/index.js';

const major = Number.parseInt(Linter.version, 10);

const settings = {
    'next-security': {
        guards: ['requireUser'],
        dal: ['src/data/**'],
        dataLayer: ['@/db'],
    },
};

const samples = [
    {
        name: 'an unguarded Server Action',
        filename: 'src/app/actions.js',
        code: `'use server';\nexport async function deleteUser(id) {\n  return remove(id);\n}`,
        expected: ['next-security/require-auth-guard'],
        severities: { recommended: 1, strict: 2 },
    },
    {
        name: 'a data layer import outside the DAL',
        filename: 'src/app/page.js',
        code: `import { db } from '@/db';\nexport const revalidate = 0;`,
        expected: ['next-security/no-data-layer-outside-dal'],
        severities: { recommended: 2, strict: 2 },
    },
    {
        name: 'raw FormData reaching the database',
        filename: 'src/data/actions.js',
        code: `'use server';\nimport { db } from '@/db';\nexport async function create(formData) {\n  await requireUser();\n  return db.insert(Object.fromEntries(formData));\n}`,
        expected: ['next-security/require-input-validation', 'next-security/no-raw-formdata-to-db'],
        severities: { recommended: 1, strict: 2 },
    },
];

function verifyFlat(code, config, filename) {
    return new Linter().verify(
        code,
        [
            ...plugin.configs[`flat/${config}`],
            { languageOptions: { ecmaVersion: 2022, sourceType: 'module' }, settings },
        ],
        filename
    );
}

function verifyLegacy(code, config, filename) {
    const linter = new Linter({ configType: 'eslintrc' });

    for (const [name, rule] of Object.entries(plugin.rules))
        linter.defineRule(`next-security/${name}`, rule);

    return linter.verify(
        code,
        {
            parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
            settings,
            rules: plugin.configs[config].rules,
        },
        filename
    );
}

const verify = major >= 9 ? verifyFlat : verifyLegacy;

for (const { name, code, filename, expected, severities } of samples) {
    for (const config of ['recommended', 'strict']) {
        const messages = verify(code, config, filename);

        assert.deepEqual(
            messages.map(message => message.ruleId).sort(),
            [...expected].sort(),
            `ESLint ${Linter.version} reported ${JSON.stringify(messages)} for ${name} under ${config}`
        );
        assert.ok(
            messages.every(message => message.severity === severities[config]),
            `ESLint ${Linter.version} did not apply the ${config} severity for ${name}`
        );
    }
}

console.log(`ESLint ${Linter.version}: ${samples.length} samples reported as expected.`);
