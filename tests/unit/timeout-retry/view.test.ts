import { describe, expect, it } from 'vitest';
import { LISTINGS } from '../../../src/concepts/timeout-retry/code-text';
import { ozetiAl } from '../../../src/concepts/timeout-retry/istek';
import { TIMEOUT_ROZET, timeoutScenario as sc, type TimeoutParams } from '../../../src/concepts/timeout-retry/scenario';
import {
  RETRY_NOTU,
  SAYFA_NOTLARI,
  SINYAL_NOTU,
  VARSAYIM_NOTU,
  davranislar,
  deriveTimeoutView,
  timeoutLabRozet,
  type TimeoutView,
} from '../../../src/concepts/timeout-retry/view';
import { listing } from '../../../src/core/listing';

const step = (n: number): TimeoutParams => sc.steps[n - 1].params as TimeoutParams;
const view = (n: number, kitapCiktisi = true) => deriveTimeoutView(step(n), kitapCiktisi);
const lab = (diff: Partial<TimeoutParams> = {}) => deriveTimeoutView({ ...sc.defaults, ...diff }, false);
const metinler = (v: TimeoutView) => v.kartlar.terminal.map((t) => t.metin);
/** Book line L of a listing, looked up by the test itself so it reads the text, not a number. */
const satir = (id: string, L: number) => { const l = listing(LISTINGS, id); return l.lines[L - l.satirlar[0]]; };
const odak = (v: TimeoutView) => v.code.active.map((i) => v.code.lines[i - 1]);
const sonOk = (v: TimeoutView) => v.sequence!.messages[v.sequence!.messages.length - 1];

const TANIM = "Timeout, bir AI servisinden belirli bir süre içinde yanıt gelmezse isteğin iptal edilmesidir. Retry, geçici bir hatada isteğin sınırlı sayıda tekrar denenmesidir. Hata izolasyonu ise AI servisinin tamamen kullanılamaz hâle gelmesi durumunda, bu durumun backend'in diğer işlevlerini (kitap arama, ödünç alma) etkilememesidir.";
const NEDEN = "Neden vardır? Bu üç mekanizma vardır çünkü AI servisleri, sıradan REST API'lerden daha değişken gecikme ve daha yüksek geçici hata oranına sahiptir. Timeout olmadan bir kullanıcı isteği süresiz bekleyebilir; retry olmadan geçici bir yükleme gecikmesi kalıcı bir hataya dönüşür; hata izolasyonu olmadan ise AI servisindeki bir sorun, ilgisiz özelliklerin de çalışmamasına yol açar.";
const NASIL = 'Nasıl kullanılır? Aşağıdaki örnek, dayanıklılık zincirinin iki halkasını kodlar: AbortController ile zaman aşımı ve AI servisi kullanılamadığında özet olmadan devam eden hata izolasyonu. Örnek, hatayı GeciciAiHatasi ve KaliciAiHatasi olarak ayırır; bu ayrım, yeniden denemenin yalnızca geçici hatalarda anlamlı olduğu için gereklidir.';
const FINALLY = 'Dikkat noktası: finally { clearTimeout(zamanlayici); } olmasaydı, istek zamanında tamamlansa bile zamanlayıcı çalışmaya devam eder ve gereksiz yere bellekte asılı kalırdı; bu yüzden zamanlayıcının temizlenmesi hem başarılı hem hata yolunda çalışan finally bloğuna konmuştur.';
const AGRESIF = "Yaygın hatalar. En yaygın hata, retry mantığını AI servisi için de Bölüm 12'deki gibi agresif biçimde (çok sayıda deneme, kısa bekleme) uygulamaktır; bir dil modeli zaten yavaşken art arda retry göndermek, servisin yükünü daha da artırabilir.";
const KAPSAM = 'Bu üç halkanın hangisinin kodlandığını ayırt etmek önemlidir. Bölümün kod örnekleri zaman aşımını, geçici/kalıcı hata ayrımını, hata izolasyonunu ve çıktı doğrulamasını çalışır biçimde gösterir. Sınırlı retry ve önbellek ise yalnızca Şekil 17.2\'de akış düzeyinde gösterilir; kodlanmaları "Bu programı geliştirin" görevlerine bırakılmıştır. Circuit breaker ve fallback cache desenleri karşılaştırma tablosunda tanıtılır, bu bölümde uygulanmaz. Model eğitimi ve LLM ince ayarı (fine-tuning) ayrıntıları da kapsam dışıdır.';
const ALTERNATIF_SATIRLARI = [
  ["Timeout + null'a düşme (Kod 17.3'te kodlanan)", 'Ana işlevi AI servisinden bağımsız korur; en az kod gerektirir', 'Geçici bir hatada bile özet üretilemez', 'İsteğe bağlı AI zenginleştirmeleri (özet, öneri)'],
  ["Timeout + sınırlı retry + null'a düşme (Şekil 17.2'de gösterilen, alıştırmada geliştirilen)", 'Geçici hatalara bir şans daha tanır', 'Ek gecikme ve yük getirir; yalnızca GeciciAiHatasi için uygulanmalıdır', 'Geçici hatanın sık görüldüğü AI servisleri'],
  ['Circuit breaker (devre kesici) deseni', 'Sürekli başarısız olan servise istek göndermeyi geçici olarak durdurur', 'Ek durum yönetimi ve eşik ayarı gerektirir', 'Yüksek trafikli, sık çağrılan AI servisleri'],
  ['Önceden hesaplanmış sonuçları önbellekten sunma (fallback cache)', 'AI servisi tamamen kullanılamaz olsa bile eski ama makul bir sonuç gösterilebilir', 'Önbellekteki sonuç güncel olmayabilir', 'Değişimi yavaş olan içerikler (örn. bir kitabın özeti nadiren değişir)'],
  ['Retry olmadan tek deneme', 'En basit yaklaşım', 'Geçici, kısa süreli sorunlarda bile hemen başarısız olur', 'Çok düşük öncelikli, kritik olmayan çağrılar'],
];
const ZAMAN_ASIMI_LOGU = 'Özet alınamadı, kitap bilgisi özetsiz gösterilecek: AI servisi zaman aşımına uğradı.';

describe('timeout-retry view', () => {
  it('davranislar follows the scenario table', () => {
    expect(davranislar('hizli', 8000)).toEqual([{ gecikmeMs: 1200, sonuc: 'ok' }]);
    expect(davranislar('yavas', 9000)).toEqual([{ gecikmeMs: 9000, sonuc: 'ok' }]);
    expect(davranislar('gecici', 8000)).toEqual([{ gecikmeMs: 8000, sonuc: 'ok' }, { gecikmeMs: 1200, sonuc: 'ok' }]);
    for (const s of ['http-500', 'bos-ozet', 'bozuk-govde'] as const) expect(davranislar(s, 8000)).toEqual([{ gecikmeMs: 1200, sonuc: s }]);
  });

  it('step 1 and 10 carry the book blocks verbatim', () => {
    const v = view(1);
    expect(v.kitap!.tanim).toBe(TANIM);
    expect(v.kitap!.paragraflar).toEqual([NEDEN]);
    expect(v.kitap!.tablolar).toEqual([]);
    expect(v.kitap!.notlar).toEqual([]);
    expect(v.zaman).toBeNull();
    expect(v.sequence).toBeNull();
    const o = view(10).kitap!;
    expect(o.tablolar.map((t) => [t.baslik, t.sutunlar.map((s) => s.ad), t.satirlar.length])).toEqual([
      ['Alternatifler', ['Yaklaşım', 'Avantajı', 'Dezavantajı', 'Uygun kullanım'], 5],
    ]);
    expect(o.tablolar[0].satirlar.map((r) => r.cells)).toEqual(ALTERNATIF_SATIRLARI);
    expect(o.notlar).toEqual([KAPSAM]);
    expect(o.notlar.join(' ')).not.toMatch(/[*`]/);
    expect(view(10).zaman).toBeNull();
  });

  it('step 2 draws one endless bar, no timeout line, empty card and terminal', () => {
    const v = view(2);
    expect(v.zaman).toEqual({ cubuklar: [{ deneme: 1, bas: 0, son: 10000, uc: 'sonsuz' }], bosluklar: [], zamanAsimiMs: null, eksenMs: 10000, toplamEtiket: null });
    expect(v.kartlar).toEqual({ yanitlar: [], terminal: [] });
    expect(v.sequence).toBeNull();
    expect(odak(v)).toEqual([satir('code-002', 175)]);
  });

  it('step 3 bar ends with an alarm tip at 5000', () => {
    const v = view(3);
    expect(v.zaman!.cubuklar).toEqual([{ deneme: 1, bas: 0, son: 5000, uc: 'iptal' }]);
    expect(v.zaman!.bosluklar).toEqual([]);
    expect(v.zaman!.zamanAsimiMs).toBe(5000);
    expect(v.zaman!.eksenMs).toBe(10000);
    expect(v.zaman!.toplamEtiket).toBe('toplam 5000 ms');
    expect(metinler(v)).toEqual([ZAMAN_ASIMI_LOGU, 'null']);
    expect(v.kartlar.yanitlar).toEqual([{ durumKodu: 200, govde: 'özet yok' }]);
    expect(v.sequence!.messages.map((m) => [m.from, m.to, m.label, m.tone])).toEqual([
      ['api', 'servis', 'POST /predict', undefined],
      ['servis', 'api', 'yanıt gelmedi', 'alarm'],
    ]);
    expect(v.sequence!.lanes.map((l) => [l.id, l.label.join(' ')])).toEqual([['istemci', 'İstemci'], ['api', 'Node.js API'], ['servis', 'FastAPI çıkarım servisi']]);
    expect(v.notlar).toEqual([SINYAL_NOTU]);
    expect(odak(v)).toEqual([satir('kod-17-3', 365), satir('kod-17-3', 369), satir('kod-17-3', 370)]);
  });

  it('code strip focus line text', () => {
    expect(odak(view(3))[0]).toBe('  const zamanlayici = setTimeout(() => controller.abort(), zamanAsimiMs);');
    expect(view(3).code.title).toBe('Kod 17.3 · AI isteklerinde zaman aşımı ve hata izolasyonu');
  });

  it('step 4 answer arrives, finally clears, book note L419', () => {
    const v = view(4);
    expect(v.zaman!.cubuklar).toEqual([{ deneme: 1, bas: 0, son: 1200, uc: 'yanit' }]);
    expect(v.zaman!.toplamEtiket).toBe('toplam 1200 ms');
    expect(metinler(v)).toEqual(['Kısa bir özet metni.']);
    expect(v.kartlar.yanitlar).toEqual([{ durumKodu: 200, govde: 'özet: Kısa bir özet metni.' }]);
    expect(v.notlar).toEqual([FINALLY]);
    expect(v.sequence!.messages.map((m) => [m.from, m.to, m.label, m.tone])).toEqual([
      ['api', 'servis', 'POST /predict', undefined],
      ['servis', 'api', '200', 'ok'],
    ]);
    expect(odak(v)).toEqual([satir('kod-17-3', 374)]);
  });

  it('step 5 hides the time axis, terminal L406', () => {
    const v = view(5);
    expect(v.zaman).toBeNull();
    expect(v.sequence).toBeNull();
    expect(metinler(v)).toEqual(listing(LISTINGS, 'kod-17-3-cikti').lines);
    expect(metinler(v)[1]).toBe(ZAMAN_ASIMI_LOGU);
    expect(v.kartlar.yanitlar.map((y) => y.durumKodu)).toEqual([200]);
    expect(odak(v)).toEqual([satir('kod-17-3', 384), satir('kod-17-3', 385), satir('kod-17-3', 386)]);
  });

  it('book output lines appear only while a Ders badge shows', () => {
    expect(view(5, false).kartlar.terminal).toEqual([]);
    expect(view(9, false).kartlar.terminal).toEqual([]);
    expect(view(5, true).kartlar.terminal).toHaveLength(3);
    expect(view(9, true).kartlar.terminal).toHaveLength(5);
  });

  it('step 6 table of error kinds and the Kod 17.3 http-500 console', () => {
    const v = view(6);
    expect(v.hataTablosu!.baslik).toBe('Hata türleri');
    expect(v.hataTablosu!.sutunlar.map((s) => s.ad)).toEqual(['gelen hata', 'dönüşen tür']);
    expect(v.hataTablosu!.satirlar.map((r) => r.cells)).toEqual([['AbortError', 'GeciciAiHatasi'], ['AI servisi hata döndürdü: 500', 'KaliciAiHatasi']]);
    expect(metinler(v)).toEqual(['Özet alınamadı, kitap bilgisi özetsiz gösterilecek: AI servisi kalıcı bir hata döndürdü.', 'null']);
    expect(v.notlar).toEqual([NASIL]);
    expect(v.zaman).toBeNull();
    expect(odak(v)).toEqual([369, 370, 371, 372].map((l) => satir('kod-17-3', l)));
  });

  it('step 7 shows bekle 1000 ms and toplam 7200 ms', () => {
    const v = view(7);
    expect(v.zaman!.cubuklar).toEqual([
      { deneme: 1, bas: 0, son: 5000, uc: 'iptal' },
      { deneme: 2, bas: 6000, son: 7200, uc: 'yanit' },
    ]);
    expect(v.zaman!.bosluklar).toEqual([{ bas: 5000, son: 6000, etiket: 'bekle 1000 ms' }]);
    expect(v.zaman!.toplamEtiket).toBe('toplam 7200 ms');
    expect(v.zaman!.eksenMs).toBe(10000);
    expect(metinler(v)).toEqual(['Kısa ve öz bir özet.']);
    expect(v.notlar).toEqual([RETRY_NOTU, VARSAYIM_NOTU]);
    expect(RETRY_NOTU).toBe('Kod 17.3/17.5 tek deneme yapar (L339); yeniden deneme bu sayfanın uzantısıdır');
    expect(VARSAYIM_NOTU).toBe('sayfa varsayımı: bekleme tabanı 1000 ms, yavaş servis 8000 ms, hızlı servis 1200 ms');
    expect(odak(v)).toEqual([satir('kod-17-5', 724), satir('kod-17-5', 725)]);
    // spec: the last arrow to the client belongs to step 8 and Lab only
    expect(v.sequence!.messages.some((m) => m.to === 'istemci')).toBe(false);
    expect(sonOk(lab())).toMatchObject({ from: 'api', to: 'istemci', label: '200 OK (özet var)' });
  });

  it('step 8 last arrow says özet yok', () => {
    const v = view(8);
    expect(v.zaman!.toplamEtiket).toBe('toplam 11000 ms');
    expect(v.zaman!.cubuklar.map((c) => [c.bas, c.son, c.uc])).toEqual([[0, 5000, 'iptal'], [6000, 11000, 'iptal']]);
    expect(sonOk(v)).toMatchObject({ from: 'api', to: 'istemci', label: '200 OK (özet yok, temel veri korunur)' });
    expect(metinler(v)).toEqual(['Özet alınamadı: AI servisi zaman aşımına uğradı.', 'null']);
    expect(v.kartlar.yanitlar).toEqual([{ durumKodu: 200, govde: 'özet yok' }]);
    expect(v.notlar).toEqual([RETRY_NOTU, VARSAYIM_NOTU, AGRESIF]);
    expect(odak(v)).toEqual([satir('code-006', 461), satir('code-006', 465)]);
    expect(v.code.title).toBe('Yanlış: agresif retry');
    expect(v.uyari).toBeNull();
  });

  it('step 9 validation kaldi and terminal L772-776', () => {
    const v = view(9);
    expect(v.zaman).toBeNull();
    expect(v.sequence).toBeNull();
    expect(v.denetim!.baslik).toBe('Kod 17.5 çağrıları');
    expect(v.denetim!.denetimler.map((d) => [d.ad, d.durum])).toEqual([['Zaman aşımı', 'gecti'], ['Doğrulama', 'kaldi']]);
    expect(metinler(v)).toEqual(listing(LISTINGS, 'kod-17-5-cikti').lines);
    expect(v.kartlar.yanitlar.map((y) => y.durumKodu)).toEqual([200]);
    expect(odak(v)).toEqual([satir('kod-17-5', 744), satir('kod-17-5', 745)]);
  });

  it('axis caps at 30000 and the total label stays true', () => {
    const v = lab({ senaryo: 'yavas', zamanAsimiMs: 10000, maksRetry: 3, beklemeTabanMs: 2000, servisGecikmesiMs: 12000 });
    expect(v.zaman!.eksenMs).toBe(30000);
    expect(v.zaman!.toplamEtiket).toBe('toplam 54000 ms');
    const son = v.zaman!.cubuklar[v.zaman!.cubuklar.length - 1];
    expect(son).toEqual({ deneme: 3, bas: 26000, son: 30000, uc: 'kesik' });
    expect(v.zaman!.cubuklar.every((c) => c.son <= 30000)).toBe(true);
    expect(v.zaman!.bosluklar.every((b) => b.son <= 30000)).toBe(true);
    expect(v.zaman!.bosluklar.map((b) => b.etiket)).toEqual(['bekle 2000 ms', 'bekle 4000 ms']);
  });

  it('axis stays at 10000 for a short run and grows with the run up to the cap', () => {
    expect(lab({ senaryo: 'hizli' }).zaman!.eksenMs).toBe(10000);
    expect(lab({ senaryo: 'yavas', maksRetry: 2 }).zaman!.eksenMs).toBe(18000); // 5000 + 1000 + 5000 + 2000 + 5000
    expect(lab({ senaryo: 'yavas', maksRetry: 3 }).zaman!.eksenMs).toBe(27000);
  });

  it('no-wait warning at base 0 and two retries', () => {
    expect(lab({ beklemeTabanMs: 0, maksRetry: 2, senaryo: 'yavas' }).uyari).toBe("bekleme yok: code_006'nın deseni (L448)");
    expect(lab({ beklemeTabanMs: 0, maksRetry: 1 }).uyari).toBeNull();
    expect(lab({ beklemeTabanMs: 500, maksRetry: 3 }).uyari).toBeNull();
    expect(lab({ beklemeTabanMs: 0, maksRetry: 2, senaryo: 'yavas' }).zaman!.bosluklar).toEqual([]);
  });

  it('no-wait warning only when two retries actually run with no wait', () => {
    for (const senaryo of ['hizli', 'http-500', 'bos-ozet', 'bozuk-govde', 'gecici'] as const) {
      expect(lab({ beklemeTabanMs: 0, maksRetry: 3, senaryo }).uyari, senaryo).toBeNull();
    }
    expect(lab({ beklemeTabanMs: 0, maksRetry: 2, senaryo: 'yavas' }).uyari).not.toBeNull();
  });

  it('lab badge turns kitaba-dayali with a second attempt', () => {
    expect(timeoutLabRozet({ ...sc.defaults }).tur).toBe('kitaba-dayali');
    expect(timeoutLabRozet({ ...sc.defaults, maksRetry: 0 }).tur).toBe('kitap-kodu');
    expect(timeoutLabRozet({ ...sc.defaults, senaryo: 'hizli' }).tur).toBe('kitap-kodu');
    expect(timeoutLabRozet({ ...sc.defaults, senaryo: 'http-500' }).tur).toBe('kitap-kodu');
  });

  it('lab code strip follows the deciding Kod 17.5 line and the card follows the result', () => {
    const kod = (diff: Partial<TimeoutParams>) => odak(lab(diff));
    expect(kod({ senaryo: 'yavas', maksRetry: 0 })).toEqual([satir('kod-17-5', 724), satir('kod-17-5', 725)]);
    expect(kod({ senaryo: 'bos-ozet' })).toEqual([satir('kod-17-5', 744), satir('kod-17-5', 745)]);
    expect(kod({ senaryo: 'hizli' })).toEqual([satir('kod-17-5', 749)]);
    expect(kod({})).toEqual([satir('kod-17-5', 749)]);
    expect(lab({ senaryo: 'bos-ozet' }).kartlar.terminal.map((t) => t.metin)).toEqual(['AI servisi geçersiz/boş özet döndürdü, özet gösterilmeyecek.', 'null']);
    expect(lab({ senaryo: 'bos-ozet' }).kartlar.yanitlar).toEqual([{ durumKodu: 200, govde: 'özet yok' }]);
    const bozuk = lab({ senaryo: 'bozuk-govde' }).sequence!.messages;
    expect(bozuk.map((m) => m.label)).toEqual(['POST /predict', '200', '200 OK (özet yok, temel veri korunur)']);
  });

  it('lab http-500 answers 500 in the diagram and is not retried', () => {
    const v = lab({ senaryo: 'http-500' });
    expect(v.zaman!.cubuklar).toEqual([{ deneme: 1, bas: 0, son: 1200, uc: 'yanit' }]);
    const yanit = v.sequence!.messages[1];
    expect([yanit.label, yanit.tone]).toEqual(['500', 'alarm']);
    expect(v.kartlar.terminal.map((t) => t.metin)).toEqual(['Özet alınamadı: AI servisi hata döndürdü: 500', 'null']);
  });

  it('lab agrees with the model', () => {
    const p = { ...sc.defaults };
    const r = ozetiAl(davranislar(p.senaryo, p.servisGecikmesiMs), p);
    expect(lab().kartlar.terminal.map((t) => t.metin)).toEqual(r.konsol);
    expect(lab().zaman!.toplamEtiket).toBe(`toplam ${r.bitisMs} ms`);
    expect(lab().notlar).toEqual([RETRY_NOTU, VARSAYIM_NOTU]);
  });

  it('the page notes are exported so the scene can style them apart', () => {
    expect(SAYFA_NOTLARI).toEqual([SINYAL_NOTU, RETRY_NOTU, VARSAYIM_NOTU]);
    expect(SINYAL_NOTU).toBe('Kitabın örnek çağrıları sinyali kullanmaz; bu adımın servisi sinyali dinler.');
    for (let n = 1; n <= 10; n++) {
      const v = view(n);
      for (const not of [...v.notlar, ...(v.kitap?.notlar ?? [])]) {
        if (SAYFA_NOTLARI.includes(not)) continue;
        expect(not, `step ${n}`).not.toMatch(/[*`]|⚠|📝|🔍/);
      }
    }
  });

  it('every step id has a badge and every step view builds in Ders and Lab mode', () => {
    for (const s of sc.steps) {
      expect(TIMEOUT_ROZET[s.id], s.id).toBeDefined();
      deriveTimeoutView(s.params as TimeoutParams, true);
      deriveTimeoutView(s.params as TimeoutParams, false);
    }
  });

  it('every lab combination yields a view inside the axis', () => {
    for (const senaryo of ['hizli', 'yavas', 'gecici', 'http-500', 'bos-ozet', 'bozuk-govde'] as const)
      for (const maksRetry of [0, 1, 2, 3])
        for (const beklemeTabanMs of [0, 500, 1000, 2000])
          for (const zamanAsimiMs of [1000, 5000, 10000])
            for (const servisGecikmesiMs of [500, 8000, 12000]) {
              const v = lab({ senaryo, maksRetry, beklemeTabanMs, zamanAsimiMs, servisGecikmesiMs });
              expect(v.zaman!.eksenMs).toBeLessThanOrEqual(30000);
              expect(v.zaman!.cubuklar.length).toBeGreaterThan(0);
              expect(v.zaman!.cubuklar.every((c) => c.son <= v.zaman!.eksenMs)).toBe(true);
            }
  });
});
