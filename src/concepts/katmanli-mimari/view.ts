import { listing } from '../../core/listing';
import type { CodeTraceSpec } from '../../core/plot/code-trace';
import type { DataTableSpec, TabloSatiri } from '../../core/plot/data-table';
import { DURUM_METNI, type HttpCardsSpec, type HttpYanit, type TerminalSatir } from '../../core/plot/http-cards';
import type { Lane, Message, SequenceSpec } from '../../core/plot/sequence';
import type { Rozet } from '../../core/plot/source-badge';
import { LISTINGS } from './code-text';
import { BASLANGIC, istekKarsila, kurulumOlaylari, type Durum, type KatmanIzi, type KatmanOlayi } from './katmanlar';
import type { KatmanParams } from './scenario';

export interface KatmanView {
  sequence: SequenceSpec;
  http: HttpCardsSpec;
  kitaplar: DataTableSpec;
  ogrenciler: DataTableSpec;
  code: CodeTraceSpec;
  /** The book's life-cycle table (step 10); null elsewhere. */
  yasam: DataTableSpec | null;
  /** The book's responsibility matrix (step 11); null elsewhere. */
  ozet: DataTableSpec | null;
  /**
   * The listing line that decides the shown request (the last event before the response reaches the caller: the `throw`
   * line on a failure, the service's `return` on success, the validation `return` for a missing field); null when no
   * event is shown yet or on the kurulum, yasam and ozet views. The Ders code strip windows around it.
   */
  karar: number | null;
}

/** The five lanes of the page; the caller's subtitle names what prints the response. */
export const KATMAN_LANES: Lane[] = [
  { id: 'cagiran', label: ['Çağıran kod'], sub: 'console.log(…)' },
  { id: 'controller', label: ['OduncAlmaController'] },
  { id: 'service', label: ['OduncAlmaService'] },
  { id: 'kitapRepo', label: ['KitapRepository'] },
  { id: 'ogrenciRepo', label: ['OgrenciRepository'] },
];

/** The book's life-cycle table (L1076-1086), three of its six columns: Adım, Katman / Bileşen, Kod 9.14. */
const YASAM: readonly (readonly [string, string, string])[] = [
  ['1. İstek Girişi', 'HTTP Taşıma Katmanı', 'Yok'],
  ['2. Uç Nokta Eşleme', 'Controller (Yönlendirme)', 'Yok; istekKarsila doğrudan çağrılır'],
  ['3. Girdi Doğrulama', 'Controller / DTO', 'Var'],
  ['4. İş Mantığına Geçiş', 'Controller → Service', 'Var'],
  ['5. İş Kuralı Denetimi', 'Service Katmanı', 'Var; yalnızca limit kuralı'],
  ['6. Durum Sorgulama', 'Service → Repository', 'Var; bellek içi dizi'],
  ['7. Uygunluk Kararı', 'Service Katmanı', 'Var'],
  ['8. Veri Kalıcılığı', 'Repository Katmanı', 'Var; bellekte, süreç bitince kaybolur'],
  ['9. Sonuç Paketleme', 'Service → Controller', 'Var'],
  ['10. Yanıt İnşası', 'Controller Katmanı', 'Var; nesne üretilir'],
  ['11. İstemciye İletim', 'HTTP Yanıt Döngüsü', 'Yok; nesne console.log ile yazdırılır'],
];

/** First sentence of the book's L1072. */
const YASAM_NOT = "Tablo bilinçli olarak Kod 9.14'ün yaptığından fazlasını gösterir.";

/** The book's responsibility matrix (L74-79): Kavram and "Ne yapmaz? (Sorumluluk Sınırı)". */
const SORUMLULUK: readonly (readonly [string, string])[] = [
  [
    'Katmanlı Mimari',
    'Otomatik olarak performansı artırmaz; mimari disiplin, test edilebilirlik ve sürdürülebilirlik sağlamak için kullanılır.',
  ],
  [
    'Controller (Kontrolcü)',
    'Veritabanı sorguları çalıştırmaz veya karmaşık iş mantığı kurallarını yürütmez; yalnızca bir istek yönlendiricisidir.',
  ],
  ['Service (İş Mantığı)', 'HTTP protokol detaylarını (req, res, header, status code) bilmez; doğrudan SQL/Prisma sorgusu yazmaz.'],
  [
    'Repository (Veri Erişimi)',
    'İş mantığı kararları vermez (örn. kullanıcının rezervasyon hakkı var mı kararını vermez); yalnızca istenen veriyi getirir ve yazar.',
  ],
  [
    'DTO (Data Transfer Object)',
    'Kendi içinde veritabanı erişimi veya iş mantığı fonksiyonları barındırmaz; yalnızca veri taşıyıcı nesnedir.',
  ],
  [
    'Sorumlulukların Ayrılması',
    'Yeni dosya ve arayüzler oluşturma disiplini gerektirir; bu bir bürokrasi değil, sistemin sürdürülebilirlik güvencesidir.',
  ],
];

/** The starting data: the book's `BASLANGIC` with the Lab's `uygunMu` and `mevcutOduncSayisi`. */
export function baslangicDurumu(p: KatmanParams): Durum {
  return {
    kitaplar: BASLANGIC.kitaplar.map((k) => ({ ...k, uygunMu: p.uygunMu })),
    ogrenciler: BASLANGIC.ogrenciler.map((o) => ({ ...o, mevcutOduncSayisi: p.mevcutOduncSayisi })),
  };
}

const ikiYuz = (kod: number): boolean => kod >= 200 && kod < 300;
const durumEtiketi = (kod: number): string => `${kod} ${DURUM_METNI[kod] ?? ''}`.trim();

function mesajlar(olaylar: readonly KatmanOlayi[], onek: string): Message[] {
  return olaylar.map((o, i): Message => {
    const id = `${onek}${i}`;
    const { from, to, etiket } = o;
    if (o.tur === 'cagri') return { id, from, to, label: etiket, kind: 'request' };
    if (o.tur === 'not') return { id, from, to, label: etiket, kind: 'note' };
    if (o.tur === 'firlat') return { id, from, to, label: etiket, kind: 'response', tone: 'alarm' };
    if (to === 'cagiran') {
      const kod = Number(etiket);
      return { id, from, to, label: durumEtiketi(kod), kind: 'response', tone: ikiYuz(kod) ? 'ok' : 'alarm' };
    }
    return { id, from, to, label: etiket, kind: 'response' };
  });
}

function tablolar(girdi: Durum, iz: KatmanIzi, gorunen: readonly KatmanOlayi[], kitapKodu: string, numara: string) {
  const goruldu = (kim: KatmanOlayi['from'], onek: string) => gorunen.some((o) => o.from === kim && o.tur === 'donus' && o.etiket.startsWith(onek));
  const kitapDegisti = goruldu('kitapRepo', 'uygunMu');
  const ogrenciDegisti = goruldu('ogrenciRepo', 'mevcutOduncSayisi');
  const kitapOkundu = goruldu('kitapRepo', 'Kitap ');
  const ogrenciOkundu = goruldu('ogrenciRepo', 'Öğrenci ');
  const kitapDurumu = kitapDegisti ? iz.durum : girdi;
  const ogrenciDurumu = ogrenciDegisti ? iz.durum : girdi;

  const kitaplar: DataTableSpec = {
    baslik: 'kitapListesi',
    sutunlar: [{ ad: 'kod', anahtar: 'PK' }, { ad: 'ad' }, { ad: 'uygunMu' }],
    satirlar: kitapDurumu.kitaplar.map((k): TabloSatiri => ({
      key: k.kod,
      cells: [k.kod, k.ad, k.uygunMu],
      ...(kitapDegisti && k.kod === kitapKodu
        ? { state: 'degisti' as const, changed: [2] }
        : kitapOkundu && k.kod === kitapKodu
          ? { state: 'etkin' as const }
          : {}),
    })),
  };
  const ogrenciler: DataTableSpec = {
    baslik: 'ogrenciListesi',
    sutunlar: [{ ad: 'numara', anahtar: 'PK' }, { ad: 'mevcutOduncSayisi' }],
    satirlar: ogrenciDurumu.ogrenciler.map((o): TabloSatiri => ({
      key: o.numara,
      cells: [o.numara, o.mevcutOduncSayisi],
      ...(ogrenciDegisti && o.numara === numara
        ? { state: 'degisti' as const, changed: [1] }
        : ogrenciOkundu && o.numara === numara
          ? { state: 'etkin' as const }
          : {}),
    })),
  };
  return { kitaplar, ogrenciler };
}

/** Listing line of the last event before the response reaches the caller (see `KatmanView.karar`). */
function kararSatiri(olaylar: readonly KatmanOlayi[]): number | null {
  const i = olaylar.findIndex((o) => o.tur === 'donus' && o.to === 'cagiran');
  if (i < 0) return null;
  const onceki = olaylar[i - 1];
  return onceki && onceki.tur !== 'not' ? onceki.satir : olaylar[i].satir;
}

function yasamTablosu(): DataTableSpec {
  return {
    baslik: 'Bir isteğin yaşam döngüsü',
    sutunlar: [{ ad: 'Adım' }, { ad: 'Katman / Bileşen' }, { ad: 'Kod 9.14' }],
    satirlar: YASAM.map(
      (cells, i): TabloSatiri => ({
        key: String(i + 1),
        cells,
        ...(cells[2].startsWith('Yok') ? { state: 'soluk' as const } : cells[2].startsWith('Var') ? { state: 'etkin' as const } : {}),
      }),
    ),
    not: YASAM_NOT,
  };
}

function ozetTablosu(): DataTableSpec {
  return {
    baslik: 'Sorumluluk sınırları',
    sutunlar: [{ ad: 'Katman' }, { ad: 'Ne yapmaz?' }],
    satirlar: SORUMLULUK.map((cells, i): TabloSatiri => ({ key: String(i + 1), cells })),
  };
}

/** Everything the scene draws for one parameter set; no DOM. */
export function deriveKatmanView(p: KatmanParams): KatmanView {
  const istek = { ogrenciNumarasi: p.ogrenciNumarasi, kitapKodu: p.kitapKodu };
  const lst = listing(LISTINGS, 'kod-9-5');
  const baslangic = baslangicDurumu(p);
  const ilk = istekKarsila(baslangic, istek);
  const ikinci = p.tekrar === 2;
  const son = ikinci ? istekKarsila(ilk.durum, istek) : ilk;
  const girdi = ikinci ? ilk.durum : baslangic;
  const yasam = p.gorunum === 'yasam' ? yasamTablosu() : null;
  const ozet = p.gorunum === 'ozet' ? ozetTablosu() : null;

  if (p.gorunum === 'kurulum') {
    const olaylar = kurulumOlaylari();
    const t = tablolar(baslangic, ilk, [], istek.kitapKodu, istek.ogrenciNumarasi);
    return {
      sequence: { lanes: KATMAN_LANES, messages: mesajlar(olaylar, 'k'), ariaLabel: 'Katmanlı mimari sıra diyagramı', dim: [] },
      http: { yanitlar: [], terminal: [] },
      ...t,
      code: { title: lst.title, lines: lst.lines, active: olaylar.map((o) => o.satir) },
      yasam,
      ozet,
      karar: null,
    };
  }

  const toplam = son.olaylar.length;
  const olay = Math.max(0, Math.min(toplam, Math.trunc(p.olay) || 0));
  const tamam = olay === toplam;
  const gorunen = son.olaylar.slice(0, olay);

  const messages = mesajlar(gorunen, 'm');
  const yanitGorundu = gorunen.some((o) => o.tur === 'donus' && o.to === 'cagiran');
  const kullanilan = new Set<string>(son.olaylar.flatMap((o) => [o.from, o.to]));
  const dim = tamam ? KATMAN_LANES.filter((l) => l.id !== 'cagiran' && !kullanilan.has(l.id)).map((l) => l.id) : [];
  const sequence: SequenceSpec = {
    lanes: KATMAN_LANES,
    messages,
    ...(messages.length > 0 ? { active: messages[messages.length - 1].id } : {}),
    ...(yanitGorundu ? { stopAt: 'cagiran', stopTone: ikiYuz(son.yanit.durumKodu) ? ('ok' as const) : ('alarm' as const) } : {}),
    ariaLabel: 'Katmanlı mimari sıra diyagramı',
    dim,
  };

  const yanitlar: HttpYanit[] = [];
  const terminal: TerminalSatir[] = [];
  const yaz = (iz: KatmanIzi, sira: number | undefined) =>
    yanitlar.push({
      durumKodu: iz.yanit.durumKodu,
      durumMetni: DURUM_METNI[iz.yanit.durumKodu],
      govde: iz.yanit.mesaj,
      ...(sira !== undefined ? { sira } : {}),
    });
  if (ikinci) {
    yaz(ilk, 1);
    ilk.cikti.forEach((metin) => terminal.push({ metin }));
  }
  if (yanitGorundu) yaz(son, ikinci ? 2 : undefined);
  if (tamam) son.cikti.forEach((metin) => terminal.push({ metin }));

  const t = tablolar(girdi, son, gorunen, istek.kitapKodu, istek.ogrenciNumarasi);
  const sonOlay = gorunen[gorunen.length - 1];
  return {
    sequence,
    http: { yanitlar, terminal },
    ...t,
    code: { title: lst.title, lines: lst.lines, active: sonOlay ? [sonOlay.satir] : [] },
    yasam,
    ozet,
    karar: p.gorunum === 'akis' && olay > 0 ? kararSatiri(son.olaylar) : null,
  };
}

/** The source badge a Lab-changed parameter set earns (the first matching rule wins). */
export function katmanLabRozet(p: KatmanParams): Rozet {
  const kitabinki = p.ogrenciNumarasi === '2024001' && p.uygunMu && p.mevcutOduncSayisi === 0 && p.tekrar === 1;
  if (kitabinki && p.kitapKodu === 'JAVA-101') return { tur: 'kitap' };
  if (kitabinki && p.kitapKodu === '') return { tur: 'kitap', ref: 'L1297' };
  return { tur: 'kitap-kodu' };
}
