// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { rbacScenario } from '../../../src/concepts/rbac-401-403/scenario';
import { go, setup, texts } from './harness';

const rozetler = (el: HTMLElement): HTMLElement[] => [...el.querySelectorAll<HTMLElement>('.rozet-yeri .kaynak-rozeti')];
const gorunur = (el: HTMLElement, sel: string): boolean => {
  const e = el.querySelector<HTMLElement>(sel)!;
  return !e.hidden && !e.closest('[hidden]');
};

describe('rbac-401-403 scene', () => {
  it('step 5 shows 403 alarm return', () => {
    const { el, player } = setup();
    go(player, 'ogrenci-403');
    const satirlar = [...el.querySelectorAll('.check-list .denetim')];
    expect(satirlar.map((s) => s.className.match(/denetim-(gecti|kaldi|atlandi)/)![1])).toEqual(['gecti', 'kaldi']);
    expect(texts(el, '.durum-kodu')).toEqual(['403']);
    expect(el.querySelector('.durum-kodu')!.classList.contains('alarm')).toBe(true);
    expect(el.querySelectorAll('svg.plot .seq-lane')).toHaveLength(4);
    expect(el.querySelectorAll('svg.plot .seq-stop')).toHaveLength(1);
  });

  it('step 6 rol lane dim', () => {
    const { el, player } = setup();
    go(player, 'gecersiz-401');
    expect(texts(el, '.durum-kodu')).toEqual(['401']);
    expect(el.querySelectorAll('svg.plot .seq-lane.dim')).toHaveLength(1);
    expect(el.querySelectorAll('svg.plot .seq-lane')).toHaveLength(4);
  });

  it('step 2 shows repository table', () => {
    const { el, player } = setup();
    go(player, 'kayit');
    expect(gorunur(el, '.data-table')).toBe(true);
    expect(el.querySelectorAll('.data-table tbody tr')).toHaveLength(2);
    expect(texts(el, '.data-table th').map((t) => t.replace(/PK$/, '').trim())).toEqual(['kullaniciAdi', 'salt', 'parolaHash', 'rol']);
  });

  it('step 8 shows two request cards, the first without Authorization', () => {
    const { el, player } = setup();
    go(player, 'bearer');
    const kartlar = [...el.querySelectorAll('.istek-karti')].filter((k) => !(k as HTMLElement).hidden);
    expect(kartlar).toHaveLength(2);
    expect(kartlar[0].textContent).not.toContain('Authorization');
    expect(kartlar[1].textContent).toContain('Authorization');
    expect(texts(el, '.durum-metni')).toEqual(['Unauthorized']);
  });

  it('step 11 shows the status table and no diagram', () => {
    const { el, player } = setup();
    go(player, 'ozet');
    expect(gorunur(el, '.data-table')).toBe(true);
    expect(el.querySelectorAll('.data-table tbody tr')).toHaveLength(4);
    expect(gorunur(el, 'svg.plot')).toBe(false);
  });

  it('step 1 shows the book definition', () => {
    const { el } = setup();
    expect(el.querySelector('.tanim')!.textContent).toContain('401 Unauthorized, isteğin kimliği doğrulanamadığında');
    expect(gorunur(el, 'svg.plot')).toBe(false);
  });

  it('rapid step jumps leave no duplicates', () => {
    const { el, player } = setup();
    for (const i of [7, 0, 10, 2, 5, 1, 3]) player.goto(i);
    expect(el.querySelectorAll('.check-list')).toHaveLength(1);
    expect(el.querySelectorAll('.http-cards')).toHaveLength(2);
    expect(el.querySelectorAll('.data-table')).toHaveLength(1);
    expect(el.querySelectorAll('svg.plot')).toHaveLength(1);
  });

  it('badge follows lab change and returns on step change', () => {
    const { el, player } = setup();
    go(player, 'ogrenci-403');
    expect(rozetler(el)[0].classList.contains('kaynak-kitap')).toBe(true);
    player.setParam('dakika', 3);
    expect(rozetler(el)).toHaveLength(1);
    expect(rozetler(el)[0].classList.contains('kaynak-kitap-kodu')).toBe(true);
    player.next();
    expect(rozetler(el)).toHaveLength(1);
    expect(rozetler(el)[0].classList.contains('kaynak-kitap-kodu')).toBe(false);
  });

  it('every step shows exactly one badge', () => {
    const { el, player } = setup();
    rbacScenario.steps.forEach((_, i) => {
      player.goto(i);
      expect(el.querySelectorAll('.kaynak-rozeti'), `step ${i + 1}`).toHaveLength(1);
    });
  });

  it('ders step 7 prints the wrong-password message', () => {
    const { el, player } = setup();
    go(player, 'yanlis-parola');
    expect(texts(el, '.terminal-satir')).toEqual(['401: Kullanıcı adı veya parola hatalı.']);
    expect(gorunur(el, '.check-list')).toBe(false);
  });

  it('ders step 6 accumulates the three book lines', () => {
    const { el, player } = setup();
    go(player, 'gecersiz-401');
    expect(texts(el, '.terminal-satir')).toHaveLength(3);
  });

  it('lab param change drops accumulated book lines', () => {
    const { el, player } = setup(1280, 540, 'lab');
    go(player, 'gecersiz-401');
    expect(texts(el, '.terminal-satir')).toHaveLength(3);
    player.setParam('dakika', 5);
    expect(texts(el, '.terminal-satir')).toHaveLength(1);
  });
});
