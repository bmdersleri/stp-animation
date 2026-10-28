// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { nginxScenario } from '../../../src/concepts/nginx-tls/scenario';
import { deriveNginxView } from '../../../src/concepts/nginx-tls/view';
import { go, setup, texts } from './harness';

const rozetler = (el: HTMLElement): HTMLElement[] => [...el.querySelectorAll<HTMLElement>('.rozet-yeri .kaynak-rozeti')];

describe('nginx-tls scene', () => {
  it('step 2 draws three requests, two stop at UFW', () => {
    const { el, player } = setup();
    go(player, 'guvenlik-duvari');
    expect(el.querySelectorAll('svg.plot .seq-lane')).toHaveLength(4);
    for (const port of ['443', '3000', '5432']) expect(el.querySelectorAll(`svg.plot g.seq-msg[data-id^="${port}-"]`).length, port).toBeGreaterThan(0);
    expect(el.querySelectorAll('svg.plot g.seq-msg')).toHaveLength(deriveNginxView(player.state.params, true).sequence!.messages.length);
    expect(el.querySelectorAll('.denetim-yeri:not([hidden]) .denetim').length).toBeGreaterThan(0);
  });

  it('step 7 shows 301 card with Location', () => {
    const { el, player } = setup();
    go(player, 'yonlendirme-301');
    expect(texts(el, '.yanit-karti').join(' ')).toContain('301');
    expect(texts(el, '.yanit-karti').join(' ')).toContain('Location');
    expect(el.querySelector<HTMLElement>('.gorulen-yeri')!.hidden).toBe(true);
  });

  it('Ders steps 8 and 10 show no certificate pieces, the Lab does', () => {
    const { el, player } = setup();
    for (const id of ['tls-sonlandirma', 'bad-gateway-502']) {
      go(player, id);
      expect(el.querySelector<HTMLElement>('.certbot-yeri')!.hidden, id).toBe(true);
      expect(el.querySelector<HTMLElement>('.sertifika-yeri')!.hidden, id).toBe(true);
    }
    player.setParam('kalanGun', 60);
    expect(el.querySelector<HTMLElement>('.certbot-yeri')!.hidden).toBe(false);
    expect(el.querySelector<HTMLElement>('.sertifika-yeri')!.hidden).toBe(false);
  });

  it("step 8's Nginx default note is the page's own and styled apart", () => {
    const { el, player } = setup();
    go(player, 'tls-sonlandirma');
    const not = el.querySelector<HTMLElement>('.nginx-not')!;
    expect(not.textContent).toMatch(/^Nginx varsayılanı: /);
    expect(not.classList.contains('nginx-sayfa-notu')).toBe(true);
    go(player, 'basliksiz-ip');
    expect(el.querySelector<HTMLElement>('.nginx-not')!.classList.contains('nginx-sayfa-notu')).toBe(false);
  });

  it('step 10 shows 502 card', () => {
    const { el, player } = setup();
    go(player, 'bad-gateway-502');
    expect(texts(el, '.yanit-karti').join(' ')).toContain('502');
    expect(el.querySelector<HTMLElement>('.gorulen-yeri')!.hidden).toBe(true);
  });

  it('ufw drop shows yanıt yok in place of the card', () => {
    const { el, player } = setup(1280, 540, 'lab');
    go(player, 'proxy-80');
    player.setParams({ asama: 'akis', hedef: 'port-3000' });
    const yok = el.querySelector<HTMLElement>('.nginx-sag-kolon > p.yanit-yok')!;
    expect(yok.hidden).toBe(false);
    expect(yok.textContent).toBe('yanıt yok: paket düşürüldü');
    expect(el.querySelector<HTMLElement>('.yanit-karti')!.hidden).toBe(true);
    expect(el.querySelector<HTMLElement>('.gorulen-yeri')!.hidden).toBe(true);
  });

  it('intro and summary show the book block in place of the diagram', () => {
    const { el, player } = setup();
    const blok = el.querySelector<HTMLElement>('.kitap-blok')!;
    expect(blok.hidden).toBe(false);
    expect(el.querySelector<HTMLElement>('.nginx-govde')!.hidden).toBe(true);
    go(player, 'ozet');
    expect(blok.hidden).toBe(false);
    expect(blok.querySelectorAll('.data-table')).toHaveLength(2);
    go(player, 'proxy-80');
    expect(blok.hidden).toBe(true);
    expect(el.querySelector<HTMLElement>('.nginx-govde')!.hidden).toBe(false);
  });

  it('rapid step jumps leave no duplicates', () => {
    const { el, player } = setup();
    for (const i of [10, 0, 9, 3, 8, 1, 5, 6]) player.goto(i);
    const v = deriveNginxView(player.state.params, true);
    expect(el.querySelectorAll('svg.plot g.seq-msg')).toHaveLength(v.sequence?.messages.length ?? 0);
    expect(el.querySelectorAll('svg.plot')).toHaveLength(1);
    expect(el.querySelectorAll('.http-cards')).toHaveLength(1);
    expect(el.querySelectorAll('.nginx-not')).toHaveLength(v.notlar.length);
    expect(el.querySelectorAll('.denetim-yeri:not(.certbot-yeri) .denetim')).toHaveLength(v.denetim?.denetimler.length ?? 0);
  });

  it('badge follows lab change and returns on step change', () => {
    const { el, player } = setup();
    go(player, 'tls-sonlandirma');
    expect(rozetler(el)[0].classList.contains('kaynak-standart')).toBe(true);
    player.setParam('kalanGun', 10);
    expect(rozetler(el)).toHaveLength(1);
    expect(rozetler(el)[0].classList.contains('kaynak-kitap-kodu')).toBe(true);
    go(player, 'tls-sonlandirma');
    expect(rozetler(el)).toHaveLength(1);
    expect(rozetler(el)[0].classList.contains('kaynak-standart')).toBe(true);
  });

  it('every step shows exactly one badge', () => {
    const { el, player } = setup();
    nginxScenario.steps.forEach((_, i) => {
      player.goto(i);
      expect(el.querySelectorAll('.kaynak-rozeti'), `step ${i + 1}`).toHaveLength(1);
    });
  });
});
