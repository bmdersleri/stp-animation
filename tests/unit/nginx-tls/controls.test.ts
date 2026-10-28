// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { go, setup } from './harness';

const input = (host: HTMLElement, name: string) => host.querySelector<HTMLInputElement>(`input[name="${name}"]`)!;
const sel = (host: HTMLElement, name: string) => host.querySelector<HTMLSelectElement>(`select[name="${name}"]`)!;
function choose(s: HTMLSelectElement, value: string): void {
  s.value = value;
  s.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('nginx-tls Lab controls', () => {
  it('lists the lab values', () => {
    const { host } = setup(1280, 540, 'lab');
    expect([...sel(host, 'hedef').options].map((o) => o.value)).toEqual(['http-80', 'https-443', 'port-3000', 'port-5432']);
    expect([...sel(host, 'ayar').options].map((o) => o.value)).toEqual(['kod-15-3', 'kod-15-5', 'code-007', 'basliksiz']);
    expect([...sel(host, 'trustProxy').options].map((o) => o.value)).toEqual(['0', '1', '2']);
    const k = input(host, 'kalanGun');
    expect([k.min, k.max, k.step]).toEqual(['0', '90', '1']);
  });

  it('kalanGun slider writes a number', () => {
    const { host, player } = setup(1280, 540, 'lab');
    const k = input(host, 'kalanGun');
    k.value = '29';
    k.dispatchEvent(new Event('input', { bubbles: true }));
    expect(player.state.params.kalanGun).toBe(29);
    expect(k.closest('.ctl')!.querySelector('output')!.textContent).toBe('29 gün');
  });

  it('selects write typed values', () => {
    const { host, player } = setup(1280, 540, 'lab');
    choose(sel(host, 'trustProxy'), '2');
    choose(sel(host, 'sahteXff'), 'var');
    choose(sel(host, 'uygulama'), 'kapali');
    expect(player.state.params).toMatchObject({ trustProxy: 2, sahteXff: true, uygulama: 'kapali' });
  });

  it('lab change sets asama akis', () => {
    const { host, player } = setup(1280, 540, 'lab');
    go(player, 'certbot');
    expect(player.state.params.asama).toBe('certbot');
    choose(sel(host, 'hedef'), 'port-3000');
    expect(player.state.params).toMatchObject({ asama: 'akis', hedef: 'port-3000' });
  });

  it('controls follow a step change', () => {
    const { host, player } = setup(1280, 540, 'lab');
    go(player, 'basliksiz-ip');
    expect(sel(host, 'ayar').value).toBe('basliksiz');
    expect(sel(host, 'hedef').value).toBe('http-80');
  });
});
