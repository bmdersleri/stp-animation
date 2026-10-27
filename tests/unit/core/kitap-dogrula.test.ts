import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { karsilastir } from '../../../scripts/kitap-dogrula-lib.mjs';
import type { Listing } from '../../../src/core/listing';

const l = (lines: string[], first = 3): Listing => ({
  id: 'x',
  title: 'X',
  bolum: 'b00',
  satirlar: [first, first + lines.length - 1],
  lines,
});
const kitap = ['bir', 'iki', 'a', 'b', 'c', 'son'];

describe('kitap-dogrula karsilastir', () => {
  it('equal ranges give null', () => {
    expect(karsilastir(kitap, l(['a', 'b', 'c']))).toBeNull();
  });

  it('first differing line is reported with its book line number', () => {
    expect(karsilastir(kitap, l(['a', 'X', 'c']))).toEqual({ satir: 4, beklenen: 'X', bulunan: 'b' });
  });

  it('trailing spaces are ignored', () => {
    expect(karsilastir(['a  ', 'b'], l(['a', 'b  '], 1))).toBeNull();
  });

  it('a short book range is a difference', () => {
    expect(karsilastir(['a', 'b'], l(['a', 'b', 'c'], 1))).toEqual({ satir: 3, beklenen: 'c', bulunan: '' });
  });

  it('missing book dir exits 0 with the skip line', () => {
    const r = spawnSync(process.execPath, ['--disable-warning=ExperimentalWarning', 'scripts/kitap-dogrula.mjs'], {
      env: { ...process.env, KITAP_DIZINI: 'C:/yok' },
      encoding: 'utf8',
    });
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('kitap bulunamadı, atlandı');
  });
});
