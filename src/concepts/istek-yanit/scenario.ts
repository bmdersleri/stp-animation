import type { Scenario } from '../../core/player';
import { notSorgula } from './flow';

/**
 * Parameters of the istek-yanit page: the request (`yol`, `yetkiliMi`), how many trace events are shown
 * (`olay`, 0 = none), and whether the page shows the flow or the three-call summary.
 */
export interface IstekParams { yol: string; yetkiliMi: boolean; olay: number; gorunum: 'akis' | 'ozet' }

const VARSAYILAN = { yol: '/api/notlar/2026001', yetkiliMi: true } as const;
const IZ = notSorgula(VARSAYILAN.yol, true);

/** Events shown once the first event matching `bul` has played (index + 1), looked up in the default trace. */
function kadar(bul: (o: (typeof IZ.olaylar)[number]) => boolean): number {
  const i = IZ.olaylar.findIndex(bul);
  if (i < 0) throw new Error('istek-yanit: trace has no such event');
  return i + 1;
}

const TUMU = (yol: string, yetkiliMi: boolean): number => notSorgula(yol, yetkiliMi).olaylar.length;

/** The step scenario of the istek-yanit page (Ders steps 1-10). */
export const istekScenario: Scenario<IstekParams> = {
  defaults: { ...VARSAYILAN, olay: 0, gorunum: 'akis' },
  steps: [
    {
      id: 'tanitim',
      title: 'Dört katman, bir istek',
      term: 'istemci-sunucu',
      text: 'İstemci-sunucu modelinde istemci isteği başlatır, sunucu yanıtı üretir. Kitabın mini uygulamasında bu iş dört sınıfa bölünmüştür: TarayiciIstemcisi, TersVekil, NotApi ve NotBackendServisi. Her katmanın tek bir sorumluluğu vardır.',
      labText: 'Dört katman yan yana duruyor; henüz hiçbir istek gönderilmedi. İstek yolunu ve yetki durumunu seçip akışın nerede durduğuna bakın.',
      params: { olay: 0, gorunum: 'akis' },
    },
    {
      id: 'istek',
      title: 'İstemci isteği gönderir',
      term: 'istek',
      text: 'TarayiciIstemcisi bir istek nesnesi kurar: yol, kullanıcı adı ve yetki bilgisi. İsteği doğrudan API\'ye değil, ters vekile yollar; istemci arkadaki yapıyı bilmez.',
      labText: 'İstek kartı, seçtiğiniz yolu ve yetki durumunu gösterir. Ok, isteğin ters vekile gittiğini işaret eder.',
      params: { olay: 1 },
    },
    {
      id: 'kimlik',
      title: 'Kimlik denetimi önce gelir',
      term: 'kimlik doğrulama',
      text: 'Ters vekil önce isteğin yetkili olup olmadığına bakar. Kimlik doğrulama, yönlendirmeden önce yapılır: sıralama değişse, yetkisiz bir istek yanlışlıkla bir backend servisine ulaşabilirdi. Yetkisizse akış burada biter ve 401 döner.',
      labText: 'Yetkiyi kapatırsanız akış bu denetimde durur ve yol ne olursa olsun yanıt yetkisiz olur.',
      params: { olay: kadar((o) => o.kind === 'note' && o.label === 'Kimlik denetimi') },
    },
    {
      id: 'yol',
      title: 'Yol denetimi ve yönlendirme',
      term: 'reverse proxy',
      text: 'Kimlik geçtikten sonra ters vekil yolun /api/notlar/ ile başlayıp başlamadığına bakar. Başlıyorsa isteği NotApi\'ye iletir; başlamıyorsa uygun yol bulunamadığı için 404 döner. Reverse proxy, istemci ile iç servisler arasında duran bu kapıdır.',
      labText: 'Yolu başka bir uç noktaya çevirirseniz akış ters vekilde durur; API ve backend hiç çalışmaz.',
      params: { olay: kadar((o) => o.kind === 'request' && o.to === 'notApi') },
    },
    {
      id: 'ayristir',
      title: 'API yolu ayrıştırır',
      term: 'uç nokta',
      text: 'NotApi, yolu / karakterine göre parçalar ve öğrenci numarasını dördüncü parçadan okur. Numara boşsa istek geçersizdir ve 400 döner. Bu uç nokta, yolun son parçasını girdi olarak alır.',
      labText: 'Yol sonundaki numarayı silerseniz API numarayı boş bulur ve akış API katmanında durur.',
      params: { olay: kadar((o) => o.kind === 'note' && o.from === 'notApi') },
    },
    {
      id: 'veri',
      title: 'Backend iş kuralını uygular',
      term: 'iş kuralı',
      text: 'NotBackendServisi not tablosuna bakar. Kayıt varsa notu döndürür, yoksa kayıt bulunamadı yanıtı üretir. Veri ve karar burada durur; üst katmanlar bu kuralı bilmez.',
      labText: 'Tabloda olmayan bir numara seçerseniz backend notu bulamaz ve akış bu serviste durur.',
      params: { olay: kadar((o) => o.kind === 'note' && o.from === 'backend') },
    },
    {
      id: 'yanit-200',
      title: 'Yanıt geri döner: 200',
      term: 'HTTP durum kodu',
      text: 'Yanıt aynı yoldan, ters yönde geri gelir. Başarılı sorguda durum kodu 200 olur ve istemci "[200] 2026001 numaralı öğrencinin notu: 88" satırını yazdırır.',
      labText: 'Başarılı akışta yanıt üç katmandan geri geçer ve terminalde tek satır oluşur. Seçimlerinizi değiştirip satırın nasıl değiştiğine bakın.',
      params: { olay: TUMU(VARSAYILAN.yol, true) },
    },
    {
      id: 'yanit-401',
      title: 'Yetkisiz istek: 401',
      term: '401',
      text: 'Aynı yol, ama yetkisiz kullanıcı: ters vekil isteği ilk denetimde reddeder ve 401 döner. NotApi ile backend hiç çalışmaz; soluk görünmeleri bu yüzdendir.',
      labText: 'Yetkisiz akışta durdurma işareti ters vekilde görünür ve arkadaki iki katman soluk kalır.',
      params: { yetkiliMi: false, olay: TUMU(VARSAYILAN.yol, false) },
    },
    {
      id: 'yanit-404',
      title: 'Kayıt yok: 404',
      term: '404',
      text: 'Yetkili istek, ama numara tabloda yok: istek backend\'e kadar gider, backend kaydı bulamaz ve 404 üretir. Yanıt kodu, hatanın hangi katmanda doğduğunu da anlatır.',
      labText: 'Bu akış tüm katmanları dolaşır ve en arkada durur; durdurma işareti backend servisinde görünür.',
      params: { yetkiliMi: true, yol: '/api/notlar/2026999', olay: TUMU('/api/notlar/2026999', true) },
    },
    {
      id: 'ozet',
      title: 'Üç çağrı, üç sonuç',
      term: 'API sözleşmesi',
      text: 'Kitabın üç çağrısı yan yana: yetkili ve kayıtlı numara 200, yetkisiz istek 401, kayıtsız numara 404 verir. Bu sonuçlar API sözleşmesinin parçasıdır: istemci, hangi durumda hangi kodun döneceğini bilir. Hata kodu, isteği durduran katmanda üretilir.',
      labText: 'Tablo, kitabın üç çağrısını sabit olarak gösterir; Lab seçimleriniz bu özeti değiştirmez.',
      params: { gorunum: 'ozet' },
    },
  ],
};
