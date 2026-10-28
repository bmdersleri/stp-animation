import { listing, type Listing } from '../../core/listing';
import { nodeInspect } from '../../core/node-inspect';
import type { CheckListSpec, Denetim } from '../../core/plot/check-list';
import type { CodeTraceSpec } from '../../core/plot/code-trace';
import type { DataTableSpec } from '../../core/plot/data-table';
import type { TerminalSatir } from '../../core/plot/http-cards';
import type { KitapBlok } from '../../core/plot/kitap-blok';
import type { Message, SequenceSpec } from '../../core/plot/sequence';
import { farkIndeksleri, type SegmentStripSpec } from '../../core/plot/segment-strip';
import type { Rozet } from '../../core/plot/source-badge';
import { LISTINGS } from './code-text';
import { imzaAl } from './degerler';
import type { IotParams } from './scenario';
import {
  DERS_SIMDI,
  SABIT_SERI,
  istegiIsle,
  saatlikOzet,
  saatlikOzetSorgusuUret,
  tamponaEkle,
  type HamOlcum,
  type IotIstek,
  type IotIzi,
  type TamponDurumu,
} from './telemetri';

export interface SeriNokta {
  /** UTC ms. */
  zaman: number;
  deger: number;
  durum: 'kabul' | 'red';
}
export interface SeriSpec {
  seri: readonly HamOlcum[];
  noktalar: readonly SeriNokta[];
  xAlan: readonly [number, number];
  /** The extremes of the series and of the accepted points, plus and minus 1; a rejected point never widens it (the scene labels it at the edge). */
  yAlan: readonly [number, number];
}
export interface IotView {
  /** The book block of the intro and summary steps; null on every other step. */
  kitap: KitapBlok | null;
  sequence: SequenceSpec | null;
  seri: SeriSpec | null;
  /** The `dogrula` arguments (R25); null where no request is made. */
  argumanlar: DataTableSpec | null;
  denetim: CheckListSpec | null;
  /** Full 64-hex segments; the scene shortens them on a narrow screen. */
  imzalar: readonly SegmentStripSpec[];
  kayit: DataTableSpec | null;
  ozet: DataTableSpec | null;
  tampon: DataTableSpec | null;
  terminal: readonly TerminalSatir[];
  notlar: readonly string[];
  code: CodeTraceSpec;
}

const L = (id: string): Listing => listing(LISTINGS, id);
const K2 = L('code-002');
const K3 = L('kod-16-3');
const K4 = L('kod-16-4');
const K4_CIKTI = L('kod-16-4-cikti').lines;
const K6 = L('kod-16-6');

/** Index (1-based, within the listing) of book line `satir`. */
const kitapSatiri = (l: Listing, satir: number): number => satir - l.satirlar[0] + 1;
const kodSeridi = (l: Listing, kitapSatirlari: readonly number[]): CodeTraceSpec =>
  ({ title: l.title, lines: l.lines, active: kitapSatirlari.map((s) => kitapSatiri(l, s)) });

/** The book's sentences, verbatim without code ticks, bold marks, list numbers and emoji (final.md line in the comment). */
const TANIM = 'IoT backend geliştirme, fiziksel cihazlardan (sensör, aktüatör) gelen veriyi HTTP/JSON veya benzeri bir protokolle karşılayan, bu veriyi doğrulayan, kimliklendiren ve genellikle zaman serisi olarak kalıcı hâle getiren backend geliştirme pratiğidir.'; // L84
const DERINLEMESINE_NOTU = "Derinlemesine: Bir kullanıcı hatalı veri girerse arayüzde uyarı görüp düzeltebilir; bir sensör hatalı veri gönderirse kimse anında müdahale etmez — bu yüzden backend'in kendisi savunmanın son katmanı olmalıdır."; // L81
const DONGU_PARAGRAFI = 'Diyagramdaki döngü kutusu, tek bir cihazın isteği tekrarladığını; dolayısıyla hatalı bir cihazın aynı hatayı dakikada bir üretebileceğini vurgular. Bu nedenle 401, 403 ve 400 yanıtları yalnızca istemciye dönmekle kalmaz, cihaz kimliğiyle birlikte günlüğe de yazılmalıdır. Üç reddetme noktasının ayrı tutulması tanı koymayı kolaylaştırır: 401 anahtarın, 403 cihazın kaydının, 400 ise ölçümün sorunlu olduğunu söyler.'; // L462
const GOZLENEBILIRLIK_NOTU = 'Aralık doğrulaması yalnızca veriyi kabul/red etmekle sınırlı kalmamalı, aynı zamanda gözlemlenebilirlik (observability) sağlamalıdır: bir sensörün art arda aralık dışı veri göndermesi, genellikle sensörün fiziksel olarak arızalandığının veya yanlış kalibre edildiğinin ilk işaretidir. Bu nedenle üretim sistemlerinde yalnızca hatalı veriyi reddetmek yeterli değildir; aynı cihazdan kısa sürede tekrarlanan reddetme olayları bir uyarı (alert) olarak bakım ekibine bildirilmelidir — aksi hâlde arızalı bir sensör, verisi sessizce reddedilerek fark edilmeden aylarca çalışmaya devam edebilir.'; // L448
const SINAV_NOTU = 'Sınav Notu: Cihaz kimliği API anahtarıyla doğrulanır, sensör verisi hem tip hem fiziksel aralık bakımından doğrulanmalıdır ve zaman serisi kaydı, sunucu zaman damgasına dayanmalıdır — cihaz saatine değil.'; // L998
const IMZA_KAPSAMI_NOTU = '${basliklar.zamanDamgasi}.${govdeMetni}: Hem zaman damgasının hem de gövdedeki ölçüm verisinin birlikte imzalanması, paketteki tek bir sıcaklık hanesi bile değiştirilse imzanın bozulmasını sağlar.'; // L434
const PENCERE_NOTU = 'Math.abs(suAn - basliklar.zamanDamgasi) > 60: 60 saniyeden daha eski istekleri anında reddederek saldırı penceresini daraltır; ancak pencere içindeki aynı imzalı mesajın tekrarını engellemez. Gerçek tek-kullanımlılık için nonce/imza kaydı ayrı bir mekanizma olarak gerekir.'; // L433
const YASEMIN_NOTU = 'Yasemin (Güvenlik Uzmanı): “Cihazların açık metin HTTP veya sabit anahtarla haberleşmesine izin vermedik. Her sensör düğümüne yüklenen tekil HMAC gizli anahtarı sayesinde, kötü niyetli biri ağ trafiğini dinlese bile sıcaklık verisini manipüle edemiyor; zaman penceresi pencere dışı tekrarları eliyor; pencere içi tekrar için ise tek-kullanımlık nonce kaydı gerekir.”'; // L770
const SUNUCU_ZAMANI_NOTU = 'sunucuZamanDamgasi: new Date().toISOString() zaman damgası cihazdan gelen değere değil, kayıt anında sunucu tarafında üretilir; bu, saati yanlış ayarlı cihazlara karşı güvenlik sağlar.'; // L554
const AG_GECIKMESI_NOTU = 'Dikkat noktası: Zaman damgasının istemci yerine sunucuda üretilmesi, dağıtık IoT sistemlerinde cihaz saatlerinin güvenilmez olabileceği gerçek bir problemi çözer; ancak bu yaklaşım, gerçek ölçüm anı ile sunucuya ulaşma anı arasındaki ağ gecikmesini de gizler.'; // L558
const TAMPON_NOTU = 'Başarısız yazmada tampon geri yüklenir; ancak bellek içi batch, süreç yeniden başlarsa veriyi kaybeder — dayanıklı kuyruk ayrı mekanizmadır.'; // L761
/** The page's own note (R24), not a book sentence. */
export const BIRLESTIRME_NOTU = 'Pencere, imza ve aralık denetimlerinin birleştirilmesi bu sayfanındır.';

const ALTERNATIFLER: DataTableSpec = {
  baslik: 'Alternatifler', // L564
  sutunlar: ['Yaklaşım', 'Avantajı', 'Dezavantajı', 'Uygun kullanım'].map((ad) => ({ ad })),
  satirlar: [ // L569-572
    { key: 'postgresql', cells: ["PostgreSQL'de zaman damgalı tablo (bu bölümde örneklenen)", 'Mevcut altyapıyla uyumlu, SQL ile esnek sorgulanabilir', 'Çok yüksek hacimde veri için özel zaman serisi veritabanları kadar optimize değildir', 'Orta hacimli, birkaç dakikada bir veri üreten sensörler'] },
    { key: 'ozel-zaman-serisi', cells: ['Özel zaman serisi veritabanı (TimescaleDB, InfluxDB)', 'Çok yüksek hacimli veri için optimize edilmiştir', 'Ek altyapı ve öğrenme maliyeti (bu bölümün kapsamı dışında)', 'Saniyede binlerce ölçüm üreten büyük ölçekli sistemler'] },
    { key: 'veri-golu', cells: ['Veri gölünde (data lake) ham veri saklama', 'Şema değişikliklerine karşı esnektir', 'Sorgulama karmaşıklaşır, doğrulama genellikle sonradan (batch) yapılır', 'Farklı cihaz türlerinden çok çeşitli, henüz şeması netleşmemiş veri'] },
    { key: 'dogrulamasiz', cells: ['Veriyi doğrulamadan olduğu gibi kaydetme', 'En basit görünen yaklaşım', 'Bozuk veri istatistikleri ve grafikleri anlamsız hâle getirir', 'Hiçbir üretim senaryosunda önerilmez'] },
  ],
};

const TANITIM_BLOK: KitapBlok = { tanim: TANIM, tablolar: [], notlar: [DERINLEMESINE_NOTU] };
const OZET_BLOK: KitapBlok = { paragraflar: [DONGU_PARAGRAFI], tablolar: [ALTERNATIFLER], notlar: [SINAV_NOTU, GOZLENEBILIRLIK_NOTU] };

const CIHAZ_UUID = 'esp32-lab101-temp';
const BILINMEYEN_UUID = 'esp32-lab102-temp';
/** P9: the chart's fixed time axis, 07:00 to 10:10 UTC. */
const X_ALAN: readonly [number, number] = [Date.UTC(2026, 8, 5, 7), Date.UTC(2026, 8, 5, 10, 10)];
const TEKRAR_ARASI_SANIYE = 20;

const SERI_LANES = [
  { id: 'cihaz', label: ['Sensör cihazı'] }, { id: 'api', label: ['Telemetri API'] }, { id: 'seri', label: ['Zaman serisi'] },
];

/** The state after the fixed series went through the buffer: 100 written, 20 waiting. */
const SABIT_DURUM: TamponDurumu = SABIT_SERI.reduce<TamponDurumu>((d, o) => tamponaEkle(d, o), { tampon: [], yazilan: [] });

const bos = (code: CodeTraceSpec, kitap: KitapBlok | null = null): IotView => ({
  kitap, sequence: null, seri: null, argumanlar: null, denetim: null, imzalar: [], kayit: null, ozet: null, tampon: null,
  terminal: [], notlar: [], code,
});

/** The signed packet of the Lab request: the signature comes from `imzaAl`, the body that is sent may differ (`degismis`). */
function istekKur(p: IotParams): IotIstek {
  const zamanDamgasi = DERS_SIMDI + p.saatFarki;
  const imzalanan = JSON.stringify({ cihazId: CIHAZ_UUID, sicaklik: p.sicaklik, nem: p.nem });
  const gonderilen = p.govde === 'degismis' ? JSON.stringify({ cihazId: CIHAZ_UUID, sicaklik: p.sicaklik + 10, nem: p.nem }) : imzalanan;
  return {
    basliklar: { cihazUuid: p.govde === 'bilinmeyen' ? BILINMEYEN_UUID : CIHAZ_UUID, imza: imzaAl(zamanDamgasi, imzalanan), zamanDamgasi },
    govdeMetni: gonderilen,
  };
}

interface Deneme { suAn: number; iz: IotIzi }

/** The request, once or (`tekrar`) a second time 20 s later; the buffer carries over. */
function denemeleriYap(p: IotParams, istek: IotIstek): Deneme[] {
  const ilk = istegiIsle(istek, DERS_SIMDI, SABIT_DURUM);
  const liste: Deneme[] = [{ suAn: DERS_SIMDI, iz: ilk }];
  if (p.tekrar) {
    const suAn = DERS_SIMDI + TEKRAR_ARASI_SANIYE;
    liste.push({ suAn, iz: istegiIsle(istek, suAn, ilk.durum) });
  }
  return liste;
}

function argumanTablosu(istek: IotIstek): DataTableSpec {
  const b = istek.basliklar;
  const satirlar: [string, string][] = [
    ['X-Timestamp', String(b.zamanDamgasi)], ['X-Signature', b.imza], ['cihazUuid', b.cihazUuid], ['govdeMetni', istek.govdeMetni],
  ];
  return { baslik: 'dogrula argümanları', sutunlar: [{ ad: 'alan' }, { ad: 'değer' }], satirlar: satirlar.map(([a, d]) => ({ key: a, cells: [a, d] })) };
}

function imzaSeritleri(iz: IotIzi, gelen: string): SegmentStripSpec[] {
  if (iz.denetimler[2].durum !== 'kaldi' || iz.beklenenImza === undefined) return [];
  return [
    { baslik: 'gelen imza', parcalar: [{ metin: gelen, ton: 3, fark: farkIndeksleri(gelen, iz.beklenenImza) }] },
    { baslik: 'beklenen imza', parcalar: [{ metin: iz.beklenenImza, ton: 1, fark: farkIndeksleri(iz.beklenenImza, gelen) }] },
  ];
}

function seriSpec(noktalar: readonly SeriNokta[]): SeriSpec {
  const degerler = [...SABIT_SERI.map((o) => o.deger), ...noktalar.filter((n) => n.durum === 'kabul').map((n) => n.deger)];
  return { seri: SABIT_SERI, noktalar, xAlan: X_ALAN, yAlan: [Math.min(...degerler) - 1, Math.max(...degerler) + 1] };
}

function sira(denemeler: readonly Deneme[]): SequenceSpec {
  const messages: Message[] = [];
  denemeler.forEach(({ iz }, i) => {
    messages.push({ id: `olcum-${i + 1}`, from: 'cihaz', to: 'api', label: 'imzalı ölçüm', kind: 'request', tone: iz.kaydedildi ? 'ok' : 'alarm' });
    if (iz.kaydedildi) messages.push({ id: `kayit-${i + 1}`, from: 'api', to: 'seri', label: 'kaydet (sunucu zamanı)', kind: 'request', tone: 'ok' });
  });
  const reddedildi = denemeler.some((d) => !d.iz.kaydedildi);
  return { lanes: SERI_LANES, messages, ariaLabel: 'Telemetri sıra diyagramı', ...(reddedildi ? { stopAt: 'api' } : {}) };
}

/** What Kod 16.3 or Kod 16.4 prints for one request (P5). */
function terminalSatirlari(iz: IotIzi): TerminalSatir[] {
  if (iz.kaydedildi) return [`Veritabanına yazıldı: ${iz.kayit!.cihazId}`, 'true'].map((metin) => ({ metin }));
  if (iz.hata !== undefined) return [{ metin: iz.hata }];
  return `${nodeInspect(false)} ${nodeInspect(iz.hatalar)}`.split('\n').map((metin) => ({ metin }));
}

/** The book line that decided the first failed request, or the step's own focus when none failed. */
function istekKodu(denemeler: readonly Deneme[], tekrar: boolean): CodeTraceSpec {
  const kalan = denemeler.find((d) => !d.iz.kaydedildi);
  if (!kalan) return tekrar ? kodSeridi(K3, [398, 399]) : kodSeridi(K4, [521]);
  const [pencere, cihaz, hmac, sicaklik, nem] = kalan.iz.denetimler;
  if (pencere.durum === 'kaldi') return kodSeridi(K3, [399]);
  if (cihaz.durum === 'kaldi') return kodSeridi(K3, [404, 405, 406]);
  if (hmac.durum === 'kaldi') return kodSeridi(K3, [417, 418, 419, 420]);
  return kodSeridi(K4, [...(sicaklik.durum === 'kaldi' ? [495, 496] : []), ...(nem.durum === 'kaldi' ? [498, 499] : []), 516, 517]);
}

function kayitTablosu(denemeler: readonly Deneme[]): DataTableSpec | null {
  const kabul = denemeler.filter((d) => d.iz.kaydedildi);
  if (kabul.length === 0) return null;
  return {
    baslik: 'Kaydedilen ölçüm',
    sutunlar: ['cihazId', 'sicaklik', 'nem', 'sunucuZamanDamgasi'].map((ad) => ({ ad })),
    satirlar: kabul.map(({ iz }, i) => ({ key: `kayit-${i + 1}`, cells: [iz.kayit!.cihazId, iz.kayit!.sicaklik, iz.kayit!.nem, iz.kayit!.sunucuZamanDamgasi] })),
    not: `tamponda ${kabul[kabul.length - 1].iz.durum.tampon.length} kayıt`,
  };
}

function istekGorunumu(p: IotParams): IotView {
  const istek = istekKur(p);
  const denemeler = denemeleriYap(p, istek);
  const hepsiKabul = denemeler.every((d) => d.iz.kaydedildi);
  const hmacKaldi = denemeler.some((d) => d.iz.denetimler[2].durum === 'kaldi');
  const notlar: string[] = [];
  if (p.govde === 'degismis' && hmacKaldi) notlar.push(IMZA_KAPSAMI_NOTU);
  if (p.tekrar && hepsiKabul) notlar.push(PENCERE_NOTU, YASEMIN_NOTU);
  if (!p.tekrar && hepsiKabul && p.saatFarki !== 0) notlar.push(SUNUCU_ZAMANI_NOTU, AG_GECIKMESI_NOTU);
  notlar.push(BIRLESTIRME_NOTU);
  const noktalar = denemeler.map(({ suAn, iz }): SeriNokta => ({ zaman: suAn * 1000, deger: p.sicaklik, durum: iz.kaydedildi ? 'kabul' : 'red' }));
  return {
    ...bos(istekKodu(denemeler, p.tekrar)),
    sequence: sira(denemeler),
    seri: seriSpec(noktalar),
    argumanlar: argumanTablosu(istek),
    denetim: { baslik: 'Denetimler', denetimler: denemeler.find((d) => !d.iz.kaydedildi)?.iz.denetimler ?? denemeler[0].iz.denetimler },
    imzalar: imzaSeritleri(denemeler.find((d) => d.iz.denetimler[2].durum === 'kaldi')?.iz ?? denemeler[0].iz, istek.basliklar.imza),
    kayit: kayitTablosu(denemeler),
    terminal: denemeler.flatMap((d) => terminalSatirlari(d.iz)),
    notlar,
  };
}

/** Kod 16.3 alone: the chain stops after HMAC, the range checks have not run yet. */
function hmacGorunumu(p: IotParams): IotView {
  const istek = istekKur(p);
  const iz = istegiIsle(istek, DERS_SIMDI, SABIT_DURUM);
  const zincirGecti = iz.denetimler[2].durum === 'gecti';
  const bekleyen = (ad: 'Sıcaklık' | 'Nem'): Denetim => ({ ad, durum: 'bekliyor' });
  const denetimler = zincirGecti ? [...iz.denetimler.slice(0, 3), bekleyen('Sıcaklık'), bekleyen('Nem')] : iz.denetimler;
  const kod = zincirGecti ? kodSeridi(K3, [417, 418]) : istekKodu([{ suAn: DERS_SIMDI, iz }], false);
  return {
    ...bos(kod),
    seri: seriSpec(zincirGecti ? [] : [{ zaman: DERS_SIMDI * 1000, deger: p.sicaklik, durum: 'red' }]),
    argumanlar: argumanTablosu(istek),
    denetim: { baslik: 'Denetimler', denetimler },
    imzalar: imzaSeritleri(iz, istek.basliklar.imza),
    terminal: zincirGecti ? [] : [{ metin: iz.hata! }],
  };
}

function aralikGorunumu(kitapCiktisi: boolean): IotView {
  const atla = (ad: string): Denetim => ({ ad, durum: 'atlandi', ayrinti: 'Kod 16.4 yalnız aralık denetler' });
  return {
    ...bos(kodSeridi(K4, [495, 496, 516, 517])),
    denetim: {
      baslik: 'Denetimler',
      denetimler: [
        atla('Zaman penceresi'), atla('Cihaz UUID'), atla('HMAC'),
        { ad: 'Sıcaklık', durum: 'kaldi', ayrinti: 'sicaklik aralık dışı (-40 ile 85 arası bekleniyor).' },
        { ad: 'Nem', durum: 'gecti' },
      ],
    },
    terminal: kitapCiktisi ? K4_CIKTI.map((metin) => ({ metin })) : [],
  };
}

const saatMetni = (ms: number): string => new Date(ms).toISOString().slice(11, 19);

function tamponGorunumu(): IotView {
  const { tampon, yazilan } = SABIT_DURUM;
  const aralik = (o: readonly HamOlcum[]) => `${saatMetni(o[0].zaman)}–${saatMetni(o[o.length - 1].zaman)}`;
  const ozet: DataTableSpec = {
    baslik: 'Saatlik özet (UTC)',
    sutunlar: ['saat_dilimi', 'ortalama_sicaklik', 'en_dusuk', 'en_yuksek', 'ornek_sayisi'].map((ad) => ({ ad })),
    satirlar: saatlikOzet(yazilan, Date.UTC(2026, 8, 5, 7)).map((s) => ({
      key: String(s.saatDilimi),
      cells: [new Date(s.saatDilimi).toISOString().slice(0, 13).replace('T', ' ') + ':00', s.ortalama, s.enDusuk.toFixed(1), s.enYuksek.toFixed(1), s.ornekSayisi],
    })),
  };
  const tamponTablosu: DataTableSpec = {
    baslik: 'Tampon',
    sutunlar: ['durum', 'kayıt', 'zaman (UTC)'].map((ad) => ({ ad })),
    satirlar: [
      { key: 'yazildi', cells: ['yazıldı', yazilan.length, aralik(yazilan)] },
      { key: 'tamponda', cells: ['tamponda', tampon.length, aralik(tampon)] },
    ],
  };
  const sql = saatlikOzetSorgusuUret(1, '2026-09-05T07:00:00Z').split('\n').slice(1, -1);
  const girinti = Math.min(...sql.filter((s) => s.trim() !== '').map((s) => s.length - s.trimStart().length));
  return {
    ...bos(kodSeridi(K6, [718, 741, 742])),
    ozet,
    tampon: tamponTablosu,
    terminal: sql.map((s) => ({ metin: s.slice(girinti) })),
    notlar: [TAMPON_NOTU],
  };
}

/** Everything the scene draws for one parameter set; no DOM. `kitapCiktisi` is true in Ders and false in Lab. */
export function deriveIotView(p: IotParams, kitapCiktisi = false): IotView {
  switch (p.asama) {
    case 'tanitim': return bos(kodSeridi(K3, []), TANITIM_BLOK);
    case 'ozet': return bos(kodSeridi(K3, []), OZET_BLOK);
    case 'dogrulamasiz':
      return {
        ...bos(kodSeridi(K2, [194])),
        seri: seriSpec([{ zaman: DERS_SIMDI * 1000, deger: p.sicaklik, durum: 'kabul' }]),
        terminal: [{ metin: `Kaydedildi: ${p.sicaklik}°C` }],
      };
    case 'imza': {
      const istek = istekKur(p);
      return {
        ...bos(kodSeridi(K3, [410, 411])),
        argumanlar: argumanTablosu(istek),
        imzalar: [{ baslik: 'imza (HMAC-SHA256)', parcalar: [{ metin: istek.basliklar.imza, ton: 1, kisalt: 16 }] }],
      };
    }
    case 'hmac': return hmacGorunumu(p);
    case 'istek': return istekGorunumu(p);
    case 'aralik': return aralikGorunumu(kitapCiktisi);
    case 'tampon': return tamponGorunumu();
  }
}

/** Always the book's code on the reader's own settings. */
export function iotLabRozet(_p: IotParams): Rozet {
  return { tur: 'kitap-kodu' };
}
