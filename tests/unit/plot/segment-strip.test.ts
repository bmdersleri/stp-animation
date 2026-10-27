// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { farkIndeksleri, SegmentStrip } from '../../../src/core/plot/segment-strip';

const make = (): { host: HTMLElement; s: SegmentStrip } => {
  const host = document.createElement('div');
  document.body.append(host);
  return { host, s: new SegmentStrip(host) };
};

describe('SegmentStrip', () => {
  it('farkIndeksleri lists differing indices', () => {
    expect(farkIndeksleri('abc', 'abd')).toEqual([2]);
    expect(farkIndeksleri('abcd', 'ab')).toEqual([2, 3]);
    expect(farkIndeksleri('ab', 'ab')).toEqual([]);
  });

  it('fark chars get .fark class', () => {
    const { host, s } = make();
    s.update({ parcalar: [{ metin: 'abcd', fark: [1, 3], etiket: 'imza', ton: 2 }] });
    const farklar = [...host.querySelectorAll('.parca-metin .fark')].map((e) => e.textContent);
    expect(farklar).toEqual(['b', 'd']);
    expect(host.querySelector('.parca-metin')!.textContent).toBe('abcd');
    expect(host.querySelector('.parca-etiket')!.textContent).toBe('imza');
    expect(host.querySelector('.parca')!.classList.contains('ton-2')).toBe(true);
  });

  it('kisalt shows prefix and ellipsis, full text in title', () => {
    const { host, s } = make();
    s.update({ parcalar: [{ metin: '0123456789abcdef', kisalt: 6 }] });
    const m = host.querySelector<HTMLElement>('.parca-metin')!;
    expect(m.textContent).toBe('012345…');
    expect(m.title).toBe('0123456789abcdef');
  });

  it('ayirici renders between parts', () => {
    const { host, s } = make();
    s.update({ baslik: 'JWT', parcalar: [{ metin: 'a' }, { metin: 'b' }, { metin: 'c' }], ayirici: '.' });
    expect(host.querySelector('.segment-strip-title')!.textContent).toBe('JWT');
    expect(host.querySelectorAll('.parca')).toHaveLength(3);
    expect(host.querySelectorAll('.ayirici')).toHaveLength(2);
    s.update({ parcalar: [{ metin: 'a' }] });
    expect(host.querySelectorAll('.parca')).toHaveLength(1);
    s.destroy();
    expect(host.querySelector('.segment-strip')).toBeNull();
  });
});
