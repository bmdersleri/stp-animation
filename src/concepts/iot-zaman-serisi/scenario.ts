import type { Scenario } from '../../core/player';
import type { Rozet } from '../../core/plot/source-badge';

export type IotAsama = 'tanitim' | 'dogrulamasiz' | 'imza' | 'hmac' | 'istek' | 'aralik' | 'tampon' | 'ozet';
/** `saglam`: the signature covers the body that is sent; `degismis`: one digit changed on the way; `bilinmeyen`: unregistered device. */
export type GovdeSecimi = 'saglam' | 'degismis' | 'bilinmeyen';

/** Parameters of the iot-zaman-serisi page: the stage on show plus the one Lab request. */
export interface IotParams {
  asama: IotAsama;
  /** Device clock minus the server clock, in seconds (negative: the device is behind). */
  saatFarki: number;
  sicaklik: number;
  nem: number;
  govde: GovdeSecimi;
  /** The same packet is processed a second time 20 s later. */
  tekrar: boolean;
}

const VARSAYILAN: IotParams = { asama: 'istek', saatFarki: 0, sicaklik: 21.5, nem: 45.2, govde: 'saglam', tekrar: false };

/** Source badge of every step, keyed by step id. */
export const IOT_ROZET: Readonly<Record<string, Rozet>> = {
  tanitim: { tur: 'kitap', ref: 'L81, L84' },
  dogrulamasiz: { tur: 'kitaba-dayali', ref: 'L203, L572' },
  'imza-uret': { tur: 'kitap-kodu', ref: 'L360, L409-411' },
  'zaman-penceresi': { tur: 'kitap-kodu', ref: 'L399-401' },
  'imza-dogrula': { tur: 'kitap-kodu', ref: 'L404-423' },
  'govde-degisti': { tur: 'kitap-kodu', ref: 'L420, L434' },
  'pencere-ici-tekrar': { tur: 'kitaba-dayali', ref: 'L398, L433, L770' },
  'aralik-dogrulama': { tur: 'kitap', ref: 'L544-546' },
  'sunucu-zamani-kayit': { tur: 'kitap-kodu', ref: 'L521, L554, L558' },
  'tampon-saatlik': { tur: 'kitap-kodu', ref: 'L716-734, L740-749, L761' },
  ozet: { tur: 'kitap', ref: 'L448, L462, L565-572, L998' },
};

/** The step scenario of the iot-zaman-serisi page (Ders steps 1-11). */
export const iotScenario: Scenario<IotParams> = {
  defaults: VARSAYILAN,
  steps: [
    {
      id: 'tanitim',
      title: 'IoT backend sensör verisine kendiliğinden güvenmez',
      term: 'IoT backend',
      text: 'Kitaba göre IoT backend, fiziksel cihazlardan gelen veriyi karşılayan, doğrulayan, kimliklendiren ve çoğunlukla zaman serisi olarak saklayan bir uygulamadır. Bu adımda yalnızca kitabın tanımı ve notu var; henüz bir ölçüm gönderilmedi.',
      labText: 'Bu görünüm yalnızca kitabın tanımını gösterir. Bir ayarı değiştirdiğinizde Lab tek bir ölçüm isteğine geçer.',
      params: { ...VARSAYILAN, asama: 'tanitim' },
    },
    {
      id: 'dogrulamasiz',
      title: 'Doğrulamasız backend bozuk değeri de kabul eder',
      term: 'doğrulamasız telemetri',
      text: 'Kitabın yanlış örneği gelen sıcaklığı hiç denetlemeden kaydeder: -999 gibi fiziksel olarak anlamsız bir değer de kabul edilir. Grafikte bu nokta 10:00’a eklenir ve eksen tek bir bozuk değere göre genişlediği için gerçek seri düzleşir.',
      labText: 'Bu görünüm kitabın yanlış örneğini gösterir. Bir ayarı değiştirdiğinizde Lab doğrulamalı akışa geçer.',
      params: { ...VARSAYILAN, asama: 'dogrulamasiz', sicaklik: -999 },
    },
    {
      id: 'imza-uret',
      title: 'Cihaz zaman damgasını ve gövdeyi HMAC ile imzalar',
      term: 'HMAC-SHA256 imzası',
      text: 'Cihaz zaman damgasıyla gövdeyi “zamanDamgasi.govde” biçiminde birleştirir ve paylaşılan gizli anahtarla HMAC-SHA256 imzalar. İmza 64 onaltılık karakterdir. Başlıkla yalnızca imza ve zaman damgası gider; gizli anahtar ağa çıkmaz, bu yüzden tabloda anahtar yoktur.',
      labText: 'Zaman damgasını, sıcaklığı ya da nemi değiştirin: imza her seferinde yeniden hesaplanır.',
      params: { ...VARSAYILAN, asama: 'imza' },
    },
    {
      id: 'zaman-penceresi',
      title: 'Zaman penceresi eski paketi daha başında reddeder',
      term: 'zaman penceresi',
      text: 'Cihazın saati 61 saniye geride: zaman damgası sunucu saatinden 61 saniye eski. Kod 16.3’ün ilk denetimi farkın 60 saniyeyi aşıp aşmadığına bakar. Fark sınırı aşıyor, istek reddedilir ve cihaz ile imza denetimlerine hiç geçilmez.',
      labText: 'Saat farkını değiştirin: fark sınırın içinde kalınca pencere geçer ve sıradaki denetimler çalışır; sınırı aşınca istek pencerede kalır.',
      params: { ...VARSAYILAN, saatFarki: -61 },
    },
    {
      id: 'imza-dogrula',
      title: 'Sunucu imzayı yeniden hesaplayıp karşılaştırır',
      term: 'sabit zamanlı karşılaştırma',
      text: 'Sunucu aynı imzayı kendi anahtarıyla yeniden hesaplar ve gelenle sabit zamanlı karşılaştırır. İmza doğruysa pencere, cihaz UUID ve HMAC denetimleri geçer; sıcaklık ve nem denetimleri henüz çalışmadı.',
      labText: 'Bir ayarı değiştirdiğinizde Lab tek bir ölçüm isteğine geçer ve tüm denetimler çalışır.',
      params: { ...VARSAYILAN, asama: 'hmac' },
    },
    {
      id: 'govde-degisti',
      title: 'Gövde değişirse imza tutmaz',
      term: 'veri bütünlüğü',
      text: 'Yolda sıcaklık 21,5’ten 31,5’e çıkarılır ama imza özgün gövdeyle hesaplanmıştır. Sunucu gelen gövdeden başka bir imza hesaplar. İki imza farklı olduğu için HMAC denetimi kalır ve veri yolda değiştirilmiş olabilir uyarısı yazılır.',
      labText: 'Gövde seçimini değiştirin: bir hanesi oynanmış gövdede gelen ve beklenen imza ayrışır; bozulmamış gövdede aynı kalır.',
      params: { ...VARSAYILAN, govde: 'degismis' },
    },
    {
      id: 'pencere-ici-tekrar',
      title: 'Pencere içindeki tekrar yakalanmaz',
      term: 'replay saldırısı',
      text: 'Aynı imzalı paket 20 saniye sonra yeniden gelir. Zaman damgası hâlâ pencerenin içinde, imza da doğru; sunucu paketi ikinci kez kabul eder ve grafikte iki nokta oluşur. Kitap pencerenin tek başına replay koruması olmadığını söyler; gerçek tek-kullanımlılık için nonce gerekir.',
      labText: 'Tekrar seçeneğini açıp kapatın: açıkken aynı paket ikinci kez işlenir ve kayıt sayısı artar.',
      params: { ...VARSAYILAN, tekrar: true },
    },
    {
      id: 'aralik-dogrulama',
      title: 'Aralık doğrulaması fiziksel sınırları denetler',
      term: 'aralık doğrulaması',
      text: 'Kod 16.4’ün iki çağrısı kitaptaki gibi çalışır: geçerli ölçüm kaydedilir, -999 sıcaklık aralık dışı olduğu için reddedilir. Bu adımda imza ve grafik yoktur; yalnız aralık denetimi vardır. Sıcaklık -40 ile 85, nem 0 ile 100 arasında beklenir.',
      labText: 'Sıcaklığı ve nemi değiştirin: her biri kendi aralığına göre ayrı denetlenir; ikisi de dışındaysa iki hata birlikte yazılır.',
      params: { ...VARSAYILAN, asama: 'aralik' },
    },
    {
      id: 'sunucu-zamani-kayit',
      title: 'Kayıt zamanı sunucunun saatidir',
      term: 'sunucu zaman damgası',
      text: 'Cihazın saati 45 saniye geride ama bu pencerenin içinde. Kayıt cihazın bildirdiği zamanla değil, sunucunun kayıt anındaki saatiyle damgalanır; bu yüzden sunucuZamanDamgasi 10:00:00 olur.',
      labText: 'Saat farkını değiştirin: kayıt zamanı cihazın saatine bağlı değildir, her zaman sunucunun kayıt anıdır.',
      params: { ...VARSAYILAN, saatFarki: -45 },
    },
    {
      id: 'tampon-saatlik',
      title: 'Tampon toplu yazar, saatlik özet yazılanı özetler',
      term: 'toplu yazma ve saatlik özet',
      text: 'Sabit seri sırayla tampona eklenir. Tampon 100 kayda ulaşınca topluca yazılır; geri kalan 20 kayıt tamponda bekler. Saatlik özet yalnız yazılmış satırlardan hesaplanır, bu yüzden 09:00 satırı 20 örnek gösterir.',
      labText: 'Bu görünüm sabit seriyi kullanır. Bir ayarı değiştirdiğinizde Lab tek bir ölçüm isteğine geçer.',
      params: { ...VARSAYILAN, asama: 'tampon' },
    },
    {
      id: 'ozet',
      title: 'Özet: seçenekler ve sınav notu',
      term: 'IoT backend özeti',
      text: 'Kitap zaman serisi saklama seçeneklerini bir tabloda karşılaştırır ve sınav notunu verir. Reddedilen ölçümlerin cihaz kimliğiyle günlüğe yazılması gerektiğini de vurgular.',
      labText: 'Tablo ve notlar kitabın özetidir. Bir ayarı değiştirdiğinizde Lab tek bir ölçüm isteğine geçer.',
      params: { ...VARSAYILAN, asama: 'ozet' },
    },
  ],
};
