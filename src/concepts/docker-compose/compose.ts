import type { Message } from '../../core/plot/sequence';
import { LISTINGS } from './code-text';

export { LISTINGS };

/** Kod 14.9, L935-939. */
export interface BaglantiSecenekleri { host: string; port: number; veritabaniAdi: string }
export interface Deneme { deneme: number; t: number; basari: boolean }
export interface BaglantiSonucu { denemeler: Deneme[]; durum: 'kuruldu' | 'hata'; log: string[]; hata?: string }

/** Kod 14.9, L946-966, on a virtual clock: try n happens at baslangicMs + (n - 1) * bekleMs. */
export function saglikliBaglantiKur(
  s: BaglantiSecenekleri,
  hazirMi: (t: number) => boolean,
  baslangicMs: number,
  maksimumDeneme = 5,
  bekleMs = 500,
): BaglantiSonucu {
  const denemeler: Deneme[] = [];
  const log: string[] = [];
  for (let n = 1; n <= maksimumDeneme; n++) {
    const t = baslangicMs + (n - 1) * bekleMs;
    const basari = hazirMi(t);
    denemeler.push({ deneme: n, t, basari });
    if (basari) {
      log.push(`[${s.host}] Bağlantı ${n}. denemede kuruldu.`); // L955
      return { denemeler, durum: 'kuruldu', log };
    }
    if (n === maksimumDeneme) {
      return { denemeler, durum: 'hata', log, hata: `${maksimumDeneme} denemede veritabanına bağlanılamadı: ${s.host}` }; // L960
    }
  }
  return { denemeler, durum: 'hata', log, hata: `${maksimumDeneme} denemede veritabanına bağlanılamadı: ${s.host}` };
}

export interface Saglik { interval: number; timeout: number; retries: number; startPeriod: number }
/** code_014, L679-681 (`start_period` is not in the book). */
export const KITAP_SAGLIK: Saglik = { interval: 2000, timeout: 3000, retries: 10, startPeriod: 0 };

export interface Prob { k: number; t: number; durum: 'gecti' | 'kaldi' | 'sayilmadi'; ardisikHata: number }

/** R10: probe k runs at k * interval; it passes once t >= dbHazirMs. `timeout` does not enter the calculation. */
export function saglikDegerlendir(dbHazirMs: number, s: Saglik): { problar: Prob[]; saglikliMs: number | null; unhealthyMs: number | null } {
  const problar: Prob[] = [];
  let ardisik = 0;
  for (let k = 1; ; k++) {
    const t = k * s.interval;
    if (t >= dbHazirMs) {
      problar.push({ k, t, durum: 'gecti', ardisikHata: 0 });
      return { problar, saglikliMs: t, unhealthyMs: null };
    }
    if (t < s.startPeriod) {
      problar.push({ k, t, durum: 'sayilmadi', ardisikHata: ardisik });
      continue;
    }
    ardisik++;
    problar.push({ k, t, durum: 'kaldi', ardisikHata: ardisik });
    if (ardisik >= s.retries) return { problar, saglikliMs: null, unhealthyMs: t };
  }
}

export interface ComposeSenaryo {
  mod: 'sira' | 'saglikli';
  dbHazirMs: number;
  retries: number;
  maksimumDeneme: number;
  hostAdi: 'kutuphane-db' | 'localhost';
}

/** Kod 14.9, L969-973. */
export const KOMPOZ_SECENEKLERI: BaglantiSecenekleri = { host: 'kutuphane-db', port: 5432, veritabaniAdi: 'kutuphane' };

/** `kutuphane-db` answers once the database is up; `localhost` is the API's own container and never connects (L868-870). */
export function hazirMiFn(host: string, dbHazirMs: number): (t: number) => boolean {
  return (t) => host === 'kutuphane-db' && t >= dbHazirMs;
}

/** 1500 -> 't = 1,5 s', 4000 -> 't = 4 s'. */
export function saniyeEtiketi(ms: number): string {
  return `t = ${String(ms / 1000).replace('.', ',')} s`;
}

export interface ComposeSonuc {
  apiBaslangicMs: number | null;
  saglik?: ReturnType<typeof saglikDegerlendir>;
  baglanti?: BaglantiSonucu;
  durum: 'kuruldu' | 'hata' | 'bagimlilik-basarisiz';
  olaylar: Message[];
}

export function composeUp(s: ComposeSenaryo): ComposeSonuc {
  const olaylar: Message[] = [
    { id: 'baslat-db', from: 'compose', to: 'db', label: `başlat · ${saniyeEtiketi(0)}`, kind: 'request' },
  ];
  let apiBaslangicMs = 0;
  let saglik: ComposeSonuc['saglik'];
  if (s.mod === 'saglikli') {
    saglik = saglikDegerlendir(s.dbHazirMs, { ...KITAP_SAGLIK, retries: s.retries });
    for (const p of saglik.problar) {
      olaylar.push({
        id: `prob-${p.k}`, from: 'compose', to: 'db', kind: 'request',
        label: `pg_isready · ${saniyeEtiketi(p.t)}`,
        tone: p.durum === 'gecti' ? 'ok' : p.durum === 'kaldi' ? 'alarm' : 'bilgi',
      });
    }
    const bitis = saglik.saglikliMs ?? saglik.unhealthyMs!;
    olaylar.push({
      id: 'saglik', from: 'db', to: 'db', kind: 'note',
      label: `${saglik.saglikliMs !== null ? 'healthy' : 'unhealthy'} · ${saniyeEtiketi(bitis)}`,
    });
    if (saglik.saglikliMs === null) return { apiBaslangicMs: null, saglik, durum: 'bagimlilik-basarisiz', olaylar };
    apiBaslangicMs = saglik.saglikliMs;
  }
  olaylar.push({ id: 'baslat-api', from: 'compose', to: 'api', label: `başlat · ${saniyeEtiketi(apiBaslangicMs)}`, kind: 'request' });

  const baglanti = saglikliBaglantiKur(
    { ...KOMPOZ_SECENEKLERI, host: s.hostAdi }, hazirMiFn(s.hostAdi, s.dbHazirMs), apiBaslangicMs, s.maksimumDeneme, 500,
  );
  for (const d of baglanti.denemeler) {
    if (s.hostAdi === 'localhost') {
      olaylar.push({ id: `deneme-${d.deneme}`, from: 'api', to: 'api', kind: 'note', label: 'localhost:5432 · ECONNREFUSED', tone: 'alarm' });
      continue;
    }
    olaylar.push({
      id: `deneme-${d.deneme}`, from: 'api', to: 'db', kind: 'request',
      label: `bağlan · ${saniyeEtiketi(d.t)}`, tone: d.basari ? 'ok' : 'alarm',
    });
    if (!d.basari) {
      olaylar.push({ id: `deneme-${d.deneme}-ret`, from: 'db', to: 'api', kind: 'response', label: 'ECONNREFUSED', tone: 'alarm' });
    }
  }
  return { apiBaslangicMs, saglik, baglanti, durum: baglanti.durum, olaylar };
}
