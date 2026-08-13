import { describe, expect, it } from 'vitest';

import { visibleToUser } from '@/lib/day';

/**
 * Regression tests for the food/exercise visibility filter.
 *
 * A real leak came from this: `visibleToUser` originally returned a bare
 * `{ OR: [...] }`, and the search branch spread it next to its own `OR` for name
 * matching. In JS the second key wins, so the ownership filter vanished and every
 * user's custom foods showed up in everyone's search results.
 *
 * These tests pin the shape that makes that impossible.
 */
describe('visibleToUser', () => {
  it('matches the shared catalogue (userId null) and the user\'s own rows', () => {
    const filter = visibleToUser('user-1');
    const or = filter.AND[0].OR;
    expect(or).toEqual([{ userId: null }, { userId: 'user-1' }]);
  });

  // ★ The actual bug. Spreading the filter beside another OR must not lose it.
  it('survives being spread alongside a caller\'s own OR clause', () => {
    const where = {
      isArchived: false,
      ...visibleToUser('user-1'),
      OR: [{ nameLower: { contains: 'roti' } }, { aliases: { contains: 'roti' } }],
    };

    // Both clauses coexist: ownership under AND, search under OR.
    expect(where.AND).toBeDefined();
    expect(where.AND[0].OR).toEqual([{ userId: null }, { userId: 'user-1' }]);
    expect(where.OR).toHaveLength(2);
  });

  it('is not a bare OR at the top level, which would be clobberable', () => {
    const filter = visibleToUser('user-1') as Record<string, unknown>;
    expect('OR' in filter).toBe(false);
    expect('AND' in filter).toBe(true);
  });

  it('scopes to the id it is given', () => {
    expect(visibleToUser('a').AND[0].OR[1]).toEqual({ userId: 'a' });
    expect(visibleToUser('b').AND[0].OR[1]).toEqual({ userId: 'b' });
  });

  it('never matches another user outright', () => {
    const json = JSON.stringify(visibleToUser('user-1'));
    expect(json).not.toContain('user-2');
  });
});
