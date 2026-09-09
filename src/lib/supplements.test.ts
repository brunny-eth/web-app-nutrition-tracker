import { describe, it, expect } from 'vitest';
import { supplementFiberBonus } from './supplements';

const psyllium = { id: 'psyllium', name: 'Psyllium husk', fiber_g: 5 };
const creatine = { id: 'creatine', name: 'Creatine' };

describe('supplementFiberBonus', () => {
  it('credits the configured fiber for a ticked supplement', () => {
    expect(supplementFiberBonus([psyllium, creatine], ['psyllium'])).toBe(5);
  });

  it('credits nothing for one that was not ticked', () => {
    expect(supplementFiberBonus([psyllium, creatine], ['creatine'])).toBe(0);
  });

  it('reads the dose from config rather than a hardcoded amount', () => {
    // Doubling the dose is a settings edit, not a deploy.
    expect(supplementFiberBonus([{ ...psyllium, fiber_g: 10 }], ['psyllium'])).toBe(10);
  });

  it('sums across several fiber-bearing supplements', () => {
    const glucomannan = { id: 'glucomannan', name: 'Glucomannan', fiber_g: 3 };
    expect(
      supplementFiberBonus([psyllium, glucomannan, creatine], ['psyllium', 'glucomannan', 'creatine'])
    ).toBe(8);
  });

  it('treats a supplement with no fiber configured as none', () => {
    expect(supplementFiberBonus([creatine], ['creatine'])).toBe(0);
    expect(supplementFiberBonus([{ ...creatine, fiber_g: null }], ['creatine'])).toBe(0);
  });

  it('ignores a tick for a supplement no longer on the list', () => {
    // Checklist rows keep the id of a supplement since deleted.
    expect(supplementFiberBonus([creatine], ['psyllium'])).toBe(0);
  });

  it('handles missing supplements or an empty checklist', () => {
    expect(supplementFiberBonus(undefined, ['psyllium'])).toBe(0);
    expect(supplementFiberBonus([psyllium], null)).toBe(0);
    expect(supplementFiberBonus([psyllium], [])).toBe(0);
  });
});
