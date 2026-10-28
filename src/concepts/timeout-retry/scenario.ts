import type { Scenario } from '../../core/player';
import type { Rozet } from '../../core/plot/source-badge';

export type TimeoutAsama = 'tanitim' | 'zamansiz' | 'akis' | 'izolasyon' | 'hata-turleri' | 'dogrulama' | 'ozet';
/** The service: `hizli` answers in 1200 ms, `yavas` after `servisGecikmesiMs`, `gecici` is slow first and fast on the retry; the last three answer in 1200 ms with a bad outcome. */
export type Senaryo = 'hizli' | 'yavas' | 'gecici' | 'http-500' | 'bos-ozet' | 'bozuk-govde';

/** Parameters of the timeout-retry page: the stage on show plus the one Lab request. */
export interface TimeoutParams {
  asama: TimeoutAsama;
  /** Which book listing runs: Kod 17.3 (timeout, error isolation) or Kod 17.5 (adds response validation). */
  surum: '17.3' | '17.5';
  zamanAsimiMs: number;
  senaryo: Senaryo;
  /** Retries after an abort (the page's extension, R29); 0 is the book's single attempt. */
  maksRetry: number;
  beklemeTabanMs: number;
  /** The slow leg of the service, in ms. */
  servisGecikmesiMs: number;
}

const VARSAYILAN: TimeoutParams = {
  asama: 'akis',
  surum: '17.5',
  zamanAsimiMs: 5000,
  senaryo: 'gecici',
  maksRetry: 1,
  beklemeTabanMs: 1000,
  servisGecikmesiMs: 8000,
};

/** Source badge of every step, keyed by step id. */
export const TIMEOUT_ROZET: Readonly<Record<string, Rozet>> = {
  tanitim: { tur: 'kitap', ref: 'L316, L318' },
  zamansiz: { tur: 'kitaba-dayali', ref: 'L162, L175' },
  abort: { tur: 'kitap-kodu', ref: 'L360-376' },
  basarili: { tur: 'kitap-kodu', ref: 'L373-375, L405' },
  izolasyon: { tur: 'kitap', ref: 'L405-407' },
  'gecici-kalici': { tur: 'kitap-kodu', ref: 'L337, L369-372' },
  'retry-bekle': { tur: 'kitaba-dayali', ref: 'L335, L443, L794' },
  'retry-tukendi': { tur: 'kitaba-dayali', ref: 'L335, L448, L471' },
  dogrulama: { tur: 'kitap', ref: 'L772-776' },
  ozet: { tur: 'kitap', ref: 'L440-446, L806' },
};

/** The step scenario of the timeout-retry page (Ders steps 1-10). */
export const timeoutScenario: Scenario<TimeoutParams> = {
  defaults: VARSAYILAN,
  steps: [
    {
      id: 'tanitim',
      title: 'AI servisi için üç koruma: timeout, retry, hata izolasyonu',
      term: 'timeout, retry ve hata izolasyonu',
      text: 'Kitaba göre timeout beklemeyi sınırlar, retry geçici hatada bir şans daha tanır, hata izolasyonu ise AI servisinin çökmesinin diğer işlevlere sızmasını önler. Bu adımda yalnızca kitabın tanımı ve gerekçesi var; henüz bir istek gönderilmedi.',
      labText: 'Bu görünüm yalnızca kitabın tanımını gösterir. Bir ayarı değiştirdiğinizde Lab tek bir AI isteğine geçer.',
      params: { ...VARSAYILAN, asama: 'tanitim' },
    },
    {
      id: 'zamansiz',
      title: 'Zaman aşımı olmayan istek süresiz bekler',
      term: 'zaman aşımsız fetch',
      text: 'Kitabın yanlış örneği fetch çağrısına zaman aşımı koymaz. Servis yanıt vermezse çubuk eksenin sonuna kadar uzar ve hiçbir yerde bitmez; istek de onu bekleyen kullanıcı da takılı kalır.',
      labText: 'Bu görünüm kitabın yanlış örneğini gösterir. Bir ayarı değiştirdiğinizde Lab zaman aşımlı akışa geçer.',
      params: { ...VARSAYILAN, asama: 'zamansiz' },
    },
    {
      id: 'abort',
      title: 'Süre dolunca abort() isteği iptal eder',
      term: 'AbortController',
      text: 'Kod 17.3 isteği başlatırken zamanlayıcıyı da kurar. Servis 8000 ms sonra yanıt verecek, zaman aşımı ise 5000 ms: zamanlayıcı önce çalışır, abort() çağrılır, fetch AbortError ile düşer ve kod bunu GeciciAiHatasi’na çevirir. Hata yakalanır, günlüğe yazılır ve null döner.',
      labText: 'Zaman aşımını ve servis gecikmesini değiştirin: gecikme zaman aşımına ulaştığı anda istek iptal edilir, ulaşmadan yanıt gelirse iptal olmaz.',
      params: { ...VARSAYILAN, surum: '17.3', senaryo: 'yavas', maksRetry: 0 },
    },
    {
      id: 'basarili',
      title: 'Yanıt zamanında gelirse finally zamanlayıcıyı temizler',
      term: 'clearTimeout',
      text: 'Servis 1200 ms içinde yanıt verir; zaman aşımına ulaşılmaz. Özet metni döner ve finally bloğu clearTimeout ile zamanlayıcıyı temizler. Temizlenmeseydi bekleyen zamanlayıcı istek bittikten sonra da bellekte kalırdı.',
      labText: 'Servis gecikmesini zaman aşımının altına indirin: yanıt gelir ve çubuk yanıt ucuyla biter. Yavaş servis seçilirse yeniden alarm ucu görünür.',
      params: { ...VARSAYILAN, surum: '17.3', senaryo: 'hizli', maksRetry: 0 },
    },
    {
      id: 'izolasyon',
      title: 'Hata izolasyonu: özet alınamasa da sayfa çalışır',
      term: 'hata izolasyonu',
      text: 'Kitabın iki örnek çağrısı aynen çalışır: ilki özeti döndürür, ikincisi AbortError fırlatır. Hata yakalanır, mesaj günlüğe yazılır ve null döner. İki çağrı da kendi başına sonuçlanır; kitap sayfası özetsiz de gösterilir.',
      labText: 'Bu görünüm kitabın iki örnek çağrısını gösterir. Bir ayarı değiştirdiğinizde Lab tek bir AI isteğine geçer.',
      params: { ...VARSAYILAN, asama: 'izolasyon' },
    },
    {
      id: 'gecici-kalici',
      title: 'Geçici ve kalıcı hata ayrı türlerdir',
      term: 'GeciciAiHatasi ve KaliciAiHatasi',
      text: 'Kod 17.3 yakaladığı hatayı iki türe ayırır: AbortError geçici bir sorundur ve GeciciAiHatasi olur, geri kalan her hata KaliciAiHatasi olur. Bu ayrım, yeniden denemenin yalnızca geçici hatalarda anlamlı olması için gereklidir. Servis 500 dönerse günlükte kalıcı hata mesajı görünür.',
      labText: 'Bu görünüm hata türlerinin eşlemesini gösterir. Bir ayarı değiştirdiğinizde Lab tek bir AI isteğine geçer.',
      params: { ...VARSAYILAN, asama: 'hata-turleri' },
    },
    {
      id: 'retry-bekle',
      title: 'Geçici hatada bekleyip bir kez daha denenir',
      term: 'yeniden deneme (retry)',
      text: 'Kitabın kodu tek deneme yapar; bu adım sayfanın uzantısıdır. İlk deneme 5000 ms’de iptal olur, 1000 ms beklenir ve ikinci deneme 1200 ms’de yanıt verir. Toplam süre 7200 ms; özet alınır.',
      labText: 'Yeniden deneme sayısını, bekleme tabanını ve servis gecikmesini değiştirin: her iptalden sonra bekleme iki katına çıkar ve çubuklar bu süreye göre kayar.',
      params: { ...VARSAYILAN },
    },
    {
      id: 'retry-tukendi',
      title: 'Deneme hakkı bitince hata izole edilir',
      term: 'tükenen yeniden deneme',
      text: 'Servis yavaş kalırsa ikinci deneme de 5000 ms’de iptal olur ve toplam süre 11000 ms olur. Deneme hakkı bitince kod hatayı günlüğe yazar ve null döner; yine de yanıt 200 OK’tir, yalnızca özet alanı boş kalır. Karşıtı kitabın yanlış örneğidir: bekleme yok, on deneme.',
      labText: 'Yeniden deneme sayısını artırın ve bekleme tabanını sıfırlayın: toplam süre uzar, bekleme sıfır olunca kitabın yanlış örneğindeki desene yaklaşılır.',
      params: { ...VARSAYILAN, senaryo: 'yavas' },
    },
    {
      id: 'dogrulama',
      title: 'Zamanında gelen yanıt da doğrulanır',
      term: 'çıktı doğrulaması',
      text: 'Kod 17.5’in üç örnek çağrısı aynen çalışır. İkinci çağrıda yanıt zamanında gelir, zaman aşımı geçilir; ama özet boştur ve doğrulama kalır. Kod bunu günlüğe yazar ve null döner; üçüncü çağrıda ise zaman aşımı hatası günlüğe düşer.',
      labText: 'Senaryoyu boş özete ya da bozuk gövdeye çevirin: yanıt zamanında gelir, doğrulama kalır ve özet gösterilmez.',
      params: { ...VARSAYILAN, asama: 'dogrulama' },
    },
    {
      id: 'ozet',
      title: 'Özet: seçenekler ve kapsam',
      term: 'timeout, retry ve hata izolasyonu özeti',
      text: 'Kitap hata izolasyonu seçeneklerini bir tabloda karşılaştırır ve hangi halkaların kodlandığını, hangilerinin yalnızca akış şemasında gösterildiğini ayırt eder.',
      labText: 'Tablo ve not kitabın özetidir. Bir ayarı değiştirdiğinizde Lab tek bir AI isteğine geçer.',
      params: { ...VARSAYILAN, asama: 'ozet' },
    },
  ],
};
