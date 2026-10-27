// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { mwPage } from '../../../src/concepts/middleware-zinciri/main';
import { mwScenario as sc } from '../../../src/concepts/middleware-zinciri/scenario';
import { mwIz } from '../../../src/concepts/middleware-zinciri/view';
import { labTextTests } from '../lab-text';
import { go, setup } from './harness';

labTextTests(sc.steps, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], ['200', '401', '404', '500']);

const sel = (host: HTMLElement, name: string) => host.querySelector<HTMLSelectElement>(`select[name="${name}"]`)!;
const box = (host: HTMLElement, name: string) => host.querySelector<HTMLInputElement>(`input[type="checkbox"][name="${name}"]`)!;
const olay = (host: HTMLElement) => host.querySelector<HTMLInputElement>('input[type="range"][name="olay"]')!;
function choose(input: HTMLSelectElement, value: string): void {
  input.value = value;
  input.dispatchEvent(new Event('change', { bubbles: true }));
}
function toggle(input: HTMLInputElement, on: boolean): void {
  input.checked = on;
  input.dispatchEvent(new Event('change', { bubbles: true }));
}
const key = (player: ReturnType<typeof setup>['player'], k: string): void => mwPage.shortcuts!(player).find((s) => s.keys.includes(k))!.run();

describe('middleware-zinciri Lab controls', () => {
  it('yol select lists the three paths', () => {
    const { host } = setup(1280, 540, 'lab');
    expect([...sel(host, 'yol').options].map((o) => o.value)).toEqual(['/korumali-durum', '/baska', '/hata-ornegi']);
    expect([...sel(host, 'anahtar').options].map((o) => o.textContent)).toEqual(['Geçerli anahtar', 'Yanlış anahtar', 'Anahtar yok']);
  });

  it('changing yol resets olay to the new trace length', () => {
    const { host, player } = setup(1280, 540, 'lab');
    go(player, 'next-unutma');
    choose(sel(host, 'yol'), '/baska');
    const p = player.state.params;
    expect(p.program).toBe('kod-5-5');
    expect(p.yol).toBe('/baska');
    expect(p.olay).toBe(mwIz(p).olaylar.length);
    expect(olay(host).max).toBe(String(p.olay));
    expect(olay(host).value).toBe(String(p.olay));
  });

  it('lab param change mid-animation leaves one token', async () => {
    const { host, el, player } = setup(1280, 540, 'lab', 1);
    player.goto(4);
    await new Promise((r) => setTimeout(r, 40));
    player.play();
    toggle(box(host, 'gunlukNext'), false);
    await new Promise((r) => setTimeout(r, 60));
    expect(el.querySelectorAll('.seq-token').length).toBeLessThanOrEqual(1);
    player.pause();
  });

  it('N toggles gunlukNext', () => {
    const { host, player } = setup(1280, 540, 'lab');
    key(player, 'n');
    expect(player.state.params.gunlukNext).toBe(false);
    expect(box(host, 'gunlukNext').checked).toBe(false);
    key(player, 'N');
    expect(player.state.params.gunlukNext).toBe(true);
  });

  it('[ and ] move olay within bounds', () => {
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
    const len = mwIz(player.state.params).olaylar.length;
    player.setParam('olay', len);
    key(player, ']');
    expect(player.state.params.olay).toBe(len);
  });

  it('the page describes itself', () => {
    expect(mwPage.title).toBe('Middleware zinciri: istek işlem hattı');
    expect(mwPage.chapter).toBe('Bölüm 5 · Express ile Web Sunucusu ve Routing');
  });
});
