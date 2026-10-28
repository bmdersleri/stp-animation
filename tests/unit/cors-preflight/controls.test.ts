// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { corsPage } from '../../../src/concepts/cors-preflight/main';
import { TUMU } from '../../../src/concepts/cors-preflight/scenario';
import { go, setup } from './harness';

const sel = (host: HTMLElement, name: string) => host.querySelector<HTMLSelectElement>(`select[name="${name}"]`)!;
const key = (player: ReturnType<typeof setup>['player'], k: string): void => corsPage.shortcuts!(player).find((s) => s.keys.includes(k))!.run();
function choose(input: HTMLSelectElement, value: string): void {
  input.value = value;
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('cors-preflight Lab controls', () => {
  it('selects list the lab values', () => {
    const { host } = setup(1280, 540, 'lab');
    const vals = (n: string) => [...sel(host, n).options].map((o) => o.value);
    expect(vals('koken')).toEqual(['kutuphane', 'localhost', 'kotu', 'http-kutuphane', 'ayni']);
    expect(vals('istemci')).toEqual(['tarayici', 'curl', 'curl-origin']);
    expect(vals('istek')).toEqual(['get-kitaplar', 'post-giris', 'get-yetkili', 'delete']);
    expect(vals('kimlik')).toEqual(['include', 'omit']);
    expect(vals('sunucu')).toEqual(['kitap-karari', 'cors-paketi', 'wildcard', 'kitap-11-7']);
  });

  it('O cycles koken', () => {
    const { host, player } = setup(1280, 540, 'lab');
    const seen: string[] = [player.state.params.koken];
    for (let i = 0; i < 5; i++) {
      key(player, 'o');
      seen.push(player.state.params.koken);
    }
    expect(seen).toEqual(['kutuphane', 'localhost', 'kotu', 'http-kutuphane', 'ayni', 'kutuphane']);
    expect(sel(host, 'koken').value).toBe('kutuphane');
    key(player, 'O');
    expect(player.state.params.koken).toBe('localhost');
  });

  it('curl disables kimlik', () => {
    const { host } = setup(1280, 540, 'lab');
    expect(sel(host, 'kimlik').disabled).toBe(false);
    choose(sel(host, 'istemci'), 'curl');
    expect(sel(host, 'kimlik').disabled).toBe(true);
    choose(sel(host, 'istemci'), 'curl-origin');
    expect(sel(host, 'kimlik').disabled).toBe(true);
    choose(sel(host, 'istemci'), 'tarayici');
    expect(sel(host, 'kimlik').disabled).toBe(false);
  });

  it('a lab change always shows the whole flow (intro, summary and cut-off traces)', () => {
    const { host, player } = setup(1280, 540, 'lab');
    go(player, 'tanitim');
    choose(sel(host, 'koken'), 'kotu');
    expect(player.state.params.asama).toBe('akis');
    expect(player.state.params.olay).toBe(TUMU);
    go(player, 'ozet');
    choose(sel(host, 'istek'), 'delete');
    expect(player.state.params.asama).toBe('akis');
    go(player, 'preflight-gerekli');
    expect(player.state.params.olay).toBe(2);
    choose(sel(host, 'koken'), 'localhost');
    expect(player.state.params.olay).toBe(TUMU);
  });

  it('lab param change mid-animation leaves one token', async () => {
    const { host, el, player } = setup(1280, 540, 'lab');
    go(player, 'preflight-tamam');
    player.play();
    choose(sel(host, 'koken'), 'localhost');
    await new Promise((r) => setTimeout(r, 40));
    expect(el.querySelectorAll('svg.plot .seq-token')).toHaveLength(1);
    player.pause();
  });

  it('the page describes itself', () => {
    expect(corsPage.title).toBe('CORS: köken kararı ve preflight');
    expect(corsPage.chapter).toBe('Bölüm 11 · Güvenli Backend: Validation, Middleware ve Hata Yönetimi');
  });
});
