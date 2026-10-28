// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { go, setup } from './harness';

const input = (host: HTMLElement, name: string) => host.querySelector<HTMLInputElement>(`input[name="${name}"]`)!;
const sel = (host: HTMLElement, name: string) => host.querySelector<HTMLSelectElement>(`select[name="${name}"]`)!;
function slide(i: HTMLInputElement, value: number | string): void {
  i.value = String(value);
  i.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('iot-zaman-serisi Lab controls', () => {
  it('lists the lab ranges', () => {
    const { host } = setup(1280, 540, 'lab');
    const r = (n: string) => [input(host, n).min, input(host, n).max, input(host, n).step];
    expect(r('saatFarki')).toEqual(['-120', '120', '1']);
    expect(r('sicaklik')).toEqual(['-999', '120', '0.5']);
    expect(r('nem')).toEqual(['-10', '110', '0.1']);
    expect([...sel(host, 'govde').options].map((o) => o.value)).toEqual(['saglam', 'degismis', 'bilinmeyen']);
  });

  it('decimal sliders read as numbers', () => {
    const { host, player } = setup(1280, 540, 'lab');
    slide(input(host, 'nem'), 45.2);
    expect(player.state.params.nem).toBe(45.2);
    slide(input(host, 'sicaklik'), '-999');
    expect(player.state.params.sicaklik).toBe(-999);
    expect(input(host, 'sicaklik').closest('.ctl')!.querySelector('output')!.textContent).toBe('−999,0 °C');
  });

  it('saatFarki keeps -61', () => {
    const { host, player } = setup(1280, 540, 'lab');
    slide(input(host, 'saatFarki'), -61);
    expect(player.state.params.saatFarki).toBe(-61);
    expect(input(host, 'saatFarki').value).toBe('-61');
  });

  it('lab change sets asama istek', () => {
    const { host, player } = setup(1280, 540, 'lab');
    for (const id of ['dogrulamasiz', 'imza-uret', 'imza-dogrula', 'aralik-dogrulama', 'tampon-saatlik', 'tanitim']) {
      go(player, id);
      expect(player.state.params.asama, id).not.toBe('istek');
      slide(input(host, 'sicaklik'), 20);
      expect(player.state.params.asama, id).toBe('istek');
    }
    go(player, 'dogrulamasiz');
    sel(host, 'govde').value = 'degismis';
    sel(host, 'govde').dispatchEvent(new Event('change', { bubbles: true }));
    expect(player.state.params).toMatchObject({ asama: 'istek', govde: 'degismis' });
    go(player, 'tampon-saatlik');
    input(host, 'tekrar').checked = true;
    input(host, 'tekrar').dispatchEvent(new Event('change', { bubbles: true }));
    expect(player.state.params).toMatchObject({ asama: 'istek', tekrar: true });
  });

  it('a Lab change never reaches the unvalidated stage and its terminal line', () => {
    const { host, el, player } = setup(1280, 540, 'lab');
    go(player, 'dogrulamasiz');
    slide(input(host, 'sicaklik'), -999);
    expect(el.textContent).not.toContain('Kaydedildi:');
  });

  it('controls follow a step change', () => {
    const { host, player } = setup(1280, 540, 'lab');
    go(player, 'govde-degisti');
    expect(sel(host, 'govde').value).toBe('degismis');
    go(player, 'zaman-penceresi');
    expect(input(host, 'saatFarki').value).toBe('-61');
  });
});
