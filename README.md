# eslint-plugin-next-security

[![npm version](https://img.shields.io/npm/v/eslint-plugin-next-security.svg)](https://www.npmjs.com/package/eslint-plugin-next-security)
[![npm downloads](https://img.shields.io/npm/dm/eslint-plugin-next-security.svg)](https://www.npmjs.com/package/eslint-plugin-next-security)

A Server Action is a public HTTP endpoint. `eslint-plugin-next` does not know that. This plugin covers the App Router holes that follow from it: **unguarded Server Actions**, **imports that reach past the data access layer**, and **request input landing in the database unvalidated**.

```sh
npm install --save-dev eslint-plugin-next-security
```

```ts
'use server';

export async function deleteUser(formData: FormData) {
    //                 ~~~~~~~~~~
    //   Server Action "deleteUser" is a public HTTP endpoint with no authorization guard.
    await db.delete(users).where(eq(users.id, formData.get('id')));
    //                                        ~~~~~~~~~~~~~~~~~~
    //   Raw request input "formData" reaches db.delete.where() unvalidated.
}
```

Both shapes of action are recognised — a `'use server'` module, and an action declared inside a Server Component and handed to the client:

```tsx
export default function Page() {
    async function remove() {
        'use server'; // just as public, just as much in need of a guard
    }
    return <form action={remove} />;
}
```

## Setup

The Server Action rules need to know what a guard looks like in your codebase. **Configure `settings` first** — `require-auth-guard` reports once per file and stays inactive until you do.

```js
// eslint.config.js
import nextSecurity from 'eslint-plugin-next-security';

export default [
    ...nextSecurity.configs['flat/recommended'],
    {
        settings: {
            'next-security': {
                guards: ['requireUser', 'assertSession', '@/lib/auth#verifySession'],
                wrappers: ['withAuth', 'authedAction'],
                validators: ['zod', 'valibot'],
                dal: ['src/data/**', 'src/server/db/**'],
                dataLayer: ['@/db', 'drizzle-orm', '@prisma/client'],
            },
        },
    },
];
```

### Legacy config (`.eslintrc`)

```json
{
    "extends": ["plugin:next-security/recommended"],
    "settings": {
        "next-security": {
            "guards": ["requireUser"],
            "dal": ["src/data/**"],
            "dataLayer": ["@/db"]
        }
    }
}
```

Two configs ship, each in a flat and a legacy form:

| Flat               | Legacy        | Severity                               | Notes                                                  |
| ------------------ | ------------- | -------------------------------------- | ------------------------------------------------------ |
| `flat/recommended` | `recommended` | `warn`, except the DAL rule as `error` | what to start from                                     |
| `flat/strict`      | `strict`      | `error`                                | also turns on the type-aware and guard-ordering checks |

`recommended` warns on purpose. A security plugin that fails the build on day two gets deleted on day three; a warning stops new holes without blocking a backlog you have not read yet. The one exception is `no-data-layer-outside-dal`, which is a structural check — a module specifier against a file path — with nothing to be wrong about.

`strict` raises everything to `error` and adds `{ typed: true }` to `no-raw-formdata-to-db` (real `FormData` types off the TypeScript checker, so it needs a type-aware parser) and `{ requireGuardFirst: true }` to `require-auth-guard`.

### Settings

Every setting is also an option on the rules that read it, so a single file or override can deviate without a second `settings` block. Rule options win over `settings`, which win over the defaults.

| Setting      | Read by                                                                          | Meaning                                                  |
| ------------ | -------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `guards`     | `require-auth-guard`                                                             | functions that prove the caller is authorized            |
| `wrappers`   | `require-auth-guard`                                                             | higher-order functions that authorize whatever they wrap |
| `validators` | `require-input-validation`                                                       | schema libraries whose calls count as validation         |
| `dal`        | `no-data-layer-outside-dal`                                                      | globs for the files allowed to import the data layer     |
| `dataLayer`  | `no-data-layer-outside-dal`, `no-raw-formdata-to-db`, `require-input-validation` | module specifiers that reach the database                |

A guard or validator name matches wherever it comes from (`requireUser`), or you can pin it to a module: `@/lib/auth#verifySession` matches only when the local name is imported from `@/lib/auth`, including through `import * as auth`. `@/lib/auth#*` accepts any export of it.

## Rules

<!-- begin auto-generated rules list -->

💼 [Configurations](https://github.com/PavelLazarchuk/eslint-plugin-next-security#setup) enabled in.\
⚠️ [Configurations](https://github.com/PavelLazarchuk/eslint-plugin-next-security#setup) set to warn in.\
✅ Set in the `recommended` [configuration](https://github.com/PavelLazarchuk/eslint-plugin-next-security#setup).

| Name                                                                       | Description                                                                  | 💼  | ⚠️  |
| :------------------------------------------------------------------------- | :--------------------------------------------------------------------------- | :-- | :-- |
| [no-data-layer-outside-dal](docs/rules/no-data-layer-outside-dal.md)       | Disallow importing the data layer outside the data access layer              | ✅  |     |
| [no-raw-formdata-to-db](docs/rules/no-raw-formdata-to-db.md)               | Disallow passing raw FormData values into data layer calls                   |     | ✅  |
| [no-sync-server-action-export](docs/rules/no-sync-server-action-export.md) | Require every export of a `use server` module to be async                    |     | ✅  |
| [require-auth-guard](docs/rules/require-auth-guard.md)                     | Require an authorization guard in every Server Action                        |     | ✅  |
| [require-input-validation](docs/rules/require-input-validation.md)         | Require Server Action input to be validated before it reaches the data layer |     | ✅  |

<!-- end auto-generated rules list -->

## What gets caught, and what does not

| Caught                                                                    | Not caught                                                       |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| exports of a `'use server'` module, wrappers unwrapped                    | an action re-exported from another module (`export { a } from`)  |
| inline `'use server'` functions, named or anonymous, passed into JSX      | a guard reached through a helper the rule cannot follow          |
| a guard call anywhere in the action, or a configured wrapper around it    | authorization done in middleware                                 |
| `import`, `export … from`, `export *` and dynamic `import()` of the DB    | a specifier spelled differently (`../../db` vs `@/db`)           |
| request input through assignments, literals, template strings, `??`, `?:` | a value that leaves the action through a function call           |
| `FormData` by type (`typed: true`), by parameter name, or by `.get()` use | a differently named untyped parameter with no `FormData` calls   |
| a validator call before the first data layer call in the action           | whether the schema actually covers the fields that reach the row |

Two limits are deliberate rather than unfinished:

**Taint analysis is intraprocedural.** It follows a value inside one function, through `sourceCode.getScope()` and its references, and stops as soon as the value is handed to another function. Cross-function analysis in ESLint means resolving imports and building a call graph on every lint run — slow in CI, unstable in the editor. This plugin under-reports instead.

**Guards are configured, never guessed.** No rule looks for a name matching `/auth|session/`. `require-auth-guard` reports once, at the top of any file that declares an action, until `guards` or `wrappers` is set — silence would be worse, because the plugin would look like it was protecting you.

## Rule docs

Every message points at a rule page under [`docs/rules`](./docs/rules), and each page ends with a "when it can be wrong" section naming the settings that fix it. If a rule argues with your codebase, that section is where to look before turning it off.

## Scope

There is no autofix. Every finding here is a decision — which guard, which schema, which fields belong in the row — and a plugin guessing at that would write code that looks reviewed and is not.

Next.js changes the Server Actions surface faster than heuristics can be calibrated. The action detector is the part most exposed to that; it is deliberately kept to one place ([`src/utils/server-actions.ts`](./src/utils/server-actions.ts)) so that a version bump is a small change rather than a rewrite of five rules.

## License

MIT © [Pavel Lazarchuk](https://github.com/PavelLazarchuk)
