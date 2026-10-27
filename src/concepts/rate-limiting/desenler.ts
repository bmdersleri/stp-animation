import type { Denetim } from '../../core/plot/check-list';
import { istegeIzinVer, loginIsteginiIsle, yeniLimiter, type Dal, type LimiterDurum, type LoginCagri } from './limiter';

export interface Istek { t: number; ip: string }
export type Desen = 'kitap' | 'pencere' | 'ayri-ip' | 'sinir' | 'duzenli' | 'iki-ip' | 'login' | 'elle';

const IP = '203.0.113.10';
const IP2 = '203.0.113.20';
const kitap = (): Istek[] => Array.from({ length: 5 }, () => ({ t: 0, ip: IP }));

export function desenIstekleri(desen: Exclude<Desen, 'login' | 'elle'>): Istek[] {
  switch (desen) {
    case 'kitap': return kitap();
    case 'pencere': return [...kitap(), { t: 60_000, ip: IP }];
    case 'ayri-ip': return [...kitap(), { t: 1000, ip: IP2 }];
    case 'sinir': return [0, 58_000, 59_000, 60_000, 60_500, 61_000].map((t) => ({ t, ip: IP }));
    case 'duzenli': return Array.from({ length: 12 }, (_, i) => ({ t: i * 10_000, ip: IP }));
    case 'iki-ip': return Array.from({ length: 10 }, (_, i) => ({ t: i * 1000, ip: i % 2 === 0 ? IP : IP2 }));
  }
}

const GOVDE = { kullaniciAdi: 'elif', parola: 'ogrenci-Parola1' };
const IZINLI = 'https://kutuphane.mehmetakif.edu.tr';
const KOTU = 'https://kotu-niyetli-site.com';
const cagri = (koken: string, simdi: number): LoginCagri => ({ koken, ip: IP2, govde: GOVDE, simdi });
/** Kod 11.7's two calls (L1194-1206), then three more from the allowed origin: the fourth success is refused. */
export const LOGIN_CAGRILARI: readonly LoginCagri[] = [
  cagri(IZINLI, 0), cagri(KOTU, 1000), cagri(IZINLI, 2000), cagri(IZINLI, 3000), cagri(IZINLI, 4000),
];
const LOGIN_ORTAMI = { JWT_SECRET: 'kutuphane-sunucu-sirri' };

export interface IstekSonucu extends Istek {
  izin: boolean;
  dal: Dal;
  sayac: number;
  pencereBaslangici: number;
  durumKodu?: number;
  mesaj?: string;
}

function kayitOku(d: LimiterDurum, ip: string): { sayac: number; pencereBaslangici: number } {
  return d.kayitlar.find(([k]) => k === ip)?.[1] ?? { sayac: 0, pencereBaslangici: 0 };
}

export function oynat(istekler: readonly Istek[], maksimumIstek: number, pencereMs: number): IstekSonucu[] {
  let d = yeniLimiter(maksimumIstek, pencereMs);
  return istekler.map((i) => {
    const r = istegeIzinVer(d, i.ip, i.t);
    d = r.durum;
    return { ...i, izin: r.izin, dal: r.dal, ...kayitOku(d, i.ip) };
  });
}

/** `dal` is absent when CORS refused the call before the limiter ran. */
export function loginOynat(): { sonuclar: (Omit<IstekSonucu, 'dal'> & { dal?: Dal; denetimler: Denetim[] })[]; durum: LimiterDurum } {
  let d = yeniLimiter(3, 60_000);
  const sonuclar = LOGIN_CAGRILARI.map((c) => {
    const r = loginIsteginiIsle(d, c, LOGIN_ORTAMI);
    d = r.durum;
    const { durumKodu, mesaj } = r.sonuc.yanit;
    return {
      t: c.simdi, ip: c.ip, izin: durumKodu !== 429 && durumKodu !== 403, dal: r.sonuc.dal,
      ...kayitOku(d, c.ip), durumKodu, mesaj, denetimler: r.sonuc.denetimler,
    };
  });
  return { sonuclar, durum: d };
}
