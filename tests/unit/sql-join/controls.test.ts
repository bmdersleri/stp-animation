// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { sqlPage } from '../../../src/concepts/sql-join/main';
import { TUMU } from '../../../src/concepts/sql-join/scenario';
import { go, setup } from './harness';

const sel = (host: HTMLElement, name: string) => host.querySelector<HTMLSelectElement>(`select[name="${name}"]`)!;
const slider = (host: HTMLElement) => host.querySelector<HTMLInputElement>('input[type="range"][name="cift"]')!;
function choose(input: HTMLSelectElement, value: string): void {
  input.value = value;
  input.dispatchEvent(new Event('change', { bubbles: true }));
}
const key = (player: ReturnType<typeof setup>['player'], k: string): void => sqlPage.shortcuts!(player).find((s) => s.keys.includes(k))!.run();

describe('sql-join Lab controls', () => {
  it('sorgu select lists seven queries', () => {
    const { host } = setup(1280, 540, 'lab');
    expect(sel(host, 'sorgu').options.length).toBe(7);
  });

  it('changing sorgu resets cift to the end', () => {
    const { host, player } = setup(1280, 540, 'lab');
    go(player, 'on-kosulu');
    expect(player.state.params.cift).toBe(4);
    choose(sel(host, 'sorgu'), 'left');
    expect(player.state.params.sorgu).toBe('left');
    expect(player.state.params.cift).toBe(TUMU);
    expect(player.state.params.gorunum).toBe('sorgu');
    expect(slider(host).value).toBe(slider(host).max);
  });

  it('deger is enabled only for parametreli', () => {
    const { host, player } = setup(1280, 540, 'lab');
    go(player, 'inner-sonuc');
    expect(sel(host, 'deger').disabled).toBe(true);
    choose(sel(host, 'sorgu'), 'parametreli');
    expect(sel(host, 'deger').disabled).toBe(false);
    choose(sel(host, 'deger'), '1');
    expect(player.state.params.deger).toBe(1);
  });

  it('[ and ] move cift within bounds', () => {
    const { host, player } = setup(1280, 540, 'lab');
    choose(sel(host, 'sorgu'), 'inner');
    const n = Number(slider(host).max);
    expect(n).toBe(6);
    key(player, '[');
    expect(player.state.params.cift).toBe(n - 1);
    for (let i = 0; i < 10; i++) key(player, '[');
    expect(player.state.params.cift).toBe(0);
    key(player, ']');
    expect(player.state.params.cift).toBe(1);
    for (let i = 0; i < 10; i++) key(player, ']');
    expect(player.state.params.cift).toBe(n);
    expect(slider(host).value).toBe(String(n));
  });

  it('the page describes itself', () => {
    expect(sqlPage.title).toBe('JOIN ile tabloları birleştirme');
    expect(sqlPage.chapter).toBe('Bölüm 7 · PostgreSQL ve SQL ile Kalıcı Veri Yönetimi');
  });
});
