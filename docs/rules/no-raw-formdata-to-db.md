# next-security/no-raw-formdata-to-db

📝 Disallow passing raw FormData values into data layer calls.

⚠️ This rule _warns_ in the ✅ `recommended` [config](https://github.com/PavelLazarchuk/eslint-plugin-next-security#setup).

<!-- end auto-generated rule header -->

Reports a value read straight from the request reaching a data layer call.

`FormData` from a Server Action is attacker-controlled: field names, field count and types are whatever the POST body says. Handing it to the database — as a row, as a filter, as a query fragment — is how mass assignment and injection get in.

```ts
'use server';
import { db } from '@/db';

/* ✗ incorrect — every field of the request becomes a column */
export async function create(formData: FormData) {
    await requireUser();
    await db.insert(users).values(Object.fromEntries(formData));
}

/* ✗ incorrect — the value travels through a variable first */
export async function remove(formData: FormData) {
    const id = formData.get('id');
    await db.delete(users).where(eq(users.id, id));
}

/* ✓ correct — the schema decides what the row can contain */
export async function create(formData: FormData) {
    await requireUser();
    const data = CreateUser.parse(Object.fromEntries(formData));
    await db.insert(users).values(data);
}
```

The taint is followed through assignments, object and array literals, template strings, `??`/`||`/ternaries, and method calls on the value itself (`formData.get(...)`). It stops the moment the value is passed to any other function — including a validator, which is the point: `schema.parse(input)` is a boundary, and everything after it is the schema's output rather than the request's.

## Options

| Option       | Type       | Default                                                                                      |
| ------------ | ---------- | -------------------------------------------------------------------------------------------- |
| `dataLayer`  | `string[]` | `[]`                                                                                         |
| `typed`      | `boolean`  | `false`                                                                                      |
| `transforms` | `string[]` | `['Object.fromEntries', 'Object.entries', 'Object.values', 'Array.from', 'structuredClone']` |

With `dataLayer` empty the rule does not run: it is what tells the rule which calls reach the database. It is normally set in `settings['next-security']`.

`transforms` are the calls a tainted value passes through unchanged. Anything not listed ends the trace.

`typed` reads the real type of each parameter off the TypeScript checker instead of guessing, and needs a type-aware parser setup (`parserOptions.projectService` or `project`). Without it — the default — a parameter counts as request input when its name looks like form data (`formData`, `form_data`) or when it is used through the `FormData` API (`.get`, `.getAll`, `.entries`, …). If type information turns out to be unavailable, the rule falls back to that heuristic rather than going quiet.

## When it can be wrong

- **Taint analysis is intraprocedural, deliberately.** A value that leaves the action through a helper is not followed. Cross-function analysis in ESLint means resolving imports and building a call graph per lint run: slow, and unstable in the editor. So this rule under-reports rather than guesses.
- **Without `typed`, a differently named parameter is missed.** `async (payload) => { ... }` that never calls a `FormData` method looks like an ordinary argument.
- **A sink is recognised by its import.** A query builder re-exported from a local module is invisible unless that module is in `dataLayer`.
- **Keys, indexes and conditions are not reported** — only values that can land in a row or a query.
