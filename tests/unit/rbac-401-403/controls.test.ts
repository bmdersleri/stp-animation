// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { rbacPage } from '../../../src/concepts/rbac-401-403/main';
import { go, setup, texts } from './harness';

const sel = (host: HTMLElement, name: string) => host.querySelector<HTMLSelectElement>(`select[name="${name}"]`)!;
const key = (player: ReturnType<typeof setup>['player'], k: string): void => rbacPage.shortcuts!(player).find((s) => s.keys.includes(k))!.run();
function choose(input: HTMLSelectElement, value: string): void {
  input.value = value;
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('rbac-401-403 Lab controls', () => {
  it('selects list the lab values with Turkish labels', () => {
    const { host } = setup(1280, 540, 'lab');
    const opts = (n: string) => [...sel(host, n).options].map((o) => [o.value, o.textContent]);
    expect(opts('kullanici').map(([v]) => v)).toEqual(['yasemin', 'elif', 'ahmet']);
    expect(opts('parola')).toEqual([['dogru', 'doğru parola'], ['yanlis', 'yanlış parola']]);
    expect(opts('token')).toEqual([['giris', 'girişten gelen token'], ['gecersiz', 'geçersiz token'], ['yok', 'token yok']]);
    expect(opts('roller')).toEqual([['kutuphaneci', 'yalnız kütüphaneci'], ['ikisi', 'öğrenci ve kütüphaneci']]);
  });

  it('R toggles roller', () => {
    const { host, player } = setup(1280, 540, 'lab');
    key(player, 'r');
    expect(player.state.params.roller).toBe('ikisi');
    expect(sel(host, 'roller').value).toBe('ikisi');
    key(player, 'R');
    expect(player.state.params.roller).toBe('kutuphaneci');
  });

  it('changing kullanici keeps token option valid', () => {
    const { host, el, player } = setup(1280, 540, 'lab');
    for (const token of ['giris', 'gecersiz', 'yok'] as const) {
      choose(sel(host, 'token'), token);
      for (const k of ['ahmet', 'elif', 'yasemin']) {
        choose(sel(host, 'kullanici'), k);
        expect([...sel(host, 'token').options].map((o) => o.value)).toEqual(['giris', 'gecersiz', 'yok']);
        expect(sel(host, 'token').value).toBe(token);
        expect(player.state.params.token).toBe(token);
      }
    }
    choose(sel(host, 'token'), 'giris');
    choose(sel(host, 'kullanici'), 'ahmet');
    expect(texts(el, '.terminal-satir')).toEqual(['401: Kullanıcı adı veya parola hatalı.']);
    expect(texts(el, '.durum-kodu')).toEqual(['401']);
  });

  it('lab change from bearer step switches to kod-10-7 kitap-ekle', () => {
    const { host, player } = setup(1280, 540, 'lab');
    go(player, 'bearer');
    expect(player.state.params.program).toBe('kod-10-4');
    choose(sel(host, 'kullanici'), 'elif');
    expect(player.state.params.program).toBe('kod-10-7');
    expect(player.state.params.asama).toBe('kitap-ekle');
    expect(player.state.params.kullanici).toBe('elif');
  });

  it('lab change from the summary step switches asama too', () => {
    const { host, player } = setup(1280, 540, 'lab');
    go(player, 'ozet');
    choose(sel(host, 'roller'), 'ikisi');
    expect(player.state.params.asama).toBe('kitap-ekle');
  });

  it('dakika slider clamps 0-30', () => {
    const { host, player } = setup(1280, 540, 'lab');
    const s = host.querySelector<HTMLInputElement>('input[name="dakika"]')!;
    expect([s.min, s.max]).toEqual(['0', '30']);
    s.value = '99';
    s.dispatchEvent(new Event('input', { bubbles: true }));
    expect(player.state.params.dakika).toBe(30);
  });

  it('lab param change mid-animation leaves one token', async () => {
    const { host, el, player } = setup(1280, 540, 'lab');
    go(player, 'ogrenci-403');
    player.play();
    choose(sel(host, 'kullanici'), 'yasemin');
    await new Promise((r) => setTimeout(r, 40));
    expect(el.querySelectorAll('svg.plot .seq-token')).toHaveLength(1);
    player.pause();
  });

  it('the page describes itself', () => {
    expect(rbacPage.title).toBe('RBAC ve 401 ile 403 ayrımı');
    expect(rbacPage.chapter).toBe('Bölüm 10 · Kimlik Doğrulama ve Yetkilendirme');
  });
});
