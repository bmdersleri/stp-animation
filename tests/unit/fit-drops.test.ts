import { describe, expect, it } from 'vitest';
import { fitDrops, type Birakilabilir } from '../../src/core/plot/fit-drops';

/** A piece of `h` px that can be hidden. */
const parca = (h: number) => {
  const p = { h, gizli: false, hide() { if (p.gizli) return false; p.gizli = true; return true; }, show() { p.gizli = false; } };
  return p;
};
const toplam = (ps: { h: number; gizli: boolean }[]) => ps.reduce((t, p) => t + (p.gizli ? 0 : p.h), 0);

describe('fitDrops', () => {
  it('hides nothing when everything fits', () => {
    const ps = [parca(50), parca(50)];
    fitDrops(ps as Birakilabilir[], () => toplam(ps) <= 200, () => {});
    expect(ps.map((p) => p.gizli)).toEqual([false, false]);
  });

  it('hides in order until it fits', () => {
    const ps = [parca(100), parca(100), parca(100)];
    fitDrops(ps as Birakilabilir[], () => toplam(ps) <= 150, () => {});
    expect(ps.map((p) => p.gizli)).toEqual([true, true, false]);
  });

  it('puts back an early piece that fits once a later bigger one went', () => {
    const ps = [parca(20), parca(200)];
    fitDrops(ps as Birakilabilir[], () => toplam(ps) <= 100, () => {});
    expect(ps.map((p) => p.gizli)).toEqual([false, true]);
  });

  it('calls apply after every change', () => {
    const ps = [parca(100), parca(100)];
    const log: string[] = [];
    fitDrops(ps as Birakilabilir[], () => { log.push('fits'); return toplam(ps) <= 100; }, () => { log.push('apply'); });
    // hide the first piece, apply, measure; on the way back show it, apply, measure, hide it again, apply
    expect(log).toEqual(['fits', 'apply', 'fits', 'apply', 'fits', 'apply']);
    expect(log.filter((e) => e === 'apply')).toHaveLength(3);
    expect(ps.map((p) => p.gizli)).toEqual([true, false]);
  });
});
