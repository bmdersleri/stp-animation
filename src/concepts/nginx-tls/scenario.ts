import type { Scenario } from '../../core/player';
import type { Rozet } from '../../core/plot/source-badge';
import type { NginxParams } from './proxy';

export type NginxAsama = 'tanitim' | 'ufw' | 'akis' | 'xff' | 'certbot' | 'ozet';

/** Parameters of the nginx-tls page: the stage on show plus the request, the Nginx setting and the app / certificate state. */
export interface NginxTlsParams extends NginxParams { asama: NginxAsama }

const VARSAYILAN: NginxTlsParams = {
  asama: 'akis', hedef: 'https-443', ayar: 'kod-15-5', uygulama: 'ayakta', trustProxy: 0, sahteXff: false, kalanGun: 60,
};

/** Source badge of every step, keyed by step id. */
export const NGINX_ROZET: Readonly<Record<string, Rozet>> = {
  tanitim: { tur: 'kitap', ref: 'L259, L266, L278' },
  'guvenlik-duvari': { tur: 'kitap-kodu', ref: 'L174, L215-221' },
  'proxy-80': { tur: 'kitap-kodu', ref: 'L303-307, L317-318' },
  'basliksiz-ip': { tur: 'kitaba-dayali', ref: 'L321, L351' },
  'xff-ayikla': { tur: 'kitap', ref: 'L363-364, L369' },
  'trust-proxy': { tur: 'standart', ref: 'Express; L355' },
  'yonlendirme-301': { tur: 'kitap-kodu', ref: 'L456, L477, L482' },
  'tls-sonlandirma': { tur: 'standart', ref: 'TLS, Nginx; L479' },
  certbot: { tur: 'kitaba-dayali', ref: 'L524-528, L566' },
  'bad-gateway-502': { tur: 'kitaba-dayali', ref: 'L278' },
  ozet: { tur: 'kitap', ref: 'L328-335, L489-496, L959' },
};

/** The step scenario of the nginx-tls page (Ders steps 1-11). */
export const nginxScenario: Scenario<NginxTlsParams> = {
  defaults: VARSAYILAN,
  steps: [
    {
      id: 'tanitim',
      title: 'Reverse proxy isteği uygulamanın önünde karşılar',
      term: 'reverse proxy',
      text: 'Kitaba göre reverse proxy, istemciden gelen HTTP(S) isteğini karşılayıp arkadaki uygulama sunucusuna ileten bir ara katmandır. Nginx bu işi görür; istek uygulamaya doğrudan ulaşmaz. Bu adımda yalnızca kitabın tanımı ve notları var; henüz bir istek gönderilmedi.',
      labText: 'Bu görünüm yalnızca kitabın tanımını gösterir. Bir ayarı değiştirdiğinizde Lab istek akışına geçer.',
      params: { ...VARSAYILAN, asama: 'tanitim' },
    },
    {
      id: 'guvenlik-duvari',
      title: 'UFW yalnız açılan portları geçirir',
      term: 'UFW güvenlik duvarı',
      text: 'Kod 15.2 gelen trafiği varsayılan olarak engeller ve yalnızca SSH, HTTP ve HTTPS portlarını açar. Üç istek gönderilir: 443 portundaki istek Nginx’e ulaşır. 3000 portundaki uygulama ile 5432 portundaki veritabanı isteği ise güvenlik duvarında durur ve paket düşürülür.',
      labText: 'Hedef portu seçin: UFW yalnızca açılan portları Nginx’e geçirir. Bu görünümde istek yolu ve kod şeridi güvenlik duvarını gösterir.',
      params: { ...VARSAYILAN, asama: 'ufw', hedef: 'port-5432' },
    },
    {
      id: 'proxy-80',
      title: 'Nginx isteği uygulamaya başlıklarla iletir',
      term: 'proxy_pass',
      text: 'Kod 15.3’teki 80 portu bloğu isteği proxy_pass ile yerel uygulamaya iletir ve üç başlık ekler: X-Real-IP, X-Forwarded-For ve X-Forwarded-Proto. Uygulamanın gördüğü tablo, ona gerçekte ulaşan başlıkları gösterir.',
      labText: 'Nginx ayarını ve hedefi değiştirin: uygulamaya ulaşan başlıklar tablosu yeniden hesaplanır.',
      params: { ...VARSAYILAN, hedef: 'http-80', ayar: 'kod-15-3' },
    },
    {
      id: 'basliksiz-ip',
      title: 'Başlıksız proxy’de uygulama istemciyi göremez',
      term: 'X-Real-IP',
      text: 'Nginx başlık eklemezse uygulama tüm istekleri Nginx’in kendi adresinden gelmiş gibi görür. Bağlantı IP’si hep yerel adrestir; gerçek istemci hiçbir alanda yoktur. Kitabın yanlış örneği de bağlantı IP’sini döndürür.',
      labText: 'Başlıksız ayarla uygulamanın gördüğü tabloda istemci adresi hiç görünmez; başka bir ayar seçince başlıklar belirir.',
      params: { ...VARSAYILAN, hedef: 'http-80', ayar: 'basliksiz' },
    },
    {
      id: 'xff-ayikla',
      title: 'X-Forwarded-For zincirinin ilk parçası istemcidir',
      term: 'X-Forwarded-For',
      text: 'Kitabın dogruIstemciIpAl işlevi X-Forwarded-For değerini virgülden böler ve ilk parçayı alır. İki parçalı zincirde ilk parça istemcinin adresidir; ikinci parça aradaki proxy’dir. Terminaldeki değer kitabın çıktısıdır.',
      labText: 'Bu adım kitabın tek çağrısını gösterir. Bir ayarı değiştirdiğinizde Lab istek akışına geçer.',
      params: { ...VARSAYILAN, asama: 'xff' },
    },
    {
      id: 'trust-proxy',
      title: 'X-Forwarded-For istemciden de gelebilir',
      term: 'trust proxy',
      text: 'İstemci kendi X-Forwarded-For başlığını gönderirse Nginx değerin sonuna gerçek adresi ekler. Zincirin ilk parçası artık istemcinin uydurduğu adrestir, bu yüzden dogruIstemciIpAl sahte adresi döndürür. Express trust proxy ayarı ise zincirin son ucundan, güvenilen sıçrama sayısı kadar atlar.',
      labText: 'Güvenilen sıçrama sayısını ve sahte başlığı değiştirin: kitabın işlevi ile Express’in req.ip değeri ayrışır.',
      params: { ...VARSAYILAN, hedef: 'http-80', ayar: 'kod-15-3', sahteXff: true, trustProxy: 1 },
    },
    {
      id: 'yonlendirme-301',
      title: 'HTTP bloğu isteği HTTPS’e yönlendirir',
      term: '301 yönlendirmesi',
      text: 'Kod 15.5’in ilk bloğu 80 portundaki isteğe uygulamayı göstermeden 301 ile yanıt verir. Location başlığı aynı adresin HTTPS biçimidir. İstek uygulama hattına hiç girmez; bu yüzden uygulamanın gördüğü tablo yoktur.',
      labText: 'Nginx ayarını değiştirin: yönlendirme yalnızca HTTPS’e yönlendiren ayarda olur, öteki ayarlarda istek doğrudan uygulamaya gider.',
      params: { ...VARSAYILAN, hedef: 'http-80' },
    },
    {
      id: 'tls-sonlandirma',
      title: 'Nginx TLS’i sonlandırır, uygulamaya düz HTTP gider',
      term: 'TLS sonlandırma',
      text: 'HTTPS isteğinde şifreli kanalı Nginx açar; sertifika Nginx’tedir. Uygulamaya giden bağlantı düz HTTP’dir. Nginx isteğin HTTPS olduğunu X-Forwarded-Proto başlığıyla bildirir; Host ise Nginx’in varsayılanıyla yerel adrese döner.',
      labText: 'Sertifikanın kalan süresini değiştirin: süre dolunca tarayıcı güvensiz uyarısı verir ve istek uygulamaya hiç ulaşmaz.',
      params: { ...VARSAYILAN },
    },
    {
      id: 'certbot',
      title: 'Certbot sertifikayı alır ve yeniler',
      term: 'Certbot',
      text: 'Certbot önce HTTP-01 sınamasıyla alan adının sahibi olunduğunu doğrular, sonra sertifikayı Nginx ayarına enjekte eder. Zamanlayıcı kalan süre eşiğin altına inince sertifikayı otomatik yeniler. Tablodaki değerler bu sayfanın varsayımıdır.',
      labText: 'Kalan günü değiştirin: yenileme satırı sertifikanın durumunu izler.',
      params: { ...VARSAYILAN, asama: 'certbot', kalanGun: 90 },
    },
    {
      id: 'bad-gateway-502',
      title: 'Uygulama kapalıysa Nginx 502 üretir',
      term: '502 Bad Gateway',
      text: 'Uygulama kapalıyken Nginx bağlantı kuramaz ve istemciye 502 Bad Gateway döner. Bu yanıtı uygulama değil Nginx üretir; bu yüzden uygulama kodunda aramak yanlış yerdir. İstek yolunda uygulama adımı atlanır.',
      labText: 'Uygulamayı kapatıp açın: kapalıyken Nginx’in kendi hata yanıtı döner, açıkken normal yanıt gelir.',
      params: { ...VARSAYILAN, uygulama: 'kapali' },
    },
    {
      id: 'ozet',
      title: 'Özet: seçenekler ve sınav notu',
      term: 'Nginx ve TLS özeti',
      text: 'Kitap iki karşılaştırma tablosu verir: trafiği karşılama yaklaşımları ve sertifika seçenekleri. Sınav notu Nginx, HTTPS, ortam değişkenleri ve sağlık denetimini tek cümlede birleştirir.',
      labText: 'Tablolar ve not kitabın özetidir. Bir ayarı değiştirdiğinizde Lab istek akışına geçer.',
      params: { ...VARSAYILAN, asama: 'ozet' },
    },
  ],
};
