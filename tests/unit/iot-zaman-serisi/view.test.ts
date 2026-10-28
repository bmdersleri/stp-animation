import { describe, expect, it } from 'vitest';
import { LISTINGS } from '../../../src/concepts/iot-zaman-serisi/code-text';
import { DERS_OZETI, GOVDE, IMZA, IMZA_DEGISMIS, IMZA_ESKI } from '../../../src/concepts/iot-zaman-serisi/degerler';
import { iotScenario as sc, type IotParams } from '../../../src/concepts/iot-zaman-serisi/scenario';
import { SABIT_SERI, DERS_SIMDI } from '../../../src/concepts/iot-zaman-serisi/telemetri';
import { deriveIotView, iotLabRozet, type IotView } from '../../../src/concepts/iot-zaman-serisi/view';
import { listing } from '../../../src/core/listing';

const step = (n: number): IotParams => sc.steps[n - 1].params as IotParams;
const view = (n: number, kitapCiktisi = true) => deriveIotView(step(n), kitapCiktisi);
const lab = (diff: Partial<IotParams> = {}) => deriveIotView({ ...sc.defaults, ...diff }, false);
const metinler = (v: IotView) => v.terminal.map((t) => t.metin);
const durumlar = (v: IotView) => v.denetim!.denetimler.map((d) => d.durum);
/** Book line L of a listing, looked up by the test itself so it reads the text, not a number. */
const satir = (id: string, L: number) => { const l = listing(LISTINGS, id); return l.lines[L - l.satirlar[0]]; };
const odak = (v: IotView) => v.code.active.map((i) => v.code.lines[i - 1]);
const HEX64 = /^[0-9a-f]{64}$/;
const arg = (v: IotView, alan: string) => v.argumanlar!.satirlar.find((r) => r.cells[0] === alan)!.cells[1] as string;

describe('iot-zaman-serisi view', () => {
  it('step 1 and 11 carry the book blocks verbatim', () => {
    const v = view(1);
    expect(v.kitap!.tanim).toMatch(/^IoT backend geliştirme, fiziksel cihazlardan \(sensör, aktüatör\)/);
    expect(v.kitap!.notlar).toHaveLength(1);
    expect(v.kitap!.notlar[0]).toMatch(/^Derinlemesine: Bir kullanıcı hatalı veri girerse/);
    expect(v.kitap!.notlar[0]).not.toMatch(/[*`]|🔍/);
    expect(v.seri).toBeNull();
    expect(v.sequence).toBeNull();
    const o = view(11).kitap!;
    expect(o.paragraflar![0]).toMatch(/^Diyagramdaki döngü kutusu/);
    expect(o.tablolar.map((t) => [t.baslik, t.satirlar.length])).toEqual([['Alternatifler', 4]]);
    expect(o.tablolar[0].satirlar[3].cells[0]).toBe('Veriyi doğrulamadan olduğu gibi kaydetme');
    expect(o.notlar[0]).toMatch(/^Sınav Notu: Cihaz kimliği API anahtarıyla/);
    expect(o.notlar[1]).toMatch(/^Aralık doğrulaması yalnızca veriyi kabul\/red etmekle/);
    expect(o.notlar.join(' ')).not.toMatch(/[*`]|📝/);
  });

  it('step 2 accepted -999 widens the y range', () => {
    const v = view(2);
    expect(v.seri!.noktalar).toEqual([{ zaman: DERS_SIMDI * 1000, deger: -999, durum: 'kabul' }]);
    expect(v.seri!.yAlan[0]).toBe(-1000);
    expect(metinler(v)).toEqual(['Kaydedildi: -999°C']);
    expect(v.denetim).toBeNull();
    expect(odak(v)).toEqual([satir('code-002', 194)]);
    expect(v.seri!.seri).toBe(SABIT_SERI);
    expect(v.seri!.xAlan).toEqual([Date.UTC(2026, 8, 5, 7), Date.UTC(2026, 8, 5, 10, 10)]);
  });

  it('out-of-range red point keeps the y range', () => {
    const v = lab({ sicaklik: -999 });
    expect(v.seri!.noktalar).toEqual([{ zaman: DERS_SIMDI * 1000, deger: -999, durum: 'red' }]);
    expect(v.seri!.yAlan[0]).toBeGreaterThan(-999);
    expect(v.seri!.yAlan).toEqual([SABIT_SERI.reduce((m, o) => Math.min(m, o.deger), 99) - 1, SABIT_SERI.reduce((m, o) => Math.max(m, o.deger), -99) + 1]);
    expect(v.kayit).toBeNull();
    expect(metinler(v)).toEqual(["false [ 'sicaklik aralık dışı (-40 ile 85 arası bekleniyor).' ]"]);
    expect(v.sequence!.stopAt).toBe('api');
    expect(odak(v)).toEqual([satir('kod-16-4', 495), satir('kod-16-4', 496), satir('kod-16-4', 516), satir('kod-16-4', 517)]);
  });

  it('both ranges out prints the four-line util.format output', () => {
    expect(metinler(lab({ sicaklik: 90, nem: 120 }))).toEqual([
      'false [',
      "  'sicaklik aralık dışı (-40 ile 85 arası bekleniyor).',",
      "  'nem aralık dışı (0 ile 100 arası bekleniyor).'",
      ']',
    ]);
  });

  it('step 3 shows the arguments and one shortened strip, no checks, no key', () => {
    const v = view(3);
    expect(v.argumanlar!.baslik).toBe('dogrula argümanları');
    expect(v.argumanlar!.sutunlar.map((s) => s.ad)).toEqual(['alan', 'değer']);
    expect(v.argumanlar!.satirlar.map((r) => r.cells[0])).toEqual(['X-Timestamp', 'X-Signature', 'cihazUuid', 'govdeMetni']);
    expect(arg(v, 'X-Timestamp')).toBe(String(DERS_SIMDI));
    expect(arg(v, 'X-Signature')).toBe(IMZA);
    expect(arg(v, 'cihazUuid')).toBe('esp32-lab101-temp');
    expect(arg(v, 'govdeMetni')).toBe(GOVDE);
    expect(JSON.stringify({ ...v, code: null })).not.toContain('super-gizli');
    expect(v.imzalar).toHaveLength(1);
    expect(v.imzalar[0].parcalar[0]).toMatchObject({ metin: IMZA, kisalt: 16 });
    expect(v.denetim).toBeNull();
    expect(odak(v)).toEqual([satir('kod-16-3', 410), satir('kod-16-3', 411)]);
  });

  it('step 4 window kaldi and the other four atlandi', () => {
    const v = view(4);
    expect(durumlar(v)).toEqual(['kaldi', 'atlandi', 'atlandi', 'atlandi', 'atlandi']);
    expect(v.denetim!.denetimler.map((d) => d.ad)).toEqual(['Zaman penceresi', 'Cihaz UUID', 'HMAC', 'Sıcaklık', 'Nem']);
    expect(arg(v, 'X-Timestamp')).toBe(String(DERS_SIMDI - 61));
    expect(arg(v, 'X-Signature')).toBe(IMZA_ESKI);
    expect(metinler(v)).toEqual(['Zaman damgası süresi dolmuş veya geçersiz (Replay Attack riski).']);
    expect(satir('kod-16-3', 401)).toContain(metinler(v)[0]);
    expect(v.seri!.noktalar).toEqual([{ zaman: DERS_SIMDI * 1000, deger: 21.5, durum: 'red' }]);
    expect(v.imzalar).toEqual([]);
    expect(v.sequence!.messages).toEqual([{ id: 'olcum-1', from: 'cihaz', to: 'api', label: 'imzalı ölçüm', kind: 'request', tone: 'alarm' }]);
  });

  it('code strip focus line text', () => {
    const v = view(4);
    expect(odak(v)).toHaveLength(1);
    expect(odak(v)[0]).toBe(satir('kod-16-3', 399));
    expect(odak(v)[0]).toMatch(/^ {4}if \(Math\.abs\(suAn - basliklar\.zamanDamgasi\) > /);
    expect(v.code.title).toBe('Kod 16.3 · HMAC-SHA256 imza ve zaman penceresi');
  });

  it('step 5 first three checks passed, range checks waiting, no point', () => {
    const v = view(5);
    expect(durumlar(v)).toEqual(['gecti', 'gecti', 'gecti', 'bekliyor', 'bekliyor']);
    expect(v.seri!.noktalar).toEqual([]);
    expect(v.terminal).toEqual([]);
    expect(v.kayit).toBeNull();
    expect(v.sequence).toBeNull();
    expect(v.imzalar).toEqual([]);
    expect(odak(v)).toEqual([satir('kod-16-3', 417), satir('kod-16-3', 418)]);
  });

  it('step 6 two signature strips differ', () => {
    const v = view(6);
    expect(durumlar(v)).toEqual(['gecti', 'gecti', 'kaldi', 'atlandi', 'atlandi']);
    expect(v.imzalar.map((s) => s.baslik)).toEqual(['gelen imza', 'beklenen imza']);
    const [gelen, beklenen] = v.imzalar.map((s) => s.parcalar[0]);
    expect(gelen.metin).toBe(IMZA);
    expect(beklenen.metin).toBe(IMZA_DEGISMIS);
    expect(gelen.kisalt).toBeUndefined();
    expect(gelen.fark!.length).toBeGreaterThan(0);
    expect(beklenen.fark!.length).toBeGreaterThan(0);
    expect(arg(v, 'X-Signature')).toMatch(HEX64);
    expect(arg(v, 'X-Signature')).toBe(IMZA);
    expect(JSON.parse(arg(v, 'govdeMetni')).sicaklik).toBe(31.5);
    expect(metinler(v)).toEqual(['HMAC imzası geçersiz; veri yolda değiştirilmiş olabilir.']);
    expect(satir('kod-16-3', 420)).toContain(metinler(v)[0]);
    expect(v.notlar[0]).toMatch(/^\$\{basliklar\.zamanDamgasi\}\.\$\{govdeMetni\}: Hem zaman damgasının/);
    expect(odak(v)).toEqual([417, 418, 419, 420].map((n) => satir('kod-16-3', n)));
  });

  it('step 7 two accepted points 20 s apart', () => {
    const v = view(7);
    expect(v.seri!.noktalar).toEqual([
      { zaman: DERS_SIMDI * 1000, deger: 21.5, durum: 'kabul' },
      { zaman: (DERS_SIMDI + 20) * 1000, deger: 21.5, durum: 'kabul' },
    ]);
    expect(v.kayit!.satirlar.map((r) => r.cells[3])).toEqual(['2026-09-05T10:00:00.000Z', '2026-09-05T10:00:20.000Z']);
    expect(v.kayit!.not).toBe('tamponda 22 kayıt');
    expect(metinler(v)).toEqual(['Veritabanına yazıldı: esp32-lab101-temp', 'true', 'Veritabanına yazıldı: esp32-lab101-temp', 'true']);
    expect(v.sequence!.messages.map((m) => m.label)).toEqual(['imzalı ölçüm', 'kaydet (sunucu zamanı)', 'imzalı ölçüm', 'kaydet (sunucu zamanı)']);
    expect(new Set(v.sequence!.messages.map((m) => m.id)).size).toBe(4);
    expect(v.notlar).toHaveLength(3);
    expect(v.notlar[0]).toMatch(/pencere içindeki aynı imzalı mesajın tekrarını engellemez/);
    expect(v.notlar[1]).toMatch(/^Yasemin \(Güvenlik Uzmanı\): “/);
    expect(odak(v)).toEqual([satir('kod-16-3', 398), satir('kod-16-3', 399)]);
  });

  it('step 8 hides the chart and the argument table, terminal L546', () => {
    const v = view(8);
    expect(v.seri).toBeNull();
    expect(v.argumanlar).toBeNull();
    expect(v.sequence).toBeNull();
    expect(metinler(v)).toEqual(listing(LISTINGS, 'kod-16-4-cikti').lines);
    expect(metinler(v)[2]).toBe("false [ 'sicaklik aralık dışı (-40 ile 85 arası bekleniyor).' ]");
    // only the book's two range results (the second call): no row in the page's own wording under the kitap badge
    expect(v.denetim!.denetimler).toEqual([
      { ad: 'Sıcaklık', durum: 'kaldi', ayrinti: 'sicaklik aralık dışı (-40 ile 85 arası bekleniyor).' },
      { ad: 'Nem', durum: 'gecti' },
    ]);
    expect(odak(v)).toEqual([495, 496, 516, 517].map((n) => satir('kod-16-4', n)));
    expect(deriveIotView(step(8), false).terminal).toEqual([]);
  });

  it('step 9 record time is the server time', () => {
    const v = view(9);
    expect(durumlar(v)).toEqual(['gecti', 'gecti', 'gecti', 'gecti', 'gecti']);
    expect(arg(v, 'X-Timestamp')).toBe(String(DERS_SIMDI - 45));
    expect(v.kayit!.baslik).toBe('Kaydedilen ölçüm');
    expect(v.kayit!.sutunlar.map((s) => s.ad)).toEqual(['cihazId', 'sicaklik', 'nem', 'sunucuZamanDamgasi']);
    expect(v.kayit!.satirlar[0].cells).toEqual(['esp32-lab101-temp', 21.5, 45.2, '2026-09-05T10:00:00.000Z']);
    expect(v.notlar).toHaveLength(3);
    expect(v.notlar[0]).toMatch(/^sunucuZamanDamgasi: new Date\(\)\.toISOString\(\) zaman damgası/);
    expect(v.notlar[1]).toMatch(/^Dikkat noktası: Zaman damgasının istemci yerine sunucuda/);
    expect(v.notlar[2]).toMatch(/birleştirilmesi bu sayfanındır/);
    expect(odak(v)).toEqual([satir('kod-16-4', 521)]);
  });

  it('step 10 summary 20.65 / 21.65 / 22.40 and buffer 20', () => {
    const v = view(10);
    expect(v.ozet!.baslik).toBe('Saatlik özet (UTC)');
    expect(v.ozet!.sutunlar.map((s) => s.ad)).toEqual(['saat_dilimi', 'ortalama_sicaklik', 'en_dusuk', 'en_yuksek', 'ornek_sayisi']);
    expect(v.ozet!.satirlar.map((r) => r.cells)).toEqual([
      ['2026-09-05 07:00', '20.65', '20.0', '21.3', 40],
      ['2026-09-05 08:00', '21.65', '21.0', '22.3', 40],
      ['2026-09-05 09:00', '22.40', '22.0', '22.8', 20],
    ]);
    expect(DERS_OZETI.map((o) => o.ortalama)).toEqual(['20.65', '21.65', '22.40']);
    expect(v.tampon!.sutunlar.map((s) => s.ad)).toEqual(['durum', 'kayıt', 'zaman (UTC)']);
    expect(v.tampon!.satirlar.map((r) => r.cells)).toEqual([
      ['yazıldı', 100, '07:00:00–09:28:30'],
      ['tamponda', 20, '09:30:00–09:58:30'],
    ]);
    expect(v.terminal).toHaveLength(10);
    expect(metinler(v)[0]).toBe('SELECT');
    expect(metinler(v)[1]).toBe("  date_trunc('hour', zaman) AS saat_dilimi,");
    expect(metinler(v)[9]).toBe('ORDER BY saat_dilimi ASC;');
    expect(v.notlar).toHaveLength(1);
    expect(v.notlar[0]).toMatch(/^Başarısız yazmada tampon geri yüklenir/);
    expect(v.seri).toBeNull();
    expect(odak(v)).toEqual([satir('kod-16-6', 718), satir('kod-16-6', 741), satir('kod-16-6', 742)]);
  });

  it('bilinmeyen device fails at Cihaz UUID', () => {
    const v = lab({ govde: 'bilinmeyen' });
    expect(durumlar(v)).toEqual(['gecti', 'kaldi', 'atlandi', 'atlandi', 'atlandi']);
    expect(arg(v, 'cihazUuid')).toBe('esp32-lab102-temp');
    expect(metinler(v)).toEqual(["Bilinmeyen cihaz UUID'si."]);
    expect(v.imzalar).toEqual([]);
    expect(odak(v)).toEqual([404, 405, 406].map((n) => satir('kod-16-3', n)));
  });

  it('accepted lab request adds one record', () => {
    const v = lab();
    expect(v.kayit!.satirlar).toHaveLength(1);
    expect(v.kayit!.not).toBe('tamponda 21 kayıt');
    expect(metinler(v)).toEqual(['Veritabanına yazıldı: esp32-lab101-temp', 'true']);
    expect(v.seri!.noktalar).toEqual([{ zaman: DERS_SIMDI * 1000, deger: 21.5, durum: 'kabul' }]);
    expect(v.sequence!.messages.map((m) => [m.from, m.to, m.label, m.tone])).toEqual([
      ['cihaz', 'api', 'imzalı ölçüm', 'ok'], ['api', 'seri', 'kaydet (sunucu zamanı)', 'ok'],
    ]);
    expect(v.sequence!.lanes.map((l) => [l.id, l.label.join(' ')])).toEqual([['cihaz', 'Sensör cihazı'], ['api', 'Telemetri API'], ['seri', 'Zaman serisi']]);
    expect(v.sequence!.stopAt).toBeUndefined();
    expect(v.notlar).toEqual(['Pencere, imza ve aralık denetimlerinin birleştirilmesi bu sayfanındır.']);
  });

  it('rejected requests leave no record and the strips use the full 64 hex', () => {
    const v = lab({ govde: 'degismis' });
    expect(v.kayit).toBeNull();
    expect(v.imzalar).toHaveLength(2);
    expect(v.imzalar.every((s) => HEX64.test(s.parcalar[0].metin))).toBe(true);
  });

  it('every stage returns a view and the Lab badge is kitap-kodu', () => {
    for (let n = 1; n <= 11; n++) {
      const v = view(n);
      expect(v.code.lines.length, `step ${n}`).toBeGreaterThan(0);
      v.code.active.forEach((i) => expect(i).toBeGreaterThanOrEqual(1));
    }
    expect(iotLabRozet(sc.defaults)).toEqual({ tur: 'kitap-kodu' });
  });
});
