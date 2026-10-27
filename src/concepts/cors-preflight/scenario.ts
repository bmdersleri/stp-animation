import type { Scenario } from '../../core/player';
import type { Rozet } from '../../core/plot/source-badge';
import type { CorsSenaryo } from './tarayici';

/** Parameters of the cors-preflight page: the CORS scenario, the stage and how many sequence events show. */
export interface CorsParams extends CorsSenaryo {
  asama: 'tanitim' | 'akis' | 'ozet';
  /** Number of sequence events shown; `TUMU` shows the whole trace. */
  olay: number;
}

/** `olay` value that shows every event of the trace. */
export const TUMU = 999;

const VARSAYILAN: CorsParams = {
  koken: 'kutuphane',
  istemci: 'tarayici',
  istek: 'get-kitaplar',
  kimlik: 'include',
  sunucu: 'kitap-karari',
  asama: 'akis',
  olay: TUMU,
};

/** Source badge of every step, keyed by step id. */
export const CORS_ROZET: Readonly<Record<string, Rozet>> = {
  tanitim: { tur: 'kitaba-dayali', ref: 'L540' },
  izinli: { tur: 'kitap-kodu', ref: 'L614-620' },
  izinsiz: { tur: 'kitap-kodu', ref: 'L621, L552-556' },
  'sunucu-reddi': { tur: 'kitap-kodu', ref: 'L1116, L1208' },
  curl: { tur: 'kitaba-dayali', ref: 'L543, L670' },
  wildcard: { tur: 'kitaba-dayali', ref: 'L633, L649' },
  'preflight-gerekli': { tur: 'standart', ref: 'Fetch' },
  'preflight-eksik': { tur: 'standart', ref: 'Fetch, L624, L646' },
  'preflight-tamam': { tur: 'standart', ref: 'Fetch, cors' },
  ozet: { tur: 'kitap', ref: 'L550-554, L644-647' },
};

/** The step scenario of the cors-preflight page (Ders steps 1-10). */
export const corsScenario: Scenario<CorsParams> = {
  defaults: VARSAYILAN,
  steps: [
    {
      id: 'tanitim',
      title: 'CORS yanıtın okunmasını denetler',
      term: 'CORS',
      text: 'Kitaba göre CORS, bir sayfanın kendi kökeninden farklı bir kökene tarayıcı üzerinden yaptığı isteği denetleyen mekanizmadır. Köken protokol, alan adı ve port üçlüsüdür. Sunucu hangi kökenlere izin verdiğini Access-Control-Allow-Origin başlığıyla bildirir; tarayıcı yanıtı betiğe bu başlığa bakarak verir ya da vermez. Bu adımda henüz bir istek gitmedi.',
      labText: 'Bu görünüm yalnızca tanımı gösterir. Köken, istemci ya da istek seçtiğinizde sonraki adımlarda istek çalışır.',
      params: { ...VARSAYILAN, asama: 'tanitim' },
    },
    {
      id: 'izinli',
      title: 'İzinli köken: yanıt betiğe verilir',
      term: 'Allow-Origin',
      text: 'Kütüphane sitesinin betiği API’den kitap listesini ister. Tarayıcı isteğe Origin başlığını ekler. Sunucu corsKarariVer ile kökeni izin listesinde bulur ve yanıta Access-Control-Allow-Origin ile Access-Control-Allow-Credentials başlıklarını koyar. Tarayıcının denetimi geçer ve yanıt betiğe verilir. Kod şeridi kararın verildiği satırda durur.',
      labText: 'Kökeni, kimlik bilgisini ya da isteği değiştirin: denetim listesi ve yanıt kartı yeniden hesaplanır.',
      params: { ...VARSAYILAN },
    },
    {
      id: 'izinsiz',
      title: 'İzinsiz köken: sunucu işler, tarayıcı vermez',
      term: 'TypeError',
      text: 'Kötü niyetli sitenin betiği aynı API’yi ister. corsKarariVer kökeni listede bulamaz ve yanıta CORS başlığı eklemez. Sunucu isteği yine de işler ve 200 döner; ama tarayıcı Allow-Origin başlığını bulamayınca yanıtı betiğe vermez, betik TypeError görür. CORS yanıtın okunmasını engeller, isteğin sunucuya ulaşmasını değil.',
      labText: 'İzinli bir köken seçerseniz denetim geçer ve betik yanıtı okur. Kimlik bilgisini kapatmak Allow-Origin denetimini değiştirmez.',
      params: { ...VARSAYILAN, koken: 'kotu' },
    },
    {
      id: 'sunucu-reddi',
      title: 'Kod 11.7: sunucu kendisi reddeder',
      term: 'corsKontrolEt',
      text: 'Kod 11.7’de CORS denetimi sunucunun içindedir: corsKontrolEt, izin listesinde olmayan kökene 403 ve “Bu köken için CORS izni yoktur.” döner. Kitap bu çağrıyı doğrudan fonksiyonla yapar (L1201-1206); burada aynı istek curl ile Origin başlığı verilerek gönderilir. Bu kez isteği tarayıcı değil sunucu geri çevirir.',
      labText: 'Köken izin listesindeki adresse sunucu isteği işler ve giriş yanıtı döner. Başka bir köken yine reddedilir.',
      params: { ...VARSAYILAN, koken: 'kotu', istemci: 'curl-origin', istek: 'post-giris', sunucu: 'kitap-11-7' },
    },
    {
      id: 'curl',
      title: 'curl CORS uygulamaz',
      term: 'curl',
      text: 'Kitap, CORS’un yalnızca tarayıcılar tarafından uygulanan bir politika olduğunu söyler; curl gibi bir araçta hiçbir etkisi yoktur. Aynı sunucu, aynı yanıt: curl Allow-Origin başlığına bakmaz, yanıt gövdesini olduğu gibi yazdırır. Bu yüzden CORS sunucu tarafı yetkilendirmenin yerini tutmaz.',
      labText: 'İstemciyi tarayıcı yaparsanız aynı istek CORS denetiminden geçer. Köken seçimi curl için bir fark yaratmaz.',
      params: { ...VARSAYILAN, istemci: 'curl' },
    },
    {
      id: 'wildcard',
      title: 'Wildcard ve kimlik bilgisi birlikte olmaz',
      term: 'Allow-Origin: *',
      text: 'Kitabın yanlış örneği Allow-Origin değerini “*” yapar ve Allow-Credentials: true ekler. Kitaba göre tarayıcı standardı bu birleşimi geçersiz sayar. Tarayıcı kimlik bilgisiyle gönderilen istekte “*” değerini kabul etmez ve yanıtı betiğe vermez.',
      labText: 'Kimlik bilgisini kapatırsanız aynı yanıt kabul edilir. Sunucuyu kitabın izin listesine çevirirseniz Allow-Origin istekteki köken olur.',
      params: { ...VARSAYILAN, sunucu: 'wildcard' },
    },
    {
      id: 'preflight-gerekli',
      title: 'Preflight: tarayıcı önce OPTIONS ister',
      term: 'preflight',
      text: 'Giriş isteği POST’tur ve Content-Type: application/json taşır. Bu değer tarayıcının güvenli saydığı içerik türlerinden değildir, bu yüzden tarayıcı asıl isteği göndermeden önce aynı yola bir OPTIONS isteği yollar. Bu ön uçuş isteği Origin, Access-Control-Request-Method ve Access-Control-Request-Headers başlıklarını taşır. Diyagramda yalnızca fetch çağrısı ve OPTIONS isteği görünür.',
      labText: 'İsteği basit bir GET yaparsanız preflight hiç gönderilmez. Başlık ya da metot değişince ön uçuş yeniden hesaplanır.',
      params: { ...VARSAYILAN, istek: 'post-giris', olay: 2 },
    },
    {
      id: 'preflight-eksik',
      title: 'Preflight kalır: asıl istek gitmez',
      term: 'Allow-Headers',
      text: 'Kitabın corsKarariVer kodu yalnızca iki başlık üretir; Access-Control-Allow-Headers yok. Express OPTIONS isteğine yine de bir yanıt verir, ama tarayıcının istediği Content-Type başlığına izin verilmediği için ön uçuş denetimi kalır. Asıl POST hiç gönderilmez ve betik TypeError görür. Denetim listesi başlığın eksik olduğunu gösterir.',
      labText: 'İsteği GET yaparsanız ön uçuş gerekmez. Sunucuyu cors paketine çevirirseniz eksik başlık tamamlanır.',
      params: { ...VARSAYILAN, istek: 'post-giris' },
    },
    {
      id: 'preflight-tamam',
      title: 'cors paketi preflight’ı yanıtlar',
      term: 'cors paketi',
      text: 'Kitabın tablosuna göre cors paketi ön uçuş isteklerini otomatik yönetir. Paket OPTIONS isteğine izin verilen metotları ve istenen başlıkları bildirerek yanıt verir; ön uçuş geçince tarayıcı asıl isteği gönderir. İki yanıt sırayla görünür: önce ön uçuşun, sonra asıl isteğin yanıtı.',
      labText: 'Kökeni izin listesinin dışına alırsanız ön uçuş kalır. Kimlik bilgisini kapatmak Allow-Credentials denetimini atlatır.',
      params: { ...VARSAYILAN, istek: 'post-giris', sunucu: 'cors-paketi' },
    },
    {
      id: 'ozet',
      title: 'Özet: CORS ne yapar, ne yapmaz',
      term: 'CORS özeti',
      text: 'Kitap iki şeyi birlikte söyler. CORS yalnızca yabancı kökenin yanıtı okumasını engeller; CSRF’i engellemez, çünkü istek sunucuya gönderilir ve sunucu onu işler. CORS ayrıca bir güvenlik duvarı değildir: curl gibi tarayıcı dışı araçlarda etkisizdir, bu yüzden sunucu tarafı yetkilendirmenin yerini tutmaz. Allow-Origin istekteki kökene eşitlenir; kimlik bilgisiyle “*” kullanılmaz.',
      labText: 'Bu görünüm kitabın özetidir ve Lab seçimlerinizden etkilenmez.',
      params: { ...VARSAYILAN, asama: 'ozet' },
    },
  ],
};
