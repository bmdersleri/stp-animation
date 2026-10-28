// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { saltPage } from '../../../src/concepts/salt-hash/main';
import { go, setup } from './harness';

const field = (host: HTMLElement, name: string) => host.querySelector<HTMLInputElement>(`input[name="${name}"]`)!;
const sel = (host: HTMLElement, name: string) => host.querySelector<HTMLSelectElement>(`select[name="${name}"]`)!;
function choose(input: HTMLSelectElement, value: string): void {
  input.value = value;
  input.dispatchEvent(new Event('change', { bubbles: true }));
}
function type(input: HTMLInputElement, value: string): void {
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}
const key = (player: ReturnType<typeof setup>['player'], k: string): void => saltPage.shortcuts!(player).find((s) => s.keys.includes(k))!.run();

describe('salt-hash Lab controls', () => {
  it('text boxes start with the defaults and allow 32 characters', () => {
    const { host } = setup(1280, 540, 'lab');
    expect(field(host, 'parola').value).toBe('guclu-Parola123');
    expect(field(host, 'deneme').value).toBe('yanlis-parola');
    expect(field(host, 'parola').maxLength).toBe(32);
    expect(field(host, 'deneme').maxLength).toBe(32);
  });

  it('parola input caps at 32', () => {
    const { host, player } = setup(1280, 540, 'lab');
    type(field(host, 'parola'), 'x'.repeat(40));
    expect(player.state.params.parola).toBe('x'.repeat(32));
    expect(field(host, 'parola').value).toBe('x'.repeat(32));
  });

  it('selects list the lab values', () => {
    const { host } = setup(1280, 540, 'lab');
    const values = (name: string): string[] => [...sel(host, name).options].map((o) => o.value);
    expect(values('yontem')).toEqual(['scrypt', 'sha256']);
    expect(values('salt')).toEqual(['sabit-1', 'sabit-2', 'yeni']);
    expect(values('gorunum')).toEqual(['hat', 'dogrula', 'karsilastir']);
  });

  it('S sets a new 32-hex salt and salt yeni', () => {
    const { player } = setup(1280, 540, 'lab');
    key(player, 's');
    const a = player.state.params;
    expect(a.salt).toBe('yeni');
    expect(a.yeniSalt).toMatch(/^[0-9a-f]{32}$/);
    key(player, 'S');
    expect(player.state.params.yeniSalt).not.toBe(a.yeniSalt);
  });

  it('the New salt button does the same', () => {
    const { host, player } = setup(1280, 540, 'lab');
    host.querySelector<HTMLButtonElement>('button.yeni-salt')!.click();
    expect(player.state.params.salt).toBe('yeni');
    expect(player.state.params.yeniSalt).toHaveLength(32);
  });

  it('second user checkbox and method select write the params', () => {
    const { host, player } = setup(1280, 540, 'lab');
    const cb = field(host, 'ikinciKullanici');
    cb.checked = true;
    cb.dispatchEvent(new Event('change', { bubbles: true }));
    expect(player.state.params.ikinciKullanici).toBe(true);
    choose(sel(host, 'yontem'), 'sha256');
    expect(player.state.params.yontem).toBe('sha256');
  });

  it('lab change from tanim switches to hat', () => {
    const { host, player } = setup(1280, 540, 'lab');
    expect(player.state.params.gorunum).toBe('tanim');
    type(field(host, 'parola'), 'abc');
    expect(player.state.params.gorunum).toBe('hat');
    go(player, 'yavas');
    choose(sel(host, 'salt'), 'sabit-2');
    expect(player.state.params.gorunum).toBe('hat');
    go(player, 'dogru-parola');
    type(field(host, 'deneme'), 'q');
    expect(player.state.params.gorunum).toBe('dogrula');
  });

  it('gorunum select is the user choice', () => {
    const { host, player } = setup(1280, 540, 'lab');
    choose(sel(host, 'gorunum'), 'karsilastir');
    expect(player.state.params.gorunum).toBe('karsilastir');
  });

  it('lab param change mid-animation leaves one token', async () => {
    const { host, el, player } = setup(1280, 540, 'lab');
    go(player, 'salt-uret');
    player.play();
    choose(sel(host, 'salt'), 'sabit-2');
    await new Promise((r) => setTimeout(r, 40));
    expect(el.querySelectorAll('.hat-kutu.etkin').length).toBeLessThanOrEqual(1);
    player.pause();
  });

  it('the page describes itself', () => {
    expect(saltPage.title).toBe('Parola güvenliği: salt ve hashing');
    expect(saltPage.chapter).toBe('Bölüm 10 · Kimlik Doğrulama ve Yetkilendirme');
  });
});
