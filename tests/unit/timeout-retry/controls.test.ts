// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { go, setup } from './harness';

const input = (host: HTMLElement, name: string) => host.querySelector<HTMLInputElement>(`input[name="${name}"]`)!;
const sel = (host: HTMLElement, name: string) => host.querySelector<HTMLSelectElement>(`select[name="${name}"]`)!;
function slide(i: HTMLInputElement, value: number | string): void {
  i.value = String(value);
  i.dispatchEvent(new Event('input', { bubbles: true }));
}
function choose(s: HTMLSelectElement, value: string): void {
  s.value = value;
  s.dispatchEvent(new Event('change', { bubbles: true }));
}
const kutu = (host: HTMLElement, name: string) => host.querySelector<HTMLElement>(`[name="${name}"]`)!.closest<HTMLElement>('.ctl')!;

describe('timeout-retry Lab controls', () => {
  it('lists the lab ranges', () => {
    const { host } = setup(1280, 540, 'lab');
    const r = (n: string) => [input(host, n).min, input(host, n).max, input(host, n).step];
    expect(r('zamanAsimiMs')).toEqual(['1000', '10000', '500']);
    expect(r('maksRetry')).toEqual(['0', '3', '1']);
    expect(r('servisGecikmesiMs')).toEqual(['500', '12000', '500']);
    expect([...sel(host, 'senaryo').options].map((o) => o.value)).toEqual(['hizli', 'yavas', 'gecici', 'http-500', 'bos-ozet', 'bozuk-govde']);
    expect([...sel(host, 'beklemeTabanMs').options].map((o) => o.value)).toEqual(['0', '500', '1000', '2000']);
  });

  it('servisGecikmesiMs hides for hizli', () => {
    const { host } = setup(1280, 540, 'lab');
    expect(kutu(host, 'servisGecikmesiMs').hidden).toBe(false);
    for (const s of ['hizli', 'http-500', 'bos-ozet', 'bozuk-govde']) {
      choose(sel(host, 'senaryo'), s);
      expect(kutu(host, 'servisGecikmesiMs').hidden, s).toBe(true);
    }
    for (const s of ['yavas', 'gecici']) {
      choose(sel(host, 'senaryo'), s);
      expect(kutu(host, 'servisGecikmesiMs').hidden, s).toBe(false);
    }
  });

  it('lab change sets asama akis and surum 17.5', () => {
    const { host, player } = setup(1280, 540, 'lab');
    for (const id of ['tanitim', 'zamansiz', 'abort', 'basarili', 'izolasyon', 'gecici-kalici', 'dogrulama', 'ozet']) {
      go(player, id);
      slide(input(host, 'zamanAsimiMs'), 6000);
      expect(player.state.params, id).toMatchObject({ asama: 'akis', surum: '17.5', zamanAsimiMs: 6000 });
    }
    go(player, 'abort');
    expect(player.state.params.surum).toBe('17.3');
    choose(sel(host, 'senaryo'), 'hizli');
    expect(player.state.params).toMatchObject({ asama: 'akis', surum: '17.5', senaryo: 'hizli' });
    go(player, 'basarili');
    slide(input(host, 'maksRetry'), 2);
    expect(player.state.params).toMatchObject({ surum: '17.5', maksRetry: 2 });
    go(player, 'izolasyon');
    choose(sel(host, 'beklemeTabanMs'), '2000');
    expect(player.state.params).toMatchObject({ asama: 'akis', surum: '17.5', beklemeTabanMs: 2000 });
    go(player, 'dogrulama');
    slide(input(host, 'servisGecikmesiMs'), 3500);
    expect(player.state.params).toMatchObject({ asama: 'akis', surum: '17.5', servisGecikmesiMs: 3500 });
  });

  it('a Lab edit on a 17.3 step shows the Kod 17.5 strip, not the 17.3 one', () => {
    const { host, el, player } = setup(1280, 540, 'ders');
    go(player, 'abort');
    expect(el.querySelector('.code-strip .code-trace')!.textContent).toContain('Kod 17.3');
    slide(input(host, 'zamanAsimiMs'), 6000);
    expect(el.querySelector('.code-strip .code-trace')!.textContent).toContain('Kod 17.5');
  });

  it('controls follow a step change', () => {
    const { host, player } = setup(1280, 540, 'lab');
    go(player, 'retry-tukendi');
    expect(sel(host, 'senaryo').value).toBe('yavas');
    expect(input(host, 'maksRetry').value).toBe('1');
    go(player, 'basarili');
    expect(sel(host, 'senaryo').value).toBe('hizli');
    expect(kutu(host, 'servisGecikmesiMs').hidden).toBe(true);
  });
});
