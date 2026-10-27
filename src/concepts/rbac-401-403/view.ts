import { lineOf, listing } from '../../core/listing';
import { nodeInspect } from '../../core/node-inspect';
import type { CheckListSpec } from '../../core/plot/check-list';
import type { CodeTraceSpec } from '../../core/plot/code-trace';
import type { DataTableSpec } from '../../core/plot/data-table';
import type { HttpCardsSpec, HttpIstek, HttpYanit, TerminalSatir } from '../../core/plot/http-cards';
import type { Lane, Message, SequenceSpec } from '../../core/plot/sequence';
import type { Rozet } from '../../core/plot/source-badge';
import { DERS_SIMDI } from '../jwt-akisi/jwt';
import { authMiddleware, girisYap, istegiIsle, kayitlar, kitapEkle, kitapSilYanlisKod } from './auth';
import { LISTINGS } from './code-text';
import { PAROLA, YANLIS_PAROLA } from './degerler';
import type { RbacParams } from './scenario';

export interface RbacView {
  sequence: SequenceSpec | null;
  http: HttpCardsSpec;
  /** Every request card of the program in call order (Kod 10.4 has two); `http.istek` is the first. */
  istekler: readonly HttpIstek[];
  tablo: DataTableSpec | null;
  denetim: CheckListSpec | null;
  code: CodeTraceSpec;
  tokenNotu: string | null;
  ozet: boolean;
}

/** The four lanes of a `kitapEkle` call (R18: the order of the calls inside it). */
export const RBAC_LANES: Lane[] = [
  { id: 'cagiran', label: ['Çağıran kod'] },
  { id: 'kitapEkle', label: ['kitapEkle'] },
  { id: 'tokenDogrula', label: ['tokenDogrula (kimlik)'] },
  { id: 'sadeceKutuphaneci', label: ['sadeceKutuphaneci (rol)'] },
];

/** Lanes of the register and sign-in steps and of a failed sign-in. */
const GIRIS_LANES: Lane[] = [
  { id: 'cagiran', label: ['Çağıran kod'] },
  { id: 'AuthService', label: ['AuthService'] },
  { id: 'KullaniciRepository', label: ['KullaniciRepository'] },
];

const K7 = listing(LISTINGS, 'kod-10-7');
const K4 = listing(LISTINGS, 'kod-10-4');
const K6 = listing(LISTINGS, 'kod-10-6');
const K6_CIKTI = listing(LISTINGS, 'kod-10-6-cikti');
const K12 = listing(LISTINGS, 'code-012');
const KOD7_CIKTI_ILK = lineOf(K7, '// Çıktı: { durumKodu: 201');
const SATIR = {
  kayitEkle: lineOf(K7, 'this.kullaniciRepository.ekle'),
  girisHata: lineOf(K7, 'if (!kayit || !parolaDogrula'),
  girisToken: lineOf(K7, 'return tokenUret({'),
  mw401: lineOf(K4, 'if (!baslik ||'),
  mwNext: lineOf(K4, 'next();'),
  cagrilar6: [lineOf(K6, 'console.log(istegiIsle(null'), lineOf(K6, 'console.log(istegiIsle("gecerli-token", "ogrenci"'), lineOf(K6, 'console.log(istegiIsle("gecerli-token", "kutuphaneci"')],
  yanlis401: lineOf(K12, 'return { durumKodu: 401 }'),
};

/** Book results are plain `{ durumKodu, mesaj }` objects, not HTTP responses: the card shows the number and the object only. */
function yanitKarti(yanit: { durumKodu: number }, govde: string): HttpYanit {
  return { durumKodu: yanit.durumKodu, govde };
}

/** The book's status code table (L926-931). */
const OZET_TABLO: DataTableSpec = {
  baslik: 'Durum kodları',
  sutunlar: [{ ad: 'Durum kodu' }, { ad: 'Anlamı' }, { ad: 'Ne zaman kullanılır' }],
  satirlar: [
    { key: '401', cells: ['401 Unauthorized', 'Kimlik doğrulanamadı', 'Token yok, geçersiz veya süresi dolmuş'] },
    { key: '403', cells: ['403 Forbidden', 'Kimlik doğrulandı, yetki yok', 'Rol veya izin yetersiz'] },
    { key: '404', cells: ['404 Not Found', 'Kaynak bulunamadı (bazen 403 yerine gizleme amaçlı kullanılır)', 'Kaynağın varlığını gizlemek istendiğinde'] },
    { key: '400', cells: ['400 Bad Request', 'İstek biçimi hatalı', 'Zorunlu alan eksik veya tür hatalı'] },
  ],
};

const bosHttp: HttpCardsSpec = { yanitlar: [], terminal: [] };
const terminalSatirlari = (metinler: readonly string[]): TerminalSatir[] => metinler.map((metin) => ({ metin }));
const kodSeridi = (l: { title: string; lines: readonly string[] }, active: readonly number[]): CodeTraceSpec => ({ title: l.title, lines: l.lines, active });

const rolAdi = (r: 'ogrenci' | 'kutuphaneci'): string => r;

/** Register view: the repository after the two kayitOl calls (hash cut to 16 characters). */
function kayitGorunumu(): RbacView {
  const k = kayitlar();
  const messages: Message[] = [];
  for (const x of k) {
    messages.push(
      { id: `kayit-${x.kullaniciAdi}`, from: 'cagiran', to: 'AuthService', label: `kayitOl("${x.kullaniciAdi}")`, kind: 'request' },
      { id: `ekle-${x.kullaniciAdi}`, from: 'AuthService', to: 'KullaniciRepository', label: 'ekle(kayit)', kind: 'request' },
    );
  }
  return {
    sequence: { lanes: GIRIS_LANES, messages, active: messages[messages.length - 1].id, ariaLabel: 'Kayıt sıra diyagramı' },
    http: bosHttp,
    istekler: [],
    tablo: {
      baslik: 'KullaniciRepository',
      sutunlar: [{ ad: 'kullaniciAdi', anahtar: 'PK' }, { ad: 'salt' }, { ad: 'parolaHash' }, { ad: 'rol' }],
      satirlar: k.map((x) => ({ key: x.kullaniciAdi, cells: [x.kullaniciAdi, x.salt, `${x.parolaHash.slice(0, 16)}…`, x.rol], state: 'yeni' as const })),
    },
    denetim: null,
    code: kodSeridi(K7, [SATIR.kayitEkle]),
    tokenNotu: null,
    ozet: false,
  };
}

/** Sign-in view: both girisYap calls, tokens cut for the terminal, roles in the note. */
function girisGorunumu(): RbacView {
  const k = kayitlar();
  const messages: Message[] = [];
  const terminal: string[] = [];
  const roller: string[] = [];
  for (const ad of ['yasemin', 'elif'] as const) {
    const s = girisYap(k, ad, PAROLA[ad], DERS_SIMDI);
    if (!('token' in s)) throw new Error('Ders sign-in must succeed');
    const rol = k.find((x) => x.kullaniciAdi === ad)!.rol;
    messages.push(
      { id: `giris-${ad}`, from: 'cagiran', to: 'AuthService', label: `girisYap("${ad}")`, kind: 'request' },
      { id: `bul-${ad}`, from: 'AuthService', to: 'KullaniciRepository', label: 'bul(kullaniciAdi)', kind: 'request' },
      { id: `kayit-${ad}`, from: 'KullaniciRepository', to: 'AuthService', label: 'kayıt', kind: 'response' },
      { id: `token-${ad}`, from: 'AuthService', to: 'cagiran', label: 'token', kind: 'response', tone: 'ok' },
    );
    terminal.push(`${ad}: ${s.token.slice(0, 8)}…`);
    roller.push(`${ad}: rol ${rol}`);
  }
  return {
    sequence: { lanes: GIRIS_LANES, messages, active: messages[messages.length - 1].id, stopAt: 'cagiran', stopTone: 'ok', ariaLabel: 'Giriş sıra diyagramı' },
    http: { yanitlar: [], terminal: terminalSatirlari(terminal) },
    istekler: [],
    tablo: null,
    denetim: null,
    code: kodSeridi(K7, [SATIR.girisToken]),
    tokenNotu: `Token payload’ında rol: ${roller.join(' · ')}`,
    ozet: false,
  };
}

/** A failed girisYap (wrong password or unknown user): no token, kitapEkle never runs. */
function girisHatasi(hata: string, kayitVar: boolean): RbacView {
  const messages: Message[] = [
    { id: 'giris', from: 'cagiran', to: 'AuthService', label: 'girisYap(kullaniciAdi, parola)', kind: 'request' },
    { id: 'bul', from: 'AuthService', to: 'KullaniciRepository', label: 'bul(kullaniciAdi)', kind: 'request' },
    { id: 'kayit', from: 'KullaniciRepository', to: 'AuthService', label: kayitVar ? 'kayıt' : 'undefined', kind: 'response' },
    { id: 'hata', from: 'AuthService', to: 'cagiran', label: '401', kind: 'response', tone: 'alarm' },
  ];
  return {
    sequence: { lanes: GIRIS_LANES, messages, active: 'hata', stopAt: 'cagiran', stopTone: 'alarm', ariaLabel: 'Başarısız giriş sıra diyagramı' },
    http: { yanitlar: [{ durumKodu: 401, govde: hata }], terminal: [{ metin: hata, akis: 'stderr' }] },
    istekler: [],
    tablo: null,
    denetim: null,
    code: kodSeridi(K7, [SATIR.girisHata]),
    tokenNotu: 'token yok: girisYap 401 fırlattı',
    ozet: false,
  };
}

/** Terminal lines of the book (L1254-1256) that a Ders step accumulates: how many for which (user, token) pair. */
function kitapSatirSayisi(p: RbacParams): number {
  if (p.roller !== 'kutuphaneci' || p.dakika !== 0 || p.parola !== 'dogru') return 0;
  if (p.token === 'giris') return p.kullanici === 'yasemin' ? 1 : p.kullanici === 'elif' ? 2 : 0;
  if (p.token === 'gecersiz') return p.kullanici === 'yasemin' || p.kullanici === 'elif' ? 3 : 0;
  return 0;
}

/** The kitapEkle view: the Lab and Ders steps 4-7. */
function kitapEkleGorunumu(p: RbacParams, kitapCiktisi: boolean): RbacView {
  const simdi = DERS_SIMDI + p.dakika * 60000;
  const kitapAdi = p.kullanici === 'yasemin' ? 'kutuphaneciToken' : 'ogrenciToken';
  let token: string;
  let tokenNotu: string;
  if (p.token === 'giris') {
    const kayit = kayitlar();
    const parola = p.kullanici === 'ahmet' ? PAROLA.elif : p.parola === 'dogru' ? PAROLA[p.kullanici] : YANLIS_PAROLA;
    const s = girisYap(kayit, p.kullanici, parola, DERS_SIMDI);
    if (!('token' in s)) return girisHatasi(s.hata, p.kullanici !== 'ahmet');
    token = s.token;
    tokenNotu = kitapCiktisi ? `kitapEkle(${kitapAdi})` : `token: ${token.slice(0, 8)}… (${p.kullanici})`;
  } else if (p.token === 'gecersiz') {
    token = 'gecersiz.token.deger';
    tokenNotu = kitapCiktisi ? 'kitapEkle("gecersiz.token.deger")' : 'token: "gecersiz.token.deger"';
  } else {
    token = '';
    tokenNotu = 'token: "" (boş)';
  }

  const iz = kitapEkle(token, simdi, p.roller);
  const kullanilan = new Set(iz.olaylar.flatMap((m) => [m.from, m.to]));
  const dim = RBAC_LANES.map((l) => l.id).filter((id) => !kullanilan.has(id));
  const karar = iz.yanit.durumKodu === 201 ? iz.satirlar[iz.satirlar.length - 1] : iz.satirlar[iz.satirlar.length - 2];

  const sayi = kitapCiktisi ? kitapSatirSayisi(p) : 0;
  const terminal = sayi > 0 ? terminalSatirlari(listing(LISTINGS, 'kod-10-7').lines.slice(KOD7_CIKTI_ILK - 1, KOD7_CIKTI_ILK - 1 + sayi).map((s) => s.replace('// Çıktı: ', ''))) : [{ metin: nodeInspect(iz.yanit) }];

  return {
    sequence: {
      lanes: RBAC_LANES,
      messages: iz.olaylar,
      active: iz.olaylar[iz.olaylar.length - 1].id,
      ...(dim.length > 0 ? { dim } : {}),
      stopAt: 'cagiran',
      stopTone: iz.yanit.durumKodu === 201 ? 'ok' : 'alarm',
      ariaLabel: 'kitapEkle sıra diyagramı',
    },
    http: { yanitlar: [yanitKarti(iz.yanit, nodeInspect(iz.yanit))], terminal },
    istekler: [],
    tablo: null,
    denetim: { baslik: 'Kitap ekleme denetimleri', denetimler: iz.denetimler },
    code: kodSeridi(K7, [karar]),
    tokenNotu,
    ozet: false,
  };
}

function bearerGorunumu(): RbacView {
  const istekler: HttpIstek[] = [
    { metot: 'GET', yol: '/kitaplar' },
    { metot: 'GET', yol: '/kitaplar', basliklar: [['Authorization', 'Bearer gecerli-token']] },
  ];
  const a = authMiddleware(undefined);
  const b = authMiddleware('Bearer gecerli-token');
  if (a.next || !b.next) throw new Error('Kod 10.4 calls changed');
  const messages: Message[] = [
    { id: 'i1', from: 'istek', to: 'authMiddleware', label: 'başlıksız istek', kind: 'request' },
    { id: 'y1', from: 'authMiddleware', to: 'istek', label: '401', kind: 'response', tone: 'alarm' },
    { id: 'i2', from: 'istek', to: 'authMiddleware', label: 'Bearer gecerli-token', kind: 'request' },
    { id: 'y2', from: 'authMiddleware', to: 'istek', label: 'next()', kind: 'response', tone: 'ok' },
  ];
  return {
    sequence: {
      lanes: [{ id: 'istek', label: ['İstek'] }, { id: 'authMiddleware', label: ['authMiddleware'] }],
      messages,
      active: 'y2',
      stopAt: 'istek',
      stopTone: 'ok',
      ariaLabel: 'authMiddleware sıra diyagramı',
    },
    http: { istek: istekler[0], yanitlar: [{ ...yanitKarti(a, JSON.stringify({ mesaj: a.mesaj })), durumMetni: 'Unauthorized' }], terminal: terminalSatirlari([`next() → istek.kullanici = ${nodeInspect(b.kullanici)}`]) },
    istekler,
    tablo: null,
    denetim: null,
    code: kodSeridi(K4, [SATIR.mw401]),
    tokenNotu: null,
    ozet: false,
  };
}

function siraGorunumu(kitapCiktisi: boolean): RbacView {
  const sonuclar = [istegiIsle(null, null), istegiIsle('gecerli-token', 'ogrenci'), istegiIsle('gecerli-token', 'kutuphaneci')];
  const messages: Message[] = [];
  sonuclar.forEach((s, i) => {
    messages.push(
      { id: `i${i}`, from: 'cagiran', to: 'istegiIsle', label: ['istegiIsle(null, null)', 'istegiIsle(token, "ogrenci")', 'istegiIsle(token, "kutuphaneci")'][i], kind: 'request' },
      { id: `y${i}`, from: 'istegiIsle', to: 'cagiran', label: `${s.durumKodu}`, kind: 'response', tone: s.durumKodu === 200 ? 'ok' : 'alarm' },
    );
  });
  return {
    sequence: {
      lanes: [{ id: 'cagiran', label: ['Çağıran kod'] }, { id: 'istegiIsle', label: ['istegiIsle'] }],
      messages,
      active: 'y2',
      stopAt: 'cagiran',
      stopTone: 'ok',
      ariaLabel: 'istegiIsle sıra diyagramı',
    },
    http: {
      yanitlar: sonuclar.map((s, i) => ({ ...yanitKarti(s, nodeInspect(s)), sira: i + 1 })),
      terminal: kitapCiktisi ? terminalSatirlari(K6_CIKTI.lines) : terminalSatirlari(sonuclar.map((s) => nodeInspect(s))),
    },
    istekler: [],
    tablo: null,
    denetim: null,
    code: kodSeridi(K6, SATIR.cagrilar6),
    tokenNotu: null,
    ozet: false,
  };
}

function yanlisKodGorunumu(p: RbacParams): RbacView {
  const rol = p.kullanici === 'yasemin' ? 'kutuphaneci' : 'ogrenci';
  const yanit = kitapSilYanlisKod(rol);
  const messages: Message[] = [
    { id: 'i', from: 'cagiran', to: 'kitapSilYanlisKod', label: `kitapSilYanlisKod("${rolAdi(rol)}")`, kind: 'request' },
    { id: 'y', from: 'kitapSilYanlisKod', to: 'cagiran', label: `${yanit.durumKodu}`, kind: 'response', tone: yanit.durumKodu === 200 ? 'ok' : 'alarm' },
  ];
  return {
    sequence: {
      lanes: [{ id: 'cagiran', label: ['Çağıran kod'] }, { id: 'kitapSilYanlisKod', label: ['kitapSilYanlisKod'] }],
      messages,
      active: 'y',
      stopAt: 'cagiran',
      stopTone: yanit.durumKodu === 200 ? 'ok' : 'alarm',
      ariaLabel: 'kitapSilYanlisKod sıra diyagramı',
    },
    http: { yanitlar: [yanitKarti(yanit, nodeInspect(yanit))], terminal: [{ metin: nodeInspect(yanit) }] },
    istekler: [],
    tablo: null,
    denetim: null,
    code: kodSeridi(K12, yanit.durumKodu === 401 ? [SATIR.yanlis401] : []),
    tokenNotu: yanit.durumKodu === 401 ? 'Doğrusu 403' : null,
    ozet: false,
  };
}

/**
 * Everything the scene draws for one parameter set; no DOM. `kitapCiktisi` true (the scene passes it while a book step's
 * own badge shows) prints the book's accumulated outputs (L1254-1256, L912-917) and names the tokens as the book does;
 * otherwise only the lines of the calls that ran for these params are printed.
 */
export function deriveRbacView(p: RbacParams, kitapCiktisi = false): RbacView {
  if (p.asama === 'tanitim') {
    return { sequence: null, http: bosHttp, istekler: [], tablo: null, denetim: null, code: kodSeridi(K7, []), tokenNotu: null, ozet: false };
  }
  if (p.asama === 'ozet') {
    return { sequence: null, http: bosHttp, istekler: [], tablo: OZET_TABLO, denetim: null, code: kodSeridi(K6, []), tokenNotu: null, ozet: true };
  }
  if (p.program === 'kod-10-4') return bearerGorunumu();
  if (p.program === 'kod-10-6') return siraGorunumu(kitapCiktisi);
  if (p.program === 'code-012') return yanlisKodGorunumu(p);
  if (p.asama === 'kayit') return kayitGorunumu();
  if (p.asama === 'giris') return girisGorunumu();
  return kitapEkleGorunumu(p, kitapCiktisi);
}

/** The Lab always runs the book's code on the reader's own input. */
export function rbacLabRozet(_p: RbacParams): Rozet {
  return { tur: 'kitap-kodu' };
}
