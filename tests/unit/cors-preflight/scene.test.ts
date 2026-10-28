// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { corsScenario } from '../../../src/concepts/cors-preflight/scenario';
import { go, setup, texts } from './harness';

const rozetler = (el: HTMLElement): HTMLElement[] => [...el.querySelectorAll<HTMLElement>('.rozet-yeri .kaynak-rozeti')];

describe('cors-preflight scene', () => {
  it('step 8 shows eksik-baslik row', () => {
    const { el, player } = setup();
    go(player, 'preflight-eksik');
    expect(texts(el, '.eksik-baslik')).toEqual(['Access-Control-Allow-Headers: yok']);
    expect(el.querySelectorAll('.denetim-kaldi').length).toBeGreaterThan(0);
  });

  it('step 9 shows OPTIONS and POST cards', () => {
    const { el, player } = setup();
    go(player, 'preflight-tamam');
    expect(texts(el, '.yanit-karti .sira')).toEqual(['#1', '#2']);
    expect(texts(el, '.istek-karti .metot')).toEqual(['POST']);
    expect(texts(el, 'svg.plot .seq-msg-label, svg.plot text').join(' ')).toContain('OPTIONS');
  });

  it('step 3 shows explanation text', () => {
    const { el, player } = setup();
    go(player, 'izinsiz');
    const a = el.querySelector<HTMLElement>('.cors-aciklama')!;
    expect(a.hidden).toBe(false);
    expect(a.textContent).toBe('Tarayıcı yanıtı betiğe vermedi; sunucu isteği işledi.');
    expect(texts(el, '.koken-deger')).toEqual(['https://kotu-niyetli-site.com', 'https://api.kutuphane.mehmetakif.edu.tr']);
  });

  it('intro and summary show the book block in place of the diagram', () => {
    const { el, player } = setup();
    go(player, 'tanitim');
    const blok = el.querySelector<HTMLElement>('.kitap-blok')!;
    expect(blok.hidden).toBe(false);
    expect(el.querySelector<HTMLElement>('.cors-diyagram')!.hidden).toBe(true);
    expect(blok.querySelector('.tanim-metin strong')!.textContent).toBe('Tanım. ');
    expect(blok.querySelector('.tanim-metin')!.textContent).toContain('CORS, bir web sayfasının çalıştığı kökenden');
    expect(texts(blok, '.kitap-not')[0]).toMatch(/^İpucu: CORS bir sunucu güvenlik duvarı değildir;/);
    expect(el.querySelectorAll('.koken-etiketi')).toHaveLength(2);
    go(player, 'ozet');
    expect(texts(blok, '.data-table-title')).toEqual(["CORS ile CSRF'i karıştırmayınız.", 'Alternatifler']);
    expect(blok.querySelectorAll('tbody tr')).toHaveLength(7);
    expect(el.querySelector<HTMLElement>('.koken-serit')!.hidden).toBe(true);
    go(player, 'izinli');
    expect(blok.hidden).toBe(true);
    expect(el.querySelector<HTMLElement>('.cors-diyagram')!.hidden).toBe(false);
    expect(el.querySelectorAll('svg.plot .seq-lane')).toHaveLength(3);
  });

  it('rapid step jumps leave no duplicates', () => {
    const { el, player } = setup();
    for (const i of [7, 0, 9, 2, 5, 1, 8, 3]) player.goto(i);
    expect(el.querySelectorAll('.check-list')).toHaveLength(1);
    expect(el.querySelectorAll('.http-cards')).toHaveLength(1);
    expect(el.querySelectorAll('svg.plot')).toHaveLength(1);
    player.goto(9);
    player.goto(9);
    expect(el.querySelectorAll('.kitap-blok .data-table')).toHaveLength(2);
  });

  it('badge follows lab change and returns on step change', () => {
    const { el, player } = setup();
    go(player, 'izinli');
    expect(rozetler(el)[0].classList.contains('kaynak-kitap-kodu')).toBe(true);
    player.setParam('kimlik', 'omit');
    expect(rozetler(el)).toHaveLength(1);
    expect(rozetler(el)[0].classList.contains('kaynak-kitap-kodu')).toBe(true);
    go(player, 'preflight-tamam');
    player.setParam('koken', 'localhost');
    expect(rozetler(el)[0].classList.contains('kaynak-standart')).toBe(true);
    player.next();
    expect(rozetler(el)).toHaveLength(1);
  });

  it('every step shows exactly one badge', () => {
    const { el, player } = setup();
    corsScenario.steps.forEach((_, i) => {
      player.goto(i);
      expect(el.querySelectorAll('.kaynak-rozeti'), `step ${i + 1}`).toHaveLength(1);
    });
  });

  it('lab param change drops the book terminal line', () => {
    const { el, player } = setup(1280, 540, 'lab');
    go(player, 'sunucu-reddi');
    const kitap = texts(el, '.terminal-satir');
    player.setParam('koken', 'kutuphane');
    expect(texts(el, '.terminal-satir')).toHaveLength(1);
    expect(texts(el, '.terminal-satir')).not.toEqual(kitap);
  });
});
