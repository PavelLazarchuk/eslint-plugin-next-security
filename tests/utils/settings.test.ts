import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, readSettings } from '../../src/utils/settings';

describe('readSettings', () => {
    it('falls back to the defaults', () => {
        expect(readSettings(undefined, undefined)).toEqual(DEFAULT_SETTINGS);
        expect(readSettings({}, {})).toEqual(DEFAULT_SETTINGS);
    });

    it('lets shared settings win over the defaults', () => {
        const resolved = readSettings({ 'next-security': { guards: ['requireUser'] } }, undefined);

        expect(resolved.guards).toEqual(['requireUser']);
        expect(resolved.validators).toEqual(DEFAULT_SETTINGS.validators);
    });

    it('lets rule options win over shared settings', () => {
        const resolved = readSettings(
            { 'next-security': { guards: ['requireUser'], dal: ['src/data/**'] } },
            { guards: ['assertSession'] }
        );

        expect(resolved.guards).toEqual(['assertSession']);
        expect(resolved.dal).toEqual(['src/data/**']);
    });

    it('keeps rule-specific defaults alongside the shared ones', () => {
        expect(readSettings({}, undefined, { typed: false }).typed).toBe(false);
        expect(readSettings({}, { typed: true }, { typed: false }).typed).toBe(true);
    });

    it('drops entries that are not strings', () => {
        const resolved = readSettings(
            { 'next-security': { guards: ['requireUser', 7, null], dal: 'src/data/**' } },
            undefined
        );

        expect(resolved.guards).toEqual(['requireUser']);
        expect(resolved.dal).toEqual([]);
    });
});
