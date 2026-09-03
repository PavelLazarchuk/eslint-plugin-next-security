---
'eslint-plugin-next-security': patch
---

Fix false positives and false negatives across the rule set:

- `no-data-layer-outside-dal` no longer reports type-only imports and re-exports (`import type { User } from '@/db'`, `import { type User }`, `export type { … } from '@/db'`); they are erased at build time and never reach the database.
- `require-auth-guard` and `no-sync-server-action-export` now resolve `export default handler` back to its local binding, so an action exported by reference is analysed instead of skipped.
- `no-raw-formdata-to-db` matches the `FormData` name on word boundaries, so a parameter such as `transformData` is no longer treated as form data, while `raw_form_data` now is.
- Type-only import bindings are excluded from callee resolution, so they can no longer stand in for a runtime guard, validator or data-layer call.
- `settings['next-security']` and rule options that are not plain objects are ignored instead of being spread, and the default setting arrays are copied per rule instead of shared.
- AST traversal skips `tokens` and `comments`, and Server Action collection is cached per file, so the three rules that need it walk the tree once instead of three times over every token.
