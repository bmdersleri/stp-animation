# Dalga 2 — Middleware, REST, SQL JOIN ve katmanlı mimari — Tasarım

- **Tarih:** 2026-10-27
- **Kaynak:** Öğretmen: "STP Animasyon — Dalga 2'ye başla." Kapsam: `middleware-zinciri` (Bölüm 5),
  `rest-crud` (Bölüm 6), `sql-join` (Bölüm 7), `katmanli-mimari` (Bölüm 9). Kitap:
  `C:\projects\modernSunucuTabProg` (salt okunur), `chapters/<bölüm>/content/final.md`:
  - `b05-express-web-server` (1874 satır)
  - `b06-http-rest-api` (1790)
  - `b07-postgresql-sql` (2003)
  - `b09-layered-backend-architecture` (1367)
- **Yetki:** Bütün tasarım kararları benimdir ("Benim kararım"). Kararlar ledger'da `Ruling:` satırı
  olarak durur ve iş sonunda öğretmene listelenir. Push ve merge, öğretmenin sohbetteki onayını ve yeşil
  `npm run check`'i bekler.
- **Dalga 1 dersleri (bu tasarıma işlendi):**
  - Alt ajanlar LF ve UTF-8 yazar.
  - Sahne erken gerçek tarayıcıda denetlenir.
  - Kitap metni `final.md` satır aralıklarına karşı node ile doğrulanır.
  - Çalışma zamanı semantiği (Express, HTTP, SQL) her brief'te açıkça modellenir.
- **Satır numaraları** bu belgede `final.md` satırlarıdır (`L606-669` biçiminde). Kontrolcü, dört bölümde
  örnek satırları node ile yokladı; hepsi tuttu.

## Amaç ve kabul ölçütleri

Öğrenci şunları kavramalı:

1. **Middleware'ler tanımlandıkları sırayla çalışır.**
   - Her halka ya `next()` ile devreder ya yanıtı gönderip zinciri bitirir. İkisini de yapmayan halka
     isteği askıda bırakır.
   - Yanıt ara katmanlardan geri geçmez; doğrudan istemciye gider.
   - Genel (`use`) middleware her istekte çalışır, route'a bağlı middleware yalnız o route'ta.
2. **REST'te URL kaynağı, metot işlemi, durum kodu sonucu anlatır.**
   - Durum kodları: POST → 201, GET → 200 ya da 404, PATCH → 200, boş ad → 400, DELETE → 204.
   - DELETE idempotenttir: sunucu durumu aynı kalır, yanıt kodu değişebilir.
   - POST idempotent değildir; `Idempotency-Key` onu tekrar denemeye karşı korur.
3. **JOIN, PK–FK eşleşmesiyle satırları birleştirir.**
   - INNER JOIN yalnız eşleşenleri getirir. LEFT JOIN sol tablonun her satırını korur, eşleşme yoksa
     sağ sütunlar `NULL` olur.
   - Koşulsuz JOIN kartezyen çarpım üretir.
   - Sağ tabloya `WHERE` koşulu koymak LEFT JOIN'i INNER JOIN'e çevirir.
   - Değerler sorgu metninden ayrı parametre (`$1`) olarak gider.
4. **Katmanlı mimaride her katmanın tek sorumluluğu vardır.**
   - Controller biçimi doğrular ve sonucu HTTP benzeri yanıta çevirir. Service iş kuralını uygular ve
     anlamlı hata fırlatır. Repository veriyi getirir ve yazar.
   - Service'in fırlattığı hata controller'da yanıta dönüşür.
   - Bağımlılıklar constructor ile verilir.

Kabul ölçütleri:

1. Dört yeni sayfa açılır, hepsi Ders (`?mod=ders`) ve Laboratuvar modunda çalışır:

   | Sayfa | Başlık | Bölüm | Adım |
   |---|---|---|---|
   | `middleware-zinciri/` | "Middleware zinciri: istek işlem hattı" | 5 | 11 |
   | `rest-crud/` | "CRUD, HTTP metotları ve durum kodları" | 6 | 10 |
   | `sql-join/` | "JOIN ile tabloları birleştirme" | 7 | 10 |
   | `katmanli-mimari/` | "Katmanlı mimari: controller, service, repository" | 9 | 11 |

   Ana sayfada 6 kavram **hazır**, 9 kavram **yakında** görünür.
2. Ekrandaki her kod satırı kitaptakiyle **harfiyen** aynıdır.
   - Kitabın çıktı blokları birim testinde sabit metin olarak doğrulanır.
   - Kitapta olmayan her girdi, çıktı ya da örnek bir **kaynak rozeti** taşır (Bölüm 1).
3. Her sayfanın modeli saf TypeScript fonksiyonudur ve çalışma zamanı kurallarını açıkça uygular.
   Kurallar Bölüm 2–5'tedir. Her kural için birim testi vardır.
4. Yeni ortak sahne parçaları `src/core/plot/` altındadır:
   - **HTTP kartları** (`http-cards.ts`)
   - **veri tablosu** (`data-table.ts`)
   - **kaynak rozeti** (`source-badge.ts`)

   `istek-yanit` kendi kartları yerine `http-cards.ts`'i kullanır; görünümü değişmez.
5. `scripts/kitap-dogrula.mjs` her sayfanın kod listelerini `final.md` satır aralıklarıyla karşılaştırır
   ve dört sayfa için temiz çıkar. Betik yerel bir araçtır, kapıya girmez.
6. Her adım 1280×720, 1280×740 ve 390 px genişlikte sahneye sığar. Ders yazı tabanları Dalga 1'deki
   gibidir.
7. Dalga 1'in ertelenen küçükleri bu dalgada kapanır (aşağıdaki karar tablosu).
8. `npm run check` yeşil.

## Kararlar

| Konu | Karar | Neden |
|---|---|---|
| Ortak HTTP kartları | `istek-yanit/scene-cards.ts`'in istek kartı, yanıt kartı ve terminali `src/core/plot/http-cards.ts`'e taşınır. Arayüz geneldir: metot, yol, başlıklar, gövde; durum kodu, gövde, ton; terminal satırları. `istek-yanit` özet tablosunu kendinde tutar, CSS sınıf adları korunur | AGENTS.md: ikinci bir sayfanın istediği katman `core/plot`'a taşınır. Dört yeni sayfanın üçü istek/yanıt kartı ister |
| Ortak veri tablosu | `src/core/plot/data-table.ts`, DOM tablosu: başlık, sütunlar, satırlar. Satır durumları `yeni`, `degisti`, `silindi`, `eslesti`, `eslesmedi`, `etkin`, `soluk`; hücre vurgusu; `NULL` hücre biçemi | `rest-crud` (ekipman listesi), `sql-join` (üç tablo) ve `katmanli-mimari` (iki repository) aynı parçayı kullanır |
| Kaynak rozeti | `source-badge.ts`, üç tür: `kitap` ("Kitabın çıktısı"), `kitap-kodu` ("Kitabın kodu, yeni girdi"), `kitaba-dayali` ("Kitabın cümlesine dayalı örnek · L…"). Her adım ve Lab senaryosu tek rozet taşır | Dürüstlük. Kitapta çıktısı olmayan dalları ve kitabın vermediği örnek veriyi öğrenci ayırt eder. Dalga 1'deki `bookBased` notunun genellenmiş biçimi |
| Sıra diyagramı | `rest-crud`, `middleware-zinciri` ve `katmanli-mimari` `SequenceLayer`'ı kullanır. Eklenenler: `stopTone` (`'alarm' \| 'ok'`; 200 sonucunda yeşil dönüş işareti, Dalga 1 küçük 2) ve SVG'ye `role="img"` + `aria-label` (küçük 11) | Üç akış da şerit + ok modeline oturur. Şekil 6.5 zaten bir sıra diyagramıdır |
| Kitap doğrulama betiği | `scripts/kitap-dogrula.mjs`: her kavramın `code-text.ts` listesi `{ bolum, satirlar: [ilk, son] }` kaynağı taşır. Betik `final.md`'deki aralıkla satır satır karşılaştırır. Kitap klasörü yoksa "atlandı" der ve 0 ile çıkar. `npm run check`'e girmez | Dalga 1 dersi. Kitap başka makinede ve CI'da yoktur; kapı taşınabilir kalmalı |
| Express modeli | `middleware-zinciri/express-sim.ts`: katman yığını, sıralı eşleme, `next`, `next(err)`, 4 parametreli hata katmanı, varsayılan 404 ve 500, askıda kalma, `ERR_HTTP_HEADERS_SENT`. Kurallar Bölüm 2'de | Dalga 1 dersi: çalışma zamanı açıkça modellenir. Kitabın Şekil 5.2'si route eşlemesini middleware'den önce gösterir. Gerçek Express'te `use` katmanları eşleşmeyen istekte de çalışır; model gerçek Express'i izler |
| Express hata middleware'i | Kitapta kodu yok. Yalnız L682 ("hata yakalama middleware'i … route'lardan sonra") ve L1814-1818 alıştırması var (`{"mesaj":"Sunucuda beklenmeyen bir hata oluştu."}`). Adım 10 bunlardan kurulan örnektir ve `kitaba-dayali` rozeti taşır | Middleware zincirinin temel parçası; kitabın alıştırma mesajı harfiyen kullanılır |
| Express varsayılan 404 | Eşleşmeyen `GET /baska` için Express'in kendi yanıtı: `404`, gövde `Cannot GET /baska`. `kitaba-dayali` rozetiyle (L558, Şekil 5.2 düğümü) | Global middleware'in her istekte çalıştığını gösteren tek örnek. Kitap varsayılan gövdeyi göstermez |
| REST programları | İki program. `laboratuvar-api` (code_011, L1295-1459): POST/GET/liste/PATCH, başlangıç verisi Mikroskop + Spektrometre, `sonrakiKimlik = 3`. `idempotentlik` (code_014, L552-647): mutlak ve göreli güncelleme, DELETE iki kez, POST + `Idempotency-Key` | Kitabın iki örneği ayrı veri kümeleri kullanır; karıştırmak yanlış durum gösterirdi. `LaboratuvarApi`'de silme yoktur (yalnız alıştırma L1463) |
| REST rota eşlemesi | Kitap HTTP isteğini göstermez; yalnız fonksiyon çağrıları var. Eşleme Şekil 6.5, Kod 6.1, code_004 ve Kod 6.5'ten kurulur: POST `/api/ekipmanlar` `{"ad":"Santrifüj"}` → `ekipmanOlustur`; GET `/api/ekipmanlar?sayfa=1&sayfaBoyutu=2` → `ekipmanlariListele(1, 2)`; PATCH `/api/ekipmanlar/1` `{"durum":"rezerve"}` → `ekipmanDurumunuGuncelle`; GET `/api/ekipmanlar/99` → `ekipmanGetir`; DELETE `/api/ekipmanlar/12` → `ekipmanSil`. 201 yanıtında `Location: /api/ekipmanlar/3` (Şekil 6.5 "201 Created + Location başlığı", değer kitapta yok) | İstek kartı HTTP'yi gösterir, kod paneli kitabın fonksiyonunu. Eşleme rozetle işaretlenir |
| REST şeritleri | Şekil 6.5'in katılımcıları: "İstemci", "Rota katmanı", "Servis" (`LaboratuvarApi`), "Veri kaynağı (bellek içi liste)" | Kitabın kendi sıra diyagramı |
| PUT | Simülasyona girmez; özet tablosunda (L529-535) ve adım 8 notunda (L471) geçer | Kitapta çalışan PUT örneği yok |
| SQL veri kümesi | `yazarlar`: (1, Yaşar Kemal) Kod 7.5 L604-605; (2, Adalet Ağaoğlu) Kod 7.6 L649-650; (3, Bilge Karasu) alıştırma L1936-1938. `kitaplar` (gösterilen sütunlar `kitap_adi`, `yazar_id`): (İnce Memed, 1) L607-608; (Ölmeye Yatmak, 2) L655-657. Bilge Karasu satırı `kitaba-dayali` rozeti taşır | Kitabın JOIN verisi 1×1'dir ve INNER/LEFT farkını göstermez (L788'deki NULL yorumu verisiz). Bütün adlar kitaptan; Kod 7.5 ve 7.6 sırayla çalışınca ilk dört satır kendiliğinden oluşur |
| SQL satır sırası | Model iç içe döngüdür: sol tablo `yazar_id` sırasıyla, sağ tablo ekleme sırasıyla. ORDER BY'sız sorgularda ekranda "ORDER BY yoksa satır sırası garanti değildir" notu durur. LEFT JOIN, Kod 7.7'deki gibi `ORDER BY y.ad_soyad` ile sıralanır (Adalet < Bilge < Yaşar) | Deterministik ve dürüst. Sıralama Türkçe harflerde belirsiz kalmaz, çünkü ilk harfler A, B, Y |
| SQL NULL ve üç değerli mantık | `NULL` hücreleri ayrı biçemde ve `NULL` yazısıyla gösterilir. `WHERE` ve `ON` değerlendirmesi üç değerlidir: `NULL <> 'x'` → `NULL`, satır elenir. `IS NULL` doğru/yanlış verir | L920 tuzağı ancak üç değerli mantıkla doğru anlatılır |
| SQL ek sorgular | `is-null` (L1936-1938 alıştırması), `where-tuzagi` ve `on-filtre` (L920), `parametreli` (Kod 7.14 L1686-1691 biçimi, bu veriyle). Hepsi `kitaba-dayali` | Kitap bunları cümle ya da alıştırma olarak verir, SQL'ini vermez |
| GROUP BY / COUNT | Girmez | Bölümde hiç yok |
| Katmanlı mimari kaynağı | Kod 9.5 (L952-1056) omurgadır. Kod 9.3'ün farklı mesajları kullanılmaz | 9.3 ve 9.5'in mesajları ve repository kümesi farklı; tek tutarlı senaryo gerekir |
| Katmanlı mimari çağrı sırası | Kodun sırası esastır: `kitapBul`, `ogrenciBul`, sonra kitap yok → öğrenci yok → uygun değil → limit. L1074-1086 tablosu limiti okumadan önce gösterir; adım 10 tabloyu kitaptaki gibi verir ve "kodun sırası farklıdır" notunu ekler | Çalışma zamanı semantiği kodu izler |
| Katmanlı mimari durumu | Repository'ler bellekte durum taşır. Adım 8, adım 7'den sonraki durumla aynı isteği yeniden gönderir → `"Kitap uygun değildir."` 400 | Gerçek çalışma: Kod 9.5'in kendi yan etkisi |
| Hata eşlemesi | Kitapta her service hatası controller'da 400'e döner (L1033-1035, L301). 404/409 eşlemesi uydurulmaz; L243 cümlesi notta geçer | Kitapta domain hata sınıfı ve eşleme kodu yok |
| DI ve sahte repository | DI yalnız L1039-1042 `new` zinciri (adım 2). Sahte repository ile test kodu kitapta yok; adım 11 L95 ve L1089 cümleleriyle anlatır, simüle etmez | Uydurma kod öğretmemek |
| Lab'da limit dalı | Kitabın verisi limiti (`>= 3`) tetiklemez. Lab, başlangıç `mevcutOduncSayisi`'ni 0–3 arasında ve `uygunMu`'yu seçtirir; değişen başlangıç `kitap-kodu` rozeti alır | Bütün kod dallarına Lab'dan ulaşılır |
| Dalga 1 küçükleri | Bu dalgada kapanır: 1 (event-loop adım 2-5 `program`), 2 (`stopTone`), 3 (0 ms → "en az 1 ms" notu), 4 (aşama çemberi kenar etiketleri ve çıkış), 5 (kuyruk adları), 8 (vmAnimation kalıntıları), 9 (README kısayol tablosu), 10 (home e2e hazır/yakında sayımı), 11 (SVG `role`/`aria-label`, kod panelinde `aria-current`), 12 (`bitti-gec` başlığı), 13 (Ders adım 1 kod şeridi). 6 ve 7 main'de düzeltildi (108f6d1, cea3c7c); plan bunu doğrular | Wave 2 aynı dosyalara dokunuyor; ayrı bakım dalgası açmamak |
| Görev incelemesi | Model, sahne ve ortak parça görevleri inceleyici alır; e2e, README ve kayıt defteri görevleri almaz | AGENTS.md bölüm temposu |
| Kitap metni değiştirilmez | Kitaptaki tutarsızlıklar animasyonda düzeltilmez, kitaba da yazılmaz; handoff'a not edilir: Şekil 5.2 sırası, Kod 5.3 başlığı, b06 "Kod 6.9/6.7" kanıt atıfları, b07 L1928 "Semaver - 1936", b09 "Kod 9.14" | Kitap salt okunur; düzeltme bookMaker işi |

## Kapsam dışı

- Dalga 3–4 kavramları (yakında kartı kalır).
- `express.Router()` bağlama, async middleware, `next('route')` (kitapta kod yok).
- PUT simülasyonu, sayfalama filtreleri (`arama`, `durum`, Kod 6.4), OpenAPI.
- GROUP BY / toplama, RIGHT/FULL JOIN simülasyonu (yalnız özet tablosunda), çoktan çoğa
  `odunc_islemleri` JOIN'i, transaction, index.
- 1:N satır çoğalması (bir yazara iki kitap). Kitapta verisi yok, uydurulmaz.
- Domain hata sınıfları, 404/409 eşlemesi, DI konteyneri, sahte repository ile test kodu.
- Serbest kod editörü; gerçek Express, PostgreSQL ya da HTTP çalıştırma.
- Kitapta düzeltme.

## Bölüm 1 — Ortak parçalar

**`http-cards.ts`.** `HttpCards` sınıfı; `update(spec)` içeriği yeniden kurar, kartlar kalıcıdır.

- İstek kartı: metot rozeti (GET/POST/PATCH/DELETE renkleri), yol, isteğe bağlı başlık satırları
  (ör. `x-api-anahtari: kitap-api-2026`, `Idempotency-Key: rzv-7f3a`) ve JSON gövde.
- Yanıt kartı: durum kodu rozeti (2xx ok, 4xx/5xx alarm), durum metni (`201 Created`), isteğe bağlı
  başlıklar (`Location`) ve gövde. 204'te "gövde yok". Askıda kalan istekte "yanıt yok — istemci
  bekliyor".
- Terminal: satır listesi; `stderr` satırları alarm renginde.

`istek-yanit` bu sınıfa geçer. Ekran görüntüsü taban çizgileri değişmemeli; değişirse fark gözle
incelenir ve gerekçesiyle yenilenir.

**`data-table.ts`.** `DataTable` sınıfı, DOM `<table>`. Spec: başlık (ör. `kitapListesi`), sütunlar
ve satırlar. Satır alanları:

- `key`: geçişler için kimlik.
- `cells`: `string | number | boolean | null`; `null` → `NULL`.
- `state`: satır durumu.
- `changed`: değişen sütunlar.

Yeni satır kısa vurguyla belirir; silinen satır üstü çizili soluk kalır ve bir sonraki güncellemede
kalkar. `aria-live` yoktur; adım başlığı zaten duyurulur.

**`source-badge.ts`.** `sourceBadge(doc, kind, ref?)` bir `<span class="kaynak-rozeti">` döndürür. Sayfa
sahnesi rozeti adım başlığının altında, sahnenin sağ üst köşesinde gösterir.

**`SequenceLayer`.** `stopTone` ve erişilebilirlik eklentileri. En çok 8 görünür satır kuralı aynen
kalır; daha uzun akışlarda eski mesajlar soluklaşıp yukarı kayar.

**`scripts/kitap-dogrula.mjs`.**

- Her `src/concepts/<kavram>/code-text.ts` bir `LISTINGS` dizisi verir: `{ id, title, bolum, satirlar,
  lines }`.
- Betik `final.md`'den `satirlar` aralığını alır ve `lines` ile birebir karşılaştırır. Yalnız sondaki
  boşluklar yok sayılır.
- Kitabın kod bloğu satırlarında çit (```` ``` ````) yer almaz.
- Çıktı kavram ve listing başına `tamam` ya da ilk farklı satırdır. Kitap klasörü yoksa
  `kitap bulunamadı, atlandı` yazar ve 0 ile çıkar.

## Bölüm 2 — `middleware-zinciri` (Bölüm 5, 11 adım)

**Kaynak kod.**

- Kod 5.5 (L606-669): `express.json()` → `istekGunlugu` → `GET /korumali-durum`
  (`apiAnahtariKontrolu`, işleyici).
- code_010 (L706-729) ve code_011 (L742-766): `next()` unutuldu / çağrıldı.
- code_017 (L1139-1148): `return`'süz 404.
- Hata örneği (`kitaba-dayali`, L682, L1814-1818):

  ```ts
  uygulama.get("/hata-ornegi", () => {
    throw new Error("Beklenmeyen durum");
  });

  uygulama.use((hata: Error, istek: Request, yanit: Response, sonrakiAdim: NextFunction) => {
    console.error(hata.message);
    yanit.status(500).json({ mesaj: "Sunucuda beklenmeyen bir hata oluştu." });
  });
  ```

**Express modeli (`express-sim.ts`).** Kurallar:

1. **Uygulama ve katmanlar.** Uygulama, kayıt sırasıyla bir katman listesidir. Katman türleri:
   - `use(fn)`: her yolu eşler.
   - `route(method, path, ...fns)`: metot ve tam yol eşleşmesi.
   - Hata katmanı: `use` ile kaydedilen 4 parametreli fonksiyon (`arity === 4`).
2. **Dağıtım.** İstek baştan sona yürür; her eşleşen katman sırayla çağrılır. Route katmanının
   fonksiyonları (route middleware'i, sonra işleyici) aynı `next` zinciriyle ilerler.
3. **`next` ve hata.**
   - `next()` sonraki eşleşen normal katmana geçer.
   - `next(err)`, ya da işleyicide senkron `throw`, hata durumuna geçer. Bu durumda normal katmanlar
     atlanır, yalnız hata katmanları çağrılır.
   - Hata yokken hata katmanları atlanır.
4. **Yanıt.**
   - `res.status(k).json(g)` / `res.send(g)` yanıtı gönderir (`headersSent = true`). Zincir, katman
     `next` çağırmadığı için durur.
   - Yanıt ara katmanlardan geri geçmez; diyagramda yanıt oku gönderen şeritten doğrudan istemciye
     çizilir.
5. **Çift yanıt.** `headersSent` iken ikinci `res.json`/`res.status` →
   `Error [ERR_HTTP_HEADERS_SENT]: Cannot set headers after they are sent to the client` (L1193). Hata
   stderr'e düşer; istemci ilk yanıtı almıştır.
6. **Yığın sonu.**
   - Hata yoksa ve yanıt da yoksa Express varsayılan 404 döner: `Cannot ${method} ${path}`.
   - Hata durumundaysa varsayılan 500 döner (bu sayfada hata katmanı her zaman vardır, varsayılan 500
     yalnız Lab'da hata katmanı kapatılınca görünür).
7. **Askıda kalma.** Bir katman ne `next` çağırır ne yanıt gönderirse iz `askida` ile biter
   (L1189: "istek sonsuza kadar askıda kalır ve istemci zaman aşımına uğrar").
8. **GET gövdesi.** `express.json()` gövdesiz GET'te ayrıştıracak bir şey bulmaz ve `next()` çağırır.

`dispatch(app, istek)` bir **iz** döndürür:

- `olaylar: Olay[]`: `{ tur: 'gir' | 'next' | 'log' | 'yanit' | 'hata' | 'atla' | 'askida', katman,
  satir, metin? }`
- `yanit?: { durumKodu, govde }`
- `terminal: { metin, akis: 'stdout' | 'stderr' }[]`

**Sahne.**

- Şeritler: "İstemci", "express.json()", "istekGunlugu", "apiAnahtariKontrolu", "Route işleyicisi".
  Hata adımında son iki şerit "GET /hata-ornegi" ve "Hata middleware'i" olur.
- İstek okları şerit şerit ilerler, etiketleri `next()`. Atlanan katman soluk kalır.
- Yanıt oku durduran şeritten istemciye gider. Askıda kalmada jeton durur ve "yanıt yok" işareti çıkar.
- Sağda HTTP kartları (istek, yanıt, terminal), altta kod izleme paneli (Kod 5.5, etkin satır).

**Adımlar (id — içerik — rozet):**

1. `tanitim` — L570 tanımı; beş şerit; Kod 5.5 panelde. Rozet: `kitap`.
2. `json` — `GET /korumali-durum` + `x-api-anahtari: kitap-api-2026`. `express.json()` gövdesiz GET'te
   `next()` çağırır. Rozet: `kitap-kodu`.
3. `gunluk` — `istekGunlugu`, terminale `GET /korumali-durum` (L667), ardından `sonrakiAdim()`.
   Rozet: `kitap`.
4. `anahtar` — `apiAnahtariKontrolu`: anahtar `"kitap-api-2026"` → `next()`. Rozet: `kitap-kodu`.
5. `isleyici` — İşleyici `200 {"mesaj":"Korumalı bilgiye erişildi."}`. Yanıt doğrudan istemciye gider.
   Rozet: `kitap-kodu`.
6. `yetkisiz` — Anahtarsız istek: günlük satırı yazılır, `401 {"mesaj":"Yetkisiz istek."}` (L668).
   İşleyici soluk. L574 cümlesi. Rozet: `kitap`.
7. `eslesmeyen` — `GET /baska`: `express.json` ve `istekGunlugu` çalışır (terminal `GET /baska`).
   Route eşleşmez → `404 Cannot GET /baska`; route şeritleri soluk. Not L674 (route'a bağlı ve genel
   middleware). Rozet: `kitaba-dayali`.
8. `next-unutma` — code_010: günlük `next` çağırmaz, jeton durur, terminal `/kitaplar` ve
   `zincir surdu mu: false`. Yanında code_011'in çıktısı: `zincir surdu mu: true`. L1189.
   Rozet: `kitap`.
9. `cift-yanit` — code_017: 404 gönderilir, ardından `yanit.json(bulunanKitap)` →
   `ERR_HTTP_HEADERS_SENT` (stderr). İstemcide yalnız 404 durur. L1193. Rozet: `kitap-kodu`.
10. `hata` — Hata örneği: işleyici fırlatır → `next(err)` → normal katmanlar atlanır → hata
    middleware'i → `500 {"mesaj":"Sunucuda beklenmeyen bir hata oluştu."}`; stderr `Beklenmeyen durum`.
    L682. Rozet: `kitaba-dayali`.
11. `ozet` — Tablo: katman, ne yapar, `next()` mi yanıt mı. L1839 cümlesi. Rozet: `kitap`.

**Laboratuvar parametreleri.**

- `yol`: `/korumali-durum`, `/baska`, `/hata-ornegi`.
- `anahtar`: geçerli / yanlış (`yanlis-anahtar`) / yok.
- `gunlukNext` (onay kutusu): `istekGunlugu` `sonrakiAdim()` çağırsın mı.
- `kontrolGenel` (onay kutusu): `apiAnahtariKontrolu` `uygulama.use` ile genel olsun (L674).
  Açıkken `/baska` anahtarsız → 401.
- `hataKatmani` (onay kutusu): hata middleware'i tanımlı mı. Kapalıyken `/hata-ornegi` → varsayılan 500.

Her değişiklikte iz baştan oynar. Kısayollar: `[` / `]` önceki/sonraki olay, `N` `gunlukNext`'i
aç/kapa.

## Bölüm 3 — `rest-crud` (Bölüm 6, 10 adım)

**Model (`api.ts`).**

- `LaboratuvarApi`, code_011'in (L1311-1418) saf TS kopyasıdır. Başlangıç verisi
  `[{1, Mikroskop, musait}, {2, Spektrometre, rezerve}]`, `sonrakiKimlik = 3`.
- `idempotentlik`, code_014'ün (L563-625) kopyasıdır:
  - `stok = { mikroskop: 3 }`
  - `ekipmanlar = Map([[12, "Santrifüj"]])`
  - `rezervasyonlar`, `islenmisAnahtarlar`
- `rota.ts`, HTTP isteğini fonksiyon çağrısına eşler (karar tablosu) ve yanıta HTTP başlıklarını ekler.
  201'e `Location`, 204'e boş gövde.

Çalışma zamanı kuralları:

- Her `gonder(durum, istek)` yeni bir durum ve olay listesi döndürür. Durum değişmez nesnedir
  (immutable); tekrarlı gönderim önceki durumdan devam eder.
- POST yeni kayıt üretir (idempotent değil). İki kez gönderilen POST iki kayıt yaratır: 3, sonra 4.
- GET durumu değiştirmez.
- DELETE ilk seferde siler ve 204 döner, ikincisinde 404 döner. Durum aynı kalır (`kalan: 0`).
- `Idempotency-Key` aynı anahtar ve aynı gövdeyle ilk yanıtı aynen tekrarlar. Farklı gövdeyle 422 döner.
- Gövde parmak izi `JSON.stringify({ ekipmanKimligi, ogrenci })`.

**Sahne.**

- Şekil 6.5'in dört şeridi. Oklar: istek, servis çağrısı, liste işlemi, geri dönüşler.
- Veri tablosu (`ekipmanListesi`, `ekipmanlar`, `stok` ya da `rezervasyonlar`).
- HTTP kartları; kod paneli (code_011 ya da code_014).

**Adımlar:**

1. `tanitim` — Kaynak ve URL (L240, L242, L138). Kod 6.1 çıktısı `/api/ekipmanlar`,
   `/api/ekipmanlar/12` (L300-301). Rozet: `kitap`.
2. `olustur` — POST → `ekipmanOlustur("Santrifüj")` → 201, kimlik 3 (monoton sayaç, L1316-1318).
   Terminal L1432-1437. `Location` başlığı. Rozet: `kitap`.
3. `listele` — GET `?sayfa=1&sayfaBoyutu=2` → 200, iki satır + `metadata` (`toplamKayit: 3`;
   L1438-1446). Yol ve sorgu ayrımı (L228). Rozet: `kitap`.
4. `guncelle` — PATCH `/api/ekipmanlar/1` `{"durum":"rezerve"}` → 200 (L1447-1452). PATCH ve PUT
   ayrımı (L471). Rozet: `kitap`.
5. `bulunamadi` — GET `/api/ekipmanlar/99` → 404 `EKIPMAN_BULUNAMADI` (L1453-1458). Rozet: `kitap`.
6. `gecersiz` — POST `{"ad":"   "}` → 400 `GECERSIZ_AD` "Ekipman adı boş olamaz."; durum değişmez.
   T-C satırı (L814). Rozet: `kitap-kodu`.
7. `sil` — `idempotentlik`: DELETE `/api/ekipmanlar/12` iki kez → `DELETE 1: 204 kalan: 0`,
   `DELETE 2: 404 kalan: 0` (L643-644). T-B satırı (L533). Rozet: `kitap`.
8. `mutlak-goreli` — `stokuAyarla(5)` iki kez → 5, `stokuArtir(1)` iki kez → 7 (L641-642). PATCH
   "garanti edilmez" (L534); PUT notu (L532). Rozet: `kitap`.
9. `idempotency-key` — `rzv-7f3a` ile üç POST → `201 201 422`, `Oluşan rezervasyon sayısı: 1`
   (L645-646). Rozet: `kitap`.
10. `ozet` — T-B tablosu (L529-535) ve Kod 6.5 başarı kodları (L1249-1255). Rozet: `kitap`.

**Laboratuvar parametreleri.**

- `program`: `laboratuvar-api` / `idempotentlik`.
- `istek`: programın hazır istekleri. `laboratuvar-api` için:
  - POST Santrifüj
  - POST boş ad
  - GET liste (1, 2)
  - GET liste (0, 2) → 400 `GECERSIZ_SAYFA`
  - GET 1
  - GET 99
  - PATCH 1 rezerve
  - PATCH 99

  `idempotentlik` için:
  - DELETE 12
  - POST anahtarlı (7, Elif)
  - POST anahtarlı farklı gövde (9, Elif)
  - `stokuAyarla(5)`
  - `stokuArtir(1)`
- `tekrar`: 1–3. Aynı istek art arda gönderilir; her gönderimin yanıtı yanıt kartında sıra numarasıyla
  durur, tablo son durumu gösterir.

Her değişiklik başlangıç verisinden yeniden hesaplar. Kısayollar: `[` / `]` önceki/sonraki gönderim,
`T` tekrar sayısını döndürür (1 → 2 → 3 → 1).

## Bölüm 4 — `sql-join` (Bölüm 7, 10 adım)

**Model (`sql.ts`).** Küçük, sabit bir değerlendirici; SQL ayrıştırıcısı yoktur. Her hazır sorgu
yapılandırılmış biçimde tanımlanır ve yanında kitaptaki ya da kitaba dayalı SQL metni durur. Bir sorgu
şu alanları taşır:

- `tur`: `'kartezyen' | 'inner' | 'left'`
- `on?`: `k.yazar_id = y.yazar_id` + isteğe bağlı ek koşul
- `where?`
- `orderBy?`
- `secim`: sütunlar
- `parametreler?`

`calistir(sorgu)` bir **adım listesi** döndürür. Değerlendirme kuralları:

1. Sol tablonun her satırı için sağ tablonun her satırı denenir (iç içe döngü). Her çift bir adımdır:
   `{ sol, sag, on: true | false | null }`.
2. `ON` üç değerlidir. `NULL` ile karşılaştırma `NULL` verir, `NULL` eşleşme sayılmaz.
3. INNER: yalnız `on === true` çiftleri sonuca girer.
4. LEFT: sol satırın hiç `true` çifti yoksa sağ sütunlar `NULL` olarak tek satır eklenir.
5. Kartezyen: bütün çiftler (3 × 2 = 6).
6. `WHERE` sonuç satırlarına uygulanır ve üç değerlidir: `NULL <> 'İnce Memed'` → `NULL` → satır
   elenir. `IS NULL` true/false verir.
7. `ORDER BY` varsa uygulanır. Yoksa sıra iç içe döngü sırasıdır ve not gösterilir.
8. `$1` parametresi metne gömülmez. Kod panelinde `$1` görünür, yanındaki kartta `[3]` dizisi durur.

**Hazır sorgular:**

| id | SQL | Kaynak | Sonuç |
|---|---|---|---|
| `kartezyen` | code_015 (L881-882) | kitap | 6 satır |
| `inner` | Kod 7.7 ilk sorgu (L777-780) | kitap | 2 satır, Bilge Karasu yok |
| `left` | Kod 7.7 ikinci sorgu (L782-786) | kitap | 3 satır; Bilge Karasu \| NULL |
| `is-null` | `SELECT y.ad_soyad FROM yazarlar AS y LEFT JOIN kitaplar AS k ON k.yazar_id = y.yazar_id WHERE k.yazar_id IS NULL;` | kitaba dayalı, L1936-1938 | `Bilge Karasu` |
| `where-tuzagi` | LEFT JOIN … `WHERE k.kitap_adi <> 'İnce Memed'` | kitaba dayalı, L920 | 1 satır (Adalet Ağaoğlu) |
| `on-filtre` | LEFT JOIN … `ON k.yazar_id = y.yazar_id AND k.kitap_adi <> 'İnce Memed'` | kitaba dayalı, L920 | 3 satır; Yaşar Kemal ve Bilge Karasu NULL |
| `parametreli` | Kod 7.14'teki biçim (L1687-1690) `WHERE y.yazar_id = $1` | kitaba dayalı | `[3]` → Bilge Karasu \| NULL |

**Sahne.**

- Üç veri tablosu: `yazarlar` (`yazar_id` PK, `ad_soyad`), `kitaplar` (`kitap_adi`, `yazar_id` FK) ve
  sonuç.
- PK ve FK sütun başlıkları rozetli. Şekil 7.3'ün `||--o{` ilişkisi iki tablo arasında bir çizgi
  olarak durur.
- Etkin çift iki satırı birlikte vurgular. Aralarında koşul rozeti: `1 = 1 → doğru`, `1 = 2 → yanlış`.
- Sonuç satırı eklenince kısa vurgu alır.
- Kod paneli SQL'i gösterir; etkin satır `ON` ya da `WHERE`'dir.

**Adımlar:**

1. `tanitim` — PK ve FK tanımı (L536), JOIN tanımı (L744). İki tablo boş başlıklarla. Rozet: `kitap`.
2. `veri` — Satırlar kaynaklarıyla dolar: Kod 7.5, Kod 7.6 ve alıştırma (Bilge Karasu rozetli).
   L561 ilişki cümlesi. Rozet: `kitaba-dayali`.
3. `kartezyen` — Koşulsuz FROM: 6 satır. Kitabın 1×1 çıktısı (L887-890) yanında. L879. Rozet: `kitap`.
4. `on-kosulu` — INNER JOIN çift çift: 6 çiftin `ON` sonucu, 2'si doğru. L748. Rozet: `kitap`.
5. `inner-sonuc` — 2 satır; Bilge Karasu yok (L804). Sıra notu. Rozet: `kitap`.
6. `left` — LEFT JOIN: Bilge Karasu korunur, `kitap_adi = NULL`; ORDER BY ile 3 satır (L804, L741).
   Rozet: `kitap`.
7. `is-null` — Kitapsız yazar: `Bilge Karasu`; `IS NULL` ve `=` farkı (L920). Rozet: `kitaba-dayali`.
8. `where-tuzagi` — Sağ tabloya WHERE: NULL satır elenir, sonuç INNER gibi daralır. Ardından
   `on-filtre` ile 3 satır. L920. Rozet: `kitaba-dayali`.
9. `parametreli` — `$1` ve `[3]`: değer metne karışmaz (L454, L1456). Rozet: `kitaba-dayali`.
10. `ozet` — JOIN türü tablosu (L860-865) ve bu veriyle satır sayıları: kartezyen 6, INNER 2, LEFT 3.
    Rozet: `kitap`.

**Laboratuvar parametreleri.**

- `sorgu`: 7 hazır sorgu.
- `deger`: `parametreli` için 1 / 2 / 3.
- `cift` kaydırıcısı: değerlendirme adımları arasında gezinir. Son adım sonuç tablosudur.

Kısayollar: `[` / `]` önceki/sonraki çift.

## Bölüm 5 — `katmanli-mimari` (Bölüm 9, 11 adım)

**Model (`katmanlar.ts`).** Kod 9.5'in (L958-1047) saf TS kopyası. `istekKarsila(durum, istek)` bir
**iz** ve yeni durum döndürür:

- `olaylar`: `{ from, to, tur: 'cagri' | 'donus' | 'firlat' | 'not', etiket, satir }`
- `yanit: { durumKodu, mesaj }`
- `durum: { kitaplar, ogrenciler }`

Çalışma zamanı kuralları:

1. **Controller.**
   - `!ogrenciNumarasi || !kitapKodu` ise service çağrılmadan
     `{ durumKodu: 400, mesaj: "Zorunlu alanlar eksiktir." }` döner.
   - Değilse `try` içinde service çağrılır.
2. **Service okumaları.** Service önce `kitapBul`, sonra `ogrenciBul` çağırır. İkisi de kontrollerden
   önce çalışır. Bulunamazsa repository `undefined` döndürür; repository hata üretmez.
3. **Kural sırası.** Kitap yok → `"Kitap bulunamadı."`; öğrenci yok → `"Öğrenci bulunamadı."`;
   `!uygunMu` → `"Kitap uygun değildir."`; `mevcutOduncSayisi >= 3` → `"Öğrenci limitine ulaştı."`.
   Her biri `throw new Error`.
4. **Hatanın yolu.** `throw` service'ten controller'a yayılır. Diyagramda bu, alarm renkli kesikli bir
   oktur. Controller `catch` ile `{ durumKodu: 400, mesaj }` döndürür.
5. **Başarı.**
   - `kitabiOduncteIsaretle` (içeride yeniden `kitapBul`) → `uygunMu = false`.
   - `oduncSayisiniArtir` → sayaç + 1.
   - Service `` `${kitap.ad} başarıyla ödünç verildi.` `` döndürür; controller bunu 201 ile sarar.
6. **Durum.** Repository durumu çağrılar arasında korunur.

**Sahne.**

- Şeritler: "Çağıran kod" (`console.log(…)`), "OduncAlmaController", "OduncAlmaService",
  "KitapRepository", "OgrenciRepository".
- İki veri tablosu (`kitapListesi`, `ogrenciListesi`).
- Yanıt kartı (`{ durumKodu, mesaj }`) ve terminal; kod paneli (Kod 9.5).
- Adım 10'da sahne L1074-1086 tablosunu gösterir. "Yok" satırları soluk, "Var" satırları vurgulu.

**Adımlar:**

1. `tanitim` — L39 cümlesi; beş şerit; Şekil 9.1 başlığı. Rozet: `kitap`.
2. `kurulum` — L1039-1042 `new` zinciri; bağımlılıklar constructor ile verilir (L173: her sınıf
   yalnız alt katmanı tanır). Rozet: `kitap`.
3. `dogrulama` — Controller biçim doğrulaması geçer (L1027; L296: biçim doğrulaması, iş kuralı değil).
   Rozet: `kitap-kodu`.
4. `okuma` — `kitapBul("JAVA-101")`, `ogrenciBul("2024001")`; tablolarda satırlar etkin. Rozet:
   `kitap-kodu`.
5. `kurallar` — Dört kural geçer (L1012-1015). Rozet: `kitap-kodu`.
6. `yan-etki` — `uygunMu` true → false, `mevcutOduncSayisi` 0 → 1; tablolarda `degisti`.
   Rozet: `kitap-kodu`.
7. `yanit-201` — Terminal L1052-1055 aynen. Rozet: `kitap`.
8. `ikinci-istek` — Aynı istek yeniden → `"Kitap uygun değildir."` fırlar → controller 400. L243,
   L301. Rozet: `kitap-kodu`.
9. `eksik-alan` — `kitapKodu: ""` → `{ durumKodu: 400, mesaj: 'Zorunlu alanlar eksiktir.' }`
   (alıştırma L1297). Service ve repository şeritleri soluk. Rozet: `kitap`.
10. `yasam-dongusu` — 11 adımlık tablo (L1074-1086), "Var/Yok" sütunu, L1072 uyarısı ve kod sırası
    notu. Rozet: `kitap`.
11. `ozet` — Katman İzolasyon İlkesi (L1089), sorumluluk matrisinin "Ne yapmaz?" sütunu (L76-79), L95
    test cümlesi. Rozet: `kitap`.

**Laboratuvar parametreleri.**

- `ogrenciNumarasi`: `2024001` / `2024999` / boş.
- `kitapKodu`: `JAVA-101` / `TS-201` / boş.
- `uygunMu` (onay kutusu, başlangıç).
- `mevcutOduncSayisi`: 0–3.
- `tekrar`: 1–2.

Başlangıç verisi kitaptakinden farklıysa rozet `kitap-kodu` olur. Kısayollar: `[` / `]` önceki/sonraki
olay, `U` `uygunMu`'yu aç/kapa.

## Bölüm 6 — Kayıt defteri, ana sayfa, README

- `registry.ts`: dört kart `hazir`. `vite.config.ts` girdilerine dört sayfa eklenir.
- `tests/e2e/home.spec.ts`: 6 hazır, 9 yakında kart ve "Ders modunda aç" bağlantıları (Dalga 1 küçük 10).
- README:
  - canlı adresler
  - kısayol tablosu: `[ / ]` bütün sayfalar için, sayfaya özel `Y`, `N`, `T`, `U` (küçük 9)
  - `npm run kitap-dogrula`

## Arayüzler

```ts
// src/core/plot/http-cards.ts
export type Metot = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
export interface HttpIstek { metot: Metot; yol: string;
  basliklar?: readonly [string, string][]; govde?: string }    // govde: biçimlenmiş JSON metni
export interface HttpYanit { durumKodu: number; durumMetni?: string;
  basliklar?: readonly [string, string][]; govde?: string | null;   // null → "gövde yok"
  askida?: boolean; sira?: number }                              // sira: tekrarlı gönderimde 1, 2, 3
export interface TerminalSatir { metin: string; akis?: 'stdout' | 'stderr' }
export interface HttpCardsSpec { istek?: HttpIstek; yanitlar: readonly HttpYanit[];
  terminal: readonly TerminalSatir[]; terminalBaslik?: string }
export class HttpCards { readonly root: HTMLDivElement; constructor(host: HTMLElement);
  update(spec: HttpCardsSpec): void; destroy(): void }

// src/core/plot/data-table.ts
export type Hucre = string | number | boolean | null;
export type SatirDurumu = 'yeni' | 'degisti' | 'silindi' | 'eslesti' | 'eslesmedi' | 'etkin' | 'soluk';
export interface TabloSatiri { key: string; cells: readonly Hucre[]; state?: SatirDurumu;
  changed?: readonly number[] }
export interface Sutun { ad: string; anahtar?: 'PK' | 'FK' }
export interface DataTableSpec { baslik: string; sutunlar: readonly Sutun[];
  satirlar: readonly TabloSatiri[]; not?: string }
export class DataTable { readonly root: HTMLDivElement; constructor(host: HTMLElement);
  update(spec: DataTableSpec): void; destroy(): void }

// src/core/plot/source-badge.ts
export type KaynakTuru = 'kitap' | 'kitap-kodu' | 'kitaba-dayali';
export function sourceBadge(doc: Document, tur: KaynakTuru, ref?: string): HTMLSpanElement;

// src/core/plot/sequence.ts (eklenen)
export interface SequenceSpec { /* … */ stopTone?: 'alarm' | 'ok'; ariaLabel?: string }

// her kavramın code-text.ts'i
export interface Listing { id: string; title: string; bolum: string;   // ör. 'b05-express-web-server'
  satirlar: readonly [number, number]; lines: readonly string[] }
export const LISTINGS: readonly Listing[];

// src/concepts/middleware-zinciri/express-sim.ts
export type Fn = { ad: string; arity: 3 | 4; satir: number; govde: (c: Ctx) => void };
export type Katman = { tur: 'use'; fn: Fn } | { tur: 'route'; metot: 'GET' | 'POST'; yol: string; fns: Fn[] };
export interface Istek { metot: 'GET' | 'POST'; yol: string; basliklar: Record<string, string> }
export interface Olay { tur: 'gir' | 'next' | 'log' | 'yanit' | 'hata' | 'atla' | 'askida';
  katman: string; satir: number; metin?: string }
export interface Iz { olaylar: Olay[]; yanit?: { durumKodu: number; govde: string };
  terminal: TerminalSatir[]; askida: boolean }
export function dispatch(app: readonly Katman[], istek: Istek): Iz;

// src/concepts/rest-crud/api.ts
export interface Ekipman { kimlik: number; ad: string; durum: 'musait' | 'rezerve' }
export interface LabDurum { ekipmanListesi: readonly Ekipman[]; sonrakiKimlik: number }
export interface IdemDurum { stok: number; ekipmanlar: readonly [number, string][];
  rezervasyonlar: readonly { kimlik: number; ekipmanKimligi: number; ogrenci: string }[];
  anahtarlar: readonly [string, { parmakIzi: string; durumKodu: number; govde: string }][] }
export type ProgramId = 'laboratuvar-api' | 'idempotentlik';
export interface Gonderim { istek: HttpIstek; yanit: HttpYanit; cagri: string;
  olaylar: Message[]; satirlar: readonly number[]; cikti: string[] }
export function gonder(program: ProgramId, durum: LabDurum | IdemDurum, istekId: string):
  { durum: LabDurum | IdemDurum; gonderim: Gonderim };

// src/concepts/sql-join/sql.ts
export type Deger = string | number | null;
export interface Sorgu { id: SorguId; sql: readonly string[]; tur: 'kartezyen' | 'inner' | 'left';
  ekOn?: Kosul; where?: Kosul; orderBy?: 'ad_soyad'; secim: readonly string[];
  parametreler?: readonly Deger[]; kaynak: KaynakTuru; ref?: string }
export interface CiftAdimi { solKey: string; sagKey: string | null; on: boolean | null;
  eklenen?: readonly Deger[] }
export interface SorguSonucu { adimlar: CiftAdimi[]; satirlar: Deger[][]; elenen: Deger[][];
  sirasiz: boolean }
export function calistir(id: SorguId, deger?: number): SorguSonucu;

// src/concepts/katmanli-mimari/katmanlar.ts
export interface Kitap { kod: string; ad: string; uygunMu: boolean }
export interface Ogrenci { numara: string; mevcutOduncSayisi: number }
export interface Durum { kitaplar: readonly Kitap[]; ogrenciler: readonly Ogrenci[] }
export interface OduncAlmaIstegiDTO { ogrenciNumarasi: string; kitapKodu: string }
export interface KatmanOlayi { from: string; to: string; tur: 'cagri' | 'donus' | 'firlat' | 'not';
  etiket: string; satir: number }
export interface KatmanIzi { olaylar: KatmanOlayi[]; yanit: { durumKodu: 201 | 400; mesaj: string };
  durum: Durum }
export const BASLANGIC: Durum;
export function istekKarsila(durum: Durum, istek: OduncAlmaIstegiDTO): KatmanIzi;
```

Kavram sayfaları `ConceptPage<P>` sözleşmesini değiştirmeden kullanır. Sayfaya özel adlar plan
sırasında değişebilir (Dalga 1 R2 gibi); ortak parçaların arayüzü ise bu belgedeki gibidir.

## Hata durumları

- `dispatch` sonsuz döngüye girmesin: 50 olayı aşarsa `Error('dispatch: olay sınırı')`.
- Bilinmeyen Lab istek kimliği → `gonder` fırlatmaz; ilk hazır isteğe döner (Lab yalnız seçim sunar).
- `calistir`'a yanlış `deger` → 1–3 aralığına sıkıştırılır.
- Lab kaydırıcıları program, sorgu ya da istek değişince 0'a döner; aralık dışı değer sıkıştırılır.
- `katmanli-mimari`'de `tekrar: 2` ilk çağrının durumuyla ikinci çağrıyı yapar; tablolar ikinci
  çağrının sonundaki durumu gösterir.
- `prefers-reduced-motion` → geçiş süreleri 0.
- Dar ekran (390 px): sahne üst üste yığılır (diyagram, kartlar, tablolar, kod). Ders'te kod şeridi
  gizlenebilir (Dalga 1 R10). Beş şeritli diyagramlarda şerit başlıkları kaydırılmadan kırılır.
- `kitap-dogrula` farklı satır bulursa: listing kimliği, satır numarası, beklenen ve bulunan satır;
  çıkış kodu 1.

## Doğrulama

- **Ortak parçalar.**
  - `tests/unit/plot/http-cards.test.ts`: metot rozeti, 204 "gövde yok", askıda, `sira`, stderr.
  - `data-table.test.ts`: `NULL`, satır durumları, `changed`, PK/FK rozeti.
  - `source-badge.test.ts`.
  - `sequence.test.ts` genişler: `stopTone`, `aria-label`.
  - `code-trace.test.ts`: `aria-current`.
- **`tests/unit/middleware-zinciri/express-sim.test.ts`.** Model kuralları 1–8'in her biri.
  - Kitap çıktıları harfiyen: `GET /korumali-durum`, `401 {"mesaj":"Yetkisiz istek."}`,
    `zincir surdu mu: false` / `true`.
  - `/baska` → günlük satırı yazılır, 404 `Cannot GET /baska`.
  - `kontrolGenel` → `/baska` 401.
  - Hata katmanı kapalı → varsayılan 500.
  - Çift yanıt → stderr `ERR_HTTP_HEADERS_SENT`, istemci 404.
- **`tests/unit/rest-crud/api.test.ts`.**
  - code_011 dört çıktısı (L1432-1458) ve code_014 altı satırı (L641-646) harfiyen.
  - POST iki kez → kimlik 3 ve 4.
  - GET durumu değiştirmez.
  - `Location` yalnız 201'de, 204'te gövde yok.
- **`tests/unit/sql-join/sql.test.ts`.**
  - Yedi sorgunun sonuçları; INNER 2, LEFT 3, kartezyen 6.
  - `where-tuzagi` 1, `on-filtre` 3.
  - Üç değerli `<>` ve `IS NULL`; ORDER BY sırası; `sirasiz` bayrağı.
  - Çift adımı sayısı (6) ve `$1` metne gömülmez.
- **`tests/unit/katmanli-mimari/katmanlar.test.ts`.**
  - L1052-1055 çıktısı; durum değişimi.
  - İkinci çağrı `"Kitap uygun değildir."` 400.
  - Boş alan → service olayı yok.
  - Dört hata dalı (Lab başlangıç durumuyla).
  - Okumaların kurallardan önce geldiği olay sırası.
- **`tests/unit/<kavram>/scenario.test.ts`, `scene.test.ts`.** Adım sayıları ve anahtar anlar:

  | Sayfa | Adım → DOM |
  |---|---|
  | middleware | 5 yanıt 200 ve oku istemciye; 6 işleyici soluk; 8 askıda işareti; 10 atlanan katmanlar soluk |
  | rest-crud | 2 tabloda yeni satır 3; 7 iki yanıt (204, 404); 9 yanıtlar 201 201 422 |
  | sql-join | 4 etkin çift ve koşul rozeti; 6 `NULL` hücre; 8 elenen satır |
  | katmanli | 6 `degisti` hücreleri; 8 alarm oku; 10 "Yok" satırları soluk |

  Her adımda kaynak rozeti beklenen türde.
- **`scripts/kitap-dogrula.mjs`.** Dört kavram için temiz; Dalga 1'in iki sayfası da `LISTINGS`'e
  geçer ve temiz çıkar.
- **`tests/e2e/<kavram>.spec.ts`.** Ders klavye yürüyüşü, Lab parametre değişimi, sığma (1280×720,
  1280×740, 390) ve Ders yazı tabanı. Ekran görüntüsü taban çizgileri yalnız anahtar adımlarda:

  | Sayfa | Taban çizgileri |
  |---|---|
  | middleware | ders 5, ders 10, lab 7 |
  | rest-crud | ders 2, ders 9 |
  | sql-join | ders 6, ders 8 |
  | katmanli | ders 8, lab 5 |
- **`tests/e2e/istek-yanit.spec.ts`.** Kart taşıması sonrası mevcut taban çizgileri geçer (ölçüt 4).
- **`tests/e2e/dalga2.perf.spec.ts`** (dalga sonunda bir kez): adım değişiminde uzun görev yok (> 50 ms);
  `sql-join` Lab çift kaydırıcısı p95 < 16 ms.
- **Kapı:** `npm run check`.
