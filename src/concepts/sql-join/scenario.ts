import type { Scenario } from '../../core/player';
import type { Rozet } from '../../core/plot/source-badge';
import type { SorguId } from './sql';

/**
 * Parameters of the sql-join page: the ready-made query (`sorgu`), the bound `$1` (`deger`), how many row pairs of the
 * nested loop the scene has walked (`cift`) and the view (intro, data, query, summary).
 */
export interface SqlParams {
  sorgu: SorguId;
  deger: 1 | 2 | 3;
  cift: number;
  gorunum: 'tanitim' | 'veri' | 'sorgu' | 'ozet';
}

/** Larger than any pair count: `cift` is clamped to the number of pair steps. */
export const TUMU = 999;

const VARSAYILAN: SqlParams = { sorgu: 'kartezyen', deger: 3, cift: TUMU, gorunum: 'tanitim' };

/** Source badge of every step, keyed by step id. */
export const SQL_ROZET: Readonly<Record<string, Rozet>> = {
  tanitim: { tur: 'kitap', ref: 'L536, L744' },
  veri: { tur: 'kitaba-dayali', ref: 'L1936-1938' },
  kartezyen: { tur: 'kitap', ref: 'L879, L887-890' },
  'on-kosulu': { tur: 'kitap', ref: 'L748' },
  'inner-sonuc': { tur: 'kitap', ref: 'L804' },
  left: { tur: 'kitap', ref: 'L741, L804' },
  'is-null': { tur: 'kitaba-dayali', ref: 'L920' },
  'where-tuzagi': { tur: 'kitaba-dayali', ref: 'L920' },
  parametreli: { tur: 'kitaba-dayali', ref: 'L454, L1456' },
  ozet: { tur: 'kitap', ref: 'L860-865' },
};

/** The step scenario of the sql-join page (Ders steps 1-10). */
export const sqlScenario: Scenario<SqlParams> = {
  defaults: VARSAYILAN,
  steps: [
    {
      id: 'tanitim',
      title: 'PK, FK ve JOIN',
      term: 'JOIN',
      text: 'Primary Key (birincil anahtar), tablodaki her satırı benzersiz biçimde tanımlayan sütun veya sütun grubudur; boş olamaz ve aynı değeri iki kayıtta taşıyamaz. Foreign Key (yabancı anahtar) ise bir tablodaki değerin başka tablodaki geçerli bir Primary Key değerine dayanmasını sağlar. JOIN, ilişkili tablolardaki satırları ortak alanlar üzerinden tek sonuç kümesinde birleştirir; ilişki çoğu zaman PK ile FK arasında kurulur. JOIN yeni veri üretmez: farklı tablolarda saklanan bilgileri sorgu anında yan yana getirir.',
      labText: 'İki tablo yalnızca başlıklarıyla durur; yazar kimliği birincil, kitaptaki yazar kimliği yabancı anahtardır. Bir sorgu seçip çift kaydırıcısını oynatarak satırların nasıl eşlendiğine bakabilirsiniz.',
      params: { gorunum: 'tanitim' },
    },
    {
      id: 'veri',
      title: 'Tabloların satırları',
      term: 'ilişki',
      text: 'Satırlar kitabın örneklerinden gelir: Kod 7.5 Yaşar Kemal ile İnce Memed’i, Kod 7.6 Adalet Ağaoğlu ile Ölmeye Yatmak’ı ekler. Kitabı olmayan Bilge Karasu, alıştırmanın beklenen çıktısından gelir ("Kitabı olmayan yazar: Bilge Karasu"). Kitabın ilişki cümlesi: bir yazarın hiç kitabı olmayabilir veya birçok kitabı olabilir, ancak her kitabın tam olarak bir yazarı vardır.',
      labText: 'Üç yazar ve iki kitap sabit veri kümesidir; Lab bu satırları değiştirmez. Yalnız Bilge Karasu’nun kitabı yoktur.',
      params: { gorunum: 'veri' },
    },
    {
      id: 'kartezyen',
      title: 'JOIN koşulu yoksa satırlar çarpılır',
      term: 'Kartezyen çarpım',
      text: 'FROM yazarlar AS y, kitaplar AS k yazıp JOIN koşulu koymazsanız satırlar birbirleriyle gereksiz biçimde çarpılır; sonuç sayısı beklenmedik şekilde büyür. Bu veride 3 yazar ile 2 kitap 6 satır verir. Kitabın çıktısı tek satırdır (Yaşar Kemal | İnce Memed, "1 row"); bu sayfadaki veri kümesinde aynı sorgu 6 satır üretir.',
      labText: 'Her çift koşulsuz eklenir; sonuç tablosu çift sayısı kadar büyür. Kaydırıcıyı sona getirince bütün çarpım görünür.',
      params: { sorgu: 'kartezyen', cift: TUMU, gorunum: 'sorgu' },
    },
    {
      id: 'on-kosulu',
      title: 'ON koşulu çiftleri eler',
      term: 'ON',
      text: 'JOIN, biçimsel olarak iki tablonun Kartezyen çarpımı alınıp belirtilen koşulu sağlayan satır çiftlerinin seçilmesidir. INNER JOIN’de ON koşulu 6 çiftin her biri için sınanır; yalnız doğru çıkan 2 çift sonuca girer.',
      labText: 'Seçili çift iki tabloda birlikte vurgulanır ve aralarındaki koşulun sonucu görünür. Kaydırıcıyı oynatarak her çiftin sınandığı sırayı izleyin.',
      params: { sorgu: 'inner', cift: 4, gorunum: 'sorgu' },
    },
    {
      id: 'inner-sonuc',
      title: 'INNER JOIN yalnız eşleşenleri getirir',
      term: 'INNER JOIN',
      text: 'INNER JOIN, iki tabloda eşleşmesi bulunan kayıtları getirir. Kitabı olmayan bir yazar bu sonuçta görünmez: Bilge Karasu sonuçta yoktur. Sorguda ORDER BY bulunmadığı için satır sırası garanti değildir.',
      labText: 'Sonuç tablosunda eşleşen yazar ve kitap yan yanadır. Sıra notu, ORDER BY yazılmayan sorgularda görünür.',
      params: { sorgu: 'inner', cift: TUMU, gorunum: 'sorgu' },
    },
    {
      id: 'left',
      title: 'LEFT JOIN soldaki tabloyu korur',
      term: 'LEFT JOIN',
      text: 'LEFT JOIN, sol taraftaki yazarlar tablosundaki her yazarı getirir; eşleşen kitap yoksa kitap alanları NULL olur. Bilge Karasu bu yüzden sonuçta kitap_adi = NULL ile kalır ve ORDER BY ile sıralı 3 satır döner. Kitabın ipucu: JOIN yazmadan önce "hangi tablo temel listemdir?" sorusunu sorun; LEFT JOIN’de soldaki tablo her zaman korunur.',
      labText: 'Eşleşmeyen yazar için sonuç satırı NULL hücreyle eklenir. Kaydırıcıda bu adımın koşul rozeti eşleşme olmadığını söyler.',
      params: { sorgu: 'left', cift: TUMU, gorunum: 'sorgu' },
    },
    {
      id: 'is-null',
      title: 'Kitapsız yazar: IS NULL',
      term: 'IS NULL',
      text: 'Kitabı olmayan yazarı bulmak için LEFT JOIN sonrası WHERE k.yazar_id IS NULL yazılır; sonuç Bilge Karasu’dur. Kitap, NULL değerini = ile karşılaştırmak yerine IS NULL kullanmak gerektiğini söyler. Nedeni bu sayfanın değerlendiricisindedir: NULL ile karşılaştırma doğru ya da yanlış değil NULL verir ve NULL eşleşme sayılmaz. Alıştırmanın beklenen çıktısı: "Kitabı olmayan yazar: Bilge Karasu".',
      labText: 'WHERE koşulu JOIN’den çıkan her satıra uygulanır; koşulu sağlamayanlar üstü çizili görünür. Yalnız kitapsız yazar kalır.',
      params: { sorgu: 'is-null', cift: TUMU, gorunum: 'sorgu' },
    },
    {
      id: 'where-tuzagi',
      title: 'Sağ tabloya WHERE koymak',
      term: 'WHERE tuzağı',
      text: 'Kitabın uyardığı hata: LEFT JOIN sonrası sağ tablonun alanına WHERE koşulu koyup farkında olmadan INNER JOIN etkisi yaratmak. NULL <> \'İnce Memed\' sonucu NULL olduğu için Bilge Karasu satırı elenir ve sonuç daralır. Aynı koşul ON’a taşınınca LEFT JOIN’in korumasını bozmaz: 3 satır kalır.',
      labText: 'Üstü çizili satırlar WHERE’in elediği satırlardır. İkinci tablo aynı koşulun ON içinde yazılmış hâlini gösterir.',
      params: { sorgu: 'where-tuzagi', cift: TUMU, gorunum: 'sorgu' },
    },
    {
      id: 'parametreli',
      title: 'Parametreli sorgu: $1',
      term: '$1',
      text: 'Parametre değerleri sorgu metnine string birleştirmeyle değil ayrı bir dizi olarak gönderilir; bu, SQL enjeksiyonunu önlemenin temel yoludur. Kod panelinde yalnız $1 görünür, değer yanındaki [3] dizisinde durur. Kitabın önerisi: istisnasız her sorguda parametreli ifadeler ($1, $2) veya güvenli sorgu oluşturucular kullanılmalıdır.',
      labText: 'Değeri değiştirdiğinizde sorgu metni aynı kalır; yalnız yanındaki dizi ve sonuç değişir.',
      params: { sorgu: 'parametreli', deger: 3, cift: TUMU, gorunum: 'sorgu' },
    },
    {
      id: 'ozet',
      title: 'JOIN türleri ve satır sayıları',
      term: 'JOIN türleri',
      text: 'Kitabın tablosu her JOIN türünün hangi kayıtları döndürdüğünü, kullanım örneğini ve riskini özetler. Bu veri kümesinde satır sayıları: Kartezyen 6, INNER JOIN 2, LEFT JOIN 3.',
      labText: 'Tablo ve sayılar sabittir: Lab seçimleriniz bu özeti değiştirmez.',
      params: { gorunum: 'ozet' },
    },
  ],
};
