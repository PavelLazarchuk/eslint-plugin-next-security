import { minimatch } from 'minimatch';

const VIRTUAL_FILENAMES = new Set(['<input>', '<text>']);

function toPosix(value: string): string {
    return value.replace(/\\/g, '/').replace(/^\.\//, '');
}

/**
 * Only real glob syntax counts. Parentheses on their own are literal, so a Next.js route group —
 * `app/(admin)/data` — stays a plain directory prefix instead of a pattern that matches nothing.
 */
function hasMagic(pattern: string): boolean {
    return /[*?[\]{}]/.test(pattern) || /[!+@]\(/.test(pattern);
}

/** A path relative to `cwd`, with `/` separators — `null` when the linter has no real file. */
export function normalizeFilename(filename: string | undefined, cwd: string): string | null {
    if (!filename || VIRTUAL_FILENAMES.has(filename)) return null;

    const file = toPosix(filename);
    const root = `${toPosix(cwd).replace(/\/$/, '')}/`;

    return file.startsWith(root) ? file.slice(root.length) : file;
}

/** Glob match against a file path; a pattern without glob syntax also matches a directory prefix. */
export function matchesPath(filename: string, patterns: string[]): boolean {
    return patterns.some(raw => {
        const pattern = toPosix(raw);

        if (!hasMagic(pattern)) {
            const directory = pattern.replace(/\/$/, '');
            return filename === directory || filename.startsWith(`${directory}/`);
        }
        return minimatch(filename, pattern, { dot: true });
    });
}

/** Module-specifier match: `@prisma/client` covers `@prisma/client/edge`, and globs work too. */
export function matchesModule(source: string, patterns: string[]): boolean {
    return patterns.some(pattern => {
        if (source === pattern || source.startsWith(`${pattern}/`)) return true;
        return hasMagic(pattern) && minimatch(source, pattern);
    });
}
