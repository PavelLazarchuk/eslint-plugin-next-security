import rule from '../../src/rules/no-sync-server-action-export';
import { ruleTester } from '../ruleTester';

ruleTester.run('no-sync-server-action-export', rule, {
    valid: [
        `'use server';
            export async function create() {}
            export const remove = async () => {};
            export default async function update() {}`,
        // Not a 'use server' module.
        `export function create() {}`,
        // The directive has to open the file.
        `const x = 1;
            'use server';
            export function create() {}`,
        // Non-function exports are a different rule's problem.
        `'use server';
            export const LIMIT = 10;`,
        // A wrapper returning an async function.
        `'use server';
            export const create = withAuth(async () => {});`,
    ],
    invalid: [
        {
            code: `'use server';
                export function create() {}`,
            errors: [{ messageId: 'syncExport', data: { name: '"create"' }, line: 2, column: 24 }],
        },
        {
            code: `'use server';
                export const remove = () => {};`,
            errors: [{ messageId: 'syncExport', data: { name: '"remove"' } }],
        },
        {
            code: `'use server';
                export default function update() {}`,
            errors: [{ messageId: 'syncExport', data: { name: '"default"' } }],
        },
        {
            code: `'use server';
                function create() {}
                export { create as createUser };`,
            errors: [{ messageId: 'syncExport', data: { name: '"createUser"' } }],
        },
        {
            code: `'use server';
                export default () => {};`,
            errors: [{ messageId: 'syncExport', data: { name: '"default"' } }],
        },
    ],
});
