// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { restPage } from '../../../src/concepts/rest-crud/main';
import { ISTEKLER } from '../../../src/concepts/rest-crud/rota';
import { TUMU } from '../../../src/concepts/rest-crud/scenario';
import { go, setup } from './harness';

const sel = (host: HTMLElement, name: string) => host.querySelector<HTMLSelectElement>(`select[name="${name}"]`)!;
const slider = (host: HTMLElement) => host.querySelector<HTMLInputElement>('input[type="range"][name="gonderim"]')!;
function choose(input: HTMLSelectElement, value: string): void {
  input.value = value;
  input.dispatchEvent(new Event('change', { bubbles: true }));
}
const key = (player: ReturnType<typeof setup>['player'], k: string): void => restPage.shortcuts!(player).find((s) => s.keys.includes(k))!.run();

describe('rest-crud Lab controls', () => {
  it('program change resets istek, onceki and gonderim', () => {
    const { host, player } = setup(1280, 540, 'lab');
    go(player, 'bulunamadi');
    player.setParam('gonderim', 2);
    choose(sel(host, 'program'), 'idempotentlik');
    const p = player.state.params;
    expect(p.program).toBe('idempotentlik');
    expect(p.istek).toBe(ISTEKLER.idempotentlik[0].id);
    expect(p.onceki).toEqual([]);
    expect(p.gonderim).toBe(TUMU);
    expect(sel(host, 'istek').value).toBe(p.istek);
  });

  it("istek select lists the program's requests", () => {
    const { host, player } = setup(1280, 540, 'lab');
    expect([...sel(host, 'istek').options].map((o) => o.textContent)).toEqual(ISTEKLER['laboratuvar-api'].map((i) => i.etiket));
    choose(sel(host, 'program'), 'idempotentlik');
    expect([...sel(host, 'istek').options].map((o) => o.value)).toEqual(ISTEKLER.idempotentlik.map((i) => i.id));
    choose(sel(host, 'istek'), 'delete-12');
    expect(player.state.params.istek).toBe('delete-12');
    expect(player.state.params.onceki).toEqual([]);
    expect(player.state.params.gonderim).toBe(TUMU);
    expect([...sel(host, 'tekrar').options].map((o) => o.value)).toEqual(['1', '2', '3']);
  });

  it('lab param change mid-animation leaves one token', async () => {
    const { host, el, player } = setup(1280, 540, 'lab', 1);
    player.goto(1);
    await new Promise((r) => setTimeout(r, 40));
    player.play();
    choose(sel(host, 'tekrar'), '2');
    await new Promise((r) => setTimeout(r, 60));
    expect(el.querySelectorAll('.seq-token').length).toBeLessThanOrEqual(1);
    player.pause();
  });

  it('T cycles tekrar', () => {
    const { host, player } = setup(1280, 540, 'lab');
    go(player, 'bulunamadi');
    key(player, 't');
    expect(player.state.params.tekrar).toBe(2);
    expect(player.state.params.onceki).toEqual([]);
    key(player, 'T');
    expect(player.state.params.tekrar).toBe(3);
    key(player, 't');
    expect(player.state.params.tekrar).toBe(1);
    expect(sel(host, 'tekrar').value).toBe('1');
  });

  it('[ and ] move gonderim within bounds', () => {
    const { host, player } = setup(1280, 540, 'lab');
    choose(sel(host, 'tekrar'), '3');
    expect(slider(host).max).toBe('3');
    key(player, '[');
    expect(player.state.params.gonderim).toBe(2);
    key(player, '[');
    key(player, '[');
    expect(player.state.params.gonderim).toBe(1);
    key(player, ']');
    expect(player.state.params.gonderim).toBe(2);
    key(player, ']');
    key(player, ']');
    expect(player.state.params.gonderim).toBe(3);
    expect(slider(host).value).toBe('3');
  });

  it('the page describes itself', () => {
    expect(restPage.title).toBe('CRUD, HTTP metotları ve durum kodları');
    expect(restPage.chapter).toBe('Bölüm 6 · HTTP ve RESTful API Tasarımı');
  });
});
