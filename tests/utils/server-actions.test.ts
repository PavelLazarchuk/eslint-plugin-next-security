import { describe, expect, it } from 'vitest';
import { parser } from 'typescript-eslint';
import type { AstNode, ServerAction } from '../../src/types';
import {
    collectExportedFunctions,
    collectServerActions,
    isUseServerFile,
} from '../../src/utils/server-actions';

interface Parser {
    parseForESLint(code: string, options?: unknown): { ast: unknown };
}

function parse(code: string): AstNode {
    const { ast } = (parser as unknown as Parser).parseForESLint(code, {
        range: true,
        loc: true,
        ecmaFeatures: { jsx: true },
    });
    return ast as AstNode;
}

function actions(code: string): ServerAction[] {
    return collectServerActions({ ast: parse(code) });
}

function summary(code: string): Partial<ServerAction>[] {
    return actions(code).map(({ name, kind, exported, passedAsProp }) => ({
        name,
        kind,
        exported,
        passedAsProp,
    }));
}

describe('isUseServerFile', () => {
    it('reads the directive prologue only', () => {
        expect(isUseServerFile(parse(`'use server';\nexport async function a() {}`))).toBe(true);
        expect(isUseServerFile(parse(`'use client';\n'use server';`))).toBe(true);
        expect(isUseServerFile(parse(`const x = 1;\n'use server';`))).toBe(false);
        expect(isUseServerFile(parse(`export async function a() {}`))).toBe(false);
    });
});

describe('collectServerActions', () => {
    it('collects every export of a use server module', () => {
        expect(
            summary(`'use server';
                export async function create() {}
                export const remove = async () => {};
                export default async function update() {}`)
        ).toEqual([
            { name: 'create', kind: 'file', exported: true, passedAsProp: false },
            { name: 'remove', kind: 'file', exported: true, passedAsProp: false },
            { name: 'default', kind: 'file', exported: true, passedAsProp: false },
        ]);
    });

    it('sees through an authorization wrapper', () => {
        const [action] = actions(`'use server';
            export const remove = withAuth(async () => {});`);

        expect(action?.node.type).toBe('ArrowFunctionExpression');
        expect(action?.wrapperCalls).toHaveLength(1);
    });

    it('collects nested wrappers innermost first', () => {
        const [action] = actions(`'use server';
            export const remove = withLogging(withAuth(async () => {}));`);

        expect(action?.wrapperCalls.map(call => (call.callee as AstNode).name)).toEqual([
            'withAuth',
            'withLogging',
        ]);
    });

    it('collects an inline action declared inside a component', () => {
        expect(
            summary(`export default function Page() {
                async function remove() {
                    'use server';
                }
                return <form action={remove} />;
            }`)
        ).toEqual([{ name: 'remove', kind: 'inline', exported: false, passedAsProp: true }]);
    });

    it('marks an anonymous inline action passed straight into JSX', () => {
        expect(
            summary(`export default function Page() {
                return <form action={async () => { 'use server'; }} />;
            }`)
        ).toEqual([{ name: null, kind: 'inline', exported: false, passedAsProp: true }]);
    });

    it('collects an inline action that is never handed to the client', () => {
        expect(
            summary(`function make() {
                return async () => { 'use server'; };
            }`)
        ).toEqual([{ name: null, kind: 'inline', exported: false, passedAsProp: false }]);
    });

    it('reports an export listed in a specifier once, as an export', () => {
        expect(
            summary(`'use server';
                async function remove() {}
                export { remove as removeUser };`)
        ).toEqual([{ name: 'removeUser', kind: 'file', exported: true, passedAsProp: false }]);
    });

    it('resolves a specifier that names a variable', () => {
        expect(
            summary(`'use server';
                const other = 1;
                const remove = withAuth(async () => {});
                export { remove };`)
        ).toEqual([{ name: 'remove', kind: 'file', exported: true, passedAsProp: false }]);
    });

    it('ignores a specifier that names something other than a function', () => {
        expect(summary(`'use server';\nconst LIMIT = 10;\nexport { LIMIT };`)).toEqual([]);
    });

    it('ignores re-exports from another module', () => {
        expect(summary(`'use server';\nexport { remove } from './actions';`)).toEqual([]);
    });

    it('does not treat an ordinary module as a set of actions', () => {
        expect(summary(`export async function remove() {}`)).toEqual([]);
    });
});

describe('collectExportedFunctions', () => {
    it('ignores non-function exports', () => {
        expect(collectExportedFunctions(parse(`export const LIMIT = 10;`))).toEqual([]);
    });

    it('names a default export', () => {
        expect(
            collectExportedFunctions(parse(`export default () => {};`)).map(entry => entry.name)
        ).toEqual(['default']);
    });
});
