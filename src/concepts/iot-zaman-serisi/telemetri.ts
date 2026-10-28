import { hmacSha256Hex } from '../../core/kripto';
import { zincirle, type Denetim } from '../../core/plot/check-list';

/** Pure telemetry model of book chapter 16 (Kod 16.3, 16.4, 16.6). The clock is a parameter: `suAn` in seconds, `simdiIso` as text. */

export const GECERLILIK_PENCERESI_SANIYE = 60;
/** The lesson "now": 2026-09-05T10:00:00Z. */
export const DERS_SIMDI = 1788602400;
/** Device UUID to shared secret (book L388-391). */
export const CIHAZ_ANAHTARLARI: Readonly<Record<string, string>> = {
  'esp32-lab101-temp': 'super-gizli-cihaz-anahtari-12345',
};

export interface ImzaliIstekBasliklari {
  cihazUuid: string;
  imza: string;
  zamanDamgasi: number;
}

/** HMAC_SHA256(`${zamanDamgasi}.${govde}`, anahtar) as hex (L410-411). */
export function imzaUret(anahtar: string, zamanDamgasi: number, govdeMetni: string): string {
  return hmacSha256Hex(anahtar, `${zamanDamgasi}.${govdeMetni}`);
}

/** Like `Buffer.from(hex, 'hex')`: stops at the first invalid pair; an odd trailing digit is dropped. */
export function hexBayt(hex: string): Uint8Array {
  const out: number[] = [];
  for (let i = 0; i + 1 < hex.length; i += 2) {
    const cift = hex.slice(i, i + 2);
    if (!/^[0-9a-fA-F]{2}$/.test(cift)) break;
    out.push(parseInt(cift, 16));
  }
  return Uint8Array.from(out);
}

/** Equal lengths required; XORs every byte (no early exit). */
export function sabitZamanliEsit(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let fark = 0;
  for (let i = 0; i < a.length; i++) fark |= a[i] ^ b[i];
  return fark === 0;
}

const PENCERE_HATASI = 'Zaman damgası süresi dolmuş veya geçersiz (Replay Attack riski).';
const CIHAZ_HATASI = "Bilinmeyen cihaz UUID'si.";
const HMAC_HATASI = 'HMAC imzası geçersiz; veri yolda değiştirilmiş olabilir.';

/** Kod 16.3 `dogrula` with `suAn` (seconds) as a parameter. `beklenenImza` is set once the HMAC was computed. */
export function dogrula(
  b: ImzaliIstekBasliklari,
  govdeMetni: string,
  suAn: number,
): { gecerliMi: boolean; hata?: string; beklenenImza?: string } {
  if (Math.abs(suAn - b.zamanDamgasi) > GECERLILIK_PENCERESI_SANIYE) return { gecerliMi: false, hata: PENCERE_HATASI };
  const anahtar = CIHAZ_ANAHTARLARI[b.cihazUuid];
  if (!anahtar) return { gecerliMi: false, hata: CIHAZ_HATASI };
  const beklenenImza = imzaUret(anahtar, b.zamanDamgasi, govdeMetni);
  const gelen = hexBayt(b.imza);
  const beklenen = hexBayt(beklenenImza);
  if (gelen.length !== beklenen.length || !sabitZamanliEsit(gelen, beklenen)) {
    return { gecerliMi: false, hata: HMAC_HATASI, beklenenImza };
  }
  return { gecerliMi: true, beklenenImza };
}

export interface TelemetriVerisi {
  cihazId: string;
  sicaklik: number;
  nem: number;
}

/** Kod 16.4 (L493-502). */
export function telemetriyiDogrula(v: TelemetriVerisi): { gecerli: boolean; hatalar: string[] } {
  const hatalar: string[] = [];
  if (typeof v.sicaklik !== 'number' || v.sicaklik < -40 || v.sicaklik > 85) {
    hatalar.push('sicaklik aralık dışı (-40 ile 85 arası bekleniyor).');
  }
  if (typeof v.nem !== 'number' || v.nem < 0 || v.nem > 100) {
    hatalar.push('nem aralık dışı (0 ile 100 arası bekleniyor).');
  }
  return { gecerli: hatalar.length === 0, hatalar };
}

export interface KaydedilenOlcum extends TelemetriVerisi {
  sunucuZamanDamgasi: string;
}

/** Kod 16.4 (L511-524), synchronous; the record time is the server time `simdiIso`. */
export function olcumuKaydet(
  v: TelemetriVerisi,
  simdiIso: string,
): { kaydedildi: boolean; hatalar: string[]; kayit?: KaydedilenOlcum } {
  const d = telemetriyiDogrula(v);
  if (!d.gecerli) return { kaydedildi: false, hatalar: d.hatalar };
  return { kaydedildi: true, hatalar: [], kayit: { ...v, sunucuZamanDamgasi: simdiIso } };
}

export interface HamOlcum {
  sensorId: number;
  deger: number;
  /** UTC ms. */
  zaman: number;
}
export interface TamponDurumu {
  tampon: readonly HamOlcum[];
  yazilan: readonly HamOlcum[];
}

const MAKS_TAMPON_BOYUTU = 100;

/** Pure copy of `TelemetriTamponlayici` (L710-734); returns a new state. A failed write puts the records back first (L731). */
export function tamponaEkle(d: TamponDurumu, o: HamOlcum, yazmaBasarili = true): TamponDurumu {
  const tampon = [...d.tampon, o];
  if (tampon.length < MAKS_TAMPON_BOYUTU || !yazmaBasarili) return { tampon, yazilan: d.yazilan };
  return { tampon: [], yazilan: [...d.yazilan, ...tampon] };
}

export interface SaatOzeti {
  /** UTC ms of the hour start. */
  saatDilimi: number;
  ortalama: string;
  enDusuk: number;
  enYuksek: number;
  ornekSayisi: number;
}

const SAAT_MS = 3_600_000;

/** Mean of tenths-integers, rounded half up to 2 decimals (`numeric(5,2)`), as text; all integer arithmetic. */
function ortalamaMetni(onda: number[]): string {
  const toplam = onda.reduce((a, x) => a + x, 0);
  // mean = toplam / (10 n) = (toplam * 10 / n) / 100 -> hundredths, half up
  const yuzde = Math.floor((toplam * 20 + onda.length) / (2 * onda.length));
  return `${Math.floor(yuzde / 100)}.${String(yuzde % 100).padStart(2, '0')}`;
}

/** L740-749 in TypeScript: rows with `zaman >= baslangic`, grouped by UTC hour, ascending. */
export function saatlikOzet(olcumler: readonly HamOlcum[], baslangic: number): SaatOzeti[] {
  const gruplar = new Map<number, number[]>();
  for (const o of olcumler) {
    if (o.zaman < baslangic) continue;
    const saat = Math.floor(o.zaman / SAAT_MS) * SAAT_MS;
    const g = gruplar.get(saat) ?? [];
    g.push(Math.round(o.deger * 10));
    gruplar.set(saat, g);
  }
  return [...gruplar.keys()]
    .sort((a, b) => a - b)
    .map((saat) => {
      const onda = gruplar.get(saat)!;
      return {
        saatDilimi: saat,
        ortalama: ortalamaMetni(onda),
        enDusuk: Math.min(...onda) / 10,
        enYuksek: Math.max(...onda) / 10,
        ornekSayisi: onda.length,
      };
    });
}

/** The template of L738-751 (never executed). */
export function saatlikOzetSorgusuUret(sensorId: number, baslangicTarihi: string): string {
  return `
      SELECT
        date_trunc('hour', zaman) AS saat_dilimi,
        AVG(deger)::numeric(5,2) AS ortalama_sicaklik,
        MIN(deger) AS en_dusuk,
        MAX(deger) AS en_yuksek,
        COUNT(*) AS ornek_sayisi
      FROM sensor_telemetrileri
      WHERE sensor_id = ${sensorId} AND zaman >= '${baslangicTarihi}'
      GROUP BY saat_dilimi
      ORDER BY saat_dilimi ASC;
    `;
}

/** R22: 120 readings, 90 s apart from 2026-09-05T07:00:00Z. */
export const SABIT_SERI: readonly HamOlcum[] = Array.from({ length: 120 }, (_, i) => ({
  sensorId: 1,
  deger: (200 + Math.floor(i / 4) + ((7 * i) % 5)) / 10,
  zaman: Date.UTC(2026, 8, 5, 7) + 90_000 * i,
}));

export type DenetimAdi = 'Zaman penceresi' | 'Cihaz UUID' | 'HMAC' | 'Sıcaklık' | 'Nem';
export interface IotIstek {
  basliklar: ImzaliIstekBasliklari;
  govdeMetni: string;
}
export interface IotIzi {
  denetimler: Denetim[];
  kaydedildi: boolean;
  hata?: string;
  hatalar: string[];
  beklenenImza?: string;
  kayit?: KaydedilenOlcum;
  durum: TamponDurumu;
}

/** R24: window, UUID, HMAC (stops at the first failure), then both ranges, then the buffer. */
export function istegiIsle(istek: IotIstek, suAn: number, durum: TamponDurumu): IotIzi {
  const { basliklar, govdeMetni } = istek;
  const imza = dogrula(basliklar, govdeMetni, suAn);
  const pencere = Math.abs(suAn - basliklar.zamanDamgasi) <= GECERLILIK_PENCERESI_SANIYE;
  const cihazVar = basliklar.cihazUuid in CIHAZ_ANAHTARLARI;
  const zincir = zincirle([
    { ad: 'Zaman penceresi', durum: pencere ? 'gecti' : 'kaldi' },
    { ad: 'Cihaz UUID', durum: cihazVar ? 'gecti' : 'kaldi' },
    { ad: 'HMAC', durum: imza.gecerliMi ? 'gecti' : 'kaldi' },
  ]);
  const zincirGecti = imza.gecerliMi;
  let veri: TelemetriVerisi | null = null;
  if (zincirGecti) {
    try {
      veri = JSON.parse(govdeMetni) as TelemetriVerisi;
    } catch {
      veri = null;
    }
  }
  const aralik = veri ? telemetriyiDogrula(veri) : null;
  const sicaklikHata = aralik?.hatalar.find((h) => h.startsWith('sicaklik'));
  const nemHata = aralik?.hatalar.find((h) => h.startsWith('nem'));
  const satir = (ad: DenetimAdi, hata: string | undefined): Denetim =>
    !aralik ? { ad, durum: 'atlandi' } : hata ? { ad, durum: 'kaldi', ayrinti: hata } : { ad, durum: 'gecti' };
  const sonuc: IotIzi = {
    denetimler: [...zincir, satir('Sıcaklık', sicaklikHata), satir('Nem', nemHata)],
    kaydedildi: false,
    hatalar: aralik ? aralik.hatalar : [],
    durum,
  };
  if (pencere && cihazVar && imza.beklenenImza !== undefined) sonuc.beklenenImza = imza.beklenenImza;
  if (!zincirGecti) {
    sonuc.hata = imza.hata;
    return sonuc;
  }
  if (veri && aralik?.gecerli) {
    const kayit = olcumuKaydet(veri, new Date(suAn * 1000).toISOString()).kayit;
    return {
      ...sonuc,
      kaydedildi: true,
      kayit,
      durum: tamponaEkle(durum, { sensorId: 1, deger: veri.sicaklik, zaman: suAn * 1000 }),
    };
  }
  return sonuc;
}
