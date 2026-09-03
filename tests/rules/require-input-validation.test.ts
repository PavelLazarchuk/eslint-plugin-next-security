import rule from '../../src/rules/require-input-validation';
import { ruleTester } from '../ruleTester';

const settings = {
    'next-security': { dataLayer: ['@/db'], validators: ['zod', 'valibot'] },
};

ruleTester.run('require-input-validation', rule, {
    valid: [
        // A schema method call before the write.
        {
            code: `'use server';
                import { db } from '@/db';
                export async function create(formData: FormData) {
                    const data = schema.parse(Object.fromEntries(formData));
                    await db.insert(users).values(data);
                }`,
            settings,
        },
        // valibot's functional form, imported from the configured module.
        {
            code: `'use server';
                import * as v from 'valibot';
                import { db } from '@/db';
                export async function create(input: unknown) {
                    const data = v.parse(Schema, input);
                    await db.insert(users).values(data);
                }`,
            settings,
        },
        // A schema imported under a built-in's name is still a schema.
        {
            code: `'use server';
                import { db } from '@/db';
                import { JSON } from '@/schemas';
                export async function create(input: unknown) {
                    await db.insert(users).values(JSON.parse(input));
                }`,
            settings,
        },
        // Validated inside the data layer call itself.
        {
            code: `'use server';
                import { db } from '@/db';
                export async function create(input: unknown) {
                    await db.insert(users).values(schema.parse(input));
                }`,
            settings,
        },
        // No input to validate.
        {
            code: `'use server';
                import { db } from '@/db';
                export async function purge() {
                    await db.delete(users);
                }`,
            settings,
        },
        // No data layer call.
        {
            code: `'use server';
                export async function create(input: unknown) {
                    await fetch('/api', { body: JSON.stringify(input) });
                }`,
            settings,
        },
        // Unconfigured data layer.
        {
            code: `'use server';
                import { db } from '@/db';
                export async function create(input: unknown) {
                    await db.insert(users).values(input);
                }`,
        },
        // Not an action.
        {
            code: `import { db } from '@/db';
                export async function create(input: unknown) {
                    await db.insert(users).values(input);
                }`,
            settings,
        },
    ],
    invalid: [
        {
            code: `'use server';
                import { db } from '@/db';
                export async function create(formData: FormData) {
                    await db.insert(users).values(Object.fromEntries(formData));
                }`,
            settings,
            errors: [
                {
                    messageId: 'missingValidation',
                    data: {
                        name: '"create"',
                        sink: 'db.insert.values()',
                        validators: 'zod, valibot',
                    },
                    line: 4,
                },
            ],
        },
        // Validation after the write protects nothing.
        {
            code: `'use server';
                import { db } from '@/db';
                export async function create(input: unknown) {
                    await db.insert(users).values(input);
                    schema.parse(input);
                }`,
            settings,
            errors: [{ messageId: 'missingValidation' }],
        },
        // `JSON.parse` decodes, it does not validate.
        {
            code: `'use server';
                import { db } from '@/db';
                export async function create(raw: string) {
                    await db.insert(users).values(JSON.parse(raw));
                }`,
            settings,
            errors: [{ messageId: 'missingValidation' }],
        },
        // A method name nobody configured is not a validator.
        {
            code: `'use server';
                import { db } from '@/db';
                export async function create(input: unknown) {
                    const data = sanitize(input);
                    await db.insert(users).values(data);
                }`,
            settings,
            options: [{ validatorMethods: ['parse'] }],
            errors: [{ messageId: 'missingValidation' }],
        },
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
                    messageId: 'missingValidation',
                    data: {
                        name: '(inline)',
                        sink: 'db.insert.values()',
                        validators: 'zod, valibot',
                    },
                },
            ],
        },
    ],
});
