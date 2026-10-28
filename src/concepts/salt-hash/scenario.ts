import type { Scenario } from '../../core/player';
import type { Rozet } from '../../core/plot/source-badge';

export type SaltYontem = 'scrypt' | 'sha256';
export type SaltSecim = 'sabit-1' | 'sabit-2' | 'yeni';
export type SaltGorunum = 'tanim' | 'hat' | 'dogrula' | 'karsilastir' | 'yavas' | 'ozet';

/**
 * Parameters of the salt-hash page: the hash method (`yontem`), the registered password (`parola`), the login attempt
 * (`deneme`), which salt the first record gets (`salt`, with `yeniSalt` for a typed one), whether a second user with the
 * same password exists and which view is on screen.
 */
export interface SaltParams {
  yontem: SaltYontem;
  parola: string;
  deneme: string;
  salt: SaltSecim;
  yeniSalt: string;
  ikinciKullanici: boolean;
  gorunum: SaltGorunum;
}

const VARSAYILAN: SaltParams = {
  yontem: 'scrypt',
  parola: 'guclu-Parola123',
  deneme: 'yanlis-parola',
  salt: 'sabit-1',
  yeniSalt: '',
  ikinciKullanici: false,
  gorunum: 'hat',
};

/** Source badge of every step, keyed by step id. */
export const SALT_ROZET: Readonly<Record<string, Rozet>> = {
  tanitim: { tur: 'kitap', ref: 'L240, L243' },
  tuzsuz: { tur: 'kitap-kodu', ref: 'L344, L371' },
  'salt-uret': { tur: 'kitap-kodu', ref: 'L282-283' },
  'ayni-parola': { tur: 'kitap-kodu', ref: 'L246, L331' },
  'dogru-parola': { tur: 'kitap-kodu', ref: 'L303' },
  'yanlis-parola': { tur: 'kitap-kodu', ref: 'L303-304' },
  zamanlama: { tur: 'kitaba-dayali', ref: 'L316, L331' },
  yavas: { tur: 'kitap', ref: 'L249, L312, L337-342' },
  ozet: { tur: 'kitap', ref: 'L311-313, L374' },
};

/** The step scenario of the salt-hash page (Ders steps 1-9). */
export const saltScenario: Scenario<SaltParams> = {
  defaults: VARSAYILAN,
  steps: [
    {
      id: 'tanitim',
      title: 'Hash tek yönlüdür',
      term: 'parola hashing',
      text: 'Parola hashing, parolayı tek yönlü bir fonksiyondan geçirerek geri döndürülemez bir özet değerine dönüştürmektir. Doğru terim “şifrelemek” değil, “tek yönlü özetlemek”tir; hash geri çözülemez. Salt ise her kullanıcı için üretilen, rastgele ve benzersiz bir değerdir ve parolayla birlikte hash fonksiyonuna verilir.',
      labText: 'Bu görünüm yalnızca kitabın tanımını gösterir. Parolayı değiştirdiğinizde kullanıcı tablosu, salt ve hash şeridi dolar; hash’ten parolaya geri dönülemez.',
      params: { ...VARSAYILAN, gorunum: 'tanim' },
    },
    {
      id: 'tuzsuz',
      title: 'Salt olmadan aynı parola aynı hash',
      term: 'salt',
      text: 'Kitabın yanlış örneği salt kullanmadan sha256 ile hash üretir. guvensizHashle("123456") iki kez çağrılınca iki şeritte de aynı 64 karakter çıkar ve karşılaştırma true verir. Aynı parolaya sahip iki kullanıcı aynı hash değerine sahip olur; bu, önceden hesaplanmış tablo saldırılarını kolaylaştırır.',
      labText: 'İkinci kullanıcı eklendiğinde sha256 ile iki şerit birebir aynı kalır. Salt sütunu boştur, çünkü bu yöntemde salt yoktur.',
      params: { ...VARSAYILAN, yontem: 'sha256', parola: '123456', ikinciKullanici: true },
    },
    {
      id: 'salt-uret',
      title: 'Salt üretilir, scrypt hash’i hesaplar',
      term: 'scrypt',
      text: 'parolaHashle her kullanıcı için randomBytes(16) ile benzersiz bir salt üretir, scryptSync salt ve parolayı birlikte kullanarak yavaş bir hash çıkarır ve { salt, hash } tabloya yazılır. Kod şeridi scryptSync satırında durur. Bu sayfadaki salt değeri örnek bir sabittir; her çağrıda yeni salt üretilmesi kitabın kodunun işidir.',
      labText: 'Salt seçimini ya da parolayı değiştirin: kayıt yeniden hesaplanır. Hesap sürerken şeritte “hesaplanıyor…” yazar.',
      params: { ...VARSAYILAN },
    },
    {
      id: 'ayni-parola',
      title: 'Aynı parola, farklı salt, farklı hash',
      term: 'rainbow table',
      text: 'İkinci kullanıcı aynı parolayı seçse bile kendi salt’ı vardır, bu yüzden hash’i neredeyse bütün karakterlerde farklıdır. Salt olmasaydı bir saldırgan yaygın parolaların hash’lerini bir kez hesaplayıp (rainbow table) tüm sızdırılmış veritabanlarına karşı kullanabilirdi; kullanıcıya özgü salt bu stratejiyi geçersiz kılar.',
      labText: 'Vurgulanan karakterler, ikinci kayıt ile ilk kayıt arasındaki farkı gösterir. Yöntemi sha256 yaparsanız fark kaybolur.',
      params: { ...VARSAYILAN, ikinciKullanici: true },
    },
    {
      id: 'dogru-parola',
      title: 'Doğru parola: aynı salt, aynı hash',
      term: 'parolaDogrula',
      text: 'parolaDogrula, doğrulama sırasında kayıttaki aynı salt’ı kullanarak hash’i yeniden hesaplar ve kayıtlı hash ile karşılaştırır. "guclu-Parola123" ile hesaplanan hash kayıtlıyla aynıdır; kod şeridi bu hesaplamanın satırında durur ve terminalde true yazar.',
      labText: 'Deneme alanına kayıtlı parolayı yazarsanız iki şerit aynı olur ve sonuç true çıkar.',
      params: { ...VARSAYILAN, gorunum: 'dogrula', deneme: 'guclu-Parola123' },
    },
    {
      id: 'yanlis-parola',
      title: 'Yanlış parola: farklı hash',
      term: 'doğrulama',
      text: 'Aynı kayıtla "yanlis-parola" denenince hesaplanan hash kayıtlı hash’ten farklı çıkar ve parolaDogrula false döner. Terminalde kitabın çıktısı görünür: önce doğru denemenin true, sonra yanlış denemenin false satırı.',
      labText: 'Denemeyi değiştirin: yalnız o denemenin satırı terminale yazılır. Farklı karakterler ikinci şeritte vurgulanır.',
      params: { ...VARSAYILAN, gorunum: 'dogrula' },
    },
    {
      id: 'zamanlama',
      title: 'Karşılaştırma ve zamanlama saldırısı',
      term: 'timingSafeEqual',
      text: 'Kitap, hash’lerin doğrudan === ile değil timingSafeEqual ile karşılaştırılmasını ister; sıradan string karşılaştırması erken çıkışıyla saldırgana hash hakkında bilgi sızdırabilir. Burada === ilk farklı karakterde durur (1 karakter), timingSafeEqual ise 64 baytın hepsine bakar. Bu sayaçlar kitabın cümlesine dayalı bir örnektir; gerçek süre ölçülmez.',
      labText: 'Sayaçlar iki karşılaştırmanın bakmak zorunda kaldığı birim sayısını verir. Denemeyi kayıtlı parolayla aynı yaparsanız === de bütün karakterlere bakar.',
      params: { ...VARSAYILAN, gorunum: 'karsilastir' },
    },
    {
      id: 'yavas',
      title: 'Bilinçli olarak yavaş fonksiyonlar',
      term: 'anahtar türetme',
      text: 'Gerçek dünyada tercih edilen scrypt, bcrypt ve argon2 bilinçli olarak yavaş çalışacak şekilde tasarlanmıştır; bu, saldırganın saniyede deneyebileceği parola sayısını sınırlayarak kaba kuvvet saldırılarını yavaşlatır. Alternatifler tablosunda düz SHA-256 hızlıdır ve parola hashleme için önerilmez.',
      labText: 'Tablo kitabın alternatifler tablosudur. Bir seçimi değiştirdiğinizde Lab hesap hattına geçer ve kendi girdinizin hash’ini hesaplar.',
      params: { ...VARSAYILAN, gorunum: 'yavas' },
    },
    {
      id: 'ozet',
      title: 'Doğru yaklaşım',
      term: 'salt ve yavaş hash',
      text: 'Kritik satırlar: randomBytes her kullanıcı için benzersiz bir salt üretir, scryptSync bilinçli yavaş çalışarak kaba kuvveti yavaşlatır, timingSafeEqual karşılaştırmayı sabit sürede yapar. Doğru yaklaşım, kullanıcı başına benzersiz salt ve yavaş bir anahtar türetme fonksiyonudur; karşılaştırma da her zaman timingSafeEqual ile yapılmalıdır.',
      labText: 'Maddeler kitabın özetidir. Bir seçimi değiştirdiğinizde Lab hesap hattına geçer ve kendi girdinizin hash’ini hesaplar.',
      params: { ...VARSAYILAN, gorunum: 'ozet' },
    },
  ],
};
