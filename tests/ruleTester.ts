import { RuleTester } from 'eslint';
import type { Linter } from 'eslint';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'vitest';
import { parser } from 'typescript-eslint';

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

export const FIXTURE_DIR = fileURLToPath(new URL('./fixture', import.meta.url));

export const ruleTester = new RuleTester({
    languageOptions: {
        parser: parser as Linter.Parser,
        ecmaVersion: 2022,
        sourceType: 'module',
        parserOptions: { ecmaFeatures: { jsx: true } },
    },
});

export const typedRuleTester = new RuleTester({
    languageOptions: {
        parser: parser as Linter.Parser,
        ecmaVersion: 2022,
        sourceType: 'module',
        parserOptions: {
            project: './tsconfig.json',
            tsconfigRootDir: FIXTURE_DIR,
            ecmaFeatures: { jsx: true },
        },
    },
});

export const TYPED_FILENAME = `${FIXTURE_DIR}/action.ts`;
