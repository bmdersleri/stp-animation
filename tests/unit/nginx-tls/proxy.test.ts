import { describe, expect, it } from 'vitest';
import {
  ISTEMCI_IP, LISTINGS, SAHTE_XFF, SOKET_IP, YOL, dogruIstemciIpAl, expressProtokol, expressReqIp,
  istekIsle, proxyBasliklari, sertifikaDurumu, ufwKarari, yanlisIstemciIpAl,
  type Ayar, type Hedef, type NginxParams,
} from '../../../src/concepts/nginx-tls/proxy';

const p = (o: Partial<NginxParams> = {}): NginxParams => ({
  hedef: 'https-443', ayar: 'kod-15-5', uygulama: 'ayakta', trustProxy: 0, sahteXff: false, kalanGun: 60, ...o,
});
const gorur = (o: Partial<NginxParams>) => Object.fromEntries(istekIsle(p(o)).uygulamaGorur!);
const durumlar = (o: Partial<NginxParams>) => istekIsle(p(o)).denetimler.map((d) => d.durum);
const listing = (id: string) => LISTINGS.find((l) => l.id === id)!;

describe('nginx-tls proxy model', () => {
  it('book output L369', () => {
    expect(dogruIstemciIpAl('203.0.113.7, 10.0.0.5', '10.0.0.5')).toBe(listing('code-004-cikti').lines[0]);
    expect(dogruIstemciIpAl('203.0.113.7, 10.0.0.5', '10.0.0.5')).toBe('203.0.113.7');
    expect(dogruIstemciIpAl(undefined, '10.0.0.5')).toBe('10.0.0.5');
    expect(yanlisIstemciIpAl('127.0.0.1')).toBe('127.0.0.1');
  });

  it('ufw allows 22 80 443 only', () => {
    for (const port of [22, 80, 443]) expect(ufwKarari(port)).toBe('izin');
    for (const port of [3000, 5432]) expect(ufwKarari(port)).toBe('engel');
  });

  it('http 80 with kod-15-3', () => {
    const g = gorur({ hedef: 'http-80', ayar: 'kod-15-3' });
    expect(g.Host).toBe('kutuphane.mehmetakif.edu.tr');
    expect(g['X-Real-IP']).toBe(ISTEMCI_IP);
    expect(g['X-Forwarded-For']).toBe('203.0.113.7');
    expect(g['X-Forwarded-Proto']).toBe('http');
    expect(g['req.ip']).toBe('127.0.0.1');
    expect(gorur({ hedef: 'http-80', ayar: 'kod-15-3', trustProxy: 1 })['req.ip']).toBe('203.0.113.7');
    expect(g['dogruIstemciIpAl(...)']).toBe('203.0.113.7');
    expect(g["bağlantı IP'si"]).toBe(SOKET_IP);
    expect(istekIsle(p({ hedef: 'http-80', ayar: 'kod-15-3' })).uygulamaGorur).toHaveLength(8);
  });

  it('spoofed XFF is appended on 80', () => {
    const o = { hedef: 'http-80', ayar: 'kod-15-3', sahteXff: true } as const;
    expect(gorur(o)['X-Forwarded-For']).toBe('1.2.3.4, 203.0.113.7');
    expect(gorur(o)['dogruIstemciIpAl(...)']).toBe(SAHTE_XFF);
    expect(gorur({ ...o, trustProxy: 1 })['req.ip']).toBe('203.0.113.7');
    expect(gorur({ ...o, trustProxy: 2 })['req.ip']).toBe('1.2.3.4');
  });

  it('https 443 with kod-15-5', () => {
    const g = gorur({});
    expect(g.Host).toBe('127.0.0.1:3000');
    expect(g['X-Forwarded-For']).toBe('yok');
    expect(g['X-Real-IP']).toBe('yok');
    expect(g['X-Forwarded-Proto']).toBe('https');
    expect(g['req.ip']).toBe('127.0.0.1');
    expect(g['req.protocol']).toBe('http');
    expect(gorur({ trustProxy: 1 })['req.protocol']).toBe('https');
  });

  it('spoofed XFF passes unchanged on 443', () => {
    expect(gorur({ sahteXff: true })['X-Forwarded-For']).toBe('1.2.3.4');
    expect(gorur({ sahteXff: true, trustProxy: 1 })['req.ip']).toBe('1.2.3.4');
    expect(gorur({ sahteXff: true })['dogruIstemciIpAl(...)']).toBe('1.2.3.4');
  });

  it('http 80 with kod-15-5 redirects', () => {
    const r = istekIsle(p({ hedef: 'http-80' }));
    expect(r.yanit!.durumKodu).toBe(301);
    expect(r.yanit!.durumMetni).toBe('Moved Permanently');
    expect(r.yanit!.basliklar).toEqual([['Location', 'https://kutuphane.mehmetakif.edu.tr/api/kitaplar']]);
    expect(r.uygulamaGorur).toBeNull();
    expect(r.denetimler.map((d) => d.ad)).toEqual(['UFW', 'TLS', 'Yönlendirme', 'Proxy', 'Uygulama']);
    expect(r.denetimler.map((d) => d.durum)).toEqual(['gecti', 'atlandi', 'gecti', 'atlandi', 'atlandi']);
    expect(r.denetimler[2].sonuc).toBe('301');
    expect(r.denetimler[1].ayrinti).toBe('HTTP: TLS yok');
  });

  it('expired certificate gives no response', () => {
    const r = istekIsle(p({ kalanGun: 0 }));
    expect(r.yanit).toBeNull();
    expect(r.yanitYok).toBe('yanıt yok: tarayıcı güvensiz uyarısı (sertifika süresi dolmuş)');
    expect(r.uygulamaGorur).toBeNull();
    expect(durumlar({ kalanGun: 0 })).toEqual(['gecti', 'kaldi', 'atlandi', 'atlandi', 'atlandi']);
  });

  it('app down gives 502 from nginx', () => {
    const r = istekIsle(p({ uygulama: 'kapali' }));
    expect(r.yanit!.durumKodu).toBe(502);
    expect(r.yanit!.durumMetni).toBe('Bad Gateway');
    expect(r.denetimler.map((d) => d.durum)).toEqual(['gecti', 'gecti', 'gecti', 'kaldi', 'atlandi']);
    expect(r.uygulamaGorur).toBeNull();
  });

  it('no 443 block refuses', () => {
    for (const ayar of ['kod-15-3', 'basliksiz'] as const) {
      const r = istekIsle(p({ ayar }));
      expect(r.yanit).toBeNull();
      expect(r.yanitYok).toBe("443'te dinleyen blok yok: bağlantı reddedildi");
      expect(r.uygulamaGorur).toBeNull();
    }
  });

  it('ufw drop stops at ufw', () => {
    for (const hedef of ['port-5432', 'port-3000'] as const) {
      const r = istekIsle(p({ hedef }));
      expect(r.olaylar[r.olaylar.length - 1].to).toBe('ufw');
      expect(r.yanit).toBeNull();
      expect(r.yanitYok).toBe('yanıt yok: paket düşürüldü');
      expect(r.denetimler.map((d) => d.durum)).toEqual(['kaldi', 'atlandi', 'atlandi', 'atlandi', 'atlandi']);
    }
  });

  it('certificate thresholds at 30 and 0', () => {
    expect([90, 30].map(sertifikaDurumu)).toEqual(['gecerli', 'gecerli']);
    expect([29, 1].map(sertifikaDurumu)).toEqual(['yenilenecek', 'yenilenecek']);
    expect(sertifikaDurumu(0)).toBe('suresi-doldu');
  });

  it('express helpers', () => {
    expect(expressReqIp('127.0.0.1', '1.2.3.4', 0)).toBe('127.0.0.1');
    expect(expressProtokol('https', 0)).toBe('http');
    expect(expressProtokol('https, http', 2)).toBe('https');
    expect(expressProtokol(undefined, 1)).toBe('http');
  });

  it('proxy headers per setting', () => {
    const gelen: [string, string][] = [['Host', 'kutuphane.mehmetakif.edu.tr']];
    expect(proxyBasliklari('basliksiz', 80, gelen, ISTEMCI_IP)).toEqual([['Host', '127.0.0.1:3000']]);
    expect(proxyBasliklari('code-007', 80, gelen, ISTEMCI_IP)).toEqual([['Host', '127.0.0.1:3000']]);
    expect(proxyBasliklari('code-007', 443, gelen, ISTEMCI_IP)).toEqual(proxyBasliklari('kod-15-5', 443, gelen, ISTEMCI_IP));
    expect(proxyBasliklari('kod-15-5', 443, gelen, ISTEMCI_IP)).toEqual([['Host', '127.0.0.1:3000'], ['X-Forwarded-Proto', 'https']]);
  });

  it('every lab combination yields a defined trace', () => {
    const hedefler: Hedef[] = ['http-80', 'https-443', 'port-3000', 'port-5432'];
    const ayarlar: Ayar[] = ['kod-15-3', 'kod-15-5', 'code-007', 'basliksiz'];
    let n = 0;
    for (const hedef of hedefler) for (const ayar of ayarlar) for (const uygulama of ['ayakta', 'kapali'] as const)
      for (const trustProxy of [0, 1, 2] as const) for (const sahteXff of [false, true])
        for (const kalanGun of [0, 29, 30, 90]) {
          const r = istekIsle({ hedef, ayar, uygulama, trustProxy, sahteXff, kalanGun });
          n++;
          expect(r.denetimler).toHaveLength(5);
          expect(r.olaylar.length).toBeGreaterThan(0);
          expect(r.istek.yol).toBe(YOL);
          expect(r.yanit !== null || typeof r.yanitYok === 'string').toBe(true);
          expect(r.yanit !== null && r.yanitYok !== undefined).toBe(false);
          if (r.uygulamaGorur) expect(r.uygulamaGorur).toHaveLength(8);
          expect(new Set(r.olaylar.map((m) => m.id)).size).toBe(r.olaylar.length);
        }
    expect(n).toBe(768);
  });

  it('request card carries the fake XFF', () => {
    expect(istekIsle(p()).istek.basliklar).toEqual([['Host', 'kutuphane.mehmetakif.edu.tr']]);
    expect(istekIsle(p({ sahteXff: true })).istek.basliklar).toEqual([
      ['Host', 'kutuphane.mehmetakif.edu.tr'], ['X-Forwarded-For', '1.2.3.4'],
    ]);
    expect(istekIsle(p()).istek.kaynak).toBe(ISTEMCI_IP);
  });

  it('listings match book', () => {
    expect(listing('kod-15-3').lines).toHaveLength(12);
    expect(listing('kod-15-3').lines[0]).toBe('server {');
    const c = listing('code-004').lines;
    expect(c[c.length - 1]).toBe('// Çıktı: 203.0.113.7');
    const k = listing('kod-15-6').lines;
    expect(k[k.length - 1]).toBe('systemctl status certbot.timer');
    for (const l of LISTINGS) expect(l.lines).toHaveLength(l.satirlar[1] - l.satirlar[0] + 1);
    expect(LISTINGS).toHaveLength(7);
  });
});
