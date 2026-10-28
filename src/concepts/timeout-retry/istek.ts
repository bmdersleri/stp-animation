/**
 * Deterministic model of a fetch with AbortController timeout, retries with exponential backoff
 * and response validation (book chapter 17, Kod 17.3 and Kod 17.5). Pure and synchronous: a
 * virtual clock in ms, no setTimeout, fetch or Date.now.
 */

export type ServisSonucu = 'ok' | 'http-500' | 'bos-ozet' | 'bozuk-govde';
export interface Davranis {
  gecikmeMs: number;
  sonuc: ServisSonucu;
}
export interface IstekAyar {
  zamanAsimiMs: number;
  maksRetry: number;
  beklemeTabanMs: number;
  surum: '17.3' | '17.5';
}
export type OlayTuru = 'istek' | 'iptal' | 'yanit' | 'temizle' | 'bekle' | 'dogrulama' | 'sonuc';
export interface IstekOlayi {
  t: number;
  tur: OlayTuru;
  deneme: number;
  metin?: string;
}

export const KITAP_ZAMAN_ASIMI_MS = 5000; // L362, L717
export const HIZLI_MS = 1200; // page assumption (R30)
export const YAVAS_MS = 8000; // page assumption (R30)
export const BEKLEME_TABANI_MS = 1000; // page assumption (R30)
export const OZET_173 = 'Kısa bir özet metni.'; // L390
export const OZET_175 = 'Kısa ve öz bir özet.'; // L753

const ZAMAN_ASIMI_MESAJI = 'AI servisi zaman aşımına uğradı.'; // L370, L725
const KALICI_MESAJI = 'AI servisi kalıcı bir hata döndürdü.'; // L372
const HTTP_500_MESAJI = 'AI servisi hata döndürdü: 500'; // Kod 17.1 pattern (R33, L124)
const GECERSIZ_OZET_LOGU = 'AI servisi geçersiz/boş özet döndürdü, özet gösterilmeyecek.'; // L745

/** Wait before retry number `retryNo` (1-based): base * 2^(retryNo - 1). */
export function beklemeMs(retryNo: number, tabanMs: number): number {
  return tabanMs * 2 ** (retryNo - 1);
}

type Yanit = { ozet?: unknown } | string;

/** Book's ozetYanitiniDogrula (L705-711) applied to the service body. */
function gecerliMi(govde: unknown): boolean {
  if (typeof govde !== 'object' || govde === null) return false;
  const ozet = (govde as Record<string, unknown>).ozet;
  return typeof ozet === 'string' && ozet.trim().length > 0;
}

function govdeUret(sonuc: ServisSonucu, surum: IstekAyar['surum']): Yanit {
  if (surum === '17.3') return OZET_173; // Kod 17.3 returns the plain string (L367)
  if (sonuc === 'bos-ozet') return { ozet: '' };
  if (sonuc === 'bozuk-govde') return {};
  return { ozet: OZET_175 };
}

export function ozetiAl(
  davranislar: readonly Davranis[],
  ayar: IstekAyar,
): { olaylar: IstekOlayi[]; ozet: string | null; konsol: string[]; bitisMs: number } {
  const olaylar: IstekOlayi[] = [];
  const konsol: string[] = [];
  const g173 = ayar.surum === '17.3';
  const olay = (t: number, tur: OlayTuru, deneme: number, metin?: string): void => {
    olaylar.push(metin === undefined ? { t, tur, deneme } : { t, tur, deneme, metin });
  };
  const logla = (mesaj: string): void => {
    konsol.push(g173 ? `Özet alınamadı, kitap bilgisi özetsiz gösterilecek: ${mesaj}` : `Özet alınamadı: ${mesaj}`);
  };

  let t = 0;
  let ozet: string | null = null;
  for (let n = 1; ; n++) {
    const d = davranislar[Math.min(n - 1, davranislar.length - 1)];
    olay(t, 'istek', n); // timer set together with the attempt (L364-365, L719-720)
    if (d.gecikmeMs >= ayar.zamanAsimiMs) {
      // timer fires first: controller.abort() -> AbortError -> GeciciAiHatasi (L369-370, L724-725)
      t += ayar.zamanAsimiMs;
      olay(t, 'iptal', n, 'AbortError');
      olay(t, 'temizle', n); // finally (L373-375, L728-730)
      if (n <= ayar.maksRetry) {
        // R29: only an abort is retried
        const bekle = beklemeMs(n, ayar.beklemeTabanMs);
        if (bekle > 0) olay(t, 'bekle', n, `${bekle} ms`);
        t += bekle;
        continue;
      }
      logla(ZAMAN_ASIMI_MESAJI); // L383-387, L739-742
      break;
    }
    t += d.gecikmeMs;
    olay(t, 'yanit', n, d.sonuc);
    olay(t, 'temizle', n);
    if (d.sonuc === 'http-500') {
      // 17.3 maps any non-abort error to KaliciAiHatasi (L372); 17.5 rethrows it as is (L727)
      logla(g173 ? KALICI_MESAJI : HTTP_500_MESAJI);
      break;
    }
    const govde = govdeUret(d.sonuc, ayar.surum);
    if (!g173) {
      // validation lives outside the try block (L744-747)
      const gecerli = gecerliMi(govde);
      olay(t, 'dogrulama', n, gecerli ? 'geçerli' : 'geçersiz');
      if (!gecerli) {
        konsol.push(GECERSIZ_OZET_LOGU);
        break;
      }
      ozet = (govde as { ozet: string }).ozet;
    } else {
      ozet = govde as string;
    }
    break;
  }
  olay(t, 'sonuc', olaylar[olaylar.length - 1].deneme, String(ozet));
  konsol.push(String(ozet));
  return { olaylar, ozet, konsol, bitisMs: t };
}

/** Runs the book's signal-less example calls synchronously (R31); no time passes. */
function kitapCagrisi(
  surum: IstekAyar['surum'],
  fn: () => unknown,
  konsol: string[],
): string | null {
  try {
    let yanit: unknown;
    try {
      yanit = fn();
    } catch (hata) {
      if ((hata as Error).name === 'AbortError') throw new Error(ZAMAN_ASIMI_MESAJI);
      if (surum === '17.3') throw new Error(KALICI_MESAJI);
      throw hata;
    }
    if (surum === '17.3') return yanit as string;
    if (!gecerliMi(yanit)) {
      konsol.push(GECERSIZ_OZET_LOGU);
      return null;
    }
    return (yanit as { ozet: string }).ozet;
  } catch (hata) {
    const mesaj = (hata as Error).message;
    konsol.push(
      surum === '17.3'
        ? `Özet alınamadı, kitap bilgisi özetsiz gösterilecek: ${mesaj}`
        : `Özet alınamadı: ${mesaj}`,
    );
    return null;
  }
}

const abortHatasi = (mesaj: string): never => {
  throw Object.assign(new Error(mesaj), { name: 'AbortError' });
};

/** Kod 17.3 example calls, L390-396: expected output L405-407. */
export function kitapCagrilari173(): string[] {
  const konsol: string[] = [];
  konsol.push(String(kitapCagrisi('17.3', () => OZET_173, konsol)));
  konsol.push(String(kitapCagrisi('17.3', () => abortHatasi('Zaman aşımı'), konsol)));
  return konsol;
}

/** Kod 17.5 example calls, L752-762: expected output L772-776. */
export function kitapCagrilari175(): string[] {
  const konsol: string[] = [];
  konsol.push(String(kitapCagrisi('17.5', () => ({ ozet: OZET_175 }), konsol)));
  konsol.push(String(kitapCagrisi('17.5', () => ({ ozet: '' }), konsol)));
  konsol.push(String(kitapCagrisi('17.5', () => abortHatasi('iptal'), konsol)));
  return konsol;
}
