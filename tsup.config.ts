import { readFileSync } from 'node:fs';
import { defineConfig } from 'tsup';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

export default defineConfig({
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    target: 'node20',
    platform: 'node',
    dts: true,
    clean: true,
    treeshake: true,
    define: { __PLUGIN_VERSION__: JSON.stringify(version) },
    external: ['eslint', 'minimatch'],
});
