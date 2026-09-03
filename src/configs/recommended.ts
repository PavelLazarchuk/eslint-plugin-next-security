import type { Linter } from 'eslint';

export const RECOMMENDED_SEVERITIES: Record<string, Linter.StringSeverity> = {
    'require-auth-guard': 'warn',
    'no-data-layer-outside-dal': 'error',
    'no-sync-server-action-export': 'warn',
    'no-raw-formdata-to-db': 'warn',
    'require-input-validation': 'warn',
};
