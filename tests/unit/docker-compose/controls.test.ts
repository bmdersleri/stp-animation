// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { go, setup } from './harness';

const input = (host: HTMLElement, name: string) => host.querySelector<HTMLInputElement>(`input[name="${name}"]`)!;
const sel = (host: HTMLElement, name: string) => host.querySelector<HTMLSelectElement>(`select[name="${name}"]`)!;
function choose(s: HTMLSelectElement, value: string): void {
  s.value = value;
  s.dispatchEvent(new Event('change', { bubbles: true }));
}
function slide(i: HTMLInputElement, value: string): void {
  i.value = value;
  i.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('docker-compose Lab controls', () => {
  it('lists the lab values', () => {
    const { host } = setup(1280, 540, 'lab');
    const db = input(host, 'dbHazirMs');
    expect([db.min, db.max, db.step]).toEqual(['0', '30000', '500']);
    expect([...sel(host, 'mod').options].map((o) => [o.value, o.textContent])).toEqual([['sira', 'depends_on (sıra)'], ['saglikli', 'service_healthy']]);
    expect([...sel(host, 'hostAdi').options].map((o) => o.value)).toEqual(['kutuphane-db', 'localhost']);
    for (const n of ['retries', 'maksimumDeneme']) expect([input(host, n).min, input(host, n).max]).toEqual(['1', '10']);
  });

  it('slider writes dbHazirMs in ms', () => {
    const { host, player } = setup(1280, 540, 'lab');
    slide(input(host, 'dbHazirMs'), '7500');
    expect(player.state.params.dbHazirMs).toBe(7500);
    expect(input(host, 'dbHazirMs').closest('.ctl')!.querySelector('output')!.textContent).toBe('t = 7,5 s');
  });

  it('retries hides in sira mode', () => {
    const { host, player } = setup(1280, 540, 'lab');
    const kutu = input(host, 'retries').closest<HTMLElement>('.ctl')!;
    expect(kutu.hidden).toBe(false);
    choose(sel(host, 'mod'), 'sira');
    expect(player.state.params.mod).toBe('sira');
    expect(kutu.hidden).toBe(true);
    choose(sel(host, 'mod'), 'saglikli');
    expect(kutu.hidden).toBe(false);
  });

  it('lab change sets asama compose', () => {
    const { host, player } = setup(1280, 540, 'lab');
    go(player, 'yeniden-deneme');
    expect(player.state.params.asama).toBe('kod-14-9');
    choose(sel(host, 'hostAdi'), 'localhost');
    expect(player.state.params).toMatchObject({ asama: 'compose', hostAdi: 'localhost' });
    go(player, 'tanitim');
    slide(input(host, 'maksimumDeneme'), '9');
    expect(player.state.params).toMatchObject({ asama: 'compose', maksimumDeneme: 9 });
  });

  it('controls follow a step change', () => {
    const { host, player } = setup(1280, 540, 'lab');
    go(player, 'depends-on-sira');
    expect(sel(host, 'mod').value).toBe('sira');
    expect(input(host, 'maksimumDeneme').value).toBe('1');
  });
});
