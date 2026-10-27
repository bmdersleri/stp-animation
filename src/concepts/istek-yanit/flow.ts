import { lineOf } from './code-text';

export interface UygulamaIstegi { yol: string; kullaniciAdi: string; yetkiliMi: boolean }
export interface UygulamaYaniti { durumKodu: 200 | 400 | 401 | 404; mesaj: string }
export type Katman = 'istemci' | 'tersVekil' | 'notApi' | 'backend';
/** One step of the flow; `line` is the 1-based line of Kod 1.5 that runs. A note is a rule check on its own layer. */
export interface Olay { kind: 'request' | 'response' | 'note'; from: Katman; to: Katman; label: string; line: number; ok?: boolean }
export interface Iz { istek: UygulamaIstegi; olaylar: Olay[]; yanit: UygulamaYaniti; durduran: Katman; cikti: string }

export const YOLLAR: readonly string[] = ['/api/notlar/2026001', '/api/notlar/2026999', '/api/notlar/', '/api/odeme'];

/** The book's grade table (NotBackendServisi.notlar). */
const NOTLAR: Readonly<Record<string, number>> = { '2026001': 88 };

/** The listing lines the trace points at, resolved once from the book text. */
const L = {
  yonlendir: lineOf('this.tersVekil.yonlendir(istek)'),
  yetki: lineOf('if (!istek.yetkiliMi)'),
  yolDenetimi: lineOf('startsWith("/api/notlar/")'),
  istekIsle: lineOf('this.notApi.istekIsle(istek)'),
  yolParcalari: lineOf('yolParcalari[3]'),
  notGetir: lineOf('this.backendServisi.notGetir('),
  notlar: lineOf('this.notlar[ogrenciNumarasi]'),
  yanit401: lineOf('durumKodu: 401'),
  yanit404Vekil: lineOf('durumKodu: 404, mesaj: "Proxy'),
  yanit400: lineOf('durumKodu: 400'),
  yanit404Not: lineOf('durumKodu: 404, mesaj: "Öğrenci'),
  yanit200: lineOf('durumKodu: 200'),
  log: lineOf('console.log('),
};

const YANIT = {
  401: { durumKodu: 401, mesaj: 'Kimlik doğrulaması gerekli.' },
  proxy404: { durumKodu: 404, mesaj: 'Proxy için uygun yol bulunamadı.' },
  400: { durumKodu: 400, mesaj: 'Öğrenci numarası eksik.' },
  notYok: { durumKodu: 404, mesaj: 'Öğrenci kaydı bulunamadı.' },
} as const satisfies Record<string, UygulamaYaniti>;

/**
 * Runs the book's mini application (Kod 1.5) for one request and records every step as an event.
 * `yol` is the full path, so the Lab can also send paths the book never uses.
 */
export function notSorgula(yol: string, yetkiliMi: boolean): Iz {
  const istek: UygulamaIstegi = { yol, kullaniciAdi: 'ayse', yetkiliMi };
  const olaylar: Olay[] = [];
  const add = (kind: Olay['kind'], from: Katman, to: Katman, label: string, line: number, ok?: boolean): void => {
    olaylar.push(ok === undefined ? { kind, from, to, label, line } : { kind, from, to, label, line, ok });
  };
  /** The response travels back to the client; `from` is the layer that produced it. */
  const don = (from: Katman, yanit: UygulamaYaniti, line: number): Iz => {
    const geri: [Katman, Katman, number][] = [
      ['backend', 'notApi', line],
      ['notApi', 'tersVekil', from === 'backend' ? L.notGetir : line],
      ['tersVekil', 'istemci', from === 'tersVekil' ? line : L.istekIsle],
    ];
    for (const [a, b, l] of geri.slice(['backend', 'notApi', 'tersVekil'].indexOf(from))) add('response', a, b, `${yanit.durumKodu}`, l);
    const cikti = `[${yanit.durumKodu}] ${yanit.mesaj}`;
    add('note', 'istemci', 'istemci', cikti, L.log);
    return { istek, olaylar, yanit, durduran: from, cikti };
  };

  add('request', 'istemci', 'tersVekil', `GET ${yol}`, L.yonlendir);
  add('note', 'tersVekil', 'tersVekil', 'Kimlik denetimi', L.yetki, yetkiliMi);
  if (!yetkiliMi) return don('tersVekil', YANIT[401], L.yanit401);
  const yolTamam = yol.startsWith('/api/notlar/');
  add('note', 'tersVekil', 'tersVekil', 'Yol /api/notlar/ ile mi başlıyor?', L.yolDenetimi, yolTamam);
  if (!yolTamam) return don('tersVekil', YANIT.proxy404, L.yanit404Vekil);
  add('request', 'tersVekil', 'notApi', 'İsteği ilet', L.istekIsle);
  const no = yol.split('/')[3] ?? '';
  add('note', 'notApi', 'notApi', `yol.split("/")[3] → "${no}"`, L.yolParcalari, no !== '');
  if (no === '') return don('notApi', YANIT[400], L.yanit400);
  add('request', 'notApi', 'backend', `notGetir("${no}")`, L.notGetir);
  const deger = NOTLAR[no];
  add('note', 'backend', 'backend', `notlar["${no}"] → ${deger ?? 'undefined'}`, L.notlar, deger !== undefined);
  if (deger === undefined) return don('backend', YANIT.notYok, L.yanit404Not);
  return don('backend', { durumKodu: 200, mesaj: `${no} numaralı öğrencinin notu: ${deger}` }, L.yanit200);
}
