import type { Scenario } from '../../core/player';
import type { Rozet } from '../../core/plot/source-badge';
import type { ProgramId } from './api';
import type { IstekId } from './rota';

/**
 * Parameters of the rest-crud page: the book program, the requests sent before the Lab one (`onceki`), the Lab request
 * (`istek`) sent `tekrar` times, which send the scene shows (`gonderim`, 1-based) and the view (intro, flow, summary).
 */
export interface RestParams {
  program: ProgramId;
  onceki: readonly IstekId[];
  istek: IstekId;
  tekrar: 1 | 2 | 3;
  gonderim: number;
  gorunum: 'tanitim' | 'akis' | 'ozet';
}

/** Larger than any send count: `gonderim` is clamped to the number of sends. */
export const TUMU = 999;

const VARSAYILAN: RestParams = {
  program: 'laboratuvar-api',
  onceki: [],
  istek: 'post-santrifuj',
  tekrar: 1,
  gonderim: TUMU,
  gorunum: 'tanitim',
};

const LAB = { program: 'laboratuvar-api', gonderim: TUMU, gorunum: 'akis' } as const;
const IDEM = { program: 'idempotentlik', gonderim: TUMU, gorunum: 'akis' } as const;

/** Source badge of every step, keyed by step id. */
export const REST_ROZET: Readonly<Record<string, Rozet>> = {
  tanitim: { tur: 'kitap', ref: 'L300-301' },
  olustur: { tur: 'kitap' },
  listele: { tur: 'kitap' },
  guncelle: { tur: 'kitap' },
  bulunamadi: { tur: 'kitap' },
  gecersiz: { tur: 'kitap-kodu' },
  sil: { tur: 'kitap', ref: 'L643-644' },
  'mutlak-goreli': { tur: 'kitap', ref: 'L641-642' },
  'idempotency-key': { tur: 'kitap', ref: 'L645-646' },
  ozet: { tur: 'kitap', ref: 'L529-535' },
};

/** The step scenario of the rest-crud page (Ders steps 1-10). */
export const restScenario: Scenario<RestParams> = {
  defaults: VARSAYILAN,
  steps: [
    {
      id: 'tanitim',
      title: 'Kaynak, URL ve metot',
      term: 'REST',
      text: 'REST, kaynakları URL’ler ve standart HTTP davranışları üzerinden yöneten mimari yaklaşımdır. Kaynak; uygulamada kimliği olan ve hakkında işlem yapılabilen bir varlıktır: laboratuvar örneğinde ekipman, öğrenci ve rezervasyon birer kaynaktır. URL genellikle eylemi değil kaynağı belirtir; bu yüzden /ekipmanEkle yerine /ekipmanlar tercih edilir ve yapılacak işlemi HTTP metodu ifade eder. Kitabın Kod 6.1 çıktısı iki adres yazar: /api/ekipmanlar koleksiyonu ve /api/ekipmanlar/12, koleksiyonun kimliği 12 olan üyesi.',
      labText: 'Dört şerit yerinde duruyor; henüz hiçbir istek gönderilmedi. Programı ve isteği değiştirip tekrar sayısını artırarak isteğin şeritlerden nasıl geçtiğine bakın.',
      params: { gorunum: 'tanitim' },
    },
    {
      id: 'olustur',
      title: 'POST yeni kaynak oluşturur',
      term: 'POST',
      text: 'POST /api/ekipmanlar isteği ekipmanOlustur("Santrifüj") çağrısına eşlenir ve 201 Created döner; yeni kaydın kimliği 3’tür. Kitabın yorumuyla: "Kimlikler monoton sayaçtan verilir; dizi uzunluğu kullanılmaz. (Silme sonrası uzunluk küçülür ve kimlikler yinelenirdi.)" Yanıtla birlikte Location: /api/ekipmanlar/3 başlığı döner; terminalde kitabın ilk çıktı bloğu görünür.',
      labText: 'Tabloya eklenen satır yeni olarak işaretlenir. Tekrar sayısını artırırsanız aynı POST her gönderimde ayrı bir kayıt üretir; POST bu güvenceyi vermez.',
      params: { ...LAB, onceki: [], istek: 'post-santrifuj', tekrar: 1 },
    },
    {
      id: 'listele',
      title: 'GET listeler, durumu değiştirmez',
      term: 'GET',
      text: 'GET /api/ekipmanlar?sayfa=1&sayfaBoyutu=2 isteği 200 döner: iki satır ve metadata içinde toplamKayit: 3. Kitabın ayrımı: kimlik gibi kaynağı tekilleştiren bilgi yolda taşınır, sayfa ve filtre gibi görünümü biçimlendiren bilgi sorguda taşınır. GET çağrısı sunucuda durum değiştirmez; tablo aynı kalır, yalnız dönen satırlar işaretlenir.',
      labText: 'Dönen satırlar etkin renkte işaretlenir, tablonun kendisi değişmez. Sayfa sıfır isteğini seçerek geçersiz sayfa yanıtını görebilirsiniz.',
      params: { ...LAB, onceki: ['post-santrifuj'], istek: 'get-liste-1-2', tekrar: 1 },
    },
    {
      id: 'guncelle',
      title: 'PATCH kaynağın bir alanını değiştirir',
      term: 'PATCH',
      text: 'PATCH /api/ekipmanlar/1 isteği gövdede {"durum":"rezerve"} taşır ve 200 döner; yalnız durum hücresi değişir. Kitaba göre PATCH, kaynağın yalnızca bazı alanları değişiyorsa daha uygundur; PUT ise kaynağın tam yeni temsili gönderiliyorsa kullanılabilir.',
      labText: 'Değişen hücre vurgulanır, diğer hücreler olduğu gibi kalır. Var olmayan bir kimliği seçerseniz tablo hiç değişmez.',
      params: { ...LAB, onceki: ['post-santrifuj', 'get-liste-1-2'], istek: 'patch-1-rezerve', tekrar: 1 },
    },
    {
      id: 'bulunamadi',
      title: 'Olmayan kaynak: 404',
      term: '404 Not Found',
      text: 'GET /api/ekipmanlar/99 isteğinde bu kimlikte ekipman yoktur: yanıt 404 olur ve gövdede hataKodu: EKIPMAN_BULUNAMADI ile "İstenen ekipman bulunamadı." mesajı yer alır. Kitabın durum kodu tablosu aynı kararı verir: kimlik bulunamadıysa uygun kod 404’tür, çünkü istenen temsil yoktur.',
      labText: 'Hata yanıtı servis şeridinden rota katmanına döner; veri şeridindeki arama boş çıkar ve tablo değişmez.',
      params: { ...LAB, onceki: ['post-santrifuj', 'get-liste-1-2', 'patch-1-rezerve'], istek: 'get-99', tekrar: 1 },
    },
    {
      id: 'gecersiz',
      title: 'Geçersiz girdi: 400',
      term: '400 Bad Request',
      text: 'POST isteğinde ad yalnızca boşluktan oluşuyorsa servis !ad.trim() denetiminde durur ve 400 döner: hataKodu GECERSIZ_AD, mesaj "Ekipman adı boş olamaz." Kitabın durum kodu tablosunda isim boş gönderildiğinde uygun kod 400’dür, 500 değil: hata istemci verisindedir. Liste değişmez.',
      labText: 'Bu girdi kitabın örnek çağrısı değildir; kitabın kodu bu isteğe de aynı şekilde yanıt verir. Veri şeridine hiç inilmez.',
      params: { ...LAB, onceki: [], istek: 'post-bos', tekrar: 1 },
    },
    {
      id: 'sil',
      title: 'DELETE idempotenttir',
      term: 'idempotent',
      text: 'Idempotentlik.ts programında DELETE /api/ekipmanlar/12 iki kez gönderilir. İlk istek kaynağı siler ve 204 döner; ikincisinde kaynak zaten silinmiştir, yanıt 404 olur. Kitabın çıktısı: "DELETE 1: 204 kalan: 0" ve "DELETE 2: 404 kalan: 0". Yanıt farklı olsa da sunucudaki son durum aynıdır; kitabın tablosunda DELETE için "Kaynak zaten silinmiştir; yanıt 404 olabilir" yazar.',
      labText: 'Yanıt kartında her gönderimin yanıtı sıra numarasıyla durur; tablo son durumu gösterir. Silinen satır, silindiği gönderimde üstü çizili kalır.',
      params: { ...IDEM, onceki: [], istek: 'delete-12', tekrar: 2 },
    },
    {
      id: 'mutlak-goreli',
      title: 'Mutlak atama ile göreli artış',
      term: 'mutlak atama',
      text: 'stokuAyarla(5) iki kez çağrılınca stok yine 5’tir; stokuArtir(1) iki kez çağrılınca stok 7 olur. Kitabın çıktısı: "Mutlak atama iki kez: 5" ve "Göreli artış iki kez: 7". Bu yüzden PATCH için idempotentlik garanti edilmez: gövdenin anlamına bağlıdır, mutlak atama mı göreli değişiklik mi olduğuna bakılır. PUT ise aynı tam temsili yeniden yazdığı için idempotenttir.',
      labText: 'Bu çağrılar HTTP isteği değil, düz fonksiyon çağrısıdır; bu yüzden istek kartı çıkmaz. Terminaldeki satır, tekrar sayısına göre değişir.',
      params: { ...IDEM, onceki: ['stok-ayarla-5', 'stok-ayarla-5'], istek: 'stok-artir-1', tekrar: 2 },
    },
    {
      id: 'idempotency-key',
      title: 'Idempotency-Key tekrarı güvenli yapar',
      term: 'Idempotency-Key',
      text: 'POST doğası gereği idempotent değildir. Idempotency-Key başlığıyla aynı anahtar ve aynı gövdeyle gelen ikinci istek ilk yanıtı aynen tekrarlar: yeni kayıt oluşmaz. Aynı anahtar farklı gövdeyle gelirse 422 döner. Kitabın çıktısı: "POST yanıtları: 201 201 422" ve "Oluşan rezervasyon sayısı: 1".',
      labText: 'Üçüncü istek aynı anahtarı farklı bir ekipmanla kullanır. Veri şeridindeki anahtar kaydına bakılır; tabloda yalnız ilk istek bir satır bırakır.',
      params: { ...IDEM, onceki: ['post-anahtar-7', 'post-anahtar-7'], istek: 'post-anahtar-9', tekrar: 1 },
    },
    {
      id: 'ozet',
      title: 'Metotlar ve başarı kodları',
      term: 'safe ve idempotent',
      text: 'Kitabın tablosu her metodun güvenli (safe) ve idempotent olup olmadığını, aynı istek tekrar gönderildiğinde ne olduğunu özetler. Yanındaki liste, Kod 6.5’te belge satırlarıyla kodun aynı uç noktaları ve başarı kodlarını verdiğini gösterir.',
      labText: 'Tablo ve liste sabittir: Lab seçimleriniz bu özeti değiştirmez.',
      params: { gorunum: 'ozet' },
    },
  ],
};
