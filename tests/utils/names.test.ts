import { describe, expect, it } from 'vitest';
import { parser } from 'typescript-eslint';
import type { AstNode } from '../../src/types';
import { calleePath, unwrapExpression } from '../../src/utils/ast';
import { collectImports, isModuleCallee, matchesCallee, parseNames } from '../../src/utils/names';

function parse(code: string): AstNode {
    return parser.parseForESLint(code).ast as unknown as AstNode;
}

function lastCallee(code: string): AstNode {
    const body = parse(code).body as AstNode[];
    const statement = body[body.length - 1] as AstNode;
    const call = unwrapExpression(statement.expression as AstNode) as AstNode;
    return call.callee as AstNode;
}

describe('parseNames', () => {
    it('splits a module-qualified name', () => {
        expect(parseNames(['requireUser', '@/lib/auth#verifySession', 'a#b#c'])).toEqual([
            { module: null, name: 'requireUser' },
            { module: '@/lib/auth', name: 'verifySession' },
            { module: 'a#b', name: 'c' },
        ]);
    });
});

describe('collectImports', () => {
    it('binds named, default and namespace imports', () => {
        const imports = collectImports(
            parse(`import db, { users as table } from '@/db';
                import * as auth from '@/lib/auth';
                import '@/styles.css';
                export const x = 1;`)
        );

        expect(imports.get('db')).toEqual({ imported: null, source: '@/db' });
        expect(imports.get('table')).toEqual({ imported: 'users', source: '@/db' });
        expect(imports.get('auth')).toEqual({ imported: null, source: '@/lib/auth' });
        expect(imports.size).toBe(3);
    });
});

describe('matchesCallee', () => {
    const imports = collectImports(
        parse(`import { verifySession } from '@/lib/auth';
            import * as auth from '@/lib/auth';
            import { verifySession as check } from '@/other';`)
    );

    it('matches a bare name wherever it comes from', () => {
        expect(
            matchesCallee(lastCallee('requireUser();'), imports, parseNames(['requireUser']))
        ).toBe(true);
        expect(
            matchesCallee(lastCallee('lib.requireUser();'), imports, parseNames(['requireUser']))
        ).toBe(true);
        expect(
            matchesCallee(lastCallee('requireAdmin();'), imports, parseNames(['requireUser']))
        ).toBe(false);
    });

    it('pins a name to its module', () => {
        const specs = parseNames(['@/lib/auth#verifySession']);

        expect(matchesCallee(lastCallee('verifySession();'), imports, specs)).toBe(true);
        expect(matchesCallee(lastCallee('auth.verifySession();'), imports, specs)).toBe(true);
        expect(matchesCallee(lastCallee('check();'), imports, specs)).toBe(false);
        expect(matchesCallee(lastCallee('unknown();'), imports, specs)).toBe(false);
    });

    it('accepts any export of a module', () => {
        expect(
            matchesCallee(lastCallee('verifySession();'), imports, parseNames(['@/lib/auth#*']))
        ).toBe(true);
    });

    it('matches nothing without specs or without a callee', () => {
        expect(matchesCallee(lastCallee('requireUser();'), imports, [])).toBe(false);
        expect(matchesCallee(null, imports, parseNames(['requireUser']))).toBe(false);
    });
});

describe('isModuleCallee', () => {
    const imports = collectImports(
        parse(`import { db } from '@/db';\nimport { eq } from 'drizzle-orm';`)
    );

    it('follows the root of the callee back to its import', () => {
        expect(isModuleCallee(lastCallee('db.insert(users).values(x);'), imports, ['@/db'])).toBe(
            true
        );
        expect(isModuleCallee(lastCallee('eq(users.id, 1);'), imports, ['drizzle-orm'])).toBe(true);
        expect(isModuleCallee(lastCallee('db.insert(x);'), imports, ['drizzle-orm'])).toBe(false);
        expect(isModuleCallee(lastCallee('local(x);'), imports, ['@/db'])).toBe(false);
    });

    it('matches nothing without modules or without a callee', () => {
        expect(isModuleCallee(lastCallee('db.insert(x);'), imports, [])).toBe(false);
        expect(isModuleCallee(null, imports, ['@/db'])).toBe(false);
        expect(calleePath(null)).toEqual([]);
    });
});
