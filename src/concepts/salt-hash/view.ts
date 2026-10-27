import { sha256Hex } from '../../core/kripto';
import { lineOf, listing } from '../../core/listing';
import type { CodeTraceSpec } from '../../core/plot/code-trace';
import type { DataTableSpec, TabloSatiri } from '../../core/plot/data-table';
import type { TerminalSatir } from '../../core/plot/http-cards';
import { farkIndeksleri, type Parca, type SegmentStripSpec } from '../../core/plot/segment-strip';
import type { Rozet } from '../../core/plot/source-badge';
import { LISTINGS } from './code-text';
import { SALT_1, SALT_2 } from './degerler';
import { karsilastirmaAdimi } from './parola';
import type { SaltParams } from './scenario';

/** Key `${parola}|${salt}` → scrypt hash; the scene fills it with Ders constants and Lab results. */
export type Onbellek = ReadonlyMap<string, string>;

export interface SaltView {
  tablo: DataTableSpec;
  seritler: readonly SegmentStripSpec[];
  terminal: readonly TerminalSatir[];
  code: CodeTraceSpec;
  /** Cache keys the view needs but the cache lacks (their hash shows as BEKLIYOR). */
  bekliyor: readonly string[];
  /** The two comparisons' work on the `karsilastir` view; null elsewhere or while a hash is missing. */
  karsilastirma: { esittir: number; timingSafeEqual: number; ilkFark: number } | null;
  /** Whether the attempt matches the record (`dogrula`, `karsilastir`); null elsewhere or while a hash is missing. */
  sonuc: boolean | null;
  /** The book's alternatives table is shown (step 8). */
  yavasTablo: boolean;
  /** The book's closing points (step 9); null elsewhere. */
  ozet: readonly string[] | null;
}

/** Text of a hash that is not in the cache yet. */
export const BEKLIYOR = 'hesaplanıyor…';

/** The page's own note under the user table (R3): the step 3 sentence, not attributed to the book. */
export const SABIT_SALT_NOTU = 'Bu sayfadaki salt değeri örnek bir sabittir; her çağrıda yeni salt üretilmesi kitabın kodunun işidir.';

const KULLANICI_1 = 'elif';
const KULLANICI_2 = 'ahmet';

/** The book's three critical lines (L311-313) and its closing sentences (L374, verbatim without code ticks), as the summary step shows them. */
const OZET: readonly string[] = [
  'randomBytes(16) her kullanıcı için benzersiz bir salt üretir; bu salt hash ile birlikte saklanır.',
  'scryptSync, bilinçli olarak yavaş çalışan bir anahtar türetme fonksiyonu olduğu için kaba kuvvet saldırılarını yavaşlatır.',
  'timingSafeEqual, hash karşılaştırmasını sabit sürede yaparak zamanlama saldırılarını engeller.',
  'Doğru yaklaşım her kullanıcı için benzersiz bir salt üretmek ve bilinçli olarak yavaş çalışan bir anahtar türetme fonksiyonu (scrypt, bcrypt, argon2) kullanmaktır. Ayrıca parola karşılaştırması her zaman zamanlama saldırılarına dirençli bir fonksiyonla (timingSafeEqual) yapılmalıdır.',
];

const KOD = listing(LISTINGS, 'kod-10-2');
const KOD_SHA = listing(LISTINGS, 'code-004');
const SATIR = {
  hashle: lineOf(KOD, 'scryptSync(duzMetinParola, salt'),
  dogrula: lineOf(KOD, 'scryptSync(duzMetinParola, kayitliParola.salt'),
  karsilastir: lineOf(KOD, 'return timingSafeEqual'),
  sha: lineOf(KOD_SHA, 'createHash("sha256")'),
};

/** The first record's salt; an empty typed salt falls back to SALT_1. */
function etkinSalt(p: SaltParams): string {
  if (p.salt === 'sabit-2') return SALT_2;
  if (p.salt === 'yeni') return p.yeniSalt || SALT_1;
  return SALT_1;
}

/** The second user's salt is the other fixed salt (SALT_2 for a typed one). */
function ikinciSalt(p: SaltParams): string {
  return etkinSalt(p) === SALT_2 ? SALT_1 : SALT_2;
}

const anahtar = (parola: string, salt: string): string => `${parola}|${salt}`;

/** The book-only views (tanim, yavas, ozet) show no computed value: their steps carry the `kitap` badge. */
const hesapsiz = (p: SaltParams): boolean => p.gorunum === 'tanim' || p.gorunum === 'yavas' || p.gorunum === 'ozet';

/** Which records exist: the registered one and, in the hat view, the second user's; none in the book-only views. */
function kayitlar(p: SaltParams): { ad: string; salt: string }[] {
  if (hesapsiz(p)) return [];
  const ilk = { ad: KULLANICI_1, salt: etkinSalt(p) };
  return p.gorunum === 'hat' && p.ikinciKullanici ? [ilk, { ad: KULLANICI_2, salt: ikinciSalt(p) }] : [ilk];
}

const denemeVar = (p: SaltParams): boolean => p.gorunum === 'dogrula' || p.gorunum === 'karsilastir';

/** (parola, salt) pairs whose scrypt hash the view needs. Empty for sha256. */
function gerekenler(p: SaltParams): [string, string][] {
  if (p.yontem === 'sha256' || hesapsiz(p)) return [];
  const out: [string, string][] = kayitlar(p).map((k) => [p.parola, k.salt]);
  if (denemeVar(p)) out.push([p.deneme, etkinSalt(p)]);
  return out;
}

/** Cache keys the view of `p` needs (for the scene to compute and fill). */
export function saltAnahtarlari(p: SaltParams): string[] {
  return [...new Set(gerekenler(p).map(([parola, salt]) => anahtar(parola, salt)))];
}

function kisalt(hash: string | undefined): string {
  return hash === undefined ? BEKLIYOR : `${hash.slice(0, 16)}…`;
}

function kodSeridi(p: SaltParams): CodeTraceSpec {
  if (p.yontem === 'sha256') return { title: KOD_SHA.title, lines: KOD_SHA.lines, active: [SATIR.sha] };
  const active = p.gorunum === 'dogrula' ? SATIR.dogrula : p.gorunum === 'karsilastir' ? SATIR.karsilastir : SATIR.hashle;
  return { title: KOD.title, lines: KOD.lines, active: [active] };
}

/**
 * Everything the scene draws for one parameter set; no DOM. `kitapCiktisi` true (the scene passes it while the step's own
 * badge shows) prints the book's two lines (L303-304) for its own verification calls; otherwise the terminal shows the one
 * line the reader's attempt computed.
 */
export function deriveSaltView(p: SaltParams, onbellek: Onbellek, kitapCiktisi = false): SaltView {
  const sha = p.yontem === 'sha256';
  const hashi = (parola: string, salt: string): string | undefined =>
    sha ? sha256Hex(parola) : onbellek.get(anahtar(parola, salt));
  const bekliyor = saltAnahtarlari(p).filter((k) => !onbellek.has(k));

  const liste = kayitlar(p);
  const hashler = liste.map((k) => hashi(p.parola, k.salt));

  const tablo: DataTableSpec = {
    baslik: 'Kullanıcı tablosu',
    sutunlar: [{ ad: 'kullaniciAdi' }, { ad: 'salt' }, { ad: 'hash' }],
    satirlar: liste.map(
      (k, i): TabloSatiri => ({ key: k.ad, cells: [k.ad, sha ? '—' : k.salt, kisalt(hashler[i])] }),
    ),
    // the hash line shows the page's fixed salts; a typed salt (yeni) is the reader's own
    ...(p.gorunum === 'hat' && !sha && p.salt !== 'yeni' ? { not: SABIT_SALT_NOTU } : {}),
  };

  const hashParcasi = (h: string | undefined, fark?: readonly number[]): Parca => ({
    metin: h ?? BEKLIYOR,
    etiket: 'hash',
    ton: 0,
    ...(fark && fark.length > 0 ? { fark } : {}),
  });

  const seritler: SegmentStripSpec[] = [];
  let karsilastirma: SaltView['karsilastirma'] = null;
  let sonuc: boolean | null = null;
  const terminal: TerminalSatir[] = [];

  if (denemeVar(p)) {
    const kayitli = hashler[0];
    const deneme = hashi(p.deneme, etkinSalt(p));
    const tam = kayitli !== undefined && deneme !== undefined;
    const fark = tam ? farkIndeksleri(deneme, kayitli) : [];
    seritler.push({ baslik: 'Kayıtlı hash', parcalar: [hashParcasi(kayitli)] });
    seritler.push({ baslik: 'Deneme hash’i', parcalar: [hashParcasi(deneme, fark)] });
    if (tam) {
      sonuc = fark.length === 0;
      if (p.gorunum === 'karsilastir') {
        karsilastirma = {
          esittir: karsilastirmaAdimi(deneme, kayitli, 'esittir'),
          timingSafeEqual: karsilastirmaAdimi(deneme, kayitli, 'timingSafeEqual'),
          ilkFark: fark.length === 0 ? -1 : fark[0],
        };
      }
      // the book prints the right attempt first, then the wrong one (L303-304), and only the verification view makes those
      // two calls; a Lab attempt (even one changed back to the book's inputs) prints its own line only
      const kitabinki = kitapCiktisi && p.gorunum === 'dogrula' && !sha && p.parola === 'guclu-Parola123' && p.deneme === 'yanlis-parola' && p.salt === 'sabit-1';
      if (kitabinki) terminal.push({ metin: 'true' });
      terminal.push({ metin: String(sonuc) });
    }
  } else {
    liste.forEach((k, i) => {
      const parcalar: Parca[] = sha ? [] : [{ metin: k.salt, etiket: 'salt', ton: 1 }];
      const ilk = hashler[0];
      const fark = i > 0 && ilk !== undefined && hashler[i] !== undefined ? farkIndeksleri(hashler[i]!, ilk) : undefined;
      parcalar.push(hashParcasi(hashler[i], fark));
      seritler.push({ baslik: k.ad, parcalar, ayirici: '·' });
    });
    // code_004 prints the comparison of two identical unsalted hashes (L371)
    if (sha && !hesapsiz(p)) terminal.push({ metin: 'true' });
  }

  return {
    tablo,
    seritler,
    terminal,
    code: kodSeridi(p),
    bekliyor,
    karsilastirma,
    sonuc,
    yavasTablo: p.gorunum === 'yavas',
    ozet: p.gorunum === 'ozet' ? OZET : null,
  };
}

/** The Lab always runs the book's code on the reader's own input, whatever the method (no line reference). */
export function saltLabRozet(_p: SaltParams): Rozet {
  return { tur: 'kitap-kodu' };
}
