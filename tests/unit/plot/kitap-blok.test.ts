// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { KitapBlokView, type KitapBlok } from '../../../src/core/plot/kitap-blok';

const tablo = {
  baslik: 'Alternatifler',
  sutunlar: [{ ad: 'Yaklaşım' }, { ad: 'Avantajı' }],
  satirlar: [{ key: 'a', cells: ['Redis', 'Paylaşımlı sayaç'] }],
};
const blok: KitapBlok = { tanim: 'Bir tanım.', paragraflar: ['Birinci.', 'İkinci.'], tablolar: [tablo], notlar: ['Bir not.'] };

function kur(): { host: HTMLElement; view: KitapBlokView } {
  const host = document.createElement('div');
  document.body.append(host);
  return { host, view: new KitapBlokView(host) };
}

describe('KitapBlokView', () => {
  it('renders definition, paragraphs, tables and notes in order', () => {
    const { view } = kur();
    view.update(blok);
    const siniflar = [...view.root.children].map((c) => (c.classList.contains('data-table') ? 'data-table' : c.className));
    expect(siniflar).toEqual(['tanim-metin', 'kitap-paragraf', 'kitap-paragraf', 'data-table', 'kitap-not']);
    const tanim = view.root.querySelector('.tanim-metin')!;
    expect(tanim.textContent!.startsWith('Tanım. ')).toBe(true);
    expect(tanim.querySelector('strong')!.textContent).toBe('Tanım. ');
  });

  it('update with null empties the block and destroys its tables', () => {
    const { view } = kur();
    view.update(blok);
    view.update(null);
    expect(view.root.children.length).toBe(0);
    expect(view.root.querySelector('.data-table')).toBeNull();
  });

  it('repeated updates leave one set of children', () => {
    const { view } = kur();
    for (let i = 0; i < 3; i++) view.update(blok);
    expect(view.root.querySelectorAll('.data-table').length).toBe(1);
    expect(view.root.children.length).toBe(5);
  });

  it('destroy removes the root', () => {
    const { host, view } = kur();
    view.update(blok);
    view.destroy();
    expect(host.contains(view.root)).toBe(false);
    expect(host.children.length).toBe(0);
  });

  it('block without tanim has no tanim-metin', () => {
    const { view } = kur();
    view.update({ tablolar: [], notlar: ['x'] });
    expect(view.root.querySelector('.tanim-metin')).toBeNull();
    expect(view.root.querySelectorAll('.kitap-not').length).toBe(1);
  });
});
