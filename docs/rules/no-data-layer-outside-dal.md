# next-security/no-data-layer-outside-dal

📝 Disallow importing the data layer outside the data access layer.

💼 This rule is enabled in the ✅ `recommended` [config](https://github.com/PavelLazarchuk/eslint-plugin-next-security#setup).

<!-- end auto-generated rule header -->

Reports an import of the database client from a file that is not part of your data access layer.

A DAL is only a boundary if it cannot be bypassed. One `import { db } from '@/db'` in a page or an action means the authorization and validation that lives in the DAL can be skipped, and nothing in review reliably catches it.

```ts
/* src/app/dashboard/page.tsx — ✗ incorrect */
import { db } from '@/db';

const rows = await db.select().from(users);
```

```ts
/* src/app/dashboard/page.tsx — ✓ correct */
import { listUsers } from '@/data/users';

const rows = await listUsers();
```

This is the only rule in the plugin that reports as an **error** in `recommended`: the check is purely structural — a module specifier against a file path — so it has no heuristics to be wrong about.

## Options

| Option      | Type       | Default |
| ----------- | ---------- | ------- |
| `dal`       | `string[]` | `[]`    |
| `dataLayer` | `string[]` | `[]`    |

Both are normally set in `settings['next-security']`. With either one empty the rule does not run.

```js
{
    dal: ['src/data/**', 'src/server/db/**'],
    dataLayer: ['@/db', 'drizzle-orm', '@prisma/client'],
}
```

`dal` is matched against the linted file's path, normalized to `/` separators and made relative to the working directory. A pattern with no glob syntax is read as a directory prefix, so `src/data` covers `src/data/users.ts`. Parentheses are literal, so a route group such as `src/app/(admin)/data` is a prefix like any other.

`dataLayer` is matched against the module specifier. An entry also covers its subpaths, so `@prisma/client` catches `@prisma/client/edge`, and globs (`@/db/*`) work.

`import`, `export … from`, `export * from` and dynamic `import()` are all checked.

## When it can be wrong

- **Aliases the rule cannot resolve.** Specifiers are matched as written; `@/db` and `../../db` are different strings. List every spelling your codebase uses, or keep one.
- **A file that legitimately sits outside the DAL** — a migration script, a seed, an instrumentation hook. Add it to `dal`, or disable the rule for that path in your ESLint config.
