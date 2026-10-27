import type { Scenario } from '../../core/player';
import type { Rozet } from '../../core/plot/source-badge';
import { istekKarsila, type KatmanOlayi } from './katmanlar';
import { baslangicDurumu } from './view';

/**
 * Parameters of the katmanli-mimari page: the request identity (`ogrenciNumarasi`, `kitapKodu`), the starting data
 * (`uygunMu`, `mevcutOduncSayisi`), how many times the request is sent (`tekrar`), how many trace events are shown
 * (`olay`) and which view is on screen.
 */
export interface KatmanParams {
  ogrenciNumarasi: '2024001' | '2024999' | '';
  kitapKodu: 'JAVA-101' | 'TS-201' | '';
  uygunMu: boolean;
  mevcutOduncSayisi: 0 | 1 | 2 | 3;
  tekrar: 1 | 2;
  olay: number;
  gorunum: 'akis' | 'kurulum' | 'yasam' | 'ozet';
}

/** Larger than any trace: `olay` is clamped to the trace length. */
export const TUMU = 999;

const VARSAYILAN: KatmanParams = {
  ogrenciNumarasi: '2024001',
  kitapKodu: 'JAVA-101',
  uygunMu: true,
  mevcutOduncSayisi: 0,
  tekrar: 1,
  olay: 0,
  gorunum: 'akis',
};

const TABAN = { ogrenciNumarasi: '2024001', kitapKodu: 'JAVA-101', tekrar: 1, gorunum: 'akis' } as const;

const IZ: readonly KatmanOlayi[] = istekKarsila(baslangicDurumu(VARSAYILAN), {
  ogrenciNumarasi: VARSAYILAN.ogrenciNumarasi,
  kitapKodu: VARSAYILAN.kitapKodu,
}).olaylar;

/** Events shown once the last event matching `bul` has played (index + 1), looked up in the default trace. */
function kadar(bul: (o: KatmanOlayi) => boolean): number {
  let i = -1;
  IZ.forEach((o, k) => {
    if (bul(o)) i = k;
  });
  if (i < 0) throw new Error('katmanli-mimari: trace has no such event');
  return i + 1;
}

/** Source badge of every step, keyed by step id. */
export const KATMAN_ROZET: Readonly<Record<string, Rozet>> = {
  tanitim: { tur: 'kitap', ref: 'L39' },
  kurulum: { tur: 'kitap', ref: 'L173, L1039-1042' },
  dogrulama: { tur: 'kitap-kodu' },
  okuma: { tur: 'kitap-kodu' },
  kurallar: { tur: 'kitap-kodu' },
  'yan-etki': { tur: 'kitap-kodu' },
  'yanit-201': { tur: 'kitap', ref: 'L1052-1055' },
  'ikinci-istek': { tur: 'kitap-kodu' },
  'eksik-alan': { tur: 'kitap', ref: 'L1297' },
  'yasam-dongusu': { tur: 'kitap', ref: 'L1072-1086' },
  ozet: { tur: 'kitap', ref: 'L76-80, L95, L1089' },
};

/** The step scenario of the katmanli-mimari page (Ders steps 1-11). */
export const katmanScenario: Scenario<KatmanParams> = {
  defaults: VARSAYILAN,
  steps: [
    {
      id: 'tanitim',
      title: 'Controller, service ve repository',
      term: 'katmanlı mimari',
      text: 'Katmanlı mimari, bu sorumlulukları bilinçli olarak ayırır. Controller dış dünya ile iletişim kurar; service iş kurallarını uygular; repository veriye erişir. Böylece bir sınıfın değişme nedeni mümkün olduğunca tek olur. Sahnede çağıran kod, controller, service ve iki repository için birer şerit vardır.',
      labText: 'Şeritler hazır; henüz hiçbir istek gönderilmedi. Öğrenciyi, kitabı ve başlangıç verisini değiştirip isteğin katmanlardan nasıl geçtiğine bakın.',
      params: { ...TABAN, olay: 0 },
    },
    {
      id: 'kurulum',
      title: 'Nesneler new ile kurulur',
      term: 'bağımlılık',
      text: 'Önce iki repository, sonra bunları alan service, en sonda service’i alan controller new ile oluşturulur: bağımlılıklar constructor ile verilir. Kitabın dikkat noktası: her sınıf yalnızca bir alt katmanı tanır (controller yalnızca service’i, service yalnızca repository’yi); controller’ın repository’yi doğrudan çağırması bu örnekte kasıtlı olarak engellenmiştir.',
      labText: 'Bu görünüm yalnızca nesnelerin kurulumunu gösterir; istek seçenekleri henüz etkili değildir.',
      params: { ...TABAN, gorunum: 'kurulum' },
    },
    {
      id: 'dogrulama',
      title: 'Controller zorunlu alanları denetler',
      term: 'biçim doğrulaması',
      text: 'İstek controller’a gelir: istekKarsila({ ogrenciNumarasi: "2024001", kitapKodu: "JAVA-101" }). İlk if koşulu, ogrenciNumarasi veya kitapKodu eksikse 400 durum koduyla erken döner; kitaba göre bu biçim (format) doğrulamasıdır, iş kuralı değildir. İki alan da dolu olduğu için controller service’i çağırmaya devam eder.',
      labText: 'Öğrenci ya da kitap alanını boş bırakırsanız controller service’i hiç çağırmaz ve istek burada biter.',
      params: { ...TABAN, olay: kadar((o) => o.from === 'controller' && o.tur === 'not' && o.etiket.startsWith('zorunlu alanlar')) },
    },
    {
      id: 'okuma',
      title: 'Service iki repository’den okur',
      term: 'repository',
      text: 'Service önce kitapRepository.kitapBul("JAVA-101"), sonra ogrenciRepository.ogrenciBul("2024001") çağırır; iki satır tabloda etkin olur. Repository iş mantığı kararı vermez, yalnızca istenen veriyi getirir. Kodda iki okuma da kurallardan önce çalışır.',
      labText: 'Başka bir öğrenci ya da kitap seçerseniz repository aradığını bulamaz; etkin satır görünmez ve kurallar bunu hata sayar.',
      params: { ...TABAN, olay: kadar((o) => o.from === 'ogrenciRepo' && o.tur === 'donus' && o.etiket.startsWith('Öğrenci')) },
    },
    {
      id: 'kurallar',
      title: 'Service dört iş kuralını denetler',
      term: 'iş kuralı',
      text: 'Okumalar bittikten sonra service dört kuralı sırayla yoklar: kitap var mı, öğrenci var mı, kitap uygun mu (uygunMu), öğrencinin ödünç sayısı limite ulaştı mı (mevcutOduncSayisi >= 3 ise hata). Hepsi geçer; hiçbir hata fırlatılmaz.',
      labText: 'Kitabı uygun değil yapın ya da öğrencinin ödünç sayısını son değere getirin: ilgili kural geçmez ve service hata fırlatır.',
      params: { ...TABAN, olay: kadar((o) => o.from === 'service' && o.to === 'service' && o.tur === 'not') },
    },
    {
      id: 'yan-etki',
      title: 'Repository verisi değişir',
      term: 'yan etki',
      text: 'Kurallar geçince service iki yazma yapar: kitabiOduncteIsaretle("JAVA-101") kitabın uygunMu alanını true’dan false’a, oduncSayisiniArtir("2024001") öğrencinin mevcutOduncSayisi alanını 0’dan 1’e çevirir. Tablolarda değişen hücreler vurgulanır.',
      labText: 'Başlangıç verisini değiştirdiğinizde tablolardaki değişen hücreler de buna göre değişir.',
      params: { ...TABAN, olay: kadar((o) => o.from === 'ogrenciRepo' && o.tur === 'donus' && o.etiket.startsWith('mevcutOduncSayisi')) },
    },
    {
      id: 'yanit-201',
      title: 'Service mesajı döner, controller 201 ile sarar',
      term: 'yanıt nesnesi',
      text: 'Service başarı mesajını controller’a döner; controller bunu { durumKodu: 201, mesaj } nesnesine sarar ve çağıran kod console.log ile yazdırır. Terminaldeki çıktı kitabın çıktısıdır: { durumKodu: 201, mesaj: \'Java ile Programlama başarıyla ödünç verildi.\' }',
      labText: 'Yanıt oku çağıran şeride döner ve durdurma işareti orada durur. Verileri değiştirirseniz yanıt kartı ve terminal de değişir.',
      params: { ...TABAN, olay: TUMU },
    },
    {
      id: 'ikinci-istek',
      title: 'Aynı istek ikinci kez: service hata fırlatır',
      term: 'throw',
      text: 'Aynı istek yeniden gelir. Repository durumu çağrılar arasında korunur: kitap artık uygun değildir, bu yüzden service "Kitap uygun değildir." hatasını fırlatır ve hata controller’a yükselir. Kitaba göre service yalnızca anlamlı bir hata üretir; controller bu hatanın nasıl HTTP yanıtına dönüşeceğini belirler. Controller, hangi iş kuralının ihlal edildiğini bilmez; yalnızca service’in fırlattığı hatayı genel bir 400 yanıtına çevirir.',
      labText: 'Kesikli alarm oku hatanın service’ten controller’a yükselişidir. Başlangıç verisi ne olursa olsun ikinci istek başarılı olmaz: ilk istek başarılıysa kitap artık uygun değildir; başarısızsa durum değişmediği için aynı hata yinelenir.',
      params: { ...TABAN, tekrar: 2, olay: TUMU },
    },
    {
      id: 'eksik-alan',
      title: 'Eksik alan: controller erken döner',
      term: 'erken dönüş',
      text: 'kitapKodu boş gelirse ilk if devreye girer ve controller service’i hiç çağırmadan { durumKodu: 400, mesaj: \'Zorunlu alanlar eksiktir.\' } döner. Service ve iki repository şeridi soluk kalır. Kitabın alıştırmasındaki beklenen çıktı budur.',
      labText: 'Soluk şeritler hiç çalışmaz. Kitap kodunu doldurursanız istek tekrar service’e kadar iner.',
      params: { ...TABAN, kitapKodu: '', olay: TUMU },
    },
    {
      id: 'yasam-dongusu',
      title: 'Bir isteğin yaşam döngüsü',
      term: 'yaşam döngüsü',
      text: 'Tablo bilinçli olarak Kod 9.14’ün yaptığından fazlasını gösterir. "Yok" işaretli adımlar, aynı mimari Express ve PostgreSQL ile kurulduğunda devreye giren taşıma ve kalıcılık katmanlarıdır; okurken bunları kodda gerçekleşmiş saymayınız. Soluk satırlar bu adımlardır. Kodun sırası farklıdır: okumalar kurallardan önce yapılır.',
      labText: 'Tablo sabittir: Lab seçimleriniz bu özeti değiştirmez.',
      params: { ...TABAN, gorunum: 'yasam' },
    },
    {
      id: 'ozet',
      title: 'Her katmanın sınırı',
      term: 'katman izolasyon ilkesi',
      text: 'Katman İzolasyon İlkesi: Repository katmanı HTTP’den habersizdir; service katmanı hangi HTTP durum kodunun dönüleceğini bilmez; controller ise kitap tablosundaki SQL sorgusundan veya indekslerden tamamen izoledir. Tablo her bileşenin ne yapmadığını gösterir. Ayrıca test edilebilirlik sağlanır: service sınıfı veritabanına doğrudan bağlı değilse, test sırasında gerçek veritabanı yerine bellek içi bir repository kullanılabilir.',
      labText: 'Tablo sabittir: Lab seçimleriniz bu özeti değiştirmez.',
      params: { ...TABAN, gorunum: 'ozet' },
    },
  ],
};
