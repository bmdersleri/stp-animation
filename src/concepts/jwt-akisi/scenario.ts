import type { Scenario } from '../../core/player';
import type { Rozet } from '../../core/plot/source-badge';
import type { Bozulma } from './jwt';

export type JwtAsama = 'tanitim' | 'header' | 'payload' | 'okunur' | 'imza' | 'dogrula' | 'akis';

/** Parameters of the jwt-akisi page: whose token, how it is tampered with, minutes since issue and which stage is on screen. */
export interface JwtParams {
  kullanici: 'elif' | 'yasemin';
  bozulma: Bozulma;
  dakika: number;
  asama: JwtAsama;
}

const VARSAYILAN: JwtParams = { kullanici: 'elif', bozulma: 'yok', dakika: 0, asama: 'dogrula' };

/** Source badge of every step, keyed by step id. */
export const JWT_ROZET: Readonly<Record<string, Rozet>> = {
  tanitim: { tur: 'kitap', ref: 'L382' },
  header: { tur: 'kitap-kodu', ref: 'L446' },
  payload: { tur: 'kitap-kodu', ref: 'L447' },
  okunur: { tur: 'kitap', ref: 'L544, L575' },
  imza: { tur: 'kitap-kodu', ref: 'L441-448' },
  dogrula: { tur: 'kitap-kodu', ref: 'L512' },
  'bozuk-imza': { tur: 'kitap-kodu', ref: 'L513' },
  'rol-degisti': { tur: 'kitaba-dayali', ref: 'L528' },
  'sure-alani': { tur: 'kitap-kodu', ref: 'L514' },
  'fazla-segment': { tur: 'kitap-kodu', ref: 'L515' },
  akis: { tur: 'kitaba-dayali', ref: 'L385, L399, L401' },
};

/** The step scenario of the jwt-akisi page (Ders steps 1-11). */
export const jwtScenario: Scenario<JwtParams> = {
  defaults: VARSAYILAN,
  steps: [
    {
      id: 'tanitim',
      title: 'JWT üç bölümdür',
      term: 'JWT',
      text: 'Kitaba göre JWT, noktayla ayrılmış üç bölümden oluşur: header, payload ve imza. Header token türünü ve imza algoritmasını, payload kullanıcıya ait bilgileri taşır; imza ise ilk iki bölümün değiştirilmediğini gösterir. Bu adımda henüz bir token üretilmedi.',
      labText: 'Bu görünüm yalnızca tanımı gösterir. Kullanıcıyı ya da bozulmayı değiştirdiğinizde Lab doğrulama görünümüne geçer ve token şeridi hemen dolar.',
      params: { ...VARSAYILAN, asama: 'tanitim' },
    },
    {
      id: 'header',
      title: 'Header: algoritma ve tür',
      term: 'header',
      text: 'tokenUret ilk olarak base64UrlKodla({ alg: "HS256", tip: "JWT" }) çağırır. Çıkan base64url metni token şeridinin ilk parçasıdır; alttaki kutu aynı metnin geri çözülmüş JSON halini gösterir. Kod şeridi bu satırda durur.',
      labText: 'Header kullanıcıdan bağımsızdır: kullanıcıyı değiştirseniz de bu parça aynı kalır.',
      params: { ...VARSAYILAN, asama: 'header' },
    },
    {
      id: 'payload',
      title: 'Payload: kullanıcı bilgisi ve süre',
      term: 'payload',
      text: 'İkinci parça payload’dır: kullaniciAdi "elif", rol "ogrenci" ve sonGecerlilik alanı. Nesne aynı base64UrlKodla ile kodlanır ve şeride govde olarak eklenir. sonGecerlilik, token verildiği andan on beş dakika sonrasıdır.',
      labText: 'Kullanıcıyı değiştirin: govde parçası ve çözülmüş payload kutusu o kullanıcının rolüne göre yeniden kurulur.',
      params: { ...VARSAYILAN, asama: 'payload' },
    },
    {
      id: 'okunur',
      title: 'Payload şifreli değil, okunur',
      term: 'base64url',
      text: 'JWT’nin payload’ı şifrelenmemiştir, yalnızca imzalanmıştır; herkes base64url çözerek içeriğini okuyabilir. Kitabın yanlış örneği payload’a parola koyar ve çözülen metin terminalde parolayı açıkça gösterir. Bu yüzden payload’a parola gibi hassas bilgi konmaz.',
      labText: 'Bu görünüm kitabın yanlış örneğidir. Bir seçimi değiştirdiğinizde Lab doğrulama görünümüne geçer ve seçtiğiniz token’ı denetler.',
      params: { ...VARSAYILAN, asama: 'okunur' },
    },
    {
      id: 'imza',
      title: 'İmza: HMAC-SHA256',
      term: 'HMAC',
      text: 'imzaOlustur, "header.govde" metnini gizli anahtarla HMAC-SHA256 üzerinden geçirir ve sonucu base64url olarak üretir. Bu üçüncü parça token’ı tamamlar. Gizli anahtar yalnızca sunucudadır; anahtarı bilmeyen biri geçerli imza üretemez.',
      labText: 'Kullanıcıyı değiştirdiğinizde govde değişir, dolayısıyla imza da baştan hesaplanır.',
      params: { ...VARSAYILAN, asama: 'imza' },
    },
    {
      id: 'dogrula',
      title: 'Doğrulama: dört denetim geçer',
      term: 'tokenDogrula',
      text: 'tokenDogrula önce biçimi, sonra imzayı, sonra süre alanını ve en sonda süreyi denetler. Üretilen token hiç değiştirilmediği için hepsi geçer; gelen imza beklenen imzayla aynıdır ve terminalde payload yazılır. Bu satır kitabın ilk çıktı satırıdır.',
      labText: 'Denetim listesi seçtiğiniz kullanıcı, bozulma ve geçen süreye göre yeniden çalışır. Süre denetimi kayan dakikaya bakar.',
      params: { ...VARSAYILAN },
    },
    {
      id: 'bozuk-imza',
      title: 'İmzaya bozuk eklenirse',
      term: 'imza denetimi',
      text: 'Token’ın sonuna "bozuk" eklenince biçim denetimi yine geçer, çünkü hâlâ üç parça vardır. İmza denetimi ise gelen imzayı yeniden hesaplanan imzayla karşılaştırır ve eşleşmediğini görür. Sonraki denetimler denenmez; terminale kitabın ikinci satırı da eklenir.',
      labText: 'Gelen ve beklenen imza şeritleri farklı karakterleri vurgular. Bozulmayı “yok” yaparsanız fark kaybolur.',
      params: { ...VARSAYILAN, bozulma: 'imza-bozuk' },
    },
    {
      id: 'rol-degisti',
      title: 'Rolü değiştirmek imzayı bozar',
      term: 'bütünlük',
      text: 'Saldırgan payload’daki rolü "kutuphaneci" yapar ama eski imzayı bırakır. Sunucu govde üzerinden beklenen imzayı yeniden hesaplar; sonuç değişir, gelen imza değişmez ve 401: Token imzası geçersiz. döner. Kitap bu noktada imza denetiminin süre denetiminden önce gelmesini bir dikkat notu olarak vurgular.',
      labText: 'Rol değişince beklenen imza değişir, gelen imza aynı kalır. Şeritlerdeki vurgular bu farkı gösterir.',
      params: { ...VARSAYILAN, bozulma: 'rol-degisti' },
    },
    {
      id: 'sure-alani',
      title: 'Süre alanı eksik payload',
      term: 'sonGecerlilik',
      text: 'Kitaptaki üçüncü deneme, sonGecerlilik alanı olmayan bir payload ile token üretir; ağdan gelen veri derleyici denetimini atlayabilir. İmza doğrudur, çünkü token sunucunun anahtarıyla imzalanmıştır. Süre alanı denetimi kalır ve terminale kitabın üçüncü satırı da eklenir.',
      labText: 'İmza denetimi geçer, süre alanı denetimi kalır; süre denetimi denenmez.',
      params: { ...VARSAYILAN, bozulma: 'sure-alani-yok' },
    },
    {
      id: 'fazla-segment',
      title: 'Fazladan segment',
      term: 'biçim denetimi',
      text: 'Token’ın sonuna ".fazladan" eklenince parça sayısı dörde çıkar ve üç parçalı yapı bozulur. İlk denetim olan biçim denetimi kalır; imza ve sonraki denetimler hiç denenmez. Terminale kitabın son çıktı satırı da eklenir.',
      labText: 'Dördüncü parça şeritte ayrı bir tonla görünür. İlk denetim kalınca diğerleri denenmedi olur.',
      params: { ...VARSAYILAN, bozulma: 'fazla-segment' },
    },
    {
      id: 'akis',
      title: 'İstemci ve sunucu akışı',
      term: 'durumsuz kimlik doğrulama',
      text: 'Diyagram kitaptaki Şekil 10.3’ün sadeleştirilmiş özetidir; mesaj adları sayfaya aittir. İstemci giriş yapar, sunucu token verir, istemci korumalı isteğe token’ı ekler, sunucu imzayı ve süreyi denetler ve yanıt verir. Sunucu oturum tutmaz; bunun bedeli, verilmiş bir token’ı süresi dolmadan iptal etmenin zor olmasıdır. Süresi dolmuş token Kod 10.3’te 401 ile reddedilir.',
      labText: 'Bu görünüm bir özet diyagramdır. Bir seçimi değiştirdiğinizde Lab doğrulama görünümüne geçer ve seçtiğiniz token’ı denetler.',
      params: { ...VARSAYILAN, asama: 'akis' },
    },
  ],
};
