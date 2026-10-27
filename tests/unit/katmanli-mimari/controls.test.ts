// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { katmanPage } from '../../../src/concepts/katmanli-mimari/main';
import { deriveKatmanView } from '../../../src/concepts/katmanli-mimari/view';
import { go, setup } from './harness';

const sel = (host: HTMLElement, name: string) => host.querySelector<HTMLSelectElement>(`select[name="${name}"]`)!;
const slider = (host: HTMLElement) => host.querySelector<HTMLInputElement>('input[type="range"][name="olay"]')!;
function choose(input: HTMLSelectElement, value: string): void {
  input.value = value;
  input.dispatchEvent(new Event('change', { bubbles: true }));
}
const key = (player: ReturnType<typeof setup>['player'], k: string): void => katmanPage.shortcuts!(player).find((s) => s.keys.includes(k))!.run();
const iz = (p: Parameters<typeof deriveKatmanView>[0]): number => deriveKatmanView({ ...p, gorunum: 'akis', olay: 999 }).sequence.messages.length;

describe('katmanli-mimari Lab controls', () => {
  it('selects list the lab values', () => {
    const { host } = setup(1280, 540, 'lab');
    const values = (name: string): string[] => [...sel(host, name).options].map((o) => o.value);
    expect(values('ogrenciNumarasi')).toEqual(['2024001', '2024999', '']);
    expect(values('kitapKodu')).toEqual(['JAVA-101', 'TS-201', '']);
    expect(values('mevcutOduncSayisi')).toEqual(['0', '1', '2', '3']);
    expect(values('tekrar')).toEqual(['1', '2']);
    const cb = host.querySelector<HTMLInputElement>('input[type="checkbox"][name="uygunMu"]')!;
    expect(cb.checked).toBe(true);
    expect(host.textContent).toContain('Kitap başlangıçta uygun');
  });

  it('changing a field resets olay to the trace length', () => {
    const { host, player } = setup(1280, 540, 'lab');
    go(player, 'okuma');
    choose(sel(host, 'kitapKodu'), '');
    const p = player.state.params;
    expect(p.kitapKodu).toBe('');
    expect(p.gorunum).toBe('akis');
    expect(p.olay).toBe(iz(p));
    expect(slider(host).max).toBe(String(iz(p)));
    expect(slider(host).value).toBe(String(iz(p)));
    choose(sel(host, 'tekrar'), '2');
    expect(player.state.params.olay).toBe(iz(player.state.params));
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

  it('U toggles uygunMu', () => {
    const { host, player } = setup(1280, 540, 'lab');
    key(player, 'u');
    expect(player.state.params.uygunMu).toBe(false);
    expect(host.querySelector<HTMLInputElement>('input[name="uygunMu"]')!.checked).toBe(false);
    key(player, 'U');
    expect(player.state.params.uygunMu).toBe(true);
  });

  it('[ and ] move olay within bounds', () => {
    const { host, player } = setup(1280, 540, 'lab');
    choose(sel(host, 'tekrar'), '1');
    const n = iz(player.state.params);
    key(player, ']');
    expect(player.state.params.olay).toBe(n);
    key(player, '[');
    expect(player.state.params.olay).toBe(n - 1);
    expect(slider(host).value).toBe(String(n - 1));
    for (let i = 0; i < n + 3; i++) key(player, '[');
    expect(player.state.params.olay).toBe(0);
    key(player, ']');
    expect(player.state.params.olay).toBe(1);
  });

  it('the page describes itself', () => {
    expect(katmanPage.title).toBe('Katmanlı mimari: controller, service, repository');
    expect(katmanPage.chapter).toBe('Bölüm 9 · Katmanlı Backend Mimarisi ve Uygulama Tasarımı');
  });
});
