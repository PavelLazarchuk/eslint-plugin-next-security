import type { ESLint } from 'eslint';
import requireAuthGuard from './rules/require-auth-guard';
import noDataLayerOutsideDal from './rules/no-data-layer-outside-dal';
import noSyncServerActionExport from './rules/no-sync-server-action-export';
import noRawFormdataToDb from './rules/no-raw-formdata-to-db';
import requireInputValidation from './rules/require-input-validation';
import { flatConfigs, legacyConfigs } from './configs';

declare const __PLUGIN_VERSION__: string;

const plugin: ESLint.Plugin = {
    meta: { name: 'eslint-plugin-next-security', version: __PLUGIN_VERSION__ },
    rules: {
        'require-auth-guard': requireAuthGuard,
        'no-data-layer-outside-dal': noDataLayerOutsideDal,
        'no-sync-server-action-export': noSyncServerActionExport,
        'no-raw-formdata-to-db': noRawFormdataToDb,
        'require-input-validation': requireInputValidation,
    },
};

plugin.configs = { ...legacyConfigs(), ...flatConfigs(plugin) };

export default plugin;
