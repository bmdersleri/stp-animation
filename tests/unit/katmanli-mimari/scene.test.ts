// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { deriveKatmanView } from '../../../src/concepts/katmanli-mimari/view';
import { LISTINGS } from '../../../src/concepts/katmanli-mimari/code-text';
import { go, setup, texts } from './harness';

const stepBadges = (el: HTMLElement): HTMLElement[] => [...el.querySelectorAll<HTMLElement>('.rozet-yeri .kaynak-rozeti')];

describe('katmanli-mimari scene', () => {
  it('step 6 shows changed cells', () => {
    const { el, player } = setup();
    go(player, 'yan-etki');
    const kitap = el.querySelector('.tablo-kitaplar .data-table tr.satir-degisti')!;
    expect(kitap.querySelector('td.degisti')!.textContent).toBe('false');
    const ogrenci = el.querySelector('.tablo-ogrenciler .data-table tr.satir-degisti')!;
    expect(ogrenci.querySelector('td.degisti')!.textContent).toBe('1');
  });

  it('step 8 shows the alarm arrow and 400', () => {
    const { el, player } = setup();
    go(player, 'ikinci-istek');
    expect(el.querySelectorAll('g.seq-msg.alarm, g.seq-msg .alarm').length).toBeGreaterThan(0);
    expect(texts(el, '.yanit-karti .yanit .durum-kodu')).toEqual(['201', '400']);
    expect(texts(el, '.yanit-karti .sira')).toEqual(['#1', '#2']);
  });

  it('step 10 shows the lifecycle table with faded rows', () => {
    const { el, player } = setup();
    go(player, 'yasam-dongusu');
    expect(el.querySelectorAll('.tablo-buyuk .data-table tbody tr')).toHaveLength(11);
    expect(el.querySelectorAll('.tablo-buyuk .data-table tr.satir-soluk')).toHaveLength(3);
    expect(el.querySelector<HTMLElement>('.yanit-karti')!.hidden).toBe(true);
    expect(el.querySelector<HTMLElement>('.tablo-kitaplar')!.hidden).toBe(true);
    // the diagram shows the whole successful trace, faded
    const iz = deriveKatmanView({ ...player.state.params, gorunum: 'akis', olay: 999, tekrar: 1 }).sequence.messages.length;
    expect(el.querySelectorAll('g.seq-msg')).toHaveLength(iz);
    expect(el.querySelector('.katman-diagram')!.hasAttribute('data-soluk')).toBe(true);
    go(player, 'okuma');
    expect(el.querySelector('.katman-diagram')!.hasAttribute('data-soluk')).toBe(false);
  });

  it('resize twice keeps five lanes', () => {
    const { el, scene, player } = setup();
    go(player, 'yan-etki');
    scene.resize(500, 700);
    scene.resize(1280, 540);
    expect(el.querySelectorAll('g.seq-lane')).toHaveLength(5);
    expect(el.querySelectorAll('svg.plot')).toHaveLength(1);
  });

  it('rapid step jumps leave no duplicates', () => {
    const { el, player } = setup();
    for (const i of [10, 0, 10, 5]) player.goto(i);
    expect(el.querySelectorAll('g.seq-lane')).toHaveLength(5);
    const v = deriveKatmanView(player.state.params);
    expect(el.querySelectorAll('g.seq-msg')).toHaveLength(v.sequence.messages.length);
    expect(el.querySelectorAll('.tablo-kitaplar .data-table tbody tr')).toHaveLength(v.kitaplar.satirlar.length);
    expect(el.querySelectorAll('.seq-token').length).toBeLessThanOrEqual(1);
  });

  it('ders mode shows the code strip, lab mode the full listing', () => {
    const ders = setup(1280, 540, 'ders');
    go(ders.player, 'yan-etki');
    const strip = ders.el.querySelector<HTMLElement>('.code-strip')!;
    expect(strip.hidden).toBe(false);
    const n = strip.querySelectorAll('li').length;
    expect(n).toBeGreaterThan(0);
    expect(n).toBeLessThanOrEqual(5);
    expect(strip.querySelectorAll('li.active').length).toBeGreaterThan(0);

    const lab = setup(1280, 540, 'lab');
    go(lab.player, 'yan-etki');
    expect(lab.el.querySelector<HTMLElement>('.code-strip')!.hidden).toBe(true);
    const kod = LISTINGS.find((l) => l.id === 'kod-9-5')!;
    expect(lab.extra.querySelectorAll('.code-trace li')).toHaveLength(kod.lines.length);
    expect(lab.extra.querySelectorAll('.code-trace li.active').length).toBeGreaterThan(0);
  });

  it('ders strip windows around the line that decides the response', () => {
    const { el, player } = setup();
    go(player, 'ikinci-istek');
    const aktif = [...el.querySelectorAll('.code-strip li.active')].map((l) => l.textContent ?? '').join(' | ');
    expect(aktif).toContain('throw new Error("Kitap uygun değildir.")');
  });

  it('badge follows a lab change and returns on step change', () => {
    const { el, player } = setup();
    go(player, 'yanit-201');
    expect(stepBadges(el)[0].classList.contains('kaynak-kitap')).toBe(true);
    player.setParam('mevcutOduncSayisi', 2);
    expect(stepBadges(el)).toHaveLength(1);
    expect(stepBadges(el)[0].classList.contains('kaynak-kitap-kodu')).toBe(true);
    player.next();
    expect(stepBadges(el)).toHaveLength(1);
    expect(stepBadges(el)[0].classList.contains('kaynak-kitap-kodu')).toBe(true);
    expect(el.querySelectorAll('.kaynak-rozeti')).toHaveLength(1);
    player.goto(0);
    expect(stepBadges(el)[0].classList.contains('kaynak-kitap')).toBe(true);
  });
});
