// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { deriveSqlView } from '../../../src/concepts/sql-join/view';
import { SQL_ROZET } from '../../../src/concepts/sql-join/scenario';
import { go, setup, texts } from './harness';

const rows = (el: HTMLElement, i: number): number => el.querySelectorAll('.data-table')[i].querySelectorAll('tbody tr').length;

describe('sql-join scene', () => {
  it('step 4 shows the active pair and the condition badge', () => {
    const { el, player } = setup();
    go(player, 'on-kosulu');
    expect(el.querySelectorAll('tr.satir-etkin').length).toBe(2);
    const b = el.querySelector('.kosul-rozeti')!;
    expect(b.classList.contains('dogru')).toBe(true);
    expect(b.textContent).toBe(deriveSqlView(player.state.params).kosul!.metin);
    expect(el.querySelector('.iliski')!.textContent).toContain('yazarlar ||--o{ kitaplar');
  });

  it('step 6 shows a NULL cell', () => {
    const { el, player } = setup();
    go(player, 'left');
    expect(el.querySelectorAll('.data-table td.null').length).toBeGreaterThan(0);
  });

  it('step 8 shows struck-out rows and the second table', () => {
    const { el, player } = setup();
    go(player, 'where-tuzagi');
    expect(el.querySelectorAll('.data-table tr.satir-silindi').length).toBeGreaterThan(0);
    expect(el.querySelectorAll('.data-table').length).toBe(4);
  });

  it('resize twice keeps three tables', () => {
    const { el, player, scene } = setup();
    go(player, 'inner-sonuc');
    scene.resize(1000, 500);
    scene.resize(1280, 540);
    expect(el.querySelectorAll('.data-table').length).toBe(3);
  });

  it('rapid step jumps leave no duplicates', () => {
    const { el, player } = setup();
    for (const id of ['where-tuzagi', 'tanitim', 'where-tuzagi', 'on-kosulu']) go(player, id);
    const v = deriveSqlView(player.state.params);
    expect(rows(el, 0)).toBe(v.yazarlar.satirlar.length);
    expect(rows(el, 1)).toBe(v.kitaplar.satirlar.length);
    expect(rows(el, 2)).toBe(v.sonuc!.satirlar.length);
    expect(el.querySelectorAll('.kaynak-rozeti').length).toBe(1);
  });

  it('ders mode shows the code strip, lab mode the full SQL', () => {
    const ders = setup(1280, 540, 'ders');
    go(ders.player, 'left');
    const full = deriveSqlView(ders.player.state.params).code.lines.length;
    expect((ders.el.querySelector('.code-strip') as HTMLElement).hidden).toBe(false);
    expect(ders.el.querySelectorAll('.code-strip li').length).toBeLessThanOrEqual(7);
    expect(ders.el.querySelector('.code-strip li.active')).not.toBeNull();
    document.body.replaceChildren();
    const lab = setup(1280, 540, 'lab');
    go(lab.player, 'left');
    expect((lab.el.querySelector('.code-strip') as HTMLElement).hidden).toBe(true);
    expect(lab.extra.querySelectorAll('li').length).toBe(full);
  });

  it("step 3 shows the book's 1×1 output in its own box with a book badge; the step badge says new input", () => {
    const { el, player } = setup();
    go(player, 'kartezyen');
    const kutu = el.querySelector<HTMLElement>('.kitap-ciktisi')!;
    expect(kutu.hidden).toBe(false);
    expect(kutu.querySelector('.kitap-ciktisi-satirlar')!.textContent).toBe(['ad_soyad   | kitap_adi', '-------------+------------', ' Yaşar Kemal | İnce Memed', '(1 row)'].join('\n'));
    expect(kutu.querySelector('.kaynak-rozeti')!.textContent).toBe('Kitabın çıktısı · L887-890');
    expect(el.querySelector('.rozet-yeri .kaynak-rozeti')!.textContent).toBe('Kitabın kodu, yeni girdi · L879, L887-890');
    go(player, 'on-kosulu');
    expect(el.querySelector<HTMLElement>('.kitap-ciktisi')!.hidden).toBe(true);
    expect(el.querySelectorAll('.kaynak-rozeti').length).toBe(1);
  });

  it('badge follows a lab change and returns on step change', () => {
    const { el, player } = setup(1280, 540, 'lab');
    go(player, 'inner-sonuc');
    expect(texts(el, '.kaynak-rozeti')[0]).toContain(SQL_ROZET['inner-sonuc'].ref!);
    player.setParams({ sorgu: 'is-null', cift: 999, gorunum: 'sorgu' });
    expect(el.querySelectorAll('.kaynak-rozeti').length).toBe(1);
    expect(texts(el, '.kaynak-rozeti')[0]).toContain('L1936-1938');
    go(player, 'left');
    expect(texts(el, '.kaynak-rozeti')[0]).toContain(SQL_ROZET.left.ref!);
  });
});
