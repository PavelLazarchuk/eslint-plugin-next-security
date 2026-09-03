import { describe, expect, it } from 'vitest';
import { parser } from 'typescript-eslint';
import type { AstNode } from '../../src/types';
import {
    calleePath,
    childNodes,
    collectCalls,
    directives,
    functionName,
    identifierName,
    isFunction,
    isNode,
    startOf,
    unwrapExpression,
    walk,
} from '../../src/utils/ast';

function parse(code: string): AstNode {
    return parser.parseForESLint(code).ast as unknown as AstNode;
}

function expression(code: string): AstNode {
    const [statement] = (parse(code).body as AstNode[]) ?? [];
    return statement?.expression as AstNode;
}

describe('isNode', () => {
    it('answers only for objects carrying a type', () => {
        expect(isNode({ type: 'Identifier' })).toBe(true);
        expect(isNode({ name: 'x' })).toBe(false);
        expect(isNode(null)).toBe(false);
        expect(isNode('Identifier')).toBe(false);
    });
});

describe('identifierName', () => {
    it('reads a name off an identifier only', () => {
        expect(identifierName(expression('x;'))).toBe('x');
        expect(identifierName(expression('1;'))).toBeNull();
        expect(identifierName({ type: 'Identifier' })).toBeNull();
    });
});

describe('isFunction', () => {
    it.each([
        ['function a() {}', true],
        ['const a = function () {};', true],
        ['const a = () => {};', true],
        ['class A {}', false],
    ])('%s', (code, expected) => {
        const found: boolean[] = [];
        walk(parse(code), node => found.push(isFunction(node)));

        expect(found.some(Boolean)).toBe(expected);
    });
});

describe('childNodes', () => {
    it('skips the keys that are not part of the tree', () => {
        const node: AstNode = {
            type: 'Fake',
            loc: { start: { line: 1, column: 0 }, end: { line: 1, column: 1 } },
            range: [0, 1],
            parent: { type: 'Program' },
            child: { type: 'Identifier' },
            list: [{ type: 'Literal' }, null, 'text'],
        };

        expect(childNodes(node).map(child => child.type)).toEqual(['Identifier', 'Literal']);
    });
});

describe('unwrapExpression', () => {
    it('sees through type-only wrappers', () => {
        expect(unwrapExpression(expression('(x as string)!;'))?.type).toBe('Identifier');
        expect(unwrapExpression({ type: 'TSAsExpression' })).toBeNull();
        expect(unwrapExpression(null)).toBeNull();
        expect(unwrapExpression(undefined)).toBeNull();
    });
});

describe('functionName', () => {
    it('takes the name from the declaration, the variable or the property', () => {
        const declaration = (parse('function a() {}').body as AstNode[])[0] as AstNode;
        expect(functionName(declaration, null)).toBe('a');

        const declarator = (
            ((parse('const b = () => {};').body as AstNode[])[0] as AstNode)
                .declarations as AstNode[]
        )[0] as AstNode;
        expect(functionName(declarator.init as AstNode, declarator)).toBe('b');

        const property = ((expression('({ c: () => {} });').properties as AstNode[]) ??
            [])[0] as AstNode;
        expect(functionName(property.value as AstNode, property)).toBe('c');

        expect(functionName(expression('(() => {});'), expression('(() => {});'))).toBeNull();
    });
});

describe('directives', () => {
    it('stops at the first statement that is not a string literal', () => {
        expect(
            directives((parse(`'use server';\n'use cache';\nconst x = 1;`) as AstNode).body)
        ).toEqual(['use server', 'use cache']);
        expect(directives((parse(`const x = 1;\n'use server';`) as AstNode).body)).toEqual([]);
        expect(directives(parse('1;').body)).toEqual([]);
        expect(directives((parse('1;').body as AstNode[])[0])).toEqual([]);
        expect(directives(undefined)).toEqual([]);
    });
});

describe('calleePath', () => {
    it.each([
        ['a();', ['a']],
        ['a.b.c();', ['a', 'b', 'c']],
        ['z.string().parse();', ['z', 'string', 'parse']],
        ['a[b].c();', ['a', 'c']],
        ['a?.b();', ['a', 'b']],
        ['(a as any)();', ['a']],
        ['(function () {})();', []],
    ])('%s', (code, expected) => {
        const call = unwrapExpression(expression(code)) as AstNode;
        expect(calleePath(call.callee as AstNode)).toEqual(expected);
    });

    it('answers nothing without a callee', () => {
        expect(calleePath(null)).toEqual([]);
    });

    it('stops at a member it cannot name', () => {
        const [call] = collectCalls(parse('class A { #b() {} m() { this.#b(); } }'));

        expect(calleePath((call as AstNode).callee as AstNode)).toEqual([]);
    });
});

describe('collectCalls', () => {
    it('returns every call in source order', () => {
        const calls = collectCalls(parse('a(); b(c()); d();'));

        expect(calls.map(call => calleePath(call.callee as AstNode).join('.'))).toEqual([
            'a',
            'b',
            'c',
            'd',
        ]);
        expect(startOf(calls[0] as AstNode)).toBe(0);
    });

    it('falls back to zero for a node without a range', () => {
        expect(startOf({ type: 'Fake' })).toBe(0);
    });
});
