# next-security/no-sync-server-action-export

📝 Require every export of a `use server` module to be async.

⚠️ This rule _warns_ in the ✅ `recommended` [config](https://github.com/PavelLazarchuk/eslint-plugin-next-security#setup).

<!-- end auto-generated rule header -->

Reports an export of a `'use server'` module that is not an `async` function.

Next.js requires every export of a `'use server'` file to be an async function, and fails the build otherwise. This rule does not find anything the compiler will miss — it just says so in the editor, on the line, before the build runs. It is not a security rule and is not sold as one.

```ts
'use server';

/* ✗ incorrect */
export function create(formData: FormData) {}
export const remove = () => {};

/* ✓ correct */
export async function create(formData: FormData) {}
export const remove = async () => {};
```

This rule has no options.

## When it can be wrong

Non-function exports are left alone, even though Next.js rejects those too: a `const` in a `'use server'` file is more often a leftover than a mistake about what an action is, and the build message for it is clear enough.
