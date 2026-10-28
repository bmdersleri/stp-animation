import { listing, type Listing } from '../../core/listing';
import type { CheckListSpec, Denetim } from '../../core/plot/check-list';
import type { CodeTraceSpec } from '../../core/plot/code-trace';
import type { DataTableSpec, TabloSatiri } from '../../core/plot/data-table';
import type { TerminalSatir } from '../../core/plot/http-cards';
import type { KitapBlok } from '../../core/plot/kitap-blok';
import type { SequenceSpec } from '../../core/plot/sequence';
import type { Rozet } from '../../core/plot/source-badge';
import { composeUp, LISTINGS, saniyeEtiketi, type Prob } from './compose';
import type { ComposeParams } from './scenario';

export interface ComposeView {
  /** The book block of the intro and summary steps; null on every other step. */
  kitap: KitapBlok | null;
  sequence: SequenceSpec | null;
  tablo: DataTableSpec | null;
  /** The health probes (at most five rows, P3); null in `sira` mode and on every non-compose stage. */
  problar: CheckListSpec | null;
  terminal: readonly TerminalSatir[];
  notlar: readonly string[];
  code: CodeTraceSpec;
}

const L = (id: string): Listing => listing(LISTINGS, id);
const K3 = L('kod-14-3');
const K4 = L('kod-14-4');
const K4_CIKTI = L('kod-14-4-cikti').lines;
const K5 = L('kod-14-5');
const K6 = L('kod-14-6');
const K8 = L('code-008');
const K9 = L('kod-14-9');
const K12 = L('code-012');
const K12_CIKTI = L('code-012-cikti').lines;
const K14 = L('code-014');

/** Index (1-based, within the listing) of book line `satir`. */
const kitapSatiri = (l: Listing, satir: number): number => satir - l.satirlar[0] + 1;
const kitapMetni = (l: Listing, satir: number): string => l.lines[kitapSatiri(l, satir) - 1];
const kodSeridi = (l: Listing, kitapSatirlari: readonly number[]): CodeTraceSpec =>
  ({ title: l.title, lines: l.lines, active: kitapSatirlari.map((s) => kitapSatiri(l, s)) });

/** The book's sentences, verbatim without code ticks, bold marks and emoji (final.md line in the comment). */
const TANIM = "Docker Compose, birden fazla container'ı (servisi), aralarındaki volume ve network ilişkileriyle birlikte tek bir YAML dosyasında tanımlayıp docker compose up tek komutuyla birlikte çalıştırmayı sağlayan araçtır."; // L564
const IMAJ_TANIMI = "Tanım. Image, bir uygulamanın çalışması için gereken dosya sistemi katmanlarının salt okunur bir anlık görüntüsüdür. Container ise bu image'dan başlatılan, kendi izole süreç alanına, dosya sistemine ve ağ arayüzüne sahip çalışan örnektir."; // L351
const SINAV_NOTU = "Sınav Notu: Image salt okunur bir taslaktır, container bu taslaktan üretilen çalışan örnektir; volume container'ın ötesinde kalıcı veri sağlar, network container'lar arası isimle iletişimi sağlar, Docker Compose ise bunların tamamını tek bir bildirimsel dosyada birleştirir."; // L1014
const AG_NOTU = "Dikkat noktası: Varsayılan bridge network'te container'lar birbirini adla bulamaz; servis adıyla iletişim ancak açıkça oluşturulmuş bir user-defined network'te mümkündür — bu örnekteki --network kutuphane-network bu yüzden zorunludur."; // L520
const DOWN_V_NOTU = "Üçüncü hata, docker compose down -v komutunu (volume'ları da silen) docker compose down ile karıştırıp yanlışlıkla tüm veritabanı verisini silmektir."; // L720
const HEALTHCHECK_NOTU = "Bu tanımla Compose, kutuphane-api servisini yalnızca kutuphane-db'nin healthcheck komutu başarılı dönmeye başladıktan sonra başlatır; bu, uygulama kodundaki yeniden deneme (retry) mantığına olan ihtiyacı azaltır ama tamamen ortadan kaldırmaz — ağ kesintisi gibi çalışma zamanı sorunlarına karşı retry mantığı yine de savunma katmanı olarak kalmalıdır."; // L683
const DEPENDS_ON_NOTU = "Dikkat noktası: docker-compose.yml'deki depends_on, servisin container'ının başlamış olmasını garanti eder ama içindeki veritabanının bağlantı almaya hazır olduğunu garanti etmez; bu yüzden uygulama tarafında bu tür bir retry mekanizması hâlâ gereklidir."; // L1002

/** The book's responsibility matrix (L67 title, L69 header, L71-77 rows); the fourth column is left out. */
const MATRIS: DataTableSpec = {
  baslik: 'Kavram sorumluluk matrisi',
  sutunlar: [{ ad: 'Kavram' }, { ad: 'Temel Görevi' }, { ad: 'Ne Yapmaz? (Sorumluluk Sınırı)' }],
  satirlar: [
    { key: "engine", cells: ["Docker Engine", "Uygulamaları ve bağımlılıklarını işletim sistemi düzeyinde sanallaştırarak (cgroups, namespaces) izole konteynerler halinde çalıştırır.", "Ağır sanal makineler (VM) gibi tam bir işletim sistemi çekirdeği emüle etmez; ana makinenin Linux çekirdeğini paylaşır."] },
    { key: "dockerfile", cells: ["Dockerfile", "Bir container image'inin temel sistemden başlayarak kod kopyalama, bağımlılık kurma ve derleme adımlarını bildiren deklaratif inşa planıdır.", "Kendi başına çalışan bir süreç değildir; image üretmek için kullanılan tarif dosyasıdır."] },
    { key: "image", cells: ["Image (İmaj)", "Uygulamanın çalışması için gereken kod, runtime, sistem araçları ve kütüphanelerin salt-okunur (read-only) paketlenmiş şablonudur.", "Çalışan dinamik bir süreç veya bellek alanı değildir; container başlatmak için kullanılan dondurulmuş durum paketidir."] },
    { key: "container", cells: ["Container (Konteyner)", "Docker image'inin bellekte izole bir süreç olarak ayağa kaldırılmış, çalışan, yazılabilir ince katmana sahip somut örneğidir.", "Verileri varsayılan olarak kalıcı tutmaz; container silindiğinde içindeki çalışma zamanı verileri de kaybolur."] },
    { key: "volume", cells: ["Volume (Kalıcı Depolama)", "Container silinse veya yeniden başlatılsa dahi veritabanı dosyaları ve yüklenen medyaların ana makinede kalıcı olarak saklanmasını sağlar.", "Otomatik yedekleme veya bulut replikasyonu yapmaz; ana makine diskinde ayrılmış güvenli depolama alanıdır."] },
    { key: "network", cells: ["Network (Konteyner Ağı)", "Birden fazla container'ın izole bir sanal ağ üzerinden container adları (DNS) aracılığıyla güvenli iletişim kurmasını sağlar.", "Konteynerlerin dış internete kontrolsüz şekilde tüm portlarını açmaz; yalnızca tanımlanan portları eşler (port mapping)."] },
    { key: "compose", cells: ["Docker Compose", "API, PostgreSQL, Redis gibi çoklu servis mimarilerini tek bir yapılandırmada toplayıp tek komutla ayağa kaldırır.", "Kubernetes gibi çok düğümlü (multi-node) üretim orkestrasyonu sağlamaz; tek ana makinede çoklu servis orkestrasyonu sunar."] },
  ],
  not: 'tam tablo L69-77',
};

const TANITIM_BLOK: KitapBlok = { tanim: TANIM, tablolar: [], notlar: [SINAV_NOTU] };
const OZET_BLOK: KitapBlok = { tablolar: [MATRIS], notlar: [HEALTHCHECK_NOTU] };

/** The book's own comment on `localhost` (code_012 L868-870, without the `// ` prefixes). */
const LOCALHOST_YORUMU = [868, 869, 870].map((n) => kitapMetni(K12, n).replace(/^\s*\/\/ /, '')).join(' ');

/** R8: the page's own assumption note opens with this; it is not a book sentence and the scene styles it apart. */
export const SAYFA_VARSAYIMI = 'sayfa varsayımı: ';

/** P11: the Turkish reading of R10's `unhealthy` state. */
const UNHEALTHY_SATIRI = 'kutuphane-db unhealthy: service_healthy koşulu sağlanmadı, kutuphane-api başlatılmadı.';

const bos = (code: CodeTraceSpec, kitap: KitapBlok | null = null): ComposeView =>
  ({ kitap, sequence: null, tablo: null, problar: null, terminal: [], notlar: [], code });

const tablo = (baslik: string, sutunlar: readonly string[], satirlar: readonly TabloSatiri[]): DataTableSpec =>
  ({ baslik, sutunlar: sutunlar.map((ad) => ({ ad })), satirlar });

/** Comment lines of Kod 14.3 without their `# ` prefix, joined as one table cell. */
const yorumlar = (...satirlar: number[]): string => satirlar.map((s) => kitapMetni(K3, s).replace(/^# /, '')).join('; ');

/**
 * P3: at most five rows. More than five probes become the first two, one merged row for the 3rd to the (n-2)th probe,
 * and the last two.
 */
export function problariKisalt(problar: readonly Prob[], retries: number): Denetim[] {
  const satir = (p: Prob): Denetim => ({
    ad: `pg_isready · ${saniyeEtiketi(p.t)}`,
    durum: p.durum === 'gecti' ? 'gecti' : p.durum === 'kaldi' ? 'kaldi' : 'atlandi',
    ayrinti: p.durum === 'gecti' ? 'healthy' : p.durum === 'kaldi' ? `hazır değil, ${p.ardisikHata}/${retries}` : 'sayılmadı',
  });
  const n = problar.length;
  if (n <= 5) return problar.map(satir);
  return [
    satir(problar[0]),
    satir(problar[1]),
    { ad: `3.–${n - 2}. prob`, durum: 'kaldi', ayrinti: `hazır değil, 3/${retries} … ${n - 2}/${retries}` },
    satir(problar[n - 2]),
    satir(problar[n - 1]),
  ];
}

/** The compose and kod-14-9 stages: everything comes from `composeUp`. */
function baslatmaGorunumu(p: ComposeParams, kitapCiktisi: boolean): ComposeView {
  const sonuc = composeUp(p);
  const olaylar = sonuc.olaylar;
  const sequence: SequenceSpec = {
    lanes: [{ id: 'compose', label: ['Compose'] }, { id: 'db', label: ['kutuphane-db'] }, { id: 'api', label: ['kutuphane-api'] }],
    messages: olaylar,
    ariaLabel: 'Compose başlatma sıra diyagramı',
  };

  const dbSatiri: TabloSatiri = { key: 'db', cells: ['kutuphane-db', 'starting', saniyeEtiketi(0)] };
  if (p.mod === 'saglikli' && sonuc.saglik) {
    const healthy = sonuc.saglik.saglikliMs !== null;
    dbSatiri.cells = ['kutuphane-db', healthy ? 'healthy' : 'unhealthy', saniyeEtiketi((sonuc.saglik.saglikliMs ?? sonuc.saglik.unhealthyMs)!)];
  }
  const apiSatiri: TabloSatiri = { key: 'api', cells: sonuc.apiBaslangicMs === null
    ? ['kutuphane-api', 'başlamadı', '—']
    : ['kutuphane-api', 'başladı', saniyeEtiketi(sonuc.apiBaslangicMs)] };

  const problar: CheckListSpec | null = p.mod === 'saglikli' && sonuc.saglik
    ? { baslik: 'Sağlık probları', denetimler: problariKisalt(sonuc.saglik.problar, p.retries) }
    : null;

  let terminal: TerminalSatir[];
  if (sonuc.durum === 'bagimlilik-basarisiz') terminal = [{ metin: UNHEALTHY_SATIRI, akis: 'stderr' }];
  else if (sonuc.durum === 'hata') terminal = [{ metin: sonuc.baglanti!.hata!, akis: 'stderr' }];
  else terminal = sonuc.baglanti!.log.map((metin) => ({ metin })); // on step 10 this is the book's own line (L990)

  const notlar = [`${SAYFA_VARSAYIMI}veritabanı ${saniyeEtiketi(p.dbHazirMs)}'de hazır`];
  if (p.asama === 'kod-14-9') notlar.push(DEPENDS_ON_NOTU);

  let code: CodeTraceSpec;
  if (sonuc.durum === 'bagimlilik-basarisiz') code = kodSeridi(K14, [673]);
  // Ders (the step's own badge shows): the step's listing; Lab (`kitapCiktisi` false): always Kod 14.9, the code that runs.
  else if (p.asama === 'kod-14-9' || !kitapCiktisi) code = kodSeridi(K9, sonuc.durum === 'kuruldu' ? [955, 963] : [960]);
  else if (p.mod === 'sira') code = kodSeridi(K6, [596, 597]);
  else code = kodSeridi(K14, [673, 678, 679, 680, 681]);

  return { kitap: null, sequence, tablo: tablo('Servisler', ['servis', 'durum', 't'], [dbSatiri, apiSatiri]), problar, terminal, notlar, code };
}

/** Everything the scene draws for one parameter set; no DOM. */
export function deriveComposeView(p: ComposeParams, kitapCiktisi = false): ComposeView {
  switch (p.asama) {
    case 'tanitim': return bos(kodSeridi(K6, []), TANITIM_BLOK);
    case 'ozet': return bos(kodSeridi(K6, []), OZET_BLOK);
    case 'image': {
      const satirlar = K4_CIKTI.map((s) => s.replace(/^# Çıktı: /, ''));
      return {
        ...bos(kodSeridi(K4, [391, 392])),
        tablo: tablo("Container'lar", ['container', 'port'], satirlar.map((s) => { const [ad, port] = s.split(/\s+/); return { key: ad, cells: [ad, port] }; })),
        terminal: satirlar.map((metin) => ({ metin })),
        notlar: [IMAJ_TANIMI],
      };
    }
    case 'cok-asamali':
      return {
        ...bos(kodSeridi(K3, [322, 323, 324, 325])),
        tablo: tablo('Kod 14.3 aşamaları', ['aşama', 'içerik'], [
          { key: 'derleme', cells: ['1. Aşama: Derleme (Builder) · derleyici', yorumlar(302, 305, 309)] },
          { key: 'calisma', cells: ['2. Aşama: Çalışma Zamanı (Production Runner) · uretim', yorumlar(322, 327)] },
        ]),
      };
    case 'volume-yok':
      return {
        ...bos(kodSeridi(K8, [549])),
        tablo: tablo('Kaynaklar', ['kaynak', 'durum'], [
          { key: 'gecici', cells: ['kutuphane-db-gecici (container)', 'silindi'], state: 'silindi' },
          { key: 'veri', cells: ['veri (container içinde)', 'silindi'], state: 'silindi' },
        ]),
      };
    case 'volume-var':
      return {
        ...bos(kodSeridi(K8, [553])),
        tablo: tablo('Kaynaklar', ['kaynak', 'durum'], [
          { key: 'db', cells: ['kutuphane-db (container)', 'silindi'], state: 'silindi' },
          { key: 'volume', cells: ['kutuphane-db-verisi (volume)', 'etkin'], state: 'etkin' },
        ]),
        notlar: [DOWN_V_NOTU],
      };
    case 'ag':
      return {
        ...bos(kodSeridi(K5, [506])),
        tablo: tablo('DNS', ['ad', 'çözüm'], [{ key: 'db', cells: ['kutuphane-db', "kutuphane-db container'ı"] }]),
        notlar: [AG_NOTU],
      };
    case 'localhost':
      return {
        ...bos(kodSeridi(K12, [872])),
        tablo: tablo('DNS', ['ad', 'çözüm'], [{ key: 'localhost', cells: ['localhost', LOCALHOST_YORUMU] }]),
        terminal: [{ metin: K12_CIKTI[0].replace(/^\/\/ Beklenmeyen çıktı: /, ''), akis: 'stderr' }],
      };
    case 'compose':
    case 'kod-14-9':
      return baslatmaGorunumu(p, kitapCiktisi);
  }
}

/** Always the book's code on the reader's own settings. */
export function composeLabRozet(_p: ComposeParams): Rozet {
  return { tur: 'kitap-kodu' };
}
