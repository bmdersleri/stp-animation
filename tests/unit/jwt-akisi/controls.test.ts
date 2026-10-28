// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { jwtPage } from '../../../src/concepts/jwt-akisi/main';
import { go, setup } from './harness';

const sel = (host: HTMLElement, name: string) => host.querySelector<HTMLSelectElement>(`select[name="${name}"]`)!;
const slider = (host: HTMLElement) => host.querySelector<HTMLInputElement>('input[name="dakika"]')!;
const key = (player: ReturnType<typeof setup>['player'], k: string): void => jwtPage.shortcuts!(player).find((s) => s.keys.includes(k))!.run();
function choose(input: HTMLSelectElement, value: string): void {
  input.value = value;
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('jwt-akisi Lab controls', () => {
  it('selects list the lab values with Turkish labels', () => {
    const { host } = setup(1280, 540, 'lab');
    expect([...sel(host, 'kullanici').options].map((o) => o.value)).toEqual(['elif', 'yasemin']);
    expect([...sel(host, 'bozulma').options].map((o) => o.value)).toEqual(['yok', 'imza-bozuk', 'rol-degisti', 'sure-alani-yok', 'fazla-segment', 'baska-anahtar', 'bozuk-json']);
    expect([...sel(host, 'bozulma').options].map((o) => o.textContent)).toEqual([
      'yok (sağlam token)', 'imza bozuk', 'rol değişti', 'süre alanı yok', 'fazla segment', 'başka anahtar', 'bozuk JSON',
    ]);
  });

  it('B cycles bozulma', () => {
    const { host, player } = setup(1280, 540, 'lab');
    key(player, 'b');
    expect(player.state.params.bozulma).toBe('imza-bozuk');
    expect(sel(host, 'bozulma').value).toBe('imza-bozuk');
    for (let i = 0; i < 6; i++) key(player, 'B');
    expect(player.state.params.bozulma).toBe('yok');
  });

  it('dakika slider clamps 0-30', () => {
    const { host, player } = setup(1280, 540, 'lab');
    const s = slider(host);
    expect([s.min, s.max]).toEqual(['0', '30']);
    s.value = '99';
    s.dispatchEvent(new Event('input', { bubbles: true }));
    expect(player.state.params.dakika).toBe(30);
    s.value = '-4';
    s.dispatchEvent(new Event('input', { bubbles: true }));
    expect(player.state.params.dakika).toBe(0);
  });

  it('the first lab change sets asama to dogrula', () => {
    const { host, player } = setup(1280, 540, 'lab');
    go(player, 'akis');
    choose(sel(host, 'kullanici'), 'yasemin');
    expect(player.state.params.asama).toBe('dogrula');
    expect(player.state.params.kullanici).toBe('yasemin');
  });

  it('lab param change mid-animation leaves one token', async () => {
    const { host, el, player } = setup(1280, 540, 'lab');
    go(player, 'payload');
    player.play();
    choose(sel(host, 'bozulma'), 'rol-degisti');
    await new Promise((r) => setTimeout(r, 40));
    expect(el.querySelectorAll('.token-yeri .segment-strip')).toHaveLength(1);
    player.pause();
  });

  it('the page describes itself', () => {
    expect(jwtPage.title).toBe('JWT: üretim ve doğrulama');
    expect(jwtPage.chapter).toBe('Bölüm 10 · Kimlik Doğrulama ve Yetkilendirme');
  });
});
