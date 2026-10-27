// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { istekPage } from '../../../src/concepts/istek-yanit/main';
import { istekScenario as sc } from '../../../src/concepts/istek-yanit/scenario';
import { notSorgula, YOLLAR } from '../../../src/concepts/istek-yanit/flow';
import { labTextTests } from '../lab-text';
import { setup } from './harness';

labTextTests(sc.steps, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], ['200', '401', '404', '400']);

const sel = (host: HTMLElement) => host.querySelector<HTMLSelectElement>('select[name="yol"]')!;
const yetki = (host: HTMLElement) => host.querySelector<HTMLInputElement>('input[type="checkbox"][name="yetkiliMi"]')!;
const olay = (host: HTMLElement) => host.querySelector<HTMLInputElement>('input[type="range"][name="olay"]')!;

function choose(input: HTMLSelectElement, value: string): void {
  input.value = value;
  input.dispatchEvent(new Event('change', { bubbles: true }));
}
function toggle(input: HTMLInputElement, on: boolean): void {
  input.checked = on;
  input.dispatchEvent(new Event('change', { bubbles: true }));
}
const key = (player: ReturnType<typeof setup>['player'], k: string): void =>
  istekPage.shortcuts!(player).find((s) => s.keys.includes(k))!.run();

describe('istek-yanit Lab controls', () => {
  it('yol select lists the four paths', () => {
    const { host } = setup(1280, 540, 'lab');
    expect([...sel(host).options].map((o) => o.value)).toEqual([...YOLLAR]);
    expect(YOLLAR).toHaveLength(4);
    expect(sel(host).value).toBe('/api/notlar/2026001');
    expect(yetki(host).checked).toBe(true);
  });

  it('choosing /api/odeme sets olay to its trace length', () => {
    const { host, player } = setup(1280, 540, 'lab');
    choose(sel(host), '/api/odeme');
    const len = notSorgula('/api/odeme', true).olaylar.length;
    expect(player.state.params.yol).toBe('/api/odeme');
    expect(player.state.params.olay).toBe(len);
    expect(olay(host).max).toBe(String(len));
    expect(olay(host).value).toBe(String(len));
  });

  it('unchecking yetkiliMi sets olay to the 401 trace length and updates the slider max', () => {
    const { host, player } = setup(1280, 540, 'lab');
    toggle(yetki(host), false);
    const len = notSorgula('/api/notlar/2026001', false).olaylar.length;
    expect(player.state.params.yetkiliMi).toBe(false);
    expect(player.state.params.olay).toBe(len);
    expect(olay(host).max).toBe(String(len));
  });

  it('the olay slider writes through to the player', () => {
    const { host, player } = setup(1280, 540, 'lab');
    olay(host).value = '3';
    olay(host).dispatchEvent(new Event('input', { bubbles: true }));
    expect(player.state.params.olay).toBe(3);
  });

  it('lab param change mid-animation leaves one token', async () => {
    const { host, el, player } = setup(1280, 540, 'lab', 1);
    player.goto(6);
    await new Promise((r) => setTimeout(r, 40));
    player.play();
    toggle(yetki(host), false);
    await new Promise((r) => setTimeout(r, 60));
    expect(el.querySelectorAll('.seq-token')).toHaveLength(1);
    player.pause();
  });

  it('Y toggles yetki', () => {
    const { host, player } = setup(1280, 540, 'lab');
    key(player, 'y');
    expect(player.state.params.yetkiliMi).toBe(false);
    expect(yetki(host).checked).toBe(false);
    key(player, 'Y');
    expect(player.state.params.yetkiliMi).toBe(true);
  });

  it('[ and ] move olay by one within the trace', () => {
    const { player } = setup(1280, 540, 'lab');
    player.setParam('olay', 2);
    key(player, ']');
    expect(player.state.params.olay).toBe(3);
    key(player, '[');
    key(player, '[');
    expect(player.state.params.olay).toBe(1);
    player.setParam('olay', 0);
    key(player, '[');
    expect(player.state.params.olay).toBe(0);
    const len = notSorgula(player.state.params.yol, true).olaylar.length;
    player.setParam('olay', len);
    key(player, ']');
    expect(player.state.params.olay).toBe(len);
  });

  it('the page describes itself', () => {
    expect(istekPage.title).toBe("İstek-yanıt yolculuğu: istemciden backend'e");
    expect(istekPage.chapter).toBe('Bölüm 1 · Modern Backend Programlamaya Giriş ve Web Mimarisi');
  });
});
