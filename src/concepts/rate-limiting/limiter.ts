import { listing, lineOf } from '../../core/listing';
import { zincirle, type Denetim } from '../../core/plot/check-list';
import { LISTINGS } from './code-text';

export interface PencereKaydi { sayac: number; pencereBaslangici: number }
export interface LimiterDurum { maksimumIstek: number; pencereMs: number; kayitlar: readonly [string, PencereKaydi][] }
export type Dal = 'yeni-pencere' | 'sinirda' | 'artir';

const K5 = listing(LISTINGS, 'kod-11-5');
const K7 = listing(LISTINGS, 'kod-11-7');

/** Line numbers inside the on-screen listing `kod-11-5` (L724, L729, L733 of the book). */
export const DAL_SATIRI: Readonly<Record<Dal, number>> = {
  'yeni-pencere': lineOf(K5, 'if (!kayit || simdi - kayit.pencereBaslangici >= this.pencereMs)'),
  sinirda: lineOf(K5, 'if (kayit.sayac >= this.maksimumIstek)'),
  artir: lineOf(K5, 'kayit.sayac += 1;'),
};

export function yeniLimiter(maksimumIstek: number, pencereMs: number): LimiterDurum {
  return { maksimumIstek, pencereMs, kayitlar: [] };
}

/** Kod 11.5, L721-735. The state is never mutated; a new one comes back. */
export function istegeIzinVer(d: LimiterDurum, anahtar: string, simdi: number): { durum: LimiterDurum; izin: boolean; dal: Dal } {
  const kayit = d.kayitlar.find(([k]) => k === anahtar)?.[1];
  const yaz = (yeni: PencereKaydi): LimiterDurum => ({
    ...d,
    kayitlar: kayit
      ? d.kayitlar.map(([k, v]) => [k, k === anahtar ? yeni : v] as [string, PencereKaydi])
      : [...d.kayitlar, [anahtar, yeni] as [string, PencereKaydi]],
  });

  if (!kayit || simdi - kayit.pencereBaslangici >= d.pencereMs) {
    return { durum: yaz({ sayac: 1, pencereBaslangici: simdi }), izin: true, dal: 'yeni-pencere' };
  }
  if (kayit.sayac >= d.maksimumIstek) {
    return { durum: d, izin: false, dal: 'sinirda' };
  }
  return { durum: yaz({ sayac: kayit.sayac + 1, pencereBaslangici: kayit.pencereBaslangici }), izin: true, dal: 'artir' };
}

export interface LoginCagri { koken: string; ip: string; govde: unknown; simdi: number }
export interface LoginSonuc {
  yanit: { durumKodu: number; mesaj: string };
  denetimler: Denetim[];
  /** Line in `kod-11-7` where the decision is made. */
  satir: number;
  /** The limiter branch; absent when CORS refused the call before the limiter ran. */
  dal?: Dal;
}

const IZINLI_KOKENLER: readonly string[] = ['https://kutuphane.mehmetakif.edu.tr']; // Kod 11.7, L1112
const MESAJ = {
  cors: 'Bu köken için CORS izni yoktur.',
  limit: 'Çok fazla giriş denemesi yapıldı. Lütfen daha sonra tekrar deneyin.',
  govde: 'İstek gövdesi bir nesne olmalıdır.',
  kullanici: 'kullaniciAdi zorunludur.',
  parola: 'parola zorunludur.',
  secret: 'Sunucu yapılandırma hatası: JWT_SECRET eksik.',
  kimlik: 'Kullanıcı adı veya parola hatalı.',
  basari: 'Giriş başarılı.',
} as const;

const AD = ['CORS', 'Rate limit', 'Validation', 'Secret', 'Kimlik bilgisi'] as const;
const SATIR = {
  cors: lineOf(K7, 'if (!izinVerilenKokenler.includes(kaynakKoken))'),
  limit: lineOf(K7, 'if (!loginLimiter.istegeIzinVer(istemciIp))'),
  govde: lineOf(K7, 'İstek gövdesi bir nesne olmalıdır.'),
  kullanici: lineOf(K7, 'kullaniciAdi zorunludur.'),
  parola: lineOf(K7, 'parola zorunludur.'),
  secret: lineOf(K7, 'JWT_SECRET eksik.'),
  kimlik: lineOf(K7, 'Kullanıcı adı veya parola hatalı.'),
  basari: lineOf(K7, 'Giriş başarılı.'),
};

type Dogrulama =
  | { hata: { durumKodu: number; mesaj: string; satir: number } }
  | { hata?: undefined; kullaniciAdi: string; parola: string };

/** loginIstegiDogrula, Kod 11.7. */
function dogrula(veri: unknown): Dogrulama {
  if (typeof veri !== 'object' || veri === null) return { hata: { durumKodu: 400, mesaj: MESAJ.govde, satir: SATIR.govde } };
  const kayit = veri as Record<string, unknown>;
  if (typeof kayit.kullaniciAdi !== 'string' || kayit.kullaniciAdi.trim() === '') {
    return { hata: { durumKodu: 400, mesaj: MESAJ.kullanici, satir: SATIR.kullanici } };
  }
  if (typeof kayit.parola !== 'string' || kayit.parola === '') {
    return { hata: { durumKodu: 400, mesaj: MESAJ.parola, satir: SATIR.parola } };
  }
  return { kullaniciAdi: kayit.kullaniciAdi, parola: kayit.parola };
}

/** Kod 11.7, L1161-1190: CORS, rate limit, validation, secret, credentials, in that order; the first failure stops the chain. */
export function loginIsteginiIsle(d: LimiterDurum, c: LoginCagri, ortam: Record<string, string | undefined>): { durum: LimiterDurum; sonuc: LoginSonuc } {
  const denetimler: Denetim[] = AD.map((ad) => ({ ad, durum: 'bekliyor' as const }));
  let durum = d;
  let dal: Dal | undefined;
  const bitir = (i: number, durumKodu: number, mesaj: string, satir: number) => {
    if (durumKodu !== 200) denetimler[i] = { ...denetimler[i], durum: 'kaldi', ayrinti: mesaj, sonuc: String(durumKodu) };
    return { durum, sonuc: { yanit: { durumKodu, mesaj }, denetimler: zincirle(denetimler), satir, dal } };
  };
  const gecti = (i: number) => { denetimler[i] = { ...denetimler[i], durum: 'gecti' }; };

  if (!IZINLI_KOKENLER.includes(c.koken)) return bitir(0, 403, MESAJ.cors, SATIR.cors);
  gecti(0);

  const r = istegeIzinVer(durum, c.ip, c.simdi);
  durum = r.durum;
  dal = r.dal;
  if (!r.izin) return bitir(1, 429, MESAJ.limit, SATIR.limit);
  gecti(1);

  const v = dogrula(c.govde);
  if (v.hata) return bitir(2, v.hata.durumKodu, v.hata.mesaj, v.hata.satir);
  gecti(2);

  if (!ortam.JWT_SECRET) return bitir(3, 500, MESAJ.secret, SATIR.secret);
  gecti(3);

  if (v.kullaniciAdi === 'elif' && v.parola === 'ogrenci-Parola1') {
    gecti(4);
    return bitir(4, 200, MESAJ.basari, SATIR.basari);
  }
  return bitir(4, 401, MESAJ.kimlik, SATIR.kimlik);
}
