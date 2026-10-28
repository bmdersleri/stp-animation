import { createHmac } from 'node:crypto';
import { format } from 'node:util';
import { describe, expect, it } from 'vitest';
import { nodeInspect } from '../../../src/core/node-inspect';
import { LISTINGS } from '../../../src/concepts/iot-zaman-serisi/code-text';
import {
  ANAHTAR,
  DERS_OZETI,
  GOVDE,
  GOVDE_DEGISMIS,
  IMZA,
  IMZA_DEGISMIS,
  IMZA_ESKI,
  IMZA_GERIDE,
  IMZA_ONBELLEK,
  imzaAl,
} from '../../../src/concepts/iot-zaman-serisi/degerler';
import {
  CIHAZ_ANAHTARLARI,
  DERS_SIMDI,
  GECERLILIK_PENCERESI_SANIYE,
  SABIT_SERI,
  dogrula,
  hexBayt,
  imzaUret,
  istegiIsle,
  olcumuKaydet,
  saatlikOzet,
  saatlikOzetSorgusuUret,
  tamponaEkle,
  telemetriyiDogrula,
  type TamponDurumu,
} from '../../../src/concepts/iot-zaman-serisi/telemetri';

const listing = (id: string) => LISTINGS.find((l) => l.id === id)!;
const UUID = 'esp32-lab101-temp';
const baslik = (imza: string, zamanDamgasi: number, cihazUuid = UUID) => ({ cihazUuid, imza, zamanDamgasi });
const bos: TamponDurumu = { tampon: [], yazilan: [] };
const node = (t: number, g: string) => createHmac('sha256', ANAHTAR).update(`${t}.${g}`).digest('hex');
const govdeSicaklik = (s: number) => JSON.stringify({ cihazId: UUID, sicaklik: s, nem: 45.2 });
const PENCERE = 'Zaman damgası süresi dolmuş veya geçersiz (Replay Attack riski).';
const BILINMEYEN = "Bilinmeyen cihaz UUID'si.";
const HMAC_HATA = 'HMAC imzası geçersiz; veri yolda değiştirilmiş olabilir.';
const doldur = (n: number, durum = bos) => {
  let d = durum;
  for (let i = 0; i < n; i++) d = tamponaEkle(d, SABIT_SERI[i]);
  return d;
};

describe('iot-zaman-serisi telemetri model', () => {
  it('ders signatures equal node createHmac', () => {
    expect(CIHAZ_ANAHTARLARI[UUID]).toBe(ANAHTAR);
    const durumlar: [number, string, string][] = [
      [1788602400, GOVDE, IMZA],
      [1788602339, GOVDE, IMZA_ESKI],
      [1788602400, GOVDE_DEGISMIS, IMZA_DEGISMIS],
      [1788602355, GOVDE, IMZA_GERIDE],
      [1788602460, GOVDE, '5a598d1400fc3434a6aa19eec11dfc6338ab0a58f399422daa6e7687cfde277d'],
      [1788602400, govdeSicaklik(-999), 'ea489e28ee17d10a5e610b6c773cbb91897ed08f006967baf53545bdb1824a4b'],
    ];
    for (const [t, g, beklenen] of durumlar) {
      expect(node(t, g)).toBe(beklenen);
      expect(imzaUret(ANAHTAR, t, g)).toBe(beklenen);
    }
    expect(GOVDE).toBe('{"cihazId":"esp32-lab101-temp","sicaklik":21.5,"nem":45.2}');
    expect(GOVDE_DEGISMIS).toBe(GOVDE.replace('21.5', '31.5'));
    expect(imzaAl(1788602400, GOVDE)).toBe(IMZA);
    expect(Object.keys(IMZA_ONBELLEK)).toHaveLength(4);
    expect(imzaAl(1788602460, GOVDE)).toBe(node(1788602460, GOVDE));
  });

  it('window boundary 60 passes and 61 fails both ways', () => {
    expect(GECERLILIK_PENCERESI_SANIYE).toBe(60);
    const b = baslik(IMZA, 1788602400);
    expect(dogrula(b, GOVDE, 1788602460).gecerliMi).toBe(true);
    expect(dogrula(b, GOVDE, 1788602340).gecerliMi).toBe(true);
    expect(dogrula(b, GOVDE, 1788602461)).toMatchObject({ gecerliMi: false, hata: PENCERE });
    expect(dogrula(b, GOVDE, 1788602339)).toMatchObject({ gecerliMi: false, hata: PENCERE });
    const arti60 = baslik('5a598d1400fc3434a6aa19eec11dfc6338ab0a58f399422daa6e7687cfde277d', 1788602460);
    expect(dogrula(arti60, GOVDE, DERS_SIMDI).gecerliMi).toBe(true);
  });

  it('window is checked before the device', () => {
    expect(dogrula(baslik(IMZA_ESKI, 1788602339, 'bilinmeyen'), GOVDE, DERS_SIMDI).hata).toBe(PENCERE);
  });

  it("three error texts are the book's", () => {
    const k = listing('kod-16-3').lines.join('\n');
    for (const t of [PENCERE, BILINMEYEN, HMAC_HATA]) expect(k).toContain(t);
    expect(dogrula(baslik(IMZA, 1788602400, 'bilinmeyen'), GOVDE, DERS_SIMDI).hata).toBe(BILINMEYEN);
    expect(dogrula(baslik(IMZA_ESKI, 1788602400), GOVDE, DERS_SIMDI).hata).toBe(HMAC_HATA);
  });

  it('changed body fails HMAC', () => {
    const s = dogrula(baslik(IMZA, 1788602400), GOVDE_DEGISMIS, DERS_SIMDI);
    expect(s).toEqual({ gecerliMi: false, hata: HMAC_HATA, beklenenImza: IMZA_DEGISMIS });
  });

  it('replay inside the window is accepted', () => {
    expect(dogrula(baslik(IMZA, 1788602400), GOVDE, 1788602420).gecerliMi).toBe(true);
  });

  it('hexBayt copies Buffer.from hex', () => {
    const t = (s: string) => Array.from(hexBayt(s));
    for (const s of ['abzz', 'abc', 'zzab', 'a', 'ABcd', '', IMZA]) expect(t(s)).toEqual(Array.from(Buffer.from(s, 'hex')));
    expect(t('abzz')).toEqual([171]);
    expect(t('abc')).toEqual([171]);
    expect(t('zzab')).toEqual([]);
    expect(t('a')).toEqual([]);
    expect(t('ABcd')).toEqual([171, 205]);
    // a short signature falls to the length branch
    expect(dogrula(baslik('abzz', 1788602400), GOVDE, DERS_SIMDI).hata).toBe(HMAC_HATA);
  });

  it('range bounds', () => {
    const ok = (sicaklik: number, nem: number) => telemetriyiDogrula({ cihazId: 'x', sicaklik, nem }).gecerli;
    for (const [s, n] of [[-40, 0], [85, 100], [0, 50]]) expect(ok(s, n)).toBe(true);
    for (const [s, n] of [[-40.1, 50], [85.1, 50], [20, -0.1], [20, 100.1]]) expect(ok(s, n)).toBe(false);
  });

  it('book output L544-546', () => {
    const satirlar: string[] = [];
    const calistir = (sicaklik: number) => {
      const v = { cihazId: 'esp32-okuma-salonu-01', sicaklik, nem: 45.2 };
      const s = olcumuKaydet(v, '2026-09-05T10:00:00.000Z');
      if (s.kaydedildi) satirlar.push(`Veritabanına yazıldı: ${v.cihazId}`);
      return s;
    };
    const gecerli = calistir(21.5);
    satirlar.push(String(gecerli.kaydedildi));
    const gecersiz = calistir(-999);
    satirlar.push(`${nodeInspect(gecersiz.kaydedildi)} ${nodeInspect(gecersiz.hatalar)}`);
    expect(satirlar).toEqual(listing('kod-16-4-cikti').lines);
    expect(gecersiz.kayit).toBeUndefined();
  });

  it('two range errors print as node does', () => {
    const s = olcumuKaydet({ cihazId: 'x', sicaklik: -999, nem: 101 }, '');
    const beklenen = format(false, s.hatalar).split('\n');
    expect(beklenen).toHaveLength(4);
    expect(`${nodeInspect(s.kaydedildi)} ${nodeInspect(s.hatalar)}`.split('\n')).toEqual(beklenen);
  });

  it('book output L203', () => {
    expect(`Kaydedildi: ${-999}°C`).toBe(listing('code-002-cikti').lines[0]);
  });

  it('server time is the record time', () => {
    const iz = istegiIsle({ basliklar: baslik(IMZA_GERIDE, 1788602355), govdeMetni: GOVDE }, DERS_SIMDI, bos);
    expect(iz.kaydedildi).toBe(true);
    expect(iz.kayit).toEqual({ cihazId: UUID, sicaklik: 21.5, nem: 45.2, sunucuZamanDamgasi: '2026-09-05T10:00:00.000Z' });
    expect(iz.durum.tampon).toEqual([{ sensorId: 1, deger: 21.5, zaman: DERS_SIMDI * 1000 }]);
  });

  it('chain stops at the first failure and range checks are skipped', () => {
    const adlar = ['Zaman penceresi', 'Cihaz UUID', 'HMAC', 'Sıcaklık', 'Nem'];
    const durumlar = (iz: ReturnType<typeof istegiIsle>) => iz.denetimler.map((d) => d.durum);
    const eski = istegiIsle({ basliklar: baslik(IMZA_ESKI, 1788602339), govdeMetni: GOVDE }, DERS_SIMDI, bos);
    expect(eski.denetimler.map((d) => d.ad)).toEqual(adlar);
    expect(durumlar(eski)).toEqual(['kaldi', 'atlandi', 'atlandi', 'atlandi', 'atlandi']);
    expect(eski.hata).toBe(PENCERE);
    expect(eski.kaydedildi).toBe(false);
    const uuid = istegiIsle({ basliklar: baslik(IMZA, 1788602400, 'x'), govdeMetni: GOVDE }, DERS_SIMDI, bos);
    expect(durumlar(uuid)).toEqual(['gecti', 'kaldi', 'atlandi', 'atlandi', 'atlandi']);
    const hmac = istegiIsle({ basliklar: baslik(IMZA, 1788602400), govdeMetni: GOVDE_DEGISMIS }, DERS_SIMDI, bos);
    expect(durumlar(hmac)).toEqual(['gecti', 'gecti', 'kaldi', 'atlandi', 'atlandi']);
    expect(hmac.beklenenImza).toBe(IMZA_DEGISMIS);
    const g = govdeSicaklik(-999);
    const aralik = istegiIsle({ basliklar: baslik(imzaAl(DERS_SIMDI, g), DERS_SIMDI), govdeMetni: g }, DERS_SIMDI, bos);
    expect(durumlar(aralik)).toEqual(['gecti', 'gecti', 'gecti', 'kaldi', 'gecti']);
    expect(aralik.hatalar).toEqual(['sicaklik aralık dışı (-40 ile 85 arası bekleniyor).']);
    expect(aralik.kaydedildi).toBe(false);
    expect(aralik.durum).toEqual(bos);
    const iyi = istegiIsle({ basliklar: baslik(IMZA, 1788602400), govdeMetni: GOVDE }, DERS_SIMDI, bos);
    expect(durumlar(iyi)).toEqual(['gecti', 'gecti', 'gecti', 'gecti', 'gecti']);
    expect(iyi.beklenenImza).toBe(IMZA);
  });

  it('buffer flushes once at 100', () => {
    const d99 = doldur(99);
    expect(d99.tampon).toHaveLength(99);
    expect(d99.yazilan).toHaveLength(0);
    const d100 = tamponaEkle(d99, SABIT_SERI[99]);
    expect(d100.yazilan).toHaveLength(100);
    expect(d100.tampon).toHaveLength(0);
    expect(d99.tampon).toHaveLength(99);
    const d120 = doldur(120);
    expect(d120.yazilan).toHaveLength(100);
    expect(d120.tampon.map((o) => o.deger)).toEqual([
      22.5, 22.7, 22.9, 22.6, 22.9, 22.6, 22.8, 23.0, 22.8, 23.0, 22.7, 22.9, 23.2, 22.9, 23.1, 22.8, 23.1, 23.3, 23.0, 23.2,
    ]);
  });

  it('failed write puts records back first', () => {
    const d = tamponaEkle(doldur(99), SABIT_SERI[99], false);
    expect(d.tampon).toHaveLength(100);
    expect(d.yazilan).toHaveLength(0);
    expect(d.tampon[0]).toBe(SABIT_SERI[0]);
  });

  it('series first and last readings', () => {
    const t0 = Date.UTC(2026, 8, 5, 7);
    expect(SABIT_SERI).toHaveLength(120);
    expect(SABIT_SERI.every((o) => o.sensorId === 1)).toBe(true);
    expect(SABIT_SERI.slice(0, 4).map((o) => [o.zaman - t0, o.deger])).toEqual([[0, 20.0], [90_000, 20.2], [180_000, 20.4], [270_000, 20.1]]);
    expect(new Date(SABIT_SERI[119].zaman).toISOString()).toBe('2026-09-05T09:58:30.000Z');
    expect(SABIT_SERI[119].deger).toBe(23.2);
  });

  it('hourly summary of the written rows', () => {
    const yazilan = doldur(120).yazilan;
    const baslangic = Date.UTC(2026, 8, 5, 7);
    const ozet = saatlikOzet(yazilan, baslangic);
    const saat = (h: number) => Date.UTC(2026, 8, 5, h);
    expect(ozet).toEqual([
      { saatDilimi: saat(7), ortalama: '20.65', enDusuk: 20.0, enYuksek: 21.3, ornekSayisi: 40 },
      { saatDilimi: saat(8), ortalama: '21.65', enDusuk: 21.0, enYuksek: 22.3, ornekSayisi: 40 },
      { saatDilimi: saat(9), ortalama: '22.40', enDusuk: 22.0, enYuksek: 22.8, ornekSayisi: 20 },
    ]);
    expect(ozet).toEqual(DERS_OZETI);
    // independent integer sums in tenths
    const toplam = (h: number) => yazilan.filter((o) => o.zaman >= saat(h) && o.zaman < saat(h + 1)).reduce((a, o) => a + Math.round(o.deger * 10), 0);
    expect([toplam(7), toplam(8), toplam(9)]).toEqual([8260, 8660, 4480]);
    expect(saatlikOzet(yazilan, saat(8)).map((s) => s.ortalama)).toEqual(['21.65', '22.40']);
  });

  it('summary of all 120 rows', () => {
    const ozet = saatlikOzet(SABIT_SERI, Date.UTC(2026, 8, 5, 7));
    expect(ozet[2]).toMatchObject({ ortalama: '22.65', enDusuk: 22.0, enYuksek: 23.3, ornekSayisi: 40 });
    const toplam = SABIT_SERI.filter((o) => o.zaman >= Date.UTC(2026, 8, 5, 9)).reduce((a, o) => a + Math.round(o.deger * 10), 0);
    expect(toplam).toBe(9060);
  });

  it('generated SQL', () => {
    const sql = saatlikOzetSorgusuUret(1, '2026-09-05T07:00:00Z');
    const k = listing('kod-16-6').lines;
    const sablon = k.slice(740 - 704, 750 - 704).join('\n');
    const beklenen = `\n${sablon}\n    `.replace('${sensorId}', '1').replace('${baslangicTarihi}', '2026-09-05T07:00:00Z');
    expect(sql).toBe(beklenen);
    expect(sql).toContain("WHERE sensor_id = 1 AND zaman >= '2026-09-05T07:00:00Z'");
  });

  it('listings match book', () => {
    const k = listing('kod-16-3');
    expect(k.lines).toHaveLength(49);
    expect(k.lines[0]).toBe('import { createHmac, timingSafeEqual } from "crypto";');
    expect(listing('kod-16-4-cikti').lines).toHaveLength(3);
    for (const l of LISTINGS) expect(l.lines).toHaveLength(l.satirlar[1] - l.satirlar[0] + 1);
  });
});
