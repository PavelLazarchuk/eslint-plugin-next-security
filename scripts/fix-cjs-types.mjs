import { readFileSync, writeFileSync } from 'node:fs';

const path = new URL('../dist/index.d.cts', import.meta.url);
const source = readFileSync(path, 'utf8');
const pattern = /export\s*\{\s*plugin as default\s*\};?/;

if (!pattern.test(source)) {
    console.error('fix-cjs-types: expected a `export { plugin as default }` in dist/index.d.cts.');
    process.exit(1);
}

writeFileSync(path, source.replace(pattern, 'export = plugin;'));
