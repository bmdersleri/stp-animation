// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { deriveRestView } from '../../../src/concepts/rest-crud/view';
import { LISTINGS } from '../../../src/concepts/rest-crud/code-text';
import { go, setup, texts } from './harness';

const badges = (el: HTMLElement): HTMLElement[] => [...el.querySelectorAll<HTMLElement>('.kaynak-rozeti')];
const stepBadges = (el: HTMLElement): HTMLElement[] => [...el.querySelectorAll<HTMLElement>('.rozet-yeri .kaynak-rozeti')];

describe('rest-crud scene', () => {
  it('step 2 shows the new row and the Location header', () => {
    const { el, player } = setup();
    go(player, 'olustur');
    const row = el.querySelector('.data-table tr.satir-yeni')!;
    expect(row.textContent).toContain('Santrifüj');
    expect(el.querySelector('.yanit-karti')!.textContent).toContain('Location');
    expect(el.querySelector('.yanit-karti .durum-kodu')!.textContent).toBe('201');
  });

  it('step 7 shows two numbered responses', () => {
    const { el, player } = setup();
    go(player, 'sil');
    expect(texts(el, '.yanit-karti .yanit .durum-kodu')).toEqual(['204', '404']);
    expect(texts(el, '.yanit-karti .sira')).toEqual(['#1', '#2']);
  });

  it('step 9 shows 201 201 422', () => {
    const { el, player } = setup();
    go(player, 'idempotency-key');
    expect(texts(el, '.yanit-karti .yanit .durum-kodu')).toEqual(['201', '201', '422']);
    expect(texts(el, '.terminal-satir')).toContain('POST yanıtları: 201 201 422');
  });

  it('step 8 hides the request card', () => {
    const { el, player } = setup();
    go(player, 'mutlak-goreli');
    expect(el.querySelector<HTMLElement>('.istek-karti')!.hidden).toBe(true);
    expect(el.querySelector<HTMLElement>('.eslem')!.hidden).toBe(true);
    go(player, 'olustur');
    expect(el.querySelector<HTMLElement>('.istek-karti')!.hidden).toBe(false);
    expect(el.querySelector<HTMLElement>('.eslem')!.hidden).toBe(false);
  });

  it('resize twice keeps four lanes', () => {
    const { el, scene, player } = setup();
    go(player, 'olustur');
    scene.resize(500, 700);
    scene.resize(1280, 540);
    expect(el.querySelectorAll('g.seq-lane')).toHaveLength(4);
    expect(el.querySelectorAll('svg.plot')).toHaveLength(1);
  });

  it('rapid step jumps leave no duplicates', () => {
    const { el, player } = setup();
    for (const i of [9, 0, 9, 3]) player.goto(i);
    expect(el.querySelectorAll('g.seq-lane')).toHaveLength(4);
    const v = deriveRestView(player.state.params);
    expect(el.querySelectorAll('g.seq-msg')).toHaveLength(v.sequence.messages.length);
    expect(el.querySelectorAll('.data-table tbody tr')).toHaveLength(v.tablo?.satirlar.length ?? 0);
    expect(el.querySelectorAll('.seq-token').length).toBeLessThanOrEqual(1);
  });

  it('ders mode shows the code strip, lab mode the full listing in explain extra', () => {
    const ders = setup(1280, 540, 'ders');
    go(ders.player, 'olustur');
    const strip = ders.el.querySelector<HTMLElement>('.code-strip')!;
    expect(strip.hidden).toBe(false);
    const n = strip.querySelectorAll('li').length;
    expect(n).toBeGreaterThan(0);
    expect(n).toBeLessThanOrEqual(5);
    expect(strip.querySelectorAll('li.active').length).toBeGreaterThan(0);

    const lab = setup(1280, 540, 'lab');
    go(lab.player, 'olustur');
    expect(lab.el.querySelector<HTMLElement>('.code-strip')!.hidden).toBe(true);
    const kod = LISTINGS.find((l) => l.id === 'laboratuvar-api')!;
    expect(lab.extra.querySelectorAll('.code-trace li')).toHaveLength(kod.lines.length);
    expect(lab.extra.querySelectorAll('.code-trace li.active').length).toBeGreaterThan(0);
  });

  it('ozet step shows the method table and the endpoint list', () => {
    const { el, player } = setup();
    go(player, 'ozet');
    expect(el.querySelectorAll('table.ozet-tablosu tbody tr')).toHaveLength(5);
    expect(el.querySelectorAll('ul.uc-noktalari li')).toHaveLength(6);
    expect(el.querySelector<HTMLElement>('.istek-karti')!.hidden).toBe(true);
  });

  it('badge follows a lab change and returns on step change', () => {
    const { el, player } = setup();
    go(player, 'olustur');
    expect(stepBadges(el)[0].classList.contains('kaynak-kitap')).toBe(true);
    player.setParam('istek', 'post-bos');
    expect(stepBadges(el)).toHaveLength(1);
    expect(stepBadges(el)[0].classList.contains('kaynak-kitap-kodu')).toBe(true);
    player.next();
    expect(stepBadges(el)).toHaveLength(1);
    expect(stepBadges(el)[0].classList.contains('kaynak-kitap')).toBe(true);
  });

  it('every step shows the step badge and the mapping badge', () => {
    const { el, player } = setup();
    for (let i = 0; i < player.state.count; i++) {
      player.goto(i);
      expect(stepBadges(el), `step ${i + 1}`).toHaveLength(1);
      const eslem = el.querySelectorAll<HTMLElement>('.eslem-rozeti');
      expect(eslem).toHaveLength(1);
      expect(eslem[0].textContent).toContain('Şekil 6.5');
      expect(el.querySelector('.eslem-etiket')!.textContent).toBe('HTTP eşlemesi');
      expect(badges(el).filter((b) => !b.classList.contains('eslem-rozeti'))).toHaveLength(1);
    }
  });
});
