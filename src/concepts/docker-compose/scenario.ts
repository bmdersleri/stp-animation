import type { Scenario } from '../../core/player';
import type { Rozet } from '../../core/plot/source-badge';

export type ComposeAsama = 'tanitim' | 'image' | 'cok-asamali' | 'volume-yok' | 'volume-var' | 'ag'
  | 'localhost' | 'compose' | 'kod-14-9' | 'ozet';

/** Parameters of the docker-compose page: the stage on show, the start mode and the database / retry settings. */
export interface ComposeParams {
  asama: ComposeAsama;
  mod: 'sira' | 'saglikli';
  dbHazirMs: number;
  retries: number;
  maksimumDeneme: number;
  hostAdi: 'kutuphane-db' | 'localhost';
}

const VARSAYILAN: ComposeParams = { asama: 'compose', mod: 'saglikli', dbHazirMs: 4000, retries: 10, maksimumDeneme: 5, hostAdi: 'kutuphane-db' };

/** Source badge of every step, keyed by step id. */
export const COMPOSE_ROZET: Readonly<Record<string, Rozet>> = {
  tanitim: { tur: 'kitap', ref: 'L564, L1014' },
  'image-container': { tur: 'kitap', ref: 'L351, L395-396' },
  'cok-asamali': { tur: 'kitap', ref: 'L293-334' },
  'volume-yok': { tur: 'kitaba-dayali', ref: 'L468, L550' },
  'volume-var': { tur: 'kitaba-dayali', ref: 'L523, L720' },
  'ag-dns': { tur: 'kitaba-dayali', ref: 'L516-517, L520' },
  'localhost-hatasi': { tur: 'kitap', ref: 'L868-870, L886' },
  'depends-on-sira': { tur: 'kitaba-dayali', ref: 'L567, L612, L892' },
  'healthcheck-bekle': { tur: 'standart', ref: 'Compose; L657, L683' },
  'yeniden-deneme': { tur: 'kitap-kodu', ref: 'L986, L990, L1002' },
  ozet: { tur: 'kitap', ref: 'L67-77, L683' },
};

/** The step scenario of the docker-compose page (Ders steps 1-11). */
export const composeScenario: Scenario<ComposeParams> = {
  defaults: VARSAYILAN,
  steps: [
    {
      id: 'tanitim',
      title: 'Docker Compose çok servisi tek dosyada toplar',
      term: 'Docker Compose',
      text: 'Kitaba göre Docker Compose, birden fazla container’ı aralarındaki volume ve network ilişkileriyle tek bir YAML dosyasında tanımlar ve tek komutla birlikte çalıştırır. Bu adımda yalnızca tanım ve kitabın sınav notu var; henüz bir container çalışmıyor.',
      labText: 'Bu görünüm yalnızca kitabın tanımını gösterir. Bir ayarı değiştirdiğinizde Lab başlatma akışına geçer ve Compose çalışır.',
      params: { ...VARSAYILAN, asama: 'tanitim' },
    },
    {
      id: 'image-container',
      title: 'Aynı image’dan birden çok container çıkar',
      term: 'image ve container',
      text: 'Image salt okunur bir taslaktır; container o taslaktan üretilen çalışan örnektir. Aynı kutuphane-api image’ından iki container, iki farklı ana makine portuyla çalışır. İkisi de container içinde aynı porta bağlanır. Tablo kitabın docker ps çıktısıdır.',
      labText: 'Bu adım image ile container ayrımını gösterir; Lab denetimleri başlatma akışını etkiler.',
      params: { ...VARSAYILAN, asama: 'image' },
    },
    {
      id: 'cok-asamali',
      title: 'Çok aşamalı Dockerfile derleme ile çalışmayı ayırır',
      term: 'çok aşamalı derleme',
      text: 'Kod 14.3 iki aşamadan oluşur. Derleme aşaması bağımlılıkları kurar, kaynağı derler ve yalnızca üretim bağımlılıklarını bırakır. Çalışma aşaması yalnızca derleme çıktısını ve üretim bağımlılıklarını alır; sonuçta imaj küçük kalır. Tablodaki hücreler kitabın yorum satırlarıdır.',
      labText: 'Bu adım Dockerfile aşamalarını gösterir; Lab denetimleri başlatma akışını etkiler.',
      params: { ...VARSAYILAN, asama: 'cok-asamali' },
    },
    {
      id: 'volume-yok',
      title: 'Volume yoksa container silinince veri gider',
      term: 'volume',
      text: 'Volume olmadan çalışan veritabanının verisi container’ın kendi yazılabilir katmanındadır. Container silindiğinde veri de silinir. Kod şeridi kitabın yanlış örneğindeki silme satırında durur; kaynak tablosunda iki kaynak da silinmiş görünür.',
      labText: 'Bu adım kalıcılığın yokluğunu gösterir; Lab denetimleri başlatma akışını etkiler.',
      params: { ...VARSAYILAN, asama: 'volume-yok' },
    },
    {
      id: 'volume-var',
      title: 'Volume veriyi container’ın ötesinde tutar',
      term: 'kalıcı volume',
      text: 'Veritabanı bir isimli volume ile çalıştırılınca veri ana makinede durur. Container silinse bile volume yerinde kalır ve yeni container aynı veriyi görür. Volume’u silmek ayrı bir komuttur: down -v verileri de siler.',
      labText: 'Bu adım kalıcılığın varlığını gösterir; Lab denetimleri başlatma akışını etkiler.',
      params: { ...VARSAYILAN, asama: 'volume-var' },
    },
    {
      id: 'ag-dns',
      title: 'Aynı network’teki container servis adıyla bulunur',
      term: 'network ve DNS',
      text: 'Kullanıcı tanımlı bir network’te container’lar birbirini servis adıyla bulur. API, veritabanına kutuphane-db adıyla ulaşır; ad, veritabanı container’ına çözülür. Ekranda bir IP adresi yok, çünkü uygulama adı kullanır, adresi değil.',
      labText: 'Bu adım ad çözümlemeyi gösterir; Lab denetimleri başlatma akışını etkiler.',
      params: { ...VARSAYILAN, asama: 'ag' },
    },
    {
      id: 'localhost-hatasi',
      title: 'localhost API’nin kendi container’ıdır',
      term: 'localhost hatası',
      text: 'API kendi container’ında çalışır, bu yüzden localhost kendi container’ını işaret eder; veritabanı container’ını değil. Kitabın yanlış örneği host olarak localhost yazar ve bağlantı reddedilir. Doğru host servis adıdır.',
      labText: 'Lab’da sunucu adını localhost yaparsanız aynı hata her denemede yinelenir.',
      params: { ...VARSAYILAN, asama: 'localhost' },
    },
    {
      id: 'depends-on-sira',
      title: 'depends_on yalnızca başlatma sırasını belirler',
      term: 'depends_on',
      text: 'depends_on, API container’ının veritabanından sonra başlamasını sağlar ama veritabanının bağlantı almaya hazır olmasını beklemez. Veritabanı container’ı başlar başlamaz API de başlar, ilk bağlantı reddedilir. Servis tablosunda veritabanı hâlâ starting durumundadır.',
      labText: 'Veritabanının hazır olma süresini uzatın ya da kısaltın: sıra modunda API yine hemen başlar.',
      params: { ...VARSAYILAN, mod: 'sira', maksimumDeneme: 1 },
    },
    {
      id: 'healthcheck-bekle',
      title: 'service_healthy API’yi sağlıklı veritabanına kadar bekletir',
      term: 'healthcheck',
      text: 'healthcheck, Compose’un veritabanına belli aralıkla pg_isready sorduğu bir denetimdir. Veritabanı hazır olana kadar prob başarısız olur. İlk başarılı probdan sonra veritabanı healthy sayılır ve ancak o zaman API başlatılır. Bu davranış kitabın kodunda yok; Compose’un standart çalışmasıdır.',
      labText: 'Veritabanının hazır olma süresini ve deneme hakkını değiştirin: prob listesi yeniden hesaplanır, yeterince uzun beklemede veritabanı unhealthy olur.',
      params: { ...VARSAYILAN },
    },
    {
      id: 'yeniden-deneme',
      title: 'Uygulama tarafındaki yeniden deneme hâlâ gerekir',
      term: 'yeniden deneme',
      text: 'Kod 14.9’daki saglikliBaglantiKur bağlantıyı belli sayıda dener ve denemeler arasında bekler. Veritabanı geç hazır olursa ilk denemeler başarısız olur, üçüncüsü kurulur ve kitabın çıktısı yazılır. depends_on başlamayı garanti eder, hazır olmayı değil; bu yüzden bu mantık gereklidir.',
      labText: 'Deneme hakkını ve veritabanının hazır olma süresini oynatın: yeterince az hakta bağlantı hiç kurulamaz.',
      params: { ...VARSAYILAN, asama: 'kod-14-9', mod: 'sira', dbHazirMs: 1000 },
    },
    {
      id: 'ozet',
      title: 'Özet: kavramların sorumluluk sınırları',
      term: 'Compose özeti',
      text: 'Kitabın sorumluluk matrisi her kavramın ne yaptığını ve ne yapmadığını yan yana koyar. Compose servisleri tek dosyada toplar; healthcheck ile bekletse bile, ağ kesintisi gibi çalışma zamanı sorunları için uygulamadaki yeniden deneme savunma katmanı olarak kalır.',
      labText: 'Tablo ve not kitabın özetidir. Bir ayarı değiştirdiğinizde Lab başlatma akışına geçer.',
      params: { ...VARSAYILAN, asama: 'ozet' },
    },
  ],
};
