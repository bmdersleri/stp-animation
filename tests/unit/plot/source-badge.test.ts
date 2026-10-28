// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { sourceBadge } from '../../../src/core/plot/source-badge';

describe('sourceBadge', () => {
  it('has the text and class of each kind', () => {
    const k = sourceBadge(document, 'kitap');
    expect(k.className).toBe('kaynak-rozeti kaynak-kitap');
    expect(k.textContent).toBe('Kitabın çıktısı');
    const c = sourceBadge(document, 'kitap-kodu');
    expect(c.className).toBe('kaynak-rozeti kaynak-kitap-kodu');
    expect(c.textContent).toBe('Kitabın kodu, yeni girdi');
    const d = sourceBadge(document, 'kitaba-dayali');
    expect(d.className).toBe('kaynak-rozeti kaynak-kitaba-dayali');
    expect(d.textContent).toBe('Kitabın cümlesine dayalı örnek');
    for (const b of [k, c, d]) expect(b.title.length).toBeGreaterThan(10);
  });

  it('standart badge text and class', () => {
    const s = sourceBadge(document, 'standart');
    expect(s.className).toBe('kaynak-rozeti kaynak-standart');
    expect(s.textContent).toBe('Standarttan · kitapta kodu yok');
    expect(s.title).toBe('Bu davranış kitabın kodunda yok; tarayıcı ya da paket standardından gelir.');
  });

  it('ref appended after a middle dot', () => {
    expect(sourceBadge(document, 'kitap', 'Kod 6.1').textContent).toBe('Kitabın çıktısı · Kod 6.1');
  });
});
