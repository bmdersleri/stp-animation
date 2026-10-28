// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { timeoutScenario } from '../../../src/concepts/timeout-retry/scenario';
import { RETRY_NOTU, SAYFA_NOTLARI, SINYAL_NOTU, deriveTimeoutView } from '../../../src/concepts/timeout-retry/view';
import { go, setup, texts } from './harness';

const rozetler = (el: HTMLElement): HTMLElement[] => [...el.querySelectorAll<HTMLElement>('.rozet-yeri .kaynak-rozeti')];

describe('timeout-retry scene', () => {
  it('step 3 bar has an alarm tip', () => {
    const { el, player } = setup();
    go(player, 'abort');
    expect(el.querySelectorAll('svg.plot.zaman rect.deneme-cubuk')).toHaveLength(1);
    expect(el.querySelector('svg.plot.zaman circle.zaman-uc')!.getAttribute('fill')).toBe('#F08A00');
    expect(el.querySelector('svg.plot.zaman text.toplam')!.textContent).toBe('toplam 5000 ms');
    expect(el.querySelectorAll('.timeout-diyagram g.seq-msg')).toHaveLength(2);
  });

  it('step 5 hides the time axis', () => {
    const { el, player } = setup();
    go(player, 'izolasyon');
    expect(el.querySelector<HTMLElement>('.timeout-zaman')!.hidden).toBe(true);
    expect(el.querySelector<HTMLElement>('.timeout-diyagram')!.hidden).toBe(true);
    expect(texts(el, '.terminal-satir').join('\n')).toContain('Kısa bir özet metni.');
  });

  it('step 7 shows the wait gap', () => {
    const { el, player } = setup();
    go(player, 'retry-bekle');
    expect(el.querySelectorAll('svg.plot.zaman g.bekle')).toHaveLength(1);
    expect(el.querySelector('svg.plot.zaman g.bekle text')!.textContent).toBe('bekle 1000 ms');
    expect(el.querySelector('svg.plot.zaman text.toplam')!.textContent).toBe('toplam 7200 ms');
  });

  it('step 9 shows the check list and no time axis', () => {
    const { el, player } = setup();
    go(player, 'dogrulama');
    expect(el.querySelector<HTMLElement>('.timeout-zaman')!.hidden).toBe(true);
    expect(el.querySelectorAll('.denetim-yeri .denetim')).toHaveLength(2);
    expect(el.querySelectorAll('.denetim-yeri .denetim-kaldi')).toHaveLength(1);
  });

  it('step 6 shows the error table', () => {
    const { el, player } = setup();
    go(player, 'gecici-kalici');
    expect(el.querySelectorAll('.hata-yeri tbody tr')).toHaveLength(2);
  });

  it('rapid step jumps leave no duplicates', () => {
    const { el, player } = setup();
    for (const i of [9, 0, 8, 3, 7, 1, 5, 6]) player.goto(i);
    const v = deriveTimeoutView(player.state.params, true);
    expect(el.querySelectorAll('.timeout-diyagram g.seq-msg')).toHaveLength(v.sequence?.messages.length ?? 0);
    expect(el.querySelectorAll('svg.plot')).toHaveLength(2);
    expect(el.querySelectorAll('svg.plot.zaman rect.deneme-cubuk')).toHaveLength(v.zaman?.cubuklar.length ?? 0);
    expect(el.querySelectorAll('svg.plot.zaman g.bekle')).toHaveLength(v.zaman?.bosluklar.length ?? 0);
    expect(el.querySelectorAll('.timeout-not')).toHaveLength(v.notlar.length);
    expect(el.querySelector<HTMLElement>('.denetim-yeri')!.hidden).toBe(v.denetim === null);
    expect(el.querySelector<HTMLElement>('.hata-yeri')!.hidden).toBe(v.hataTablosu === null);
  });

  it('lab param change leaves one bar set', () => {
    const { el, player } = setup(1280, 540, 'lab');
    go(player, 'retry-tukendi');
    player.setParams({ asama: 'akis', surum: '17.5', senaryo: 'yavas', maksRetry: 3 });
    for (const m of [2, 1, 3, 0, 3]) player.setParam('maksRetry', m);
    expect(el.querySelectorAll('svg.plot.zaman rect.deneme-cubuk')).toHaveLength(4);
    expect(el.querySelectorAll('svg.plot.zaman g.bekle')).toHaveLength(3);
    expect(el.querySelectorAll('svg.plot.zaman line.zaman-asimi')).toHaveLength(1);
    player.setParam('maksRetry', 0);
    expect(el.querySelectorAll('svg.plot.zaman rect.deneme-cubuk')).toHaveLength(1);
    expect(el.querySelectorAll('svg.plot.zaman g.bekle')).toHaveLength(0);
    expect(el.querySelectorAll('svg.plot')).toHaveLength(2);
  });

  it('badge follows lab change and returns on step change', () => {
    const { el, player } = setup();
    go(player, 'retry-bekle');
    expect(rozetler(el)[0].classList.contains('kaynak-kitaba-dayali')).toBe(true);
    player.setParam('zamanAsimiMs', 6000);
    expect(rozetler(el)).toHaveLength(1);
    expect(rozetler(el)[0].classList.contains('kaynak-kitaba-dayali')).toBe(true);
    player.setParam('maksRetry', 0);
    expect(rozetler(el)).toHaveLength(1);
    expect(rozetler(el)[0].classList.contains('kaynak-kitap-kodu')).toBe(true);
    go(player, 'retry-bekle');
    expect(rozetler(el)).toHaveLength(1);
    expect(rozetler(el)[0].classList.contains('kaynak-kitaba-dayali')).toBe(true);
  });

  it('every step shows exactly one badge', () => {
    const { el, player } = setup();
    timeoutScenario.steps.forEach((_, i) => {
      player.goto(i);
      expect(el.querySelectorAll('.kaynak-rozeti'), `step ${i + 1}`).toHaveLength(1);
    });
  });

  it('intro and summary show the book block', () => {
    const { el, player } = setup();
    const blok = el.querySelector<HTMLElement>('.kitap-blok')!;
    expect(blok.hidden).toBe(false);
    expect(el.querySelector<HTMLElement>('.timeout-govde')!.hidden).toBe(true);
    expect(blok.querySelector('.tanim-metin')!.textContent).toContain('Timeout, bir AI servisinden');
    go(player, 'ozet');
    expect(blok.hidden).toBe(false);
    expect(blok.querySelectorAll('.data-table')).toHaveLength(1);
    expect(blok.querySelectorAll('.kitap-not')).toHaveLength(1);
    go(player, 'abort');
    expect(blok.hidden).toBe(true);
    expect(el.querySelector<HTMLElement>('.timeout-govde')!.hidden).toBe(false);
  });

  it('the code strip is hidden on steps 1 and 10 and shown on the others', () => {
    const { el, player } = setup();
    const strip = el.querySelector<HTMLElement>('.code-strip')!;
    expect(strip.hidden).toBe(true);
    go(player, 'ozet');
    expect(strip.hidden).toBe(true);
    for (const id of ['zamansiz', 'abort', 'basarili', 'izolasyon', 'gecici-kalici', 'retry-bekle', 'retry-tukendi', 'dogrulama']) {
      go(player, id);
      expect(strip.hidden, id).toBe(false);
    }
  });

  it('the page notes are styled apart from the book notes', () => {
    const { el, player } = setup();
    go(player, 'abort');
    expect([...el.querySelectorAll('.timeout-sayfa-notu')].map((n) => n.textContent)).toEqual([SINYAL_NOTU]);
    go(player, 'retry-bekle');
    expect([...el.querySelectorAll('.timeout-sayfa-notu')].map((n) => n.textContent)).toEqual(SAYFA_NOTLARI.slice(1));
    expect(el.querySelector('.timeout-sayfa-notu')!.textContent).toBe(RETRY_NOTU);
    go(player, 'gecici-kalici');
    expect(el.querySelectorAll('.timeout-sayfa-notu')).toHaveLength(0);
    expect(el.querySelectorAll('.timeout-not')).toHaveLength(1);
  });

  it('only step 8 draws the closing 17.5 arrow in Ders; steps 3, 4 and 7 do not', () => {
    const { el, player } = setup();
    for (const id of ['abort', 'basarili', 'retry-bekle']) {
      go(player, id);
      expect(texts(el, '.timeout-diyagram g.seq-msg').join('|'), id).not.toContain('200 OK');
    }
    go(player, 'retry-tukendi');
    expect(texts(el, '.timeout-diyagram g.seq-msg').join('|')).toContain('200 OK (özet yok');
  });

  it('the no-wait warning is its own paragraph', () => {
    const { el, player } = setup(1280, 540, 'lab');
    player.setParams({ asama: 'akis', surum: '17.5', senaryo: 'yavas', maksRetry: 3, beklemeTabanMs: 0 });
    expect(el.querySelectorAll('p.uyari')).toHaveLength(1);
    player.setParam('beklemeTabanMs', 1000);
    expect(el.querySelectorAll('p.uyari')).toHaveLength(0);
  });
});
