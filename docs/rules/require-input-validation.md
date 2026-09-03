# next-security/require-input-validation

📝 Require Server Action input to be validated before it reaches the data layer.

⚠️ This rule _warns_ in the ✅ `recommended` [config](https://github.com/PavelLazarchuk/eslint-plugin-next-security#setup).

<!-- end auto-generated rule header -->

Reports a Server Action that passes its input to the data layer without a schema check.

Types do not survive the network. A Server Action's parameters are typed in the editor and arbitrary at runtime, so the only thing that makes them safe is a parse step. This rule asks that a validator run before the first data layer call in the action.

```ts
'use server';
import { db } from '@/db';
import { z } from 'zod';

const CreateUser = z.object({ email: z.string().email(), name: z.string().max(80) });

/* ✗ incorrect */
export async function create(input: unknown) {
    await requireUser();
    await db.insert(users).values(input);
}

/* ✓ correct */
export async function create(input: unknown) {
    await requireUser();
    await db.insert(users).values(CreateUser.parse(input));
}
```

Where [`no-raw-formdata-to-db`](./no-raw-formdata-to-db.md) traces one value from the request to the database, this rule asks a coarser question — did anything get validated at all — and so catches actions whose input arrives as a plain object rather than `FormData`.

## Options

| Option             | Type       | Default                                                  |
| ------------------ | ---------- | -------------------------------------------------------- |
| `dataLayer`        | `string[]` | `[]`                                                     |
| `validators`       | `string[]` | `['zod', 'valibot']`                                     |
| `validatorMethods` | `string[]` | `['parse', 'safeParse', 'parseAsync', 'safeParseAsync']` |

With `dataLayer` empty the rule does not run — it has no way to tell which call reaches the database.

A call counts as validation when its callee is rooted at an import from a `validators` module (`v.parse(Schema, input)` from valibot) or when its method name is in `validatorMethods` (`CreateUser.parse(input)`, whichever module the schema came from). A validator nested inside the data layer call itself counts as well. A method call on a built-in global — `JSON.parse`, `Date.parse`, `Number.parseInt` — never counts: those decode a value, they do not check its shape.

An action that takes no parameters is skipped: there is no input to validate.

## When it can be wrong

- **A validator that does not look like one.** A hand-written `assertCreateUser(input)` is not recognised — add its name to `validatorMethods`, or its module to `validators`.
- **Validation in a helper.** `const data = await parseInput(formData)` puts the schema call in another function, where this rule does not look.
- **Presence, not coverage.** The rule sees that a validator ran before the write. It cannot tell whether the schema covers the fields that actually reach the row.
