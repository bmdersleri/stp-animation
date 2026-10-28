import type { Scenario } from '../../core/player';
import type { Rozet } from '../../core/plot/source-badge';
import type { Desen } from './desenler';

export interface ElleIstek { t: number; ip: string }

/** Parameters of the rate-limiting page: the request pattern, the limiter settings and how many requests show. */
export interface RateParams {
  desen: Desen;
  maksimumIstek: number;
  pencereSn: 10 | 30 | 60;
  /** The reader's own requests; played only by the `elle` pattern. */
  elle: readonly ElleIstek[];
  /** Number of requests shown; `TUMU` shows all of them. */
  istek: number;
  asama: 'tanitim' | 'akis' | 'ozet';
}

/** `istek` value that shows every request of the pattern. */
export const TUMU = 999;
/** The `elle` pattern plays at most this many requests. */
export const ELLE_SINIRI = 30;

const VARSAYILAN: RateParams = { desen: 'kitap', maksimumIstek: 3, pencereSn: 60, elle: [], istek: TUMU, asama: 'akis' };

/** Source badge of every step, keyed by step id. */
export const RATE_ROZET: Readonly<Record<string, Rozet>> = {
  tanitim: { tur: 'kitap', ref: 'L675, L678' },
  // The limiter table, the timeline dots and the check list are computed by the page; the book prints none of those values.
  'ilk-istek': { tur: 'kitap-kodu', ref: 'L756' },
  artir: { tur: 'kitap-kodu', ref: 'L757-758' },
  sinir: { tur: 'kitap-kodu', ref: 'L759-760, L793' },
  'pencere-doldu': { tur: 'kitap-kodu', ref: 'L763' },
  'ayri-anahtar': { tur: 'kitap-kodu', ref: 'L793' },
  'sinirda-patlama': { tur: 'kitap-kodu', ref: 'L771' },
  'login-sira': { tur: 'kitap-kodu', ref: 'L158, L1207-1208' },
  'login-429': { tur: 'kitap-kodu', ref: 'L1171-1172' },
  ozet: { tur: 'kitap', ref: 'L763, L767-774' },
};

/** The step scenario of the rate-limiting page (Ders steps 1-10). */
export const rateScenario: Scenario<RateParams> = {
  defaults: VARSAYILAN,
  steps: [
    {
      id: 'tanitim',
      title: 'Rate limiting istek sayısını sınırlar',
      term: 'rate limiting',
      text: 'Kitaba göre rate limiting, bir istemcinin belirli bir sürede yapabileceği istek sayısını sınırlar. Amaç kaba kuvvet denemelerini ve aşırı yükü azaltmaktır. Bu bölümdeki sınırlayıcı sabit pencere kullanır: her istemci anahtarı için bir sayaç ve bir pencere başlangıcı tutulur. Bu adımda henüz bir istek gelmedi.',
      labText: 'Bu görünüm yalnızca kitabın tanımını gösterir. Bir ayarı değiştirdiğinizde ya da kendi isteklerinizi eklediğinizde Lab akışa geçer ve sınırlayıcı hemen çalışır.',
      params: { ...VARSAYILAN, asama: 'tanitim' },
    },
    {
      id: 'ilk-istek',
      title: 'İlk istek yeni bir pencere açar',
      term: 'pencere başlangıcı',
      text: 'Aynı IP’den ilk istek gelir. Sınırlayıcı bu anahtar için kayıt bulamaz, sayacı bire koyar ve pencere başlangıcını şimdiki zamana ayarlar. İstek kabul edilir. Kod şeridi yeni pencereyi açan koşulda durur.',
      labText: 'Pencere uzunluğunu ya da en fazla istek sayısını değiştirin: tablo ve zaman çizgisi baştan hesaplanır.',
      params: { ...VARSAYILAN, istek: 1 },
    },
    {
      id: 'artir',
      title: 'Pencere içindeki istekler sayacı artırır',
      term: 'sayaç',
      text: 'Aynı pencere dolmadan gelen sonraki istekler sayacı birer birer artırır. Sayaç sınıra ulaşmadığı sürece istek kabul edilir; pencere başlangıcı değişmez. Üçüncü istekte sayaç sınıra eşitlenir ama istek hâlâ geçer.',
      labText: 'En fazla istek sayısını artırırsanız aynı görünümde daha çok istek kabul edilir.',
      params: { ...VARSAYILAN, istek: 3 },
    },
    {
      id: 'sinir',
      title: 'Sınır aşılınca istek 429 alır',
      term: '429',
      text: 'Sayaç sınıra eşitken gelen istek reddedilir: sınırlayıcı false döner ve kitabın çıktısında bu denemeler “429 Too Many Requests” olarak yazılır. Reddedilen istek sayacı artırmaz. Zaman çizgisinde aynı anda gelen iki istek üst üste turuncu noktalar olarak görünür.',
      labText: 'İsteklerin hepsini aynı anda göndermek yerine kendi zamanlarınızı girin: noktalar yatay eksende ayrılır.',
      params: { ...VARSAYILAN },
    },
    {
      id: 'pencere-doldu',
      title: 'Pencere dolunca sayaç sıfırlanır',
      term: 'pencere süresi',
      text: 'Pencere süresi geçtikten sonra gelen istek, kayıt olmasına rağmen yeni pencere koşuluna girer. Sayaç yeniden bire iner ve pencere başlangıcı yeni isteğin zamanı olur. Reddedilen istemci pencere bittiğinde yeniden kabul edilir. Zaman çizgisinde ikinci bir pencere bandı açılır.',
      labText: 'Pencere süresini kısaltırsanız aynı isteklerin arasındaki boşluk pencereyi daha erken kapatır.',
      params: { ...VARSAYILAN, desen: 'pencere' },
    },
    {
      id: 'ayri-anahtar',
      title: 'Her anahtar kendi sayacını tutar',
      term: 'anahtar',
      text: 'Sınırlayıcı sayaçları anahtara göre tutar; kitapta anahtar istemci IP’sidir. Sınırı dolduran bir IP başka bir IP’yi etkilemez: ikinci IP’nin ilk isteği kendi kaydını açar ve kabul edilir. Tabloda her anahtar ayrı bir satırdır.',
      labText: 'İki IP’li desenlere geçin ve isteklerin dağılımını izleyin: her IP kendi sınırına göre değerlendirilir.',
      params: { ...VARSAYILAN, desen: 'ayri-ip' },
    },
    {
      id: 'sinirda-patlama',
      title: 'Sabit pencerenin sınırında patlama olur',
      term: 'sınırda patlama',
      text: 'Sabit pencerenin bilinen zayıflığı sınırdır. Bir istemci pencerenin sonunda sınıra kadar istek gönderir, pencere dönünce hemen yeniden sınıra kadar gönderir. Kısa sürede sınırın katı kadar istek geçer. Zaman çizgisindeki iki pencere bandı bu geçişi gösterir.',
      labText: 'Kendi zamanlarınızla pencere sınırına yakın istekler deneyin ve kabul edilen sayıyı karşılaştırın.',
      params: { ...VARSAYILAN, desen: 'sinir' },
    },
    {
      id: 'login-sira',
      title: 'Kod 11.7: denetim sırası',
      term: 'denetim zinciri',
      text: 'Kod 11.7’de login isteği önce CORS denetiminden, sonra rate limit denetiminden geçer; ilk başarısız denetim zinciri durdurur. İlk iki çağrının çıktısı kitapta basılıdır: izinli kökenden gelen çağrı başarılı olur, kötü niyetli siteden gelen çağrı CORS’ta 403 alır. CORS’ta reddedilen çağrı sınırlayıcıya ulaşmaz.',
      labText: 'Bu desenin sınırlayıcı ayarları sabittir; bir ayarı değiştirdiğinizde Lab kitap desenine geçer. Zincirin devamı sonraki adımdadır.',
      params: { ...VARSAYILAN, desen: 'login', istek: 2 },
    },
    {
      id: 'login-429',
      title: 'Giriş denemesi sınırı aşınca 429',
      term: 'AppError 429',
      text: 'Aynı IP’den izinli kökenle gelen çağrılar sayacı artırır. Sınır dolunca rate limit denetimi kalır ve sunucu 429 ile “Çok fazla giriş denemesi yapıldı.” mesajını döndürür. Sonraki denetimler atlanır; parola bile bakılmaz. Kod şeridi 429’u veren satırda durur.',
      labText: 'Bu desenin ayarları sabittir; bir ayarı değiştirdiğinizde Lab kitap desenine geçer ve sınırı ve pencereyi siz belirlersiniz.',
      params: { ...VARSAYILAN, desen: 'login' },
    },
    {
      id: 'ozet',
      title: 'Özet: sabit pencere ve sınırı',
      term: 'rate limiting özeti',
      text: 'Kitaba göre sabit pencere basit ve anlaşılırdır: anahtar başına bir sayaç yeter. Pencere dönünce sayaç sıfırlanır; bu yüzden sınırda kısa süreli bir patlama mümkündür. Sınırlayıcı CORS’tan sonra, doğrulamadan önce çalışır ve aşırı denemeleri 429 ile durdurur.',
      labText: 'Tablo ve not kitabın özetidir. Bir ayarı değiştirdiğinizde Lab akışa geçer ve sınırlayıcı seçtiğiniz desenle çalışır.',
      params: { ...VARSAYILAN, asama: 'ozet' },
    },
  ],
};
