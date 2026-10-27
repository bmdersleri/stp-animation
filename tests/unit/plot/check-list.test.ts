// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { CheckList, zincirle, type Denetim } from '../../../src/core/plot/check-list';

const make = (): { host: HTMLElement; c: CheckList } => {
  const host = document.createElement('div');
  document.body.append(host);
  return { host, c: new CheckList(host) };
};

describe('CheckList', () => {
  it('zincirle marks checks after the first failure as atlandi', () => {
    const d: Denetim[] = [
      { ad: 'a', durum: 'gecti' },
      { ad: 'b', durum: 'kaldi' },
      { ad: 'c', durum: 'gecti' },
      { ad: 'd', durum: 'bekliyor' },
    ];
    expect(zincirle(d).map((x) => x.durum)).toEqual(['gecti', 'kaldi', 'atlandi', 'atlandi']);
    expect(d[2]!.durum).toBe('gecti');
  });

  it('renders sonuc badge and denenmedi text', () => {
    const { host, c } = make();
    c.update({
      baslik: 'Denetimler',
      denetimler: [
        { ad: 'imza', durum: 'gecti', ayrinti: 'eşleşti', sonuc: '200' },
        { ad: 'süre', durum: 'atlandi' },
      ],
    });
    expect(host.querySelector('.check-list-title')!.textContent).toBe('Denetimler');
    const rows = host.querySelectorAll('.denetim');
    expect(rows).toHaveLength(2);
    expect(rows[0]!.querySelector('.denetim-sonuc')!.textContent).toBe('200');
    expect(rows[0]!.querySelector('.denetim-ayrinti')!.textContent).toBe('eşleşti');
    expect(rows[1]!.textContent).toContain('denenmedi');
  });

  it('kaldi row has alarm class', () => {
    const { host, c } = make();
    c.update({ baslik: 'x', denetimler: [{ ad: 'imza', durum: 'kaldi' }] });
    expect(host.querySelector('.denetim')!.classList.contains('denetim-kaldi')).toBe(true);
    c.update({ baslik: 'x', denetimler: [{ ad: 'imza', durum: 'gecti' }] });
    expect(host.querySelectorAll('.denetim')).toHaveLength(1);
    expect(host.querySelector('.denetim')!.classList.contains('denetim-kaldi')).toBe(false);
    c.destroy();
    expect(host.querySelector('.check-list')).toBeNull();
  });
});
