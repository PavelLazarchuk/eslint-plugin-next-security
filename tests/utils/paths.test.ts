import { describe, expect, it } from 'vitest';
import { matchesModule, matchesPath, normalizeFilename } from '../../src/utils/paths';

describe('normalizeFilename', () => {
    it('makes an absolute path relative to the cwd', () => {
        expect(normalizeFilename('/repo/src/app/page.tsx', '/repo')).toBe('src/app/page.tsx');
        expect(normalizeFilename('/repo/src/app/page.tsx', '/repo/')).toBe('src/app/page.tsx');
    });

    it('converts Windows separators', () => {
        expect(normalizeFilename('C:\\repo\\src\\data\\users.ts', 'C:\\repo')).toBe(
            'src/data/users.ts'
        );
    });

    it('keeps a path that lies outside the cwd', () => {
        expect(normalizeFilename('/other/app/page.tsx', '/repo')).toBe('/other/app/page.tsx');
    });

    it('strips a leading ./', () => {
        expect(normalizeFilename('./src/app/page.tsx', '/repo')).toBe('src/app/page.tsx');
    });

    it('answers null when there is no real file', () => {
        expect(normalizeFilename(undefined, '/repo')).toBeNull();
        expect(normalizeFilename('', '/repo')).toBeNull();
        expect(normalizeFilename('<input>', '/repo')).toBeNull();
        expect(normalizeFilename('<text>', '/repo')).toBeNull();
    });
});

describe('matchesPath', () => {
    it('matches globs', () => {
        expect(matchesPath('src/data/users.ts', ['src/data/**'])).toBe(true);
        expect(matchesPath('src/data/nested/users.ts', ['src/data/**'])).toBe(true);
        expect(matchesPath('src/app/page.tsx', ['src/data/**'])).toBe(false);
    });

    it('reads a pattern without glob syntax as a directory prefix', () => {
        expect(matchesPath('src/data/users.ts', ['src/data'])).toBe(true);
        expect(matchesPath('src/data', ['src/data/'])).toBe(true);
        expect(matchesPath('src/database/users.ts', ['src/data'])).toBe(false);
    });

    it('reads parentheses as literal, so a route group is a directory prefix', () => {
        expect(matchesPath('src/app/(admin)/data/users.ts', ['src/app/(admin)/data'])).toBe(true);
        expect(matchesPath('src/app/(admin)/data/users.ts', ['src/app/(admin)/**'])).toBe(true);
        expect(matchesPath('src/app/(public)/page.tsx', ['src/app/(admin)'])).toBe(false);
    });

    it('accepts Windows separators in a pattern', () => {
        expect(matchesPath('src/data/users.ts', ['src\\data\\**'])).toBe(true);
    });

    it('matches nothing without patterns', () => {
        expect(matchesPath('src/data/users.ts', [])).toBe(false);
    });
});

describe('matchesModule', () => {
    it('matches a specifier and its subpaths', () => {
        expect(matchesModule('@prisma/client', ['@prisma/client'])).toBe(true);
        expect(matchesModule('@prisma/client/edge', ['@prisma/client'])).toBe(true);
        expect(matchesModule('@prisma/client-extras', ['@prisma/client'])).toBe(false);
    });

    it('matches globs', () => {
        expect(matchesModule('@/db/users', ['@/db/*'])).toBe(true);
        expect(matchesModule('@/lib/auth', ['@/db/*'])).toBe(false);
    });
});
