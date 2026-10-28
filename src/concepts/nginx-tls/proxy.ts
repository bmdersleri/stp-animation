import { zincirle, type Denetim } from '../../core/plot/check-list';
import type { HttpIstek, HttpYanit } from '../../core/plot/http-cards';
import type { Message } from '../../core/plot/sequence';
import { LISTINGS } from './code-text';

export { LISTINGS };

export type Hedef = 'http-80' | 'https-443' | 'port-3000' | 'port-5432';
export type Ayar = 'kod-15-3' | 'kod-15-5' | 'code-007' | 'basliksiz';
export interface NginxParams {
  hedef: Hedef; ayar: Ayar; uygulama: 'ayakta' | 'kapali';
  trustProxy: 0 | 1 | 2; sahteXff: boolean; kalanGun: number;
}

export const ISTEMCI_IP = '203.0.113.7'; // L363
export const SUNUCU_ADI = 'kutuphane.mehmetakif.edu.tr'; // L300
export const UYGULAMA = '127.0.0.1:3000'; // L303
export const SOKET_IP = '127.0.0.1';
export const YOL = '/api/kitaplar';
export const SAHTE_XFF = '1.2.3.4';

const PORT: Record<Hedef, number> = { 'http-80': 80, 'https-443': 443, 'port-3000': 3000, 'port-5432': 5432 };
const DUSTU = 'yanıt yok: paket düşürüldü';

/** Kod 15.2, L215-221. */
export function ufwKarari(port: number): 'izin' | 'engel' {
  return port === 22 || port === 80 || port === 443 ? 'izin' : 'engel';
}

function bul(b: readonly [string, string][], ad: string): string | undefined {
  return b.find(([a]) => a.toLowerCase() === ad.toLowerCase())?.[1];
}

/** R16: client headers pass as they are; the block's `proxy_set_header`s replace same-named ones; `Host` defaults to `$proxy_host`. */
export function proxyBasliklari(
  ayar: Ayar, blok: 80 | 443, gelen: readonly [string, string][], istemciIp: string,
): [string, string][] {
  const eklenen: [string, string][] = [];
  let host = UYGULAMA;
  if (ayar === 'kod-15-3' && blok === 80) {
    const gelenHost = bul(gelen, 'Host');
    if (gelenHost !== undefined) host = gelenHost; // $host
    const gelenXff = bul(gelen, 'X-Forwarded-For');
    eklenen.push(
      ['X-Real-IP', istemciIp],
      ['X-Forwarded-For', gelenXff ? `${gelenXff}, ${istemciIp}` : istemciIp],
      ['X-Forwarded-Proto', 'http'],
    );
  } else if ((ayar === 'kod-15-5' || ayar === 'code-007') && blok === 443) {
    eklenen.push(['X-Forwarded-Proto', 'https']);
  }
  const adlar = new Set(eklenen.map(([a]) => a.toLowerCase()));
  const gecen = gelen.filter(([a]) => a.toLowerCase() !== 'host' && !adlar.has(a.toLowerCase()));
  return [['Host', host], ...gecen, ...eklenen];
}

/** L350-352. */
export function yanlisIstemciIpAl(baglantiIp: string): string {
  return baglantiIp;
}

/** L356-361. */
export function dogruIstemciIpAl(xForwardedFor: string | undefined, baglantiIp: string): string {
  if (!xForwardedFor) return baglantiIp;
  return xForwardedFor.split(',')[0].trim();
}

/** R17 (Express, proxy-addr): chain is [socket, ...XFF right to left]; the first `n` hops are trusted. */
export function expressReqIp(soketIp: string, xff: string | undefined, trustProxy: 0 | 1 | 2): string {
  if (trustProxy === 0) return soketIp;
  const zincir = [soketIp, ...(xff ? xff.split(',').map((s) => s.trim()).reverse() : [])];
  return trustProxy >= zincir.length ? zincir[zincir.length - 1] : zincir[trustProxy];
}

export function expressProtokol(xfProto: string | undefined, trustProxy: 0 | 1 | 2): 'http' | 'https' {
  if (trustProxy >= 1 && xfProto) return xfProto.split(',')[0].trim() === 'https' ? 'https' : 'http';
  return 'http';
}

export function sertifikaDurumu(kalanGun: number): 'gecerli' | 'yenilenecek' | 'suresi-doldu' {
  if (kalanGun <= 0) return 'suresi-doldu';
  return kalanGun < 30 ? 'yenilenecek' : 'gecerli';
}

export interface NginxIzi {
  denetimler: Denetim[]; olaylar: Message[]; istek: HttpIstek;
  yanit: HttpYanit | null; uygulamaGorur: [string, string][] | null; yanitYok?: string;
}

const msg = (id: string, from: string, to: string, label: string, kind: Message['kind'], tone?: Message['tone']): Message =>
  ({ id, from, to, label, kind, ...(tone ? { tone } : {}) });

export function istekIsle(p: NginxParams, yol: string = YOL): NginxIzi {
  const port = PORT[p.hedef];
  const blok: 80 | 443 = port === 443 ? 443 : 80;
  const gelen: [string, string][] = [['Host', SUNUCU_ADI]];
  if (p.sahteXff) gelen.push(['X-Forwarded-For', SAHTE_XFF]);
  const istek: HttpIstek = { metot: 'GET', kaynak: ISTEMCI_IP, yol, basliklar: gelen };

  const olaylar: Message[] = [msg('istek', 'istemci', 'ufw', `GET :${port}`, 'request')];
  const denetim = (d: Partial<Denetim>[]): Denetim[] => zincirle(
    ['UFW', 'TLS', 'Yönlendirme', 'Proxy', 'Uygulama'].map((ad, i) => ({ ad, durum: 'atlandi' as const, ...d[i] })),
  );
  const bitir = (d: Partial<Denetim>[], yanit: HttpYanit | null, yanitYok?: string, gorur: [string, string][] | null = null): NginxIzi => ({
    denetimler: denetim(d), olaylar, istek, yanit, uygulamaGorur: gorur, ...(yanitYok ? { yanitYok } : {}),
  });

  // 1. UFW
  if (ufwKarari(port) === 'engel') {
    olaylar.push(msg('ufw-dusur', 'ufw', 'ufw', `:${port} engel · paket düşürüldü`, 'note', 'alarm'));
    return bitir([{ durum: 'kaldi', ayrinti: `:${port} engel (varsayılan: deny incoming)` }], null, DUSTU);
  }
  const ufw: Partial<Denetim> = { durum: 'gecti', ayrinti: `:${port} izin` };
  olaylar.push(msg('ufw-izin', 'ufw', 'nginx', `:${port} izin`, 'request', 'ok'));

  // 2. block selection
  const var443 = p.ayar === 'kod-15-5' || p.ayar === 'code-007';
  if (blok === 443 && !var443) {
    olaylar.push(msg('red', 'nginx', 'istemci', 'bağlantı reddedildi', 'response', 'alarm'));
    return bitir([ufw, { durum: 'kaldi', ayrinti: "443'te dinleyen blok yok" }], null,
      "443'te dinleyen blok yok: bağlantı reddedildi");
  }

  // 3. TLS
  let tls: Partial<Denetim> = { durum: 'atlandi', ayrinti: 'HTTP: TLS yok' };
  if (blok === 443) {
    const sert = sertifikaDurumu(p.kalanGun);
    olaylar.push(
      msg('tls-hello', 'istemci', 'nginx', 'ClientHello', 'request'),
      msg('tls-sertifika', 'nginx', 'istemci', 'sertifika', 'response'),
    );
    if (sert === 'suresi-doldu') {
      olaylar.push(msg('tls-uyari', 'istemci', 'istemci', 'güvensiz uyarısı', 'note', 'alarm'));
      return bitir([ufw, { durum: 'kaldi', ayrinti: 'sertifika süresi dolmuş' }], null,
        'yanıt yok: tarayıcı güvensiz uyarısı (sertifika süresi dolmuş)');
    }
    olaylar.push(
      msg('tls-anahtar', 'istemci', 'nginx', 'anahtar anlaşması', 'request'),
      msg('tls-kanal', 'nginx', 'istemci', 'şifreli kanal', 'response', 'ok'),
    );
    tls = { durum: 'gecti', ayrinti: `sertifika ${p.kalanGun} gün geçerli` };
  }

  // 4. redirect
  if (p.ayar === 'kod-15-5' && blok === 80) {
    olaylar.push(msg('yonlendirme', 'nginx', 'istemci', '301 Moved Permanently', 'response', 'bilgi'));
    return bitir([ufw, tls, { durum: 'gecti', sonuc: '301', ayrinti: 'return 301 https://$host$request_uri' }], {
      durumKodu: 301, durumMetni: 'Moved Permanently',
      basliklar: [['Location', `https://${SUNUCU_ADI}${yol}`]], govde: null,
    });
  }
  const yon: Partial<Denetim> = { durum: 'gecti', ayrinti: blok === 443 ? 'HTTPS: yönlendirme gerekmez' : 'yönlendirme yok' };

  // 5. proxy
  olaylar.push(msg('proxy', 'nginx', 'uygulama', `proxy_pass :${UYGULAMA.split(':')[1]}`, 'request'));
  if (p.uygulama === 'kapali') {
    olaylar.push(
      msg('uygulama-red', 'uygulama', 'nginx', 'bağlantı reddedildi', 'response', 'alarm'),
      msg('bad-gateway', 'nginx', 'istemci', '502 Bad Gateway', 'response', 'alarm'),
    );
    return bitir([ufw, tls, yon, { durum: 'kaldi', sonuc: '502', ayrinti: `${UYGULAMA} bağlantıyı reddetti` }], {
      durumKodu: 502, durumMetni: 'Bad Gateway', govde: null,
    });
  }

  // 6. application
  const giden = proxyBasliklari(p.ayar, blok, gelen, ISTEMCI_IP);
  const xff = bul(giden, 'X-Forwarded-For');
  const proto = bul(giden, 'X-Forwarded-Proto');
  const yokla = (v: string | undefined) => v ?? 'yok';
  const gorur: [string, string][] = [
    ["bağlantı IP'si", SOKET_IP],
    ['Host', yokla(bul(giden, 'Host'))],
    ['X-Real-IP', yokla(bul(giden, 'X-Real-IP'))],
    ['X-Forwarded-For', yokla(xff)],
    ['X-Forwarded-Proto', yokla(proto)],
    ['req.ip', expressReqIp(SOKET_IP, xff, p.trustProxy)],
    ['req.protocol', expressProtokol(proto, p.trustProxy)],
    ['dogruIstemciIpAl(...)', dogruIstemciIpAl(xff, SOKET_IP)],
  ];
  olaylar.push(
    msg('uygulama-yanit', 'uygulama', 'nginx', '200 OK', 'response', 'ok'),
    msg('yanit', 'nginx', 'istemci', '200 OK', 'response', 'ok'),
  );
  return bitir([ufw, tls, yon, { durum: 'gecti', ayrinti: 'proxy_pass' }, { durum: 'gecti', sonuc: '200' }], {
    durumKodu: 200, durumMetni: 'OK', govde: 'kitap listesi (JSON)',
  }, undefined, gorur);
}
