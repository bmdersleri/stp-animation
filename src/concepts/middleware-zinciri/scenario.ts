import type { Scenario } from '../../core/player';
import type { Rozet } from '../../core/plot/source-badge';
import type { Iz, Olay } from './express-sim';
import { mwIz } from './view';

export type MwProgram = 'kod-5-5' | 'next-unutma' | 'cift-yanit';
export type MwYol = '/korumali-durum' | '/baska' | '/hata-ornegi';
export type MwAnahtar = 'gecerli' | 'yanlis' | 'yok';
/**
 * Parameters of the middleware-zinciri page: the program (the book's Kod 5.5 or one of its two error examples), the
 * request (`yol`, `anahtar`), the Lab switches, how many trace events are shown (`olay`) and flow vs summary view.
 */
export interface MwParams {
  program: MwProgram;
  yol: MwYol;
  anahtar: MwAnahtar;
  gunlukNext: boolean;
  kontrolGenel: boolean;
  hataKatmani: boolean;
  olay: number;
  gorunum: 'akis' | 'ozet';
}

/** Larger than any trace: `olay` is clamped to the trace length. */
export const TUMU = 999;

const VARSAYILAN: MwParams = {
  program: 'kod-5-5',
  yol: '/korumali-durum',
  anahtar: 'gecerli',
  gunlukNext: true,
  kontrolGenel: false,
  hataKatmani: true,
  olay: 0,
  gorunum: 'akis',
};

const TABAN = { program: 'kod-5-5', yol: '/korumali-durum', anahtar: 'gecerli', gorunum: 'akis' } as const;

const IZ: Iz = mwIz(VARSAYILAN);

/** Events shown once the first event matching `bul` has played (index + 1), looked up in the default trace. */
function kadar(bul: (o: Olay) => boolean): number {
  const i = IZ.olaylar.findIndex(bul);
  if (i < 0) throw new Error('middleware-zinciri: trace has no such event');
  return i + 1;
}

/** Source badge of every step, keyed by step id. */
export const MW_ROZET: Readonly<Record<string, Rozet>> = {
  tanitim: { tur: 'kitap' },
  json: { tur: 'kitap-kodu' },
  gunluk: { tur: 'kitap', ref: 'L667' },
  anahtar: { tur: 'kitap-kodu' },
  isleyici: { tur: 'kitap-kodu' },
  yetkisiz: { tur: 'kitap', ref: 'L668' },
  eslesmeyen: { tur: 'kitaba-dayali', ref: 'L558' },
  'next-unutma': { tur: 'kitap', ref: 'L727-728' },
  'cift-yanit': { tur: 'kitap-kodu' },
  hata: { tur: 'kitaba-dayali', ref: 'L682, L1814-1818' },
  ozet: { tur: 'kitap', ref: 'L1839' },
};

/** The step scenario of the middleware-zinciri page (Ders steps 1-11). */
export const mwScenario: Scenario<MwParams> = {
  defaults: VARSAYILAN,
  steps: [
    {
      id: 'tanitim',
      title: 'İstek ile yanıt arasındaki fonksiyon',
      term: 'middleware',
      text: 'Middleware, request ile response arasındaki süreçte çalışan fonksiyondur. Bu fonksiyon isteği inceleyebilir, log yazabilir, veri ekleyebilir, doğrulama yapabilir, response gönderebilir veya kontrolü bir sonraki middleware’e aktarabilir. Kitabın Kod 5.5 uygulaması bir zincir kurar: express.json(), istekGunlugu, apiAnahtariKontrolu ve route işleyicisi.',
      labText: 'Şeritler yan yana duruyor; henüz hiçbir istek gönderilmedi. Yolu, anahtarı ve katman seçeneklerini değiştirip isteğin hangi şeritlerden geçtiğine bakın.',
      params: { ...TABAN, olay: 0 },
    },
    {
      id: 'json',
      title: 'express.json() gövdesiz GET\'te next() çağırır',
      term: 'express.json()',
      text: 'İstek GET /korumali-durum, başlığı x-api-anahtari: kitap-api-2026. Zincirin ilk katmanı express.json() gövdeyi ayrıştırır. Bu GET isteğinde gövde yoktur; ayrıştıracak bir şey bulamaz ve next() çağırarak isteği sonraki katmana bırakır.',
      labText: 'İstek kartı, seçtiğiniz yolu ve anahtar durumunu gösterir. İlk katman gövdeyi ayrıştırır ve isteği bir sonraki katmana geçirir.',
      params: { ...TABAN, olay: kadar((o) => o.tur === 'next' && o.katman === 'json') },
    },
    {
      id: 'gunluk',
      title: 'İstek günlüğü ve sonrakiAdim()',
      term: 'next()',
      text: 'istekGunlugu gelen metodun ve URL’nin kaydını tutar: terminale "GET /korumali-durum" yazılır (kitabın çıktısı: GET /korumali-durum). Bu middleware response üretmeden sonrakiAdim() ile zincire devam eder; next çağrısı olmazsa istek burada bekler.',
      labText: 'Günlük satırı terminalde belirir. Günlük katmanının next çağrısını kapatırsanız zincir burada kopar ve istek askıda kalır.',
      params: { ...TABAN, olay: kadar((o) => o.tur === 'next' && o.katman === 'gunluk') },
    },
    {
      id: 'anahtar',
      title: 'Yetki kontrolü: geçerli anahtar',
      term: 'yetkilendirme middleware\'i',
      text: 'apiAnahtariKontrolu API anahtarını x-api-anahtari başlığından okur. Anahtar "kitap-api-2026" ise geçerli anahtar bulunmuştur ve sonrakiAdim() ile devam edilir; route işleyicisine geçiş açılır.',
      labText: 'Anahtarı yanlış ya da yok seçerseniz bu katman isteği ilerletmez; işleyiciye geçiş kapanır.',
      params: { ...TABAN, olay: kadar((o) => o.tur === 'next' && o.katman === 'anahtar') },
    },
    {
      id: 'isleyici',
      title: 'İşleyici yanıtı doğrudan istemciye gönderir',
      term: 'yanıt',
      text: 'Route işleyicisi 200 yanıtını üretir: {"mesaj":"Korumalı bilgiye erişildi."}. Yanıt aradaki katmanlardan geri geçmez, doğrudan istemciye gider. Kitabın sözüyle: send() veya json() çağrısı yanıtı sonlandırır ve sonraki middleware çalışmaz.',
      labText: 'Yanıt oku, yanıtı gönderen şeritten doğrudan istemciye çizilir; durdurma işareti aynı şeritte durur.',
      params: { ...TABAN, olay: TUMU },
    },
    {
      id: 'yetkisiz',
      title: 'Anahtarsız istek: 401',
      term: 'yetkisiz istek',
      text: 'Anahtarsız istekte günlük satırı yine yazılır, ama apiAnahtariKontrolu 401 {"mesaj":"Yetkisiz istek."} yanıtını gönderir ve return eder (kitabın çıktısı: Geçersiz anahtarda 401). Havaalanı benzetmesiyle: bir aşamada sorun varsa yolcu uçağa alınmaz; yetkilendirme middleware’i başarısız olursa route işleyicisine geçilmez. İşleyici bu yüzden soluktur.',
      labText: 'Anahtarı değiştirdikçe durdurma işaretinin hangi şeritte durduğuna bakın; işleyici ancak geçerli anahtarla çalışır.',
      params: { ...TABAN, anahtar: 'yok', olay: TUMU },
    },
    {
      id: 'eslesmeyen',
      title: 'Eşleşmeyen yol: varsayılan 404',
      term: 'genel middleware',
      text: 'GET /baska isteğinde express.json() ve istekGunlugu yine çalışır (terminal: GET /baska), çünkü uygulama.use ile kaydedilen middleware her isteğe uygulanır. Hiçbir route eşleşmediği için Express varsayılan 404 yanıtını verir: Cannot GET /baska. Kitap, apiAnahtariKontrolu’nun yalnızca belirli route’a verildiğini söyler; global middleware için uygulama.use(apiAnahtariKontrolu) kullanılırsa tüm route’lar etkilenir.',
      labText: 'Route şeritleri soluk kalır. Anahtar denetimini genel yaparsanız aynı istek, anahtarsızken bu kez yetkisiz yanıtla biter.',
      params: { ...TABAN, yol: '/baska', anahtar: 'yok', olay: TUMU },
    },
    {
      id: 'next-unutma',
      title: 'next() unutulursa istek askıda kalır',
      term: 'askıda kalan istek',
      text: 'code_010: günlük middleware’i isteği kaydeder ama zinciri sürdürmez; next çağrılmaz, route işleyicisi çalışmaz. Terminal "/kitaplar" ve "zincir surdu mu: false" yazar (kitabın çıktısı). Express bir ara katmanın işini ya res.send()/res.json() ile yanıt verilmesinden ya da next() çağrılmasından anlar; ikisi de yapılmazsa istek sonsuza kadar askıda kalır ve istemci zaman aşımına uğrar. Yandaki karşılaştırmada code_011 aynı akışı next çağırarak çalıştırır: son satır "zincir surdu mu: true" olur.',
      labText: 'Bu adım kitabın hatalı örneğini kendi başına oynatır; Lab seçenekleri burada etkili değildir. Karşılaştırma, doğru sürümün çıktısını gösterir.',
      params: { ...TABAN, program: 'next-unutma', anahtar: 'yok', olay: TUMU },
    },
    {
      id: 'cift-yanit',
      title: 'return unutulursa ikinci yanıt hata verir',
      term: 'ERR_HTTP_HEADERS_SENT',
      text: 'code_017: 404 yanıtı gönderildikten sonra kod return etmez, akış sürer. res.json() yanıtı sokete yazar ama altındaki JavaScript kodları çalışmaya devam eder; alt satırdaki ikinci res.json() ERR_HTTP_HEADERS_SENT hatası fırlatır. Hata stderr’e düşer; istemci yalnız ilk yanıtı, 404’ü alır.',
      labText: 'Terminaldeki stderr satırı ikinci gönderim denemesinin hatasıdır; yanıt kartında yalnız ilk yanıt durur.',
      params: { ...TABAN, program: 'cift-yanit', anahtar: 'yok', olay: TUMU },
    },
    {
      id: 'hata',
      title: 'Hata atlanır, hata middleware\'i yakalar',
      term: 'hata middleware\'i',
      text: 'GET /hata-ornegi işleyicisi hata fırlatır (throw new Error("Beklenmeyen durum")). Express hata durumuna geçer: normal katmanlar atlanır, yalnız hata middleware’i çağrılır. Kitaba göre hata yakalama middleware’i çoğunlukla route’lardan sonra tanımlanır. Hata middleware’i hatayı stderr’e yazar ve 500 {"mesaj":"Sunucuda beklenmeyen bir hata oluştu."} gönderir.',
      labText: 'Hata katmanını kapatırsanız kayıtlı hata middleware’i kalmaz ve Express kendi varsayılan hata yanıtını verir.',
      params: { ...TABAN, yol: '/hata-ornegi', anahtar: 'gecerli', olay: TUMU },
    },
    {
      id: 'ozet',
      title: 'Zincir next() ile sürer, yanıt zinciri bitirir',
      term: 'middleware zinciri',
      text: 'Middleware zinciri next() ile sürer; send() veya json() çağrısı yanıtı sonlandırır ve sonraki middleware çalışmaz. Tablo her katmanın ne yaptığını ve sonucunun next() mi yanıt mı olduğunu özetler.',
      labText: 'Tablo sabittir: Lab seçimleriniz bu özeti değiştirmez.',
      params: { ...TABAN, olay: TUMU, gorunum: 'ozet' },
    },
  ],
};
