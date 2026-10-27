import { GIZLI_ANAHTAR, SURE_MS, tokenUret, type Rol, type TokenPayload } from '../jwt-akisi/jwt';
import { b64urlCoz, hmacSha256B64url } from '../../core/kripto';
import { lineOf, listing } from '../../core/listing';
import { zincirle, type Denetim } from '../../core/plot/check-list';
import type { Message } from '../../core/plot/sequence';
import { LISTINGS } from './code-text';
import { HASHLER, PAROLA, SALT_ELIF, SALT_YASEMIN } from './degerler';

/** Pure copy of Kod 10.7 (ChapterMiniAppAuth.ts), Kod 10.4, Kod 10.6 and code_012, with the clock as a parameter (R4, R16-R18). */

export interface KullaniciKaydi {
  kullaniciAdi: string;
  salt: string;
  parolaHash: string;
  rol: Rol;
}

const K7 = listing(LISTINGS, 'kod-10-7');
const SATIR = {
  imza: lineOf(K7, 'if (imza !== imzaOlustur'),
  sure: lineOf(K7, 'Date.now() > payload.sonGecerlilik'),
  basari: lineOf(K7, 'return payload;'),
  dogrulaCagri: lineOf(K7, 'const payload = tokenDogrula(token);'),
  rolCagri: lineOf(K7, 'this.sadeceKutuphaneci(payload);'),
  rolHata: lineOf(K7, 'throw new Error("403'),
  olustur: lineOf(K7, 'return { durumKodu: 201'),
  yakala: lineOf(K7, 'return { durumKodu: mesaj.startsWith'),
};

/** L1245-1246: the two kayitOl calls, in order (hashes come from the Ders table, R17). */
export function kayitlar(): KullaniciKaydi[] {
  return [
    { kullaniciAdi: 'yasemin', salt: SALT_YASEMIN, parolaHash: HASHLER[`${PAROLA.yasemin}|${SALT_YASEMIN}`], rol: 'kutuphaneci' },
    { kullaniciAdi: 'elif', salt: SALT_ELIF, parolaHash: HASHLER[`${PAROLA.elif}|${SALT_ELIF}`], rol: 'ogrenci' },
  ];
}

export type GirisSonucu = { token: string } | { hata: string };

/** L1201-1215. An unknown user short-circuits (`!kayit`); a (parola, salt) pair missing from HASHLER throws. */
export function girisYap(kayitlar: readonly KullaniciKaydi[], ad: string, parola: string, simdi: number): GirisSonucu {
  const kayit = kayitlar.find((k) => k.kullaniciAdi === ad);
  if (!kayit || !parolaDogrulaOnbellek(parola, kayit.salt, kayit.parolaHash)) {
    return { hata: '401: Kullanıcı adı veya parola hatalı.' };
  }
  const { token } = tokenUret({ kullaniciAdi: kayit.kullaniciAdi, rol: kayit.rol, sonGecerlilik: simdi + SURE_MS });
  return { token };
}

function parolaDogrulaOnbellek(parola: string, salt: string, kayitliHash: string): boolean {
  const hash = HASHLER[`${parola}|${salt}`];
  if (hash === undefined) throw new Error(`HASHLER has no entry for this password and salt`);
  return hash === kayitliHash;
}

export interface KisaDogrulama {
  payload?: TokenPayload;
  hata?: '401';
  /** 1-based line of kod-10-7 where the decision was made. */
  satir: number;
  ayrinti: string;
}

/** L1169-1179: no format check; a failed signature or an expired token gives "401". */
export function tokenDogrulaKisa(token: string, simdi: number): KisaDogrulama {
  const [header, govde, imza] = token.split('.');
  if (imza !== hmacSha256B64url(GIZLI_ANAHTAR, `${header}.${govde}`)) {
    return { hata: '401', satir: SATIR.imza, ayrinti: `L${K7.satirlar[0] + SATIR.imza - 1}: imza eşleşmedi` };
  }
  const payload = JSON.parse(b64urlCoz(govde)) as TokenPayload;
  if (simdi > payload.sonGecerlilik) {
    return { hata: '401', satir: SATIR.sure, ayrinti: `L${K7.satirlar[0] + SATIR.sure - 1}: süre doldu` };
  }
  return { payload, satir: SATIR.basari, ayrinti: 'imza ve süre geçti' };
}

export type IzinliRoller = 'kutuphaneci' | 'ikisi';
export interface KitapEkleIzi {
  olaylar: Message[];
  yanit: { durumKodu: 201 | 401 | 403; mesaj: string };
  denetimler: Denetim[];
  /** 1-based kod-10-7 lines the call passes, in order. */
  satirlar: number[];
}

/** L1228-1237. The role list follows the Kod 10.5 pattern (requireRole). */
export function kitapEkle(token: string, simdi: number, roller: IzinliRoller = 'kutuphaneci'): KitapEkleIzi {
  const izinli: readonly Rol[] = roller === 'ikisi' ? ['ogrenci', 'kutuphaneci'] : ['kutuphaneci'];
  const olaylar: Message[] = [
    { id: 'm1', from: 'cagiran', to: 'kitapEkle', label: 'kitapEkle(token)', kind: 'request' },
    { id: 'm2', from: 'kitapEkle', to: 'tokenDogrula', label: 'tokenDogrula(token)', kind: 'request' },
  ];
  const satirlar = [SATIR.dogrulaCagri];
  const kimlik: Denetim = { ad: 'Kimlik doğrulama', durum: 'bekliyor' };
  const yetki: Denetim = { ad: 'Yetkilendirme', durum: 'bekliyor' };
  const bitir = (mesaj: string): KitapEkleIzi => {
    const durumKodu = mesaj.startsWith('403') ? 403 : 401;
    satirlar.push(SATIR.yakala);
    olaylar.push({ id: 'm-yanit', from: 'kitapEkle', to: 'cagiran', label: `${durumKodu}`, kind: 'response', tone: 'alarm' });
    return { olaylar, yanit: { durumKodu, mesaj }, denetimler: zincirle([kimlik, yetki]), satirlar };
  };

  const d = tokenDogrulaKisa(token, simdi);
  if (!d.payload) {
    satirlar.push(d.satir);
    kimlik.durum = 'kaldi';
    kimlik.ayrinti = d.ayrinti;
    kimlik.sonuc = '401';
    olaylar.push({ id: 'm3', from: 'tokenDogrula', to: 'kitapEkle', label: '401', kind: 'response', tone: 'alarm' });
    return bitir('401');
  }
  kimlik.durum = 'gecti';
  kimlik.ayrinti = d.ayrinti;
  olaylar.push(
    { id: 'm3', from: 'tokenDogrula', to: 'kitapEkle', label: `payload (${d.payload.rol})`, kind: 'response', tone: 'ok' },
    { id: 'm4', from: 'kitapEkle', to: 'sadeceKutuphaneci', label: 'sadeceKutuphaneci(payload)', kind: 'request' },
  );
  satirlar.push(SATIR.rolCagri);
  if (!izinli.includes(d.payload.rol)) {
    satirlar.push(SATIR.rolHata);
    yetki.durum = 'kaldi';
    yetki.ayrinti = `rol: ${d.payload.rol}`;
    yetki.sonuc = '403';
    olaylar.push({ id: 'm5', from: 'sadeceKutuphaneci', to: 'kitapEkle', label: '403', kind: 'response', tone: 'alarm' });
    return bitir('403: Bu işlem için yetkiniz yok.');
  }
  yetki.durum = 'gecti';
  yetki.ayrinti = `rol: ${d.payload.rol}`;
  satirlar.push(SATIR.olustur);
  olaylar.push(
    { id: 'm5', from: 'sadeceKutuphaneci', to: 'kitapEkle', label: 'geçti', kind: 'response', tone: 'ok' },
    { id: 'm-yanit', from: 'kitapEkle', to: 'cagiran', label: '201', kind: 'response', tone: 'ok' },
  );
  return {
    olaylar,
    yanit: { durumKodu: 201, mesaj: 'Kitap eklendi.' },
    denetimler: zincirle([kimlik, yetki]),
    satirlar,
  };
}

export type MwSonuc =
  | { next: true; kullanici: { kullaniciAdi: string; rol: Rol } }
  | { next: false; durumKodu: 401; mesaj: string };

/** Kod 10.4, L638-667: only the identity is checked; the header must start with "Bearer ". */
export function authMiddleware(authorization: string | undefined): MwSonuc {
  if (!authorization || !authorization.startsWith('Bearer ')) {
    return { next: false, durumKodu: 401, mesaj: 'Token bulunamadı.' };
  }
  const token = authorization.replace('Bearer ', '');
  if (token !== 'gecerli-token') {
    return { next: false, durumKodu: 401, mesaj: 'Token geçersiz veya süresi dolmuş.' };
  }
  return { next: true, kullanici: { kullaniciAdi: 'elif', rol: 'ogrenci' } };
}

/** Kod 10.6, L884-899. */
export function istegiIsle(token: string | null, rol: Rol | null): { durumKodu: number; mesaj: string } {
  if (!token) return { durumKodu: 401, mesaj: 'Kimlik doğrulanamadı: token eksik.' };
  if (!rol) return { durumKodu: 401, mesaj: 'Kimlik doğrulanamadı: token geçersiz.' };
  if (rol !== 'kutuphaneci') {
    return { durumKodu: 403, mesaj: 'Bu işlem yalnızca kütüphaneciler tarafından yapılabilir.' };
  }
  return { durumKodu: 200, mesaj: 'Kitap başarıyla eklendi.' };
}

/** code_012, L947-953: the wrong code, 401 for an identified user without permission. */
export function kitapSilYanlisKod(rol: Rol): { durumKodu: number } {
  if (rol !== 'kutuphaneci') return { durumKodu: 401 };
  return { durumKodu: 200 };
}

export { LISTINGS } from './code-text';
