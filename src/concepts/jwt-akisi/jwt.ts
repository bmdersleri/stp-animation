import { b64urlCoz, b64urlJson, b64urlMetin, hmacSha256B64url } from '../../core/kripto';
import { lineOf, listing } from '../../core/listing';
import { zincirle, type Denetim } from '../../core/plot/check-list';
import { LISTINGS } from './code-text';

/** Pure copy of Kod 10.3 (BasitJWT.ts) with the clock as a parameter (R4). */

export type Rol = 'ogrenci' | 'kutuphaneci';
export interface TokenPayload {
  kullaniciAdi: string;
  rol: Rol;
  sonGecerlilik: number;
}

export const GIZLI_ANAHTAR = 'kutuphane-sunucu-sirri';
export const SALDIRGAN_ANAHTAR = 'saldirgan-sirri';
/** The Ders clock; + SURE_MS = 1788607428600, the value printed in the book (L512). */
export const DERS_SIMDI = 1788606528600;
export const SURE_MS = 15 * 60 * 1000;

export interface UretilenToken {
  header: string;
  govde: string;
  imza: string;
  token: string;
}

/** L445-450. */
export function tokenUret(payload: object, anahtar: string = GIZLI_ANAHTAR): UretilenToken {
  const header = b64urlJson({ alg: 'HS256', tip: 'JWT' });
  const govde = b64urlJson(payload);
  const imza = hmacSha256B64url(anahtar, `${header}.${govde}`);
  return { header, govde, imza, token: `${header}.${govde}.${imza}` };
}

type Kullanici = 'elif' | 'yasemin';

/** elif is an ogrenci, yasemin a kutuphaneci (L775-776). */
export function payloadKur(kullanici: Kullanici, simdi: number): TokenPayload {
  return { kullaniciAdi: kullanici, rol: kullanici === 'elif' ? 'ogrenci' : 'kutuphaneci', sonGecerlilik: simdi + SURE_MS };
}

export type DogrulamaSonucu = { payload: TokenPayload } | { hata: string; yakalanmamis?: boolean };
export interface DogrulamaIzi {
  denetimler: Denetim[];
  sonuc: DogrulamaSonucu;
  beklenenImza?: string;
  parcalar: string[];
  /** 1-based line of kod-10-3 where the decision was made (the return or throw line). */
  satir: number;
}

const KOD = listing(LISTINGS, 'kod-10-3');
const SATIR = {
  bicim: lineOf(KOD, '401: Token biçimi geçersiz.'),
  imza: lineOf(KOD, '401: Token imzası geçersiz.'),
  json: lineOf(KOD, 'JSON.parse'),
  sureAlani: lineOf(KOD, '401: Token süre alanı eksik.'),
  sure: lineOf(KOD, '401: Token süresi dolmuş.'),
  basari: lineOf(KOD, 'return payload;'),
};

const AD = ['Biçim (3 parça)', 'İmza', 'Payload JSON', 'Süre alanı', 'Süre'] as const;

/** L452-475, check by check; the first failure stops the chain (the rest become `atlandi`). */
export function tokenDogrula(token: string, simdi: number): DogrulamaIzi {
  const parcalar = token.split('.');
  const [header, govde, imza] = parcalar;
  const sonuc: Denetim[] = AD.map((ad) => ({ ad, durum: 'bekliyor' as const }));
  const bitir = (i: number, hata: string, satir: number, beklenenImza?: string, yakalanmamis?: boolean): DogrulamaIzi => {
    sonuc[i] = { ...sonuc[i], durum: 'kaldi', ayrinti: hata, sonuc: yakalanmamis ? 'hata' : '401' };
    return {
      denetimler: zincirle(sonuc),
      sonuc: yakalanmamis ? { hata, yakalanmamis: true } : { hata },
      beklenenImza,
      parcalar,
      satir,
    };
  };

  if (parcalar.length !== 3 || !header || !govde || !imza) {
    return bitir(0, '401: Token biçimi geçersiz.', SATIR.bicim);
  }
  sonuc[0] = { ...sonuc[0], durum: 'gecti' };

  const beklenenImza = hmacSha256B64url(GIZLI_ANAHTAR, `${header}.${govde}`);
  if (imza !== beklenenImza) return bitir(1, '401: Token imzası geçersiz.', SATIR.imza, beklenenImza);
  sonuc[1] = { ...sonuc[1], durum: 'gecti' };

  let payload: TokenPayload;
  try {
    payload = JSON.parse(b64urlCoz(govde)) as TokenPayload;
  } catch (e) {
    const err = e as Error;
    return bitir(2, `${err.name}: ${err.message}`, SATIR.json, beklenenImza, true);
  }
  sonuc[2] = { ...sonuc[2], durum: 'gecti' };

  if (typeof payload?.sonGecerlilik !== 'number') {
    return bitir(3, '401: Token süre alanı eksik.', SATIR.sureAlani, beklenenImza);
  }
  sonuc[3] = { ...sonuc[3], durum: 'gecti' };

  if (simdi > payload.sonGecerlilik) return bitir(4, '401: Token süresi dolmuş.', SATIR.sure, beklenenImza);
  sonuc[4] = { ...sonuc[4], durum: 'gecti' };

  return { denetimler: zincirle(sonuc), sonuc: { payload }, beklenenImza, parcalar, satir: SATIR.basari };
}

export type Bozulma =
  | 'yok'
  | 'imza-bozuk'
  | 'rol-degisti'
  | 'sure-alani-yok'
  | 'fazla-segment'
  | 'baska-anahtar'
  | 'bozuk-json';

/** The tampered tokens of the book (L486, L493, L500) and the Lab. */
export function bozukToken(kullanici: Kullanici, bozulma: Bozulma, simdi: number): string {
  const payload = payloadKur(kullanici, simdi);
  const t = tokenUret(payload);
  switch (bozulma) {
    case 'yok':
      return t.token;
    case 'imza-bozuk':
      return t.token + 'bozuk';
    case 'rol-degisti': {
      const rol: Rol = payload.rol === 'ogrenci' ? 'kutuphaneci' : 'ogrenci';
      return `${t.header}.${b64urlJson({ ...payload, rol })}.${t.imza}`;
    }
    case 'sure-alani-yok':
      return tokenUret({ kullaniciAdi: payload.kullaniciAdi, rol: payload.rol }).token;
    case 'fazla-segment':
      return `${t.token}.fazladan`;
    case 'baska-anahtar':
      return tokenUret(payload, SALDIRGAN_ANAHTAR).token;
    case 'bozuk-json': {
      const govde = b64urlMetin('{bozuk');
      return `${t.header}.${govde}.${hmacSha256B64url(GIZLI_ANAHTAR, `${t.header}.${govde}`)}`;
    }
  }
}

export { LISTINGS } from './code-text';
