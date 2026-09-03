import rule from '../../src/rules/no-raw-formdata-to-db';
import { TYPED_FILENAME, ruleTester, typedRuleTester } from '../ruleTester';

const settings = { 'next-security': { dataLayer: ['@/db', 'drizzle-orm'] } };

ruleTester.run('no-raw-formdata-to-db', rule, {
    valid: [
        // Parsed first: the schema call is a boundary the taint does not cross.
        {
            code: `'use server';
                import { db } from '@/db';
                export async function create(formData: FormData) {
                    const data = schema.parse(Object.fromEntries(formData));
                    await db.insert(users).values(data);
                }`,
            settings,
        },
        // The raw value never reaches the data layer.
        {
            code: `'use server';
                import { db } from '@/db';
                export async function create(formData: FormData) {
                    console.log(formData.get('id'));
                    await db.insert(users).values({});
                }`,
            settings,
        },
        // The call is not a data layer call.
        {
            code: `'use server';
                export async function create(formData: FormData) {
                    await fetch('/api', { body: formData });
                }`,
            settings,
        },
        {
            code: `'use server';
                import { db } from '@/db';
                export async function create(transformData) {
                    await db.insert(users).values(Object.fromEntries(transformData));
                }`,
            settings,
        },
        // Without types, a parameter neither named nor used like FormData is not tracked.
        {
            code: `'use server';
                import { db } from '@/db';
                export async function create(payload) {
                    await db.insert(users).values(Object.fromEntries(payload));
                }`,
            settings,
        },
        // A key, an index and a condition are not the value that lands in a row.
        {
            code: `'use server';
                import { db } from '@/db';
                export async function create(formData: FormData) {
                    await db.insert({ [formData.get('key')]: 1 });
                }`,
            settings,
        },
        {
            code: `'use server';
                import { db } from '@/db';
                export async function remove(formData: FormData) {
                    const id = formData.get('id');
                    await db.insert(id ? users : posts);
                    await db.insert(rows[id]);
                }`,
            settings,
        },
        // An assignment target the scope analyser cannot resolve to a variable.
        {
            code: `'use server';
                import { db } from '@/db';
                export async function create(formData: FormData) {
                    cache.value = Object.fromEntries(formData);
                    await db.insert({});
                }`,
            settings,
        },
        // The value never reaches a call at all.
        {
            code: `'use server';
                export async function read(formData: FormData) {
                    return formData;
                }`,
            settings,
        },
        // A parameter that is neither named nor used like FormData.
        {
            code: `'use server';
                import { db } from '@/db';
                export async function create(id: string) {
                    await db.delete(id);
                }`,
            settings,
        },
        // Unconfigured data layer: nothing is a sink.
        {
            code: `'use server';
                import { db } from '@/db';
                export async function create(formData: FormData) {
                    await db.insert(users).values(Object.fromEntries(formData));
                }`,
        },
        // Not an action at all.
        {
            code: `import { db } from '@/db';
                export async function create(formData: FormData) {
                    await db.insert(users).values(Object.fromEntries(formData));
                }`,
            settings,
        },
    ],
    invalid: [
        {
            code: `'use server';
                import { db } from '@/db';
                export async function create(raw_form_data) {
                    await db.insert(users).values(raw_form_data);
                }`,
            settings,
            errors: [{ messageId: 'rawFormData' }],
        },
        {
            code: `'use server';
                import { db } from '@/db';
                export async function create(formData: FormData) {
                    await db.insert(users).values(Object.fromEntries(formData));
                }`,
            settings,
            errors: [
                {
                    messageId: 'rawFormData',
                    data: { source: 'formData', sink: 'db.insert.values()' },
                    line: 4,
                },
            ],
        },
        // Through a local variable, and through a drizzle helper.
        {
            code: `'use server';
                import { eq } from 'drizzle-orm';
                export async function remove(formData: FormData) {
                    const id = formData.get('id');
                    await db.delete(users).where(eq(users.id, id));
                }`,
            settings,
            errors: [{ messageId: 'rawFormData', data: { source: 'id', sink: 'eq()' }, line: 5 }],
        },
        // Interpolated into a query string.
        {
            code: `'use server';
                import { sql } from '@/db';
                export async function remove(input: FormData) {
                    await sql(\`delete from users where id = \${input.get('id')}\`);
                }`,
            settings,
            errors: [{ messageId: 'rawFormData', data: { source: 'input', sink: 'sql()' } }],
        },
        // Reassignment keeps the taint.
        {
            code: `'use server';
                import { db } from '@/db';
                export async function create(formData: FormData) {
                    let payload = {};
                    payload = Object.fromEntries(formData);
                    await db.insert(users).values(payload);
                }`,
            settings,
            errors: [
                {
                    messageId: 'rawFormData',
                    data: { source: 'payload', sink: 'db.insert.values()' },
                },
            ],
        },
        // Taint survives a fallback and a branch.
        {
            code: `'use server';
                import { db } from '@/db';
                export async function create(formData: FormData, flag: boolean) {
                    const payload = Object.fromEntries(formData);
                    await db.insert(payload || {});
                    await db.insert(flag ? payload : {});
                }`,
            settings,
            errors: [
                { messageId: 'rawFormData', line: 5 },
                { messageId: 'rawFormData', line: 6 },
            ],
        },
        // A module-scope variable assigned inside the action.
        {
            code: `'use server';
                import { db } from '@/db';
                let payload = {};
                export async function create(formData: FormData) {
                    payload = Object.fromEntries(formData);
                    await db.insert(payload);
                }`,
            settings,
            errors: [
                { messageId: 'rawFormData', data: { source: 'payload', sink: 'db.insert()' } },
            ],
        },
        // An inline action carries the same risk.
        {
            code: `import { db } from '@/db';
                export default function Page() {
                    return <form action={async (formData) => {
                        'use server';
                        await db.insert(users).values(Object.fromEntries(formData));
                    }} />;
                }`,
            settings,
            errors: [
                {
                    messageId: 'rawFormData',
                    data: { source: 'formData', sink: 'db.insert.values()' },
                },
            ],
        },
    ],
});

typedRuleTester.run('no-raw-formdata-to-db (typed)', rule, {
    valid: [
        {
            code: `'use server';
                import { db } from '@/db';
                export async function create(payload: Record<string, string>) {
                    await db.insert(payload);
                }`,
            filename: TYPED_FILENAME,
            settings,
            options: [{ typed: true }],
        },
    ],
    invalid: [
        {
            code: `'use server';
                import { db } from '@/db';
                export async function create(payload: FormData) {
                    await db.insert(payload);
                }`,
            filename: TYPED_FILENAME,
            settings,
            options: [{ typed: true }],
            errors: [
                { messageId: 'rawFormData', data: { source: 'payload', sink: 'db.insert()' } },
            ],
        },
    ],
});
