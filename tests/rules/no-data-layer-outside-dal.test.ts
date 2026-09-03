import rule from '../../src/rules/no-data-layer-outside-dal';
import { ruleTester } from '../ruleTester';

const settings = {
    'next-security': {
        dal: ['src/data/**', 'src/server/db/**'],
        dataLayer: ['@/db', 'drizzle-orm', '@prisma/client'],
    },
};

const dal = 'src/data/**, src/server/db/**';

ruleTester.run('no-data-layer-outside-dal', rule, {
    valid: [
        // Inside the DAL, importing the data layer is the point.
        {
            code: `import { db } from '@/db';`,
            filename: 'src/data/users.ts',
            settings,
        },
        {
            code: `import { eq } from 'drizzle-orm';`,
            filename: 'src/server/db/queries/users.ts',
            settings,
        },
        // Outside the DAL, other imports are none of this rule's business.
        {
            code: `import { getUser } from '@/data/users';`,
            filename: 'src/app/page.tsx',
            settings,
        },
        // A package whose name only starts like a data-layer entry.
        {
            code: `import x from 'drizzle-orm-extras';`,
            filename: 'src/app/page.tsx',
            settings,
        },
        // Unconfigured: the rule has nothing to compare against.
        { code: `import { db } from '@/db';`, filename: 'src/app/page.tsx' },
        {
            code: `import { db } from '@/db';`,
            filename: 'src/app/page.tsx',
            settings: { 'next-security': { dataLayer: ['@/db'] } },
        },
        // No real file — nothing to match a glob against.
        { code: `import { db } from '@/db';`, settings },
        {
            code: `import type { User } from '@/db';`,
            filename: 'src/app/page.tsx',
            settings,
        },
        {
            code: `import { type User, type Post } from '@/db';`,
            filename: 'src/app/page.tsx',
            settings,
        },
        {
            code: `export type { User } from '@/db';`,
            filename: 'src/app/page.tsx',
            settings,
        },
    ],
    invalid: [
        {
            code: `import { db } from '@/db';`,
            filename: 'src/app/page.tsx',
            settings,
            errors: [{ messageId: 'importOutsideDal', data: { source: '@/db', dal }, column: 20 }],
        },
        // Subpaths of a configured package count.
        {
            code: `import { PrismaClient } from '@prisma/client/edge';`,
            filename: 'src/app/actions.ts',
            settings,
            errors: [
                {
                    messageId: 'importOutsideDal',
                    data: { source: '@prisma/client/edge', dal },
                },
            ],
        },
        // Dynamic imports and re-exports reach the database just as well.
        {
            code: `const { db } = await import('@/db');`,
            filename: 'src/app/page.tsx',
            settings,
            errors: [{ messageId: 'importOutsideDal' }],
        },
        {
            code: `export { db } from '@/db';`,
            filename: 'src/app/page.tsx',
            settings,
            errors: [{ messageId: 'importOutsideDal' }],
        },
        {
            code: `import { db, type User } from '@/db';`,
            filename: 'src/app/page.tsx',
            settings,
            errors: [{ messageId: 'importOutsideDal' }],
        },
        {
            code: `import '@/db';`,
            filename: 'src/app/page.tsx',
            settings,
            errors: [{ messageId: 'importOutsideDal' }],
        },
        {
            code: `export * from 'drizzle-orm';`,
            filename: 'src/app/page.tsx',
            settings,
            errors: [{ messageId: 'importOutsideDal' }],
        },
        // A rule option overrides the shared settings.
        {
            code: `import { db } from '@/db';`,
            filename: 'src/data/users.ts',
            settings,
            options: [{ dal: ['src/server/db/**'] }],
            errors: [
                {
                    messageId: 'importOutsideDal',
                    data: { source: '@/db', dal: 'src/server/db/**' },
                },
            ],
        },
    ],
});
