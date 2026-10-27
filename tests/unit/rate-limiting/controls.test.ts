// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { ratePage } from '../../../src/concepts/rate-limiting/main';
import { ELLE_SINIRI, TUMU } from '../../../src/concepts/rate-limiting/scenario';
import { go, setup } from './harness';

const sel = (host: HTMLElement, name: string) => host.querySelector<HTMLSelectElement>(`select[name="${name}"]`)!;
const btn = (host: HTMLElement, name: string) => host.querySelector<HTMLButtonElement>(`button[name="${name}"]`)!;
const key = (player: ReturnType<typeof setup>['player'], k: string): void => ratePage.shortcuts!(player).find((s) => s.keys.includes(k))!.run();
function choose(input: HTMLSelectElement, value: string): void {
  input.value = value;
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('rate-limiting Lab controls', () => {
  it('selects list the lab values', () => {
    const { host } = setup(1280, 540, 'lab');
    expect([...sel(host, 'desen').options].map((o) => o.value).filter((v) => !v.startsWith('ders:'))).toEqual(['kitap', 'duzenli', 'sinir', 'iki-ip', 'elle']);
    expect([...sel(host, 'pencereSn').options].map((o) => o.value)).toEqual(['10', '30', '60']);
    const r = host.querySelector<HTMLInputElement>('input[name="maksimumIstek"]')!;
    expect([r.min, r.max]).toEqual(['1', '10']);
  });

  it('a Ders-only pattern shows as a disabled placeholder, not a blank select', () => {
    const { host, player } = setup(1280, 540, 'lab');
    go(player, 'pencere-doldu');
    const o = sel(host, 'desen').selectedOptions[0];
    expect(o.textContent).toBe('Ders deseni: pencere');
    expect(o.disabled).toBe(true);
    go(player, 'sinir');
    expect(sel(host, 'desen').value).toBe('kitap');
  });

  it('G adds a request at the current time', () => {
    const { host, player } = setup(1280, 540, 'lab');
    key(player, 'g');
    expect(player.state.params.desen).toBe('elle');
    expect(player.state.params.elle).toEqual([{ t: 0, ip: '203.0.113.10' }]);
    btn(host, 'ilerle').click();
    key(player, 'G');
    expect(player.state.params.elle.map((e) => e.t)).toEqual([0, 10_000]);
  });

  it('+10 s advances time', () => {
    const { host, player } = setup(1280, 540, 'lab');
    key(player, 'g');
    btn(host, 'ilerle').click();
    btn(host, 'ilerle').click();
    expect(host.querySelector('.elle-simdi')!.textContent).toContain('20 s');
    btn(host, 'gonder').click();
    expect(player.state.params.elle.at(-1)!.t).toBe(20_000);
    btn(host, 'sifirla').click();
    expect(player.state.params.elle).toEqual([]);
    expect(host.querySelector('.elle-simdi')!.textContent).toContain('0 s');
  });

  it('send disabled at 30', () => {
    const { host, player } = setup(1280, 540, 'lab');
    for (let i = 0; i < ELLE_SINIRI; i++) key(player, 'g');
    expect(player.state.params.elle).toHaveLength(ELLE_SINIRI);
    expect(btn(host, 'gonder').disabled).toBe(true);
    key(player, 'g');
    expect(player.state.params.elle).toHaveLength(ELLE_SINIRI);
  });

  it('[ and ] move istek within bounds', () => {
    const { player } = setup(1280, 540, 'lab');
    go(player, 'sinir');
    key(player, '[');
    expect(player.state.params.istek).toBe(4);
    for (let i = 0; i < 9; i++) key(player, '[');
    expect(player.state.params.istek).toBe(1);
    for (let i = 0; i < 9; i++) key(player, ']');
    expect(player.state.params.istek).toBe(5);
  });

  it('changing desen resets istek', () => {
    const { host, player } = setup(1280, 540, 'lab');
    go(player, 'artir');
    expect(player.state.params.istek).toBe(3);
    choose(sel(host, 'desen'), 'duzenli');
    expect(player.state.params.istek).toBe(TUMU);
    key(player, '[');
    choose(sel(host, 'pencereSn'), '30');
    expect(player.state.params.istek).toBe(TUMU);
  });

  it('a lab change leaves intro, summary and login behind', () => {
    const { host, player } = setup(1280, 540, 'lab');
    go(player, 'tanitim');
    choose(sel(host, 'pencereSn'), '30');
    expect(player.state.params.asama).toBe('akis');
    go(player, 'ozet');
    choose(sel(host, 'desen'), 'sinir');
    expect(player.state.params.asama).toBe('akis');
    go(player, 'login-429');
    choose(sel(host, 'pencereSn'), '10');
    expect(player.state.params.desen).toBe('kitap');
  });

  it('lab param change mid-animation leaves one token', async () => {
    const { host, el, player } = setup(1280, 540, 'lab');
    go(player, 'sinir');
    player.play();
    choose(sel(host, 'desen'), 'iki-ip');
    await new Promise((r) => setTimeout(r, 40));
    expect(el.querySelectorAll('svg.plot .rate-axis')).toHaveLength(1);
    expect(el.querySelectorAll('svg.plot .rate-nokta')).toHaveLength(10);
    player.pause();
  });

  it('the page describes itself', () => {
    expect(ratePage.title).toBe('Rate limiting: istek sınırlama');
    expect(ratePage.chapter).toBe('Bölüm 11 · Güvenli Backend: Validation, Middleware ve Hata Yönetimi');
  });
});
