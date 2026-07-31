import { describe, it, expect } from 'vitest';
import { FALLBACK_ACTIVITY_MULTIPLIER, resolveActivityMultiplier } from './tdee';

describe('resolveActivityMultiplier', () => {
  it('prefers the stored continuous estimate', () => {
    expect(resolveActivityMultiplier({ multiplier: 1.68, activity_level_id: null })).toBe(1.68);
  });

  it('reads the stored multiplier when the legacy level is null, which was the bug', () => {
    // Newer rows leave activity_level_id null; reading only that column scored
    // every such day as moderate and understated the deficit. Asserted positively —
    // this used to be `not.toBe(FALLBACK)`, which would also pass on 0 or NaN.
    const row = { multiplier: 1.72, activity_level_id: null };

    expect(resolveActivityMultiplier(row)).toBe(1.72);
    expect(resolveActivityMultiplier(row)).not.toBe(FALLBACK_ACTIVITY_MULTIPLIER);
  });

  it('maps a legacy activity level to its multiplier', () => {
    expect(resolveActivityMultiplier({ multiplier: null, activity_level_id: 1 })).toBe(1.2);
    expect(resolveActivityMultiplier({ multiplier: null, activity_level_id: 5 })).toBe(1.9);
  });

  it('ignores the legacy level when both are present', () => {
    expect(resolveActivityMultiplier({ multiplier: 1.4, activity_level_id: 5 })).toBe(1.4);
  });

  it('falls back to moderate for a missing, empty, or unknown row', () => {
    expect(resolveActivityMultiplier(undefined)).toBe(FALLBACK_ACTIVITY_MULTIPLIER);
    expect(resolveActivityMultiplier(null)).toBe(FALLBACK_ACTIVITY_MULTIPLIER);
    expect(resolveActivityMultiplier({})).toBe(FALLBACK_ACTIVITY_MULTIPLIER);
    expect(resolveActivityMultiplier({ activity_level_id: 99 })).toBe(FALLBACK_ACTIVITY_MULTIPLIER);
  });
});
