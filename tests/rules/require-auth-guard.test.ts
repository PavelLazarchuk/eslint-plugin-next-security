import rule from '../../src/rules/require-auth-guard';
import { ruleTester } from '../ruleTester';

const expected = 'requireUser, @/lib/auth#verifySession, withAuth';

const settings = {
    'next-security': {
        guards: ['requireUser', '@/lib/auth#verifySession'],
        wrappers: ['withAuth'],
    },
};

ruleTester.run('require-auth-guard', rule, {
    valid: [
        // Guard called inside a file-level action.
        {
            code: `'use server';
                export async function deleteUser(formData: FormData) {
                    await requireUser();
                    await db.delete(formData.get('id'));
                }`,
            settings,
        },
        // The guard lives in the wrapper.
        {
            code: `'use server';
                export const deleteUser = withAuth(async (formData: FormData) => {
                    await db.delete(formData.get('id'));
                });`,
            settings,
        },
        // Nested wrappers still count.
        {
            code: `'use server';
                export const deleteUser = withLogging(withAuth(async () => {}));`,
            settings,
        },
        // A guard pinned to its module.
        {
            code: `'use server';
                import { verifySession } from '@/lib/auth';
                export async function deleteUser() {
                    await verifySession();
                }`,
            settings,
        },
        // A namespace import of the same module.
        {
            code: `'use server';
                import * as auth from '@/lib/auth';
                export async function deleteUser() {
                    await auth.verifySession();
                }`,
            settings,
        },
        // Inline action with a guard.
        {
            code: `export default function Page() {
                    async function remove() {
                        'use server';
                        await requireUser();
                    }
                    return <form action={remove} />;
                }`,
            settings,
        },
        // No directive: an ordinary module export is not an endpoint.
        {
            code: `export async function deleteUser() { await db.delete(1); }`,
            settings,
        },
        // Re-exports belong to the module they came from.
        {
            code: `'use server';
                export { deleteUser } from './actions';`,
            settings,
        },
        // Explicitly excused.
        {
            code: `'use server';
                export async function healthcheck() { return 'ok'; }`,
            settings,
            options: [{ ignoreNames: ['healthcheck'] }],
        },
        // The guard runs first, so the ordering check is satisfied too.
        {
            code: `'use server';
                export async function deleteUser(formData: FormData) {
                    await requireUser();
                    const id = formData.get('id');
                    await db.delete(id);
                }`,
            settings,
            options: [{ requireGuardFirst: true }],
        },
        // Reading the action's own arguments is not "work" for the ordering check.
        {
            code: `'use server';
                export async function deleteUser(formData: FormData) {
                    const id = formData.get('id');
                    console.log(id);
                    await requireUser();
                }`,
            settings,
            options: [{ requireGuardFirst: true }],
        },
    ],
    invalid: [
        {
            code: `'use server';
                export async function deleteUser(formData: FormData) {
                    await db.delete(formData.get('id'));
                }`,
            settings,
            errors: [
                {
                    messageId: 'missingGuard',
                    data: { name: '"deleteUser"', expected },
                    line: 2,
                },
            ],
        },
        // An inline action handed to the client is just as public.
        {
            code: `export default function Page() {
                    const remove = async () => {
                        'use server';
                        await db.delete(1);
                    };
                    return <form action={remove} />;
                }`,
            settings,
            errors: [{ messageId: 'missingGuard', data: { name: '"remove"', expected } }],
        },
        // An anonymous inline action.
        {
            code: `export default function Page() {
                    return <form action={async () => { 'use server'; await db.delete(1); }} />;
                }`,
            settings,
            errors: [{ messageId: 'missingGuard', data: { name: '(inline)', expected } }],
        },
        // A wrapper nobody configured is not a guard.
        {
            code: `'use server';
                export const deleteUser = withLogging(async () => { await db.delete(1); });`,
            settings,
            errors: [{ messageId: 'missingGuard' }],
        },
        // export { … } of a local function.
        {
            code: `'use server';
                async function deleteUser() { await db.delete(1); }
                export { deleteUser };`,
            settings,
            errors: [{ messageId: 'missingGuard', line: 2 }],
        },
        {
            code: `'use server';
                export default async function deleteUser() { await db.delete(1); }`,
            settings,
            errors: [{ messageId: 'missingGuard' }],
        },
        // Without configured guards the rule cannot know what a guard is.
        {
            code: `'use server';
                export async function deleteUser() {}`,
            errors: [{ messageId: 'guardsNotConfigured', line: 1, column: 1 }],
        },
        // Guard present, but after the write it is supposed to protect.
        {
            code: `'use server';
                export async function deleteUser(formData: FormData) {
                    await db.delete(formData.get('id'));
                    await requireUser();
                }`,
            settings,
            options: [{ requireGuardFirst: true }],
            errors: [{ messageId: 'lateGuard', data: { name: '"deleteUser"' }, line: 4 }],
        },
    ],
});
