import type { Scenario } from '../../core/player';
import type { Rozet } from '../../core/plot/source-badge';
import type { IzinliRoller } from './auth';

export type RbacProgram = 'kod-10-7' | 'kod-10-4' | 'kod-10-6' | 'code-012';
export type RbacAsama = 'tanitim' | 'kayit' | 'giris' | 'kitap-ekle' | 'ozet';

/** Parameters of the rbac-401-403 page: which book program, stage, user, password, token, minutes since sign-in and allowed roles. */
export interface RbacParams {
  program: RbacProgram;
  asama: RbacAsama;
  kullanici: 'yasemin' | 'elif' | 'ahmet';
  parola: 'dogru' | 'yanlis';
  token: 'giris' | 'gecersiz' | 'yok';
  dakika: number;
  roller: IzinliRoller;
}

const VARSAYILAN: RbacParams = {
  program: 'kod-10-7',
  asama: 'kitap-ekle',
  kullanici: 'yasemin',
  parola: 'dogru',
  token: 'giris',
  dakika: 0,
  roller: 'kutuphaneci',
};

/** Source badge of every step, keyed by step id. */
export const RBAC_ROZET: Readonly<Record<string, Rozet>> = {
  tanitim: { tur: 'kitap', ref: 'L845, L848' },
  kayit: { tur: 'kitap-kodu', ref: 'L1263' },
  giris: { tur: 'kitap-kodu', ref: 'L1264' },
  'kutuphaneci-201': { tur: 'kitap', ref: 'L1254' },
  'ogrenci-403': { tur: 'kitap', ref: 'L1255, L1265' },
  'gecersiz-401': { tur: 'kitap', ref: 'L1256' },
  'yanlis-parola': { tur: 'kitap-kodu', ref: 'L1206, L955' },
  bearer: { tur: 'kitap-kodu', ref: 'L645, L679' },
  sira: { tur: 'kitap', ref: 'L912-917, L920' },
  'yanlis-kod': { tur: 'kitap-kodu', ref: 'L853, L950' },
  ozet: { tur: 'kitap', ref: 'L926-931, L1280' },
};

/** The step scenario of the rbac-401-403 page (Ders steps 1-11). */
export const rbacScenario: Scenario<RbacParams> = {
  defaults: VARSAYILAN,
  steps: [
    {
      id: 'tanitim',
      title: '401 ve 403 farklı sorulardır',
      term: '401 / 403',
      text: 'Kitaba göre 401, kimliğin doğrulanamadığı anlamına gelir: sunucu isteği yapanı tanıyamamıştır. 403 ise kimliğin doğrulandığı, ama o kimliğin istenen işlemi yapma yetkisinin olmadığı anlamına gelir. Kitabın sınav notu bunu şöyle özetler: 401 “sen kimsin, bilmiyorum”, 403 “seni tanıyorum ama bu işleme iznin yok”. Bu adımda henüz bir istek çalışmadı.',
      labText: 'Bu görünüm yalnızca tanımı gösterir. Kullanıcıyı ya da tokenı değiştirdiğinizde sonraki adımlarda istek çalışır.',
      params: { ...VARSAYILAN, asama: 'tanitim' },
    },
    {
      id: 'kayit',
      title: 'Kayıt: parola hash olarak saklanır',
      term: 'kayitOl',
      text: 'Kod 10.7 iki kullanıcı kaydeder: yasemin kütüphaneci, elif öğrenci. kayitOl her parola için bir salt üretir, parolayı hashler ve repository’ye yalnızca kullaniciAdi, salt, parolaHash ve rol yazar. Tabloda düz metin parola yoktur. Sayfa kitabın rastgele salt’ı yerine sabit bir salt kullanır; hash’in yalnızca ilk on altı karakteri gösterilir.',
      labText: 'Kayıt adımı sabittir. Kullanıcı ve parola seçimleri bu görünümü değiştirmez.',
      params: { ...VARSAYILAN, asama: 'kayit' },
    },
    {
      id: 'giris',
      title: 'Giriş: iki kullanıcı iki token alır',
      term: 'girisYap',
      text: 'girisYap önce kullanıcıyı repository’de bulur, sonra parolayı doğrular ve tokenUret ile bir token üretir. Token’ın payload’ında kullanıcının rolü bulunur. Böylece sonraki istekte rol sunucuda yeniden aranmaz. Terminalde her token yalnızca ilk karakterleriyle gösterilir.',
      labText: 'Giriş adımı sabit parolalarla çalışır. Token’ın rol notu kullanıcıya göre değişir.',
      params: { ...VARSAYILAN, asama: 'giris' },
    },
    {
      id: 'kutuphaneci-201',
      title: 'Kütüphaneci: iki denetim geçer, 201',
      term: '201',
      text: 'kitapEkle(kutuphaneciToken) önce tokenDogrula’yı çağırır; imza ve süre geçer. Sonra sadeceKutuphaneci rolü denetler; rol listede olduğu için o da geçer. Yanıt 201 ve “Kitap eklendi.” olur. Terminalde kitabın ilk çıktı satırı görünür.',
      labText: 'Kullanıcıyı, tokenı ya da geçen süreyi değiştirin: denetim listesi ve yanıt kartı yeniden hesaplanır.',
      params: { ...VARSAYILAN },
    },
    {
      id: 'ogrenci-403',
      title: 'Öğrenci: kimlik geçer, rol kalır, 403',
      term: '403',
      text: 'kitapEkle(ogrenciToken) için tokenDogrula yine geçer, çünkü öğrencinin kimliği doğrudur. Ardından sadeceKutuphaneci “ogrenci” rolünü izin listesinde bulamaz ve 403 fırlatır. Kod şeridi rolün denetlendiği satırda durur. Terminale kitabın ikinci çıktı satırı eklenir.',
      labText: 'Rol listesini ikisine açarsanız öğrenci de geçer. Kullanıcıyı yasemin yaparsanız yanıt 201 olur.',
      params: { ...VARSAYILAN, kullanici: 'elif' },
    },
    {
      id: 'gecersiz-401',
      title: 'Geçersiz token: imza kalır, 401',
      term: 'imza denetimi',
      text: 'kitapEkle("gecersiz.token.deger") çağrısında token kimliği doğrulayamaz: imza yeniden hesaplanan imzayla eşleşmez ve tokenDogrula 401 fırlatır. Kimlik belli olmadığı için rol denetimine hiç geçilmez; rol şeridi soluk kalır. Terminale kitabın üçüncü çıktı satırı eklenir.',
      labText: 'Token seçimini girişten gelen token yaparsanız kimlik geçer. Boş token da imza denetiminde kalır.',
      params: { ...VARSAYILAN, token: 'gecersiz' },
    },
    {
      id: 'yanlis-parola',
      title: 'Yanlış parola: token üretilmez',
      term: 'enumeration',
      text: 'girisYap("elif", "yanlis-parola") çağrısında parola doğrulaması başarısız olur ve 401: Kullanıcı adı veya parola hatalı. fırlatılır. Token üretilmediği için kitapEkle çağrılmaz. Kitap, kullanıcı adının var olup olmadığını belli etmeyen genel bir mesajı tercih eder; aksi halde saldırgan geçerli kullanıcı adlarını tarayabilir.',
      labText: 'Kayıtsız kullanıcı ahmet seçildiğinde de aynı mesaj döner; mesaj kullanıcının var olup olmadığını belli etmez.',
      params: { ...VARSAYILAN, kullanici: 'elif', parola: 'yanlis' },
    },
    {
      id: 'bearer',
      title: 'Kod 10.4: Bearer başlığı',
      term: 'authMiddleware',
      text: 'authMiddleware yalnızca kimliği denetler. Authorization başlığı yoksa ya da “Bearer ” ile başlamıyorsa 401 ve “Token bulunamadı.” döner. Başlık geçerli bir token taşıyorsa istek.kullanici doldurulur ve next() çağrılır. İstek kartlarındaki /kitaplar yolu bu sayfaya aittir; Kod 10.4’te bir yol yoktur. Terminaldeki next() → istek.kullanici satırı sayfanın kendi özetidir, kitabın çıktısı değildir. Kitap burada rol denetimi yapılmadığını dikkat notuyla belirtir.',
      labText: 'Bu görünüm kitabın ara katman örneğinin iki çağrısını gösterir ve kullanıcı, token ya da rol seçimlerinden etkilenmez.',
      params: { ...VARSAYILAN, program: 'kod-10-4' },
    },
    {
      id: 'sira',
      title: 'Kod 10.6: önce 401, sonra 403',
      term: 'denetim sırası',
      text: 'istegiIsle önce token’ın varlığını ve geçerliliğini denetler; bunlardan biri kalırsa 401 döner. Token geçerliyse rol denetlenir ve yetersizse 403 döner. İkisi de geçerse 200 döner. Üç çağrı sırayla 401, 403 ve 200 üretir; terminalde kitabın çıktısı görünür. Sıra, kimlik doğrulamanın yetkilendirmeden önce geldiğini gösterir.',
      labText: 'Bu görünüm Kod 10.6’nın üç çağrısını gösterir ve Lab seçimlerinizden etkilenmez.',
      params: { ...VARSAYILAN, program: 'kod-10-6' },
    },
    {
      id: 'yanlis-kod',
      title: 'Yanlış kod: yetkisize 401',
      term: 'yanlış durum kodu',
      text: 'Kitabın yanlış örneğinde kimliği doğrulanmış bir öğrenci için 401 döner. Doğrusu 403’tür: kullanıcı tanınmıştır, ama yetkisi yoktur. 401 alan istemci kullanıcıyı gereksiz yere yeniden girişe yönlendirir; yeniden giriş yetki sorununu çözmez.',
      labText: 'Bu görünüm kitabın yanlış örneğini gösterir ve Lab seçimlerinizden etkilenmez.',
      params: { ...VARSAYILAN, program: 'code-012', kullanici: 'elif' },
    },
    {
      id: 'ozet',
      title: 'Özet: durum kodları',
      term: 'durum kodları',
      text: 'Tablo kitabın durum kodu özetidir: 401 kimlik doğrulanamadı, 403 kimlik doğrulandı ama yetki yok, 404 kaynak bulunamadı, 400 istek biçimi hatalı. Bölüm sınav notu da aynı ayrımı verir: authentication “kimsin”, authorization “ne yapabilirsin” sorusunu yanıtlar.',
      labText: 'Bu görünüm kitabın özet tablosudur ve Lab seçimlerinizden etkilenmez.',
      params: { ...VARSAYILAN, asama: 'ozet' },
    },
  ],
};
