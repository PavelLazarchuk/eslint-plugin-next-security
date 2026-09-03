import type { AstNode } from '../types';
import { calleePath, identifierName, isType } from './ast';
import { matchesModule } from './paths';

export interface ImportBinding {
    imported: string | null;
    source: string;
}

export interface NameSpec {
    /** `@/lib/auth#verifySession` pins the module; a bare name matches wherever it comes from. */
    module: string | null;
    name: string;
}

export function parseNames(entries: string[]): NameSpec[] {
    return entries.map(entry => {
        const hash = entry.lastIndexOf('#');
        if (hash === -1) return { module: null, name: entry };

        return { module: entry.slice(0, hash), name: entry.slice(hash + 1) };
    });
}

/** Every local name a module import binds, by local name. */
export function collectImports(ast: AstNode): Map<string, ImportBinding> {
    const bindings = new Map<string, ImportBinding>();

    for (const statement of ast.body as AstNode[]) {
        if (!isType(statement, 'ImportDeclaration')) continue;

        const source = (statement.source as AstNode).value;
        if (typeof source !== 'string') continue;

        for (const specifier of statement.specifiers as AstNode[]) {
            const local = identifierName(specifier.local);
            if (local === null) continue;

            const imported = specifier.imported;
            bindings.set(local, {
                imported: isType(imported, 'Identifier') ? (imported.name as string) : null,
                source,
            });
        }
    }
    return bindings;
}

function matchesSpec(path: string[], imports: Map<string, ImportBinding>, spec: NameSpec): boolean {
    const root = path[0] as string;
    const last = path[path.length - 1] as string;

    if (spec.module === null) return root === spec.name || last === spec.name;

    const binding = imports.get(root);
    if (!binding || !matchesModule(binding.source, [spec.module])) return false;

    return spec.name === '*' || binding.imported === spec.name || last === spec.name;
}

export function matchesCallee(
    callee: AstNode | null,
    imports: Map<string, ImportBinding>,
    specs: NameSpec[]
): boolean {
    if (specs.length === 0) return false;

    const path = calleePath(callee);
    return path.length > 0 && specs.some(spec => matchesSpec(path, imports, spec));
}

export function isModuleCallee(
    callee: AstNode | null,
    imports: Map<string, ImportBinding>,
    modules: string[]
): boolean {
    if (modules.length === 0) return false;

    const root = calleePath(callee)[0];
    if (root === undefined) return false;

    const binding = imports.get(root);
    return binding !== undefined && matchesModule(binding.source, modules);
}
