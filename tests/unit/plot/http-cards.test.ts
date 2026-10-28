// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { HttpCards, type HttpCardsSpec } from '../../../src/core/plot/http-cards';

const make = (): { host: HTMLElement; c: HttpCards } => {
  const host = document.createElement('div');
  document.body.append(host);
  return { host, c: new HttpCards(host) };
};
const spec = (extra: Partial<HttpCardsSpec> = {}): HttpCardsSpec => ({ yanitlar: [], terminal: [], ...extra });

describe('HttpCards', () => {
  it('method badge class follows the method', () => {
    const { host, c } = make();
    c.update(spec({ istek: { metot: 'PATCH', yol: '/api/ekipman/1', basliklar: [['x-api-anahtari', 'kitap-api-2026']], govde: '{\n  "durum": "rezerve"\n}' } }));
    const m = host.querySelector('.istek-karti .istek-satir .metot')!;
    expect(m.textContent).toBe('PATCH');
    expect(m.classList.contains('metot-patch')).toBe(true);
    expect(host.querySelector('.istek-karti code.yol')!.textContent).toBe('/api/ekipman/1');
    expect(host.querySelector('.istek-karti dl.alanlar dt')!.textContent).toBe('x-api-anahtari');
    expect(host.querySelector('.istek-karti pre.govde')!.textContent).toContain('"durum"');
    expect(host.querySelector('.istek-karti .kart-baslik')!.textContent).toBe('İstek');
  });

  it('204 shows gövde yok', () => {
    const { host, c } = make();
    c.update(spec({ yanitlar: [{ durumKodu: 204, durumMetni: 'No Content', govde: null }] }));
    expect(host.querySelector('.yanit-karti .govde-yok')!.textContent).toBe('gövde yok');
    const kod = host.querySelector('.yanit-karti .durum-kodu')!;
    expect(kod.textContent).toBe('204');
    expect(kod.classList.contains('ok')).toBe(true);
    expect(host.querySelector('.yanit-karti .durum-metni')!.textContent).toBe('No Content');
  });

  it('hanging request shows yanıt yok and no status', () => {
    const { host, c } = make();
    c.update(spec({ yanitlar: [{ durumKodu: 0, askida: true }] }));
    expect(host.querySelector('.yanit-karti .yanit-yok')!.textContent).toBe('yanıt yok — istemci bekliyor');
    expect(host.querySelector('.yanit-karti .durum-kodu')).toBeNull();
  });

  it('sira numbers each response', () => {
    const { host, c } = make();
    c.update(spec({
      yanitlar: [
        { durumKodu: 201, sira: 1, govde: '{\n  "a": 1\n}' },
        { durumKodu: 404, sira: 2, govde: 'Bulunamadı' },
      ],
    }));
    expect([...host.querySelectorAll('.yanit-karti .yanit .sira')].map((s) => s.textContent)).toEqual(['#1', '#2']);
    const kodlar = [...host.querySelectorAll('.yanit-karti .durum-kodu')];
    expect(kodlar.map((k) => k.classList.contains('alarm'))).toEqual([false, true]);
    expect(host.querySelector('.yanit pre.govde')).not.toBeNull();
    expect(host.querySelector('.yanit p.govde.mesaj')!.textContent).toBe('Bulunamadı');
  });

  it('stderr line has the stderr class', () => {
    const { host, c } = make();
    c.update(spec({ terminal: [{ metin: 'tamam' }, { metin: 'hata', akis: 'stderr' }], terminalBaslik: 'Sunucu günlüğü' }));
    const lines = [...host.querySelectorAll('.terminal .terminal-satir')];
    expect(lines.map((l) => l.classList.contains('stderr'))).toEqual([false, true]);
    expect(host.querySelector('.terminal .kart-baslik')!.textContent).toBe('Sunucu günlüğü');
  });

  it('empty spec hides cards and terminal', () => {
    const { host, c } = make();
    c.update(spec());
    for (const s of ['.istek-karti', '.yanit-karti', '.terminal']) expect(host.querySelector<HTMLElement>(s)!.hidden).toBe(true);
    expect(host.querySelector('.terminal .kart-baslik')).toBeNull();
    c.update(spec({ terminal: [{ metin: 'x' }] }));
    expect(host.querySelector<HTMLElement>('.terminal')!.hidden).toBe(false);
    expect(host.querySelector('.terminal .kart-baslik')!.textContent).toBe('Terminal');
  });

  it('OPTIONS method badge', () => {
    const { host, c } = make();
    c.update(spec({ istek: { metot: 'OPTIONS', yol: '/api/kitaplar' } }));
    const m = host.querySelector('.istek-satir .metot')!;
    expect(m.textContent).toBe('OPTIONS');
    expect(m.classList.contains('metot-options')).toBe(true);
  });

  it('eksikBasliklar renders alarm rows', () => {
    const { host, c } = make();
    c.update(spec({ yanitlar: [{ durumKodu: 204, govde: null, basliklar: [['allow', 'GET']], eksikBasliklar: ['access-control-allow-origin', 'access-control-allow-methods'] }] }));
    const li = [...host.querySelectorAll('.yanit li.eksik-baslik')];
    expect(li.map((l) => l.textContent)).toEqual(['access-control-allow-origin: yok', 'access-control-allow-methods: yok']);
  });

  it('kaynak shows on request card', () => {
    const { host, c } = make();
    c.update(spec({ istek: { metot: 'GET', yol: '/api/x', kaynak: 'http://localhost:5173' } }));
    const satir = host.querySelector('.istek-satir')!;
    expect(satir.querySelector('.kaynak')!.textContent).toBe('http://localhost:5173');
    expect(satir.textContent).toBe('http://localhost:5173 · GET /api/x');
  });

  it('update twice keeps one card of each kind', () => {
    const { host, c } = make();
    const s = spec({ istek: { metot: 'GET', yol: '/' }, yanitlar: [{ durumKodu: 200, govde: 'ok' }], terminal: [{ metin: 'a' }] });
    c.update(s);
    c.update(s);
    for (const sel of ['.http-cards', '.istek-karti', '.yanit-karti', '.terminal']) expect(host.querySelectorAll(sel)).toHaveLength(1);
    expect(host.querySelectorAll('.terminal-satir')).toHaveLength(1);
    c.destroy();
    expect(host.querySelector('.http-cards')).toBeNull();
  });
});
