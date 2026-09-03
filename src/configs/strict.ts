import type { Linter } from 'eslint';
import { RECOMMENDED_SEVERITIES } from './recommended';

export const STRICT_SEVERITIES: Record<string, Linter.StringSeverity> = Object.fromEntries(
    Object.keys(RECOMMENDED_SEVERITIES).map(name => [name, 'error'])
);

export const STRICT_OPTIONS: Record<string, unknown[]> = {
    'no-raw-formdata-to-db': [{ typed: true }],
    'require-auth-guard': [{ requireGuardFirst: true }],
};
