import { describe, expect, it } from 'vitest';
import { LISTINGS } from '../../../src/concepts/nginx-tls/code-text';
import { nginxScenario as sc, type NginxTlsParams } from '../../../src/concepts/nginx-tls/scenario';
import { deriveNginxView, nginxLabRozet } from '../../../src/concepts/nginx-tls/view';
import { listing } from '../../../src/core/listing';

const step = (n: number): NginxTlsParams => sc.steps[n - 1].params as NginxTlsParams;
const view = (n: number, kitapCiktisi = true) => deriveNginxView(step(n), kitapCiktisi);
const gorulen = (v: ReturnType<typeof deriveNginxView>) => Object.fromEntries(v.gorulen!.satirlar.map((r) => [r.cells[0], r.cells[1]]));
/** Book line L of a listing, looked up by the test itself so it reads the text, not a number. */
const satir = (id: string, L: number) => { const l = listing(LISTINGS, id); return l.lines[L - l.satirlar[0]]; };
const odak = (v: ReturnType<typeof deriveNginxView>) => v.code.active.map((i) => v.code.lines[i - 1]);

describe('nginx-tls view', () => {
  it('step 1 and 11 carry the book blocks verbatim', () => {
    const v = view(1);
    expect(v.kitap!.tanim).toMatch(/^Reverse proxy, istemcilerden gelen HTTP\(S\) isteklerini/);
    expect(v.kitap!.paragraflar![0]).toMatch(/`docker compose`|docker compose/);
    expect(v.kitap!.paragraflar![0]).not.toContain('`');
    expect(v.kitap!.notlar).toHaveLength(2);
    expect(v.kitap!.notlar.join(' ')).toContain('127.0.0.1');
    expect(v.kitap!.notlar.join(' ')).toContain('502 Bad Gateway');
    expect(v.sequence).toBeNull();
    const o = view(11).kitap!;
    expect(o.tablolar.map((t) => [t.baslik, t.satirlar.length])).toEqual([['Alternatifler', 4], ['Alternatifler', 4]]);
    expect(o.tablolar[0].satirlar[3].cells[0]).toBe('Caddy sunucusu');
    expect(o.tablolar[1].satirlar[0].cells[0]).toBe("Let's Encrypt + certbot (bu bölümde örneklenen)");
    expect(o.notlar[0]).toMatch(/^Sınav Notu: Nginx trafiği API'nin önünde/);
  });

  it('step 2 the 5432 arrow stops at UFW', () => {
    const v = view(2);
    const m = v.sequence!.messages;
    expect(m.map((x) => x.label.match(/:\d+/)?.[0])).toEqual([':443', ':443', ':3000', ':3000', ':5432', ':5432']);
    expect(m.at(-1)).toMatchObject({ to: 'ufw', tone: 'alarm' });
    expect(m[1]).toMatchObject({ from: 'ufw', to: 'nginx', tone: 'ok' });
    expect(new Set(m.map((x) => x.id)).size).toBe(m.length);
    expect(v.denetim!.denetimler[0]).toMatchObject({ ad: 'UFW', durum: 'kaldi' });
    expect(v.yanitYok).toBe('yanıt yok: paket düşürüldü');
    expect(v.kartlar.yanitlar).toEqual([]);
    expect(v.gorulen).toBeNull();
    expect(odak(v)).toEqual([satir('kod-15-2', 215), satir('kod-15-2', 219), satir('kod-15-2', 220), satir('kod-15-2', 221)]);
    expect(odak(view(2, false))).toEqual([satir('kod-15-2', 215)]);
  });

  it('step 3 and 4 show the forwarded headers or none', () => {
    const v3 = view(3);
    expect(gorulen(v3)).toMatchObject({ 'X-Real-IP': '203.0.113.7', 'X-Forwarded-For': '203.0.113.7', 'X-Forwarded-Proto': 'http', "bağlantı IP'si": '127.0.0.1' });
    expect(v3.denetim!.baslik).toBe('İstek yolu');
    expect(v3.gorulen!.baslik).toBe('Uygulamanın gördüğü');
    expect(v3.gorulen!.sutunlar.map((s) => s.ad)).toEqual(['alan', 'değer']);
    expect(v3.gorulen!.satirlar).toHaveLength(8);
    expect(odak(v3)).toEqual([303, 304, 305, 306, 307].map((n) => satir('kod-15-3', n)));
    expect(v3.xff).toBeNull();
    expect(v3.sertifika).toBeNull();
    expect(v3.certbot).toBeNull();
    const v4 = view(4);
    expect(gorulen(v4)).toMatchObject({ 'X-Real-IP': 'yok', 'X-Forwarded-For': 'yok' });
    expect(odak(v4)).toEqual([satir('code-004', 351)]);
    expect(v4.notlar).toHaveLength(1);
    expect(v4.notlar[0]).toMatch(/^Dikkat noktası: Bu başlıklar eklenmezse/);
    expect(odak(view(4, false))).toEqual([satir('kod-15-3', 303)]);
  });

  it('step 5 terminal 203.0.113.7 and first strip part highlighted', () => {
    const v = view(5);
    expect(v.kartlar.terminal).toEqual([{ metin: '203.0.113.7' }]);
    expect(v.xff!.parcalar.map((p) => p.metin)).toEqual(['203.0.113.7', '10.0.0.5']);
    expect(v.xff!.parcalar[0]).toMatchObject({ ton: 1, fark: [...Array(11).keys()] });
    expect(v.xff!.parcalar[1].fark ?? []).toEqual([]);
    expect(v.sequence).toBeNull();
    expect(v.denetim).toBeNull();
    expect(odak(v)).toEqual([satir('code-004', 360)]);
    expect(odak(view(5, false))).toEqual(odak(v));
  });

  it('step 6 dogruIstemciIpAl 1.2.3.4 and req.ip 203.0.113.7', () => {
    const v = view(6);
    expect(gorulen(v)).toMatchObject({ 'dogruIstemciIpAl(...)': '1.2.3.4', 'req.ip': '203.0.113.7', 'X-Forwarded-For': '1.2.3.4, 203.0.113.7' });
    expect(v.xff!.ayirici).toBe(', ');
    expect(v.xff!.parcalar).toMatchObject([
      { metin: '1.2.3.4', etiket: 'istemcinin gönderdiği', ton: 3 },
      { metin: '203.0.113.7', etiket: "Nginx'in eklediği", ton: 1 },
    ]);
    expect(odak(v)).toEqual([satir('code-004', 360)]);
  });

  it('step 7 301 with Location and no arrow to the app lane', () => {
    const v = view(7);
    expect(v.kartlar.yanitlar[0]).toMatchObject({ durumKodu: 301, basliklar: [['Location', 'https://kutuphane.mehmetakif.edu.tr/api/kitaplar']] });
    expect(v.sequence!.messages.some((m) => m.to === 'uygulama' || m.from === 'uygulama')).toBe(false);
    expect(v.notlar).toHaveLength(2);
    expect(v.notlar[0]).toMatch(/^Dikkat noktası: 301 yönlendirmesi/);
    expect(v.notlar[1]).toMatch(/^Yaygın hatalar\. En yaygın hata/);
    expect(v.sertifika).toBeNull();
  });

  it('step 8 Host 127.0.0.1:3000, XFF yok, Proto https', () => {
    const v = view(8);
    expect(gorulen(v)).toMatchObject({ Host: '127.0.0.1:3000', 'X-Forwarded-For': 'yok', 'X-Forwarded-Proto': 'https', 'req.protocol': 'http' });
    expect(v.notlar).toEqual(["Nginx varsayılanı: Host = $proxy_host (127.0.0.1:3000); Kod 15.5'in 443 bloğu yalnız X-Forwarded-Proto ekler."]);
    expect(odak(v)).toEqual([460, 463, 464, 468].map((n) => satir('kod-15-5', n)));
    expect(v.xff).toBeNull();
    expect(v.sertifika!.baslik).toBe('Sertifika');
  });

  it('step 9 certbot list and certificate table, no terminal', () => {
    const v = view(9);
    expect(v.certbot!.baslik).toBe('Certbot');
    expect(v.certbot!.denetimler.map((d) => [d.ad, d.durum])).toEqual([
      ['HTTP-01 Challenge', 'gecti'], ['Sertifika Enjeksiyonu', 'gecti'], ['Otomatik Yenileme', 'gecti'],
    ]);
    expect(v.sertifika!.sutunlar.map((s) => s.ad)).toEqual(['kalan gün', 'durum', 'yenileme eşiği']);
    expect(v.sertifika!.satirlar[0].cells).toEqual([90, 'gecerli', '30 gün']);
    expect(v.kartlar.terminal).toEqual([]);
    expect(v.sequence).toBeNull();
    expect(odak(v)).toEqual([548, 549, 550, 551, 552, 553].map((n) => satir('kod-15-6', n)));
  });

  it('step 10 502 and Uygulama atlandi', () => {
    const v = view(10);
    expect(v.kartlar.yanitlar[0]).toMatchObject({ durumKodu: 502 });
    expect(v.denetim!.denetimler.at(-1)).toMatchObject({ ad: 'Uygulama', durum: 'atlandi' });
    expect(v.denetim!.denetimler.at(-2)).toMatchObject({ ad: 'Proxy', durum: 'kaldi', sonuc: '502' });
    expect(v.gorulen).toBeNull();
    expect(odak(v)).toEqual([satir('kod-15-5', 467)]);
  });

  it('table hides on 301 and on no response', () => {
    expect(view(7).gorulen).toBeNull();
    expect(deriveNginxView({ ...step(8), hedef: 'port-3000' }).gorulen).toBeNull();
    expect(deriveNginxView({ ...step(8), kalanGun: 0 }).gorulen).toBeNull();
    expect(deriveNginxView({ ...step(8), kalanGun: 0 }).yanitYok).toMatch(/güvensiz uyarısı/);
    expect(deriveNginxView({ ...step(8), kalanGun: 0 }).kartlar.yanitlar).toEqual([]);
    expect(deriveNginxView({ ...step(8), uygulama: 'kapali' }).gorulen).toBeNull();
    expect(view(8).yanitYok).toBeNull();
  });

  it('xff strip shows only for a two-part chain', () => {
    expect(deriveNginxView({ ...step(6), sahteXff: false }).xff).toBeNull();
    expect(deriveNginxView({ ...step(6), ayar: 'basliksiz' }).xff).toBeNull();
  });

  it('certbot renewal row follows the certificate', () => {
    const satiri = (kalanGun: number) => deriveNginxView({ ...step(8), kalanGun }).certbot!.denetimler;
    expect(satiri(60).map((d) => d.durum)).toEqual(['gecti', 'gecti', 'gecti']);
    expect(satiri(20).map((d) => d.durum)).toEqual(['gecti', 'gecti', 'bekliyor']);
    expect(satiri(20)[2].ayrinti).toBe('kalan < 30 gün: yenilenecek');
    expect(satiri(0).map((d) => d.durum)).toEqual(['gecti', 'gecti', 'kaldi']);
    expect(deriveNginxView({ ...step(8), kalanGun: 29 }).sertifika!.satirlar[0].cells).toEqual([29, 'yenilenecek', '30 gün']);
    expect(deriveNginxView({ ...step(8), hedef: 'http-80' }).certbot).toBeNull();
    expect(deriveNginxView({ ...step(8), hedef: 'http-80' }).sertifika).toBeNull();
  });

  it('code strip focus line text', () => {
    const v = view(7);
    expect(v.code.lines[v.code.active[0] - 1]).toBe('    return 301 https://$host$request_uri;');
    expect(v.code.title).toBe(listing(LISTINGS, 'kod-15-5').title);
    // Lab: the setting's listing, the deciding line
    const lab = (p: Partial<NginxTlsParams>) => odak(deriveNginxView({ ...step(8), ...p }, false));
    expect(lab({ hedef: 'http-80' })).toEqual([satir('kod-15-5', 456)]);
    expect(lab({})).toEqual([satir('kod-15-5', 467)]);
    expect(lab({ hedef: 'port-3000' })).toEqual([satir('kod-15-2', 215)]);
    expect(lab({ hedef: 'http-80', ayar: 'kod-15-3' })).toEqual([satir('kod-15-3', 303)]);
    expect(lab({ hedef: 'http-80', ayar: 'code-007' })).toEqual([satir('code-007', 514)]);
    expect(lab({ hedef: 'http-80', ayar: 'basliksiz' })).toEqual([satir('kod-15-3', 303)]);
  });

  it('code-007 on 443 uses the Kod 15.5 block, on 80 its own line', () => {
    const lab = (p: Partial<NginxTlsParams>) => odak(deriveNginxView({ ...step(8), ayar: 'code-007', ...p }, false));
    expect(lab({ hedef: 'https-443' })).toEqual([satir('kod-15-5', 467)]);
    expect(lab({ hedef: 'https-443', kalanGun: 0 })).toEqual([satir('kod-15-5', 463)]);
    expect(lab({ hedef: 'https-443', uygulama: 'kapali' })).toEqual([satir('kod-15-5', 467)]);
    expect(lab({ hedef: 'http-80' })).toEqual([satir('code-007', 514)]);
    expect(deriveNginxView({ ...step(8), ayar: 'code-007', hedef: 'https-443' }, false).code.title).toBe(listing(LISTINGS, 'kod-15-5').title);
  });

  it('flag: expired certificate, sahteXff and certbot in Ders and Lab', () => {
    for (const k of [true, false]) expect(odak(deriveNginxView({ ...step(8), kalanGun: 0 }, k))).toEqual([satir('kod-15-5', 463)]);
    expect(odak(deriveNginxView(step(6), false))).toEqual([satir('kod-15-3', 303)]);
    expect(odak(deriveNginxView(step(6), true))).toEqual([satir('code-004', 360)]);
    for (const k of [true, false]) expect(odak(deriveNginxView(step(9), k))).toEqual([548, 549, 550, 551, 552, 553].map((n) => satir('kod-15-6', n)));
  });

  it('every step and lab combination derives without throwing', () => {
    for (let n = 1; n <= 11; n++) for (const k of [true, false]) expect(() => view(n, k)).not.toThrow();
    for (const hedef of ['http-80', 'https-443', 'port-3000', 'port-5432'] as const)
      for (const ayar of ['kod-15-3', 'kod-15-5', 'code-007', 'basliksiz'] as const)
        for (const uygulama of ['ayakta', 'kapali'] as const)
          for (const trustProxy of [0, 1, 2] as const)
            for (const sahteXff of [false, true])
              for (const kalanGun of [0, 29, 30, 90])
                expect(() => deriveNginxView({ asama: 'akis', hedef, ayar, uygulama, trustProxy, sahteXff, kalanGun }, false)).not.toThrow();
  });

  it('lab badge is always book code', () => {
    expect(nginxLabRozet(step(8))).toEqual({ tur: 'kitap-kodu' });
    expect(nginxLabRozet({ ...step(10), kalanGun: 0 })).toEqual({ tur: 'kitap-kodu' });
  });
});
