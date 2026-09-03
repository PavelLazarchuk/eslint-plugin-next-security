# next-security/require-auth-guard

📝 Require an authorization guard in every Server Action.

⚠️ This rule _warns_ in the ✅ `recommended` [config](https://github.com/PavelLazarchuk/eslint-plugin-next-security#setup).

<!-- end auto-generated rule header -->

Reports a Server Action that does its work without asking who is calling.

A Server Action is a public HTTP endpoint. Next.js gives it an ID and mounts it; anyone who can read the client bundle can POST to it, with any arguments, from anywhere. Nothing about the file it lives in or the component that renders it restricts that. So authorization has to happen inside the action, every time — the check on the page that renders the form protects the page, not the action.

The rule sees both shapes an action comes in:

```ts
/* src/app/actions.ts */
'use server';

/* ✗ incorrect — a public endpoint that deletes a row for whoever asks */
export async function deleteUser(formData: FormData) {
    await db.delete(users).where(eq(users.id, formData.get('id')));
}

/* ✓ correct */
export async function deleteUser(formData: FormData) {
    await requireUser();
    await db.delete(users).where(eq(users.id, formData.get('id')));
}
```

```tsx
/* An inline action in a Server Component is an endpoint too, and this one is unguarded. */
export default function Page() {
    /* ✗ incorrect */
    async function remove(formData: FormData) {
        'use server';
        await db.delete(users).where(eq(users.id, formData.get('id')));
    }
    return <form action={remove} />;
}
```

A guard inside a wrapper counts, which is how most codebases actually write this:

```ts
/* ✓ correct — with { wrappers: ['withAuth'] } */
export const deleteUser = withAuth(async (formData: FormData) => { ... });
```

## Options

| Option              | Type       | Default |
| ------------------- | ---------- | ------- |
| `guards`            | `string[]` | `[]`    |
| `wrappers`          | `string[]` | `[]`    |
| `requireGuardFirst` | `boolean`  | `false` |
| `ignoreNames`       | `string[]` | `[]`    |

`guards` and `wrappers` are normally set once in `settings['next-security']`; the options are here for the file or rule that needs to deviate.

**Without `guards` or `wrappers` the rule does not run.** It reports once per file, at the top, saying so. There is no regex heuristic looking for something that smells like `auth` — a guard is a decision about your codebase, and a rule that guesses at it either misses real holes or cries wolf until someone turns it off.

A name matches wherever it comes from (`requireUser`), or you can pin it to a module:

```js
{
    guards: ['requireUser', '@/lib/auth#verifySession', '@/lib/auth#*'],
}
```

`module#name` matches only when the local name is imported from that module — including through a namespace import (`import * as auth`, then `auth.verifySession()`). `module#*` accepts any export of it.

`requireGuardFirst` additionally reports a guard that runs after other work, so an action cannot query the database and then check permissions. Reading the action's own parameters (`formData.get(...)`) and `console` calls are not counted as work. It is off by default: the ordering heuristic is the part most likely to argue with a codebase that reads a request ID or opens a transaction before authorizing.

`ignoreNames` excuses actions by name — for a genuinely public endpoint such as a health check.

## When it can be wrong

- **A guard reached through a helper of your own.** `await checkAccess()`, where `checkAccess` calls `requireUser`, is not seen: the rule does not follow calls into other functions. Add the helper to `guards`.
- **Authorization by middleware.** Next.js middleware runs for Server Action requests too, and if your session check lives there the rule still asks for a call inside the action. That is deliberate — middleware is matcher-based and a matcher is easy to get wrong — but if you rely on it, turn the rule off for those files rather than fighting it.
- **A guard in a wrapper you did not list.** Only `wrappers` entries count; any other enclosing call is invisible.
