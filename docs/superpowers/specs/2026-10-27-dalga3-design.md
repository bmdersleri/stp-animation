# Dalga 3 — Parola, JWT, RBAC, CORS ve rate limiting — Tasarım

- **Tarih:** 2026-10-27
- **Kaynak:** Öğretmen: "Sonraki: Dalga 3 — salt-hash, jwt-akisi, rbac-401-403 (b10), cors-preflight,
  rate-limiting (b11)." Kitap: `C:\projects\modernSunucuTabProg` (salt okunur),
  `chapters/<bölüm>/content/final.md`:
  - `b10-authentication-authorization` (1544 satır)
  - `b11-secure-backend` (1493)
- **Yetki:** Bütün tasarım kararları benimdir. Kararlar aşağıdaki tabloda `R1`… numarasıyla durur, ledger'a
  `Ruling:` satırı olarak geçer ve iş sonunda öğretmene listelenir. Push ve merge, öğretmenin sohbetteki
  onayını ve yeşil `npm run check`'i bekler.
- **Satır numaraları** `final.md` satırlarıdır (`L269-298` biçiminde; aralık, kod çitlerinin içidir).
  Kontrolcü bütün aralıkları node ile çıkardı. Bu belgedeki bütün hash, base64url ve HMAC değerlerini
  `node:crypto` ile hesapladı.
- **Dalga 1–2 dersleri.** Her brief'e girer:
  - Alt ajanlar LF ve UTF-8 yazar (cp1254 ve CRLF iki kez sızdı).
  - Kart ve tablo sütunları 1280 px'te kaymaz. E2e `.stage`'i değil, gerçek kapsayıcıları ölçer.
  - Sıra diyagramı satırları kendi SVG'sinin içinde kalır (`tests/e2e/helpers.ts` `seqOutsideSvg`).
  - Ders kod şeridi, kararın verildiği satıra odaklanır.
  - Kitaba ait olmayan açıklama kitaba atfedilmez. Rozetler veriye dürüsttür. Kitapta olmayan girdi ya
    da ara değer içeren adım `kitap-kodu` alır.
  - `npm run kitap-dogrula` listing'leri `final.md` ile karşılaştırır.
  - Sahne erken, gerçek tarayıcıda denetlenir.
  - Çalışma zamanı semantiği (Node `crypto`, tarayıcının CORS denetimi, limiter saati) brief'te açıkça
    modellenir.

## Amaç ve kabul ölçütleri

Öğrenci şunları kavramalı:

1. **Parola şifrelenmez, tuzlanıp yavaşça özetlenir.**
   - Tuzsuz hızlı hash aynı parolaya hep aynı değeri verir.
   - Her kullanıcının rastgele salt'ı, aynı parolaya farklı hash verir. Doğrulama kayıttaki salt ile
     yeniden hesaplar.
   - Karşılaştırma `timingSafeEqual` ile yapılır, `===` ile değil.
2. **JWT imzalıdır, şifreli değildir.**
   - `header.payload.imza`: payload herkesçe okunur.
   - İmza, gizli anahtarı bilmeyen birinin payload'ı değiştirmesini yakalar.
   - Doğrulama sırası: biçim, imza, süre alanı, süre.
3. **401 kimlik sorunudur, 403 yetki sorunudur.**
   - Önce authentication, sonra authorization çalışır.
   - Geçersiz token rol denetimine hiç ulaşmaz.
   - Yanlış kod istemciyi gereksiz yere giriş ekranına gönderir.
4. **CORS bir tarayıcı politikasıdır.**
   - Sunucu izin verdiği kökeni başlıkla bildirir. Tarayıcı, yanıtı betiğe verip vermeyeceğine bu başlığa
     göre karar verir.
   - İstek yine de sunucuya ulaşmıştır: CORS okumayı engeller, göndermeyi engellemez.
   - `curl` CORS'u hiç dikkate almaz.
   - Basit olmayan istekten önce tarayıcı bir `OPTIONS` ön isteği (preflight) gönderir.
5. **Rate limiting, bir anahtarın pencere başına istek sayısını sınırlar.**
   - Sınır aşılınca 429 döner. Pencere dolunca sayaç sıfırlanır.
   - Her anahtarın kendi sayacı vardır.
   - Sabit pencere, sınırda patlamaya izin verir.
   - Ucuz denetimler dışta çalışır.

Kabul ölçütleri:

1. Beş yeni sayfa açılır; hepsi Ders (`?mod=ders`) ve Laboratuvar modunda çalışır:

   | Sayfa | Başlık | Bölüm | Adım |
   |---|---|---|---|
   | `salt-hash/` | "Parola güvenliği: salt ve hashing" | 10 | 9 |
   | `jwt-akisi/` | "JWT: üretim ve doğrulama" | 10 | 11 |
   | `rbac-401-403/` | "RBAC ve 401 ile 403 ayrımı" | 10 | 11 |
   | `cors-preflight/` | "CORS: köken kararı ve preflight" | 11 | 10 |
   | `rate-limiting/` | "Rate limiting: sabit pencere" | 11 | 10 |

   Ana sayfada 11 kavram **hazır**, 4 kavram **yakında** görünür.
2. Ekrandaki her kod satırı kitaptakiyle **harfiyen** aynıdır.
   - Kitabın çıktı blokları ve `// Çıktı:` yorumları birim testinde sabit metin olarak doğrulanır.
   - Kitapta olmayan her girdi, çıktı, ara değer ya da kural bir **kaynak rozeti** taşır.
3. Her sayfanın modeli saf TypeScript'tir ve çalışma zamanı kurallarını açıkça uygular. Her kuralın
   birim testi vardır.
   - Kriptografik değerler gerçektir: birim testi her sabiti `node:crypto` ile yeniden hesaplar.
4. Yeni ortak parçalar `src/core/` altındadır:
   - `plot/check-list.ts`
   - `plot/segment-strip.ts`
   - `kripto.ts`

   Var olanlara eklemeler: `source-badge.ts` (`standart` türü), `http-cards.ts` (`OPTIONS`, eksik başlık).
5. `npm run kitap-dogrula` beş yeni sayfa ve eski altı sayfa için temiz çıkar.
6. Her adım 1280×720, 1280×740 ve 390 px genişlikte sahneye sığar. Ders yazı tabanları önceki dalgalardaki
   gibidir. Kart, tablo ve şerit kapsayıcıları 1280'de yatay kaymaz. Sıra diyagramı satırları kendi
   SVG'sinin içinde kalır.
7. `npm run check` yeşil.

## Kararlar

| # | Konu | Karar | Neden / yanlışsa maliyeti |
|---|---|---|---|
| R1 | Kripto kütüphanesi | `@noble/hashes` (2.x) çalışma bağımlılığı olur: `sha256`, `hmac`, `scrypt`, `scryptAsync`. `src/core/kripto.ts` bunu sarar: `sha256Hex`, `hmacSha256B64url`, `scryptHex` (async), `b64urlJson`, `b64urlCoz`. Yalnız Dalga 3 sayfaları içe aktarır | WebCrypto'da scrypt yok; HMAC ve SHA-256 orada yalnız async. Saf TS, bağımlılıksız ve denetlenmiş bir kütüphane. Yanlışsa: sayfa başına yaklaşık 15 KB fazla |
| R2 | Ders'te sabit kripto değerleri | Ders adımları önceden hesaplanmış sabitleri gösterir (`salt-hash/degerler.ts`, `jwt-akisi/degerler.ts`, `rbac-401-403/degerler.ts`). Birim testi her sabiti `node:crypto` ile (`scryptSync`, `createHmac`, `createHash`) yeniden üretir; ayrıca `kripto.ts`'in aynı değeri verdiğini doğrular. Lab canlı hesaplar | Ders deterministik kalır ve adım değişiminde 50 ms'lik uzun görev oluşmaz. Değerler yine de gerçektir |
| R3 | Salt | Ders'te sabit salt'lar kullanılır: `a3f1c2d4e5b60718293a4b5c6d7e8f90` ve `5e0c9b8a7f6d5c4b3a29180f7e6d5c4b`. Kitapta `randomBytes(16).toString("hex")` vardır. Salt, scrypt'e **hex metni** olarak (32 karakterin UTF-8 baytları) verilir; parametreler Node varsayılanıdır: N=16384, r=8, p=1, 64 bayt. Lab'daki "Yeni salt" `crypto.getRandomValues` kullanır. Salt gösteren adımlar `kitap-kodu` rozeti ve "salt bu sayfada sabittir" notu taşır | Kitabın kodu birebir çalışır, yalnız rastgelelik sabitlenir. Hex'i bayta çevirmek Node'dan farklı hash verirdi |
| R4 | JWT saati | Ders'in "şimdi"si `1788606528600`'dir. Böylece `sonGecerlilik = 1788607428600` olur; bu, kitabın çıktısındaki değerdir (L512). `rbac-401-403` aynı saati kullanır. Lab, verilişten sonra 0–30 dakika kaydırıcısı sunar | Kitabın yazdığı payload harfiyen çıkar; token deterministik olur |
| R5 | `tip` alanı | Kitabın header'ı `{ alg: "HS256", tip: "JWT" }` aynen kullanılır (RFC 7519'da alan `typ`'tir). Ekranda düzeltme ya da not yoktur; tutarsızlık handoff'a yazılır | Kitap kodu harfiyen. Kitaba ait olmayan düzeltme kitaba atfedilmez |
| R6 | Dördüncü rozet türü | `source-badge.ts` yeni bir tür kazanır: `standart` ("Standarttan · kitapta kodu yok", ref örn. `Fetch`). Yalnız `cors-preflight`'ın preflight adımları ve tarayıcı kuralları kullanır | Kitapta preflight kodu yok; yalnız L646'da bir tablo hücresi var. Tarayıcının uyguladığı kural kitaba atfedilemez. Yanlışsa: bir rozet türü fazla |
| R7 | Sayfa adı `cors-preflight` | Slug korunur, başlık "CORS: köken kararı ve preflight" olur. Adım 1–6 ve 10 kitabı izler; 7–9 preflight'ı `standart` rozetiyle anlatır | Öğretmenin verdiği ad. Preflight, Kod 11.7'nin JSON girişinin tarayıcıda gerçekten yaşadığı adımdır |
| R8 | Tarayıcı CORS modeli | `cors-preflight/tarayici.ts`, Fetch standardının sadeleştirilmiş kurallarını uygular (Bölüm 4). Tarayıcı hata metinleri Türkçe açıklamadır; Chrome konsolunun metni gibi sunulmaz. Betik yalnız `TypeError` görür | Chrome metinleri sürüme göre değişir ve burada doğrulanamaz |
| R9 | API kökeni ve uç noktalar | API kökeni `https://api.kutuphane.mehmetakif.edu.tr`, uç noktalar `GET /api/kitaplar` ve `POST /api/giris`. Bunlar sayfanındır, `kitaba-dayali` rozetiyle (L540, L582). `GET` yanıt gövdesi "kitap listesi (JSON)" diye özetlenir; veri uydurulmaz | Kitap kökenleri verir, API'nin adresini vermez |
| R10 | `cors` paketi davranışı | Sunucu türü `cors-paketi`, `cors({ origin: izinVerilenKokenler, credentials: true })` gibi davranır: `OPTIONS` → `204`; `Access-Control-Allow-Origin` (istek kökeni), `-Allow-Credentials: true`, `-Allow-Methods: GET,HEAD,PUT,PATCH,POST,DELETE`, `-Allow-Headers` (istekteki `Access-Control-Request-Headers` yansıtılır), `Vary: Origin`. İzinsiz kökende CORS başlığı eklenmez. Rozet `standart` | Paketin varsayılanları. Kitap L646 yalnız "preflight isteklerini otomatik yönetir" der |
| R11 | Kod 11.7'de saat | Kod 11.7 `istegeIzinVer(istemciIp)` çağırır (`Date.now()`). Model, kitabın L740'ta yaptığı gibi `simdi`'yi açıkça verir. Ekranda saat "t = 0 s" biçiminde göreli gösterilir | Deterministik. Kitabın kendi imzası `simdi` parametresini kabul eder |
| R12 | Rate limiting algoritmaları | Yalnız kitabın sabit penceresi simüle edilir. Kayan pencere ve token bucket özet tablosunda (L771-774) geçer | Kitapta yalnız sabit pencerenin kodu var |
| R13 | `===` ile karşılaştırma adımı | `salt-hash` adım 7, iki hash'i karakter karakter gösterir. `===` ilk farkta durur, `timingSafeEqual` 64 baytın hepsine bakar. Rozet `kitaba-dayali · L316, L331`. Gerçek süre ölçülmez | Kitabın cümlesi. Gerçek zamanlama farkı tarayıcıda ölçülemeyecek kadar küçük ve gürültülüdür |
| R14 | Yavaşlık ölçümü | Ders'te ölçüm yok; L337-342 tablosu gösterilir. Lab "bu tarayıcıda ölçüldü: sha256 x ms, scrypt y ms" satırını gösterir, rozeti `kitap-kodu`. E2e değeri değil, satırın varlığını denetler | Ders deterministik. Lab'da gerçek ölçüm öğreticidir |
| R15 | Lab parola alanları | `salt-hash` Lab'ı iki metin kutusu sunar (`parola`, `deneme`; en çok 32 karakter). Hesaplama `scryptAsync` ile, 250 ms gecikmeyle yapılır; sürerken "hesaplanıyor…" görünür | Kitabın konusu girilen parola. Serbest kod editörü değildir |
| R16 | `rbac-401-403` omurgası | Kod 10.7 (L1118-1256) omurgadır; çıktısı `// Çıktı:` yorumlarındadır (L1254-1256, `OUTPUT_FOR` bloğu yok). Kod 10.4, 10.6 ve code_012 kendi adımlarında kod paneline gelir | Kod 10.7 kayıt, giriş, token ve rolü birlikte taşır; 401 ve 403'ü gerçek tokenla üretir |
| R17 | Kod 10.7 salt'ları | `yasemin` için `0f1e2d3c4b5a69788796a5b4c3d2e1f0`, `elif` için `1a2b3c4d5e6f708192a3b4c5d6e7f809`. Repository tablosu hash'in ilk 16 karakterini ve `…` gösterir | R3 ile aynı ilke |
| R18 | Zincir gösterimi | Kitabın kodunda adımlar elle çağrılır (L401). `rbac-401-403`'ün şeritleri, `kitapEkle` içindeki çağrı sırasıdır: `tokenDogrula` sonra `sadeceKutuphaneci`. Express zinciri çizilmez; L165 ve L401 notta geçer | Uydurma `app.use` kodu öğretmemek |
| R19 | Lab'da kayıtsız kullanıcı | `rbac-401-403` Lab'ı kayıtsız `ahmet` seçeneğini sunar → `"401: Kullanıcı adı veya parola hatalı."`. Mesaj, yanlış parolayla aynıdır (L955). Rozet `kitap-kodu` | Kullanıcı adı taraması (enumeration) uyarısı kodun kendi davranışıyla gösterilir |
| R20 | Ortak parçalar | `check-list.ts` (sıralı denetimler: geçti, kaldı, atlandı, bekliyor) dört sayfada kullanılır: `jwt-akisi`, `rbac-401-403`, `cors-preflight`, `rate-limiting`. `segment-strip.ts` (renkli parçalı tek aralıklı metin, karakter farkı vurgusu) `salt-hash` ve `jwt-akisi`'de kullanılır. Zaman çizelgesi yalnız `rate-limiting`'in olduğundan sayfada kalır (`scene-timeline.ts`) | AGENTS.md: ikinci bir sayfanın istediği katman `core/plot`'a gider |
| R21 | Dalga 2 küçükleri | Dalga 2 `final-review.md` "can wait" maddeleri bu dalgada açılmaz. Yalnız dokunulan ortak dosyalardaki maddeler kapanır: http-cards `.yanit-ust` ve pre-wrap (madde 2) ve `sequence.ts` eski `aria-label` (madde 1) | Dalga dar kalır; aynı dosyaya dokunulurken ucuz olanlar kapanır |
| R22 | Görev incelemesi | Model, sahne ve ortak parça görevleri inceleyici alır. E2e, README ve kayıt defteri görevleri almaz. Son inceleme ve düzeltme opus'tadır, alt ajanlar sonnet | AGENTS.md bölüm temposu, öğretmenin model kuralı |
| R23 | Kitap metni değiştirilmez | Tutarsızlıklar ekranda düzeltilmez, handoff'a yazılır: Kod 10.3 `tip` (R5); Kod 10.3 ve 10.7 imzayı `!==` ile karşılaştırır, oysa L316 hash için `timingSafeEqual` ister; Kod 11.4'ün başlıkları JSON preflight'ına yetmez, kitap bunu L646'da pakete bırakır; Kod 10.7'de `OUTPUT_FOR` bloğu yok | Kitap salt okunur; düzeltme bookMaker işidir |

## Kapsam dışı

- Dalga 4 kavramları (yakında kartı kalır).
- Bölüm 11'in validation, `AppError` ve secrets yönetimi bölümleri. Kod 11.7'de geçtikleri kadar
  gösterilir, ayrı sayfa olmaz.
- Refresh token, token iptali, oturum ve çerez tabanlı kimlik, OAuth/SSO, ABAC, kaynak sahipliği (BOLA).
- bcrypt ve argon2 simülasyonu (yalnız L337-342 tablosunda geçer).
- Kayan pencere, token bucket ve Redis deposu (R12).
- CSRF token ve `SameSite` simülasyonu (yalnız L550-556 tablosu).
- Gerçek ağ isteği, gerçek CORS sunucusu, serbest kod editörü.
- Kitapta düzeltme.

## Bölüm 1 — Ortak parçalar

**`src/core/kripto.ts`** (R1). Saf fonksiyonlar, DOM yok:

- `sha256Hex(metin)` — UTF-8 baytlarının SHA-256'sı, küçük harf hex.
- `hmacSha256B64url(anahtar, veri)` — `createHmac("sha256", anahtar).update(veri).digest("base64url")`
  ile aynı.
- `b64urlJson(deger)` — `Buffer.from(JSON.stringify(deger)).toString("base64url")` ile aynı (dolgu yok).
- `b64urlCoz(parca)` — UTF-8 metin. Geçersiz girdide fırlatır.
- `scryptHex(parola, salt, { N: 16384, r: 8, p: 1, dkLen: 64 })` — `scryptAsync`; `Promise<string>`.
  `scryptSyncHex` yalnız testte.
- `rastgeleSaltHex()` — 16 bayt, `crypto.getRandomValues`.

**`src/core/plot/check-list.ts`** (R20). `CheckList` sınıfı, DOM listesi (`<ol>`):

- Satır alanları: `ad`, `durum` (`'gecti' | 'kaldi' | 'atlandi' | 'bekliyor'`), isteğe bağlı `ayrinti`
  ve `sonuc` (ör. `401`).
- `kaldi` satırı alarm renginde. Sonrakiler `atlandi` olur ve soluk görünür; "denenmedi" yazar.
- Satır metni kırılır, kapsayıcı yatay kaymaz.

**`src/core/plot/segment-strip.ts`** (R20). `SegmentStrip`, tek aralıklı metin parçaları:

- Her parçanın `metin`, `etiket` (ör. "header", "salt"), `ton` (0–3) ve isteğe bağlı `fark` alanları
  vardır. `fark: number[]` başka bir şeride göre değişen karakter indeksleridir.
- Uzun hash'ler karakter sınırında kırılır (`overflow-wrap: anywhere`); 128 karakterlik hex 390 px'te
  sığar.
- `kisalt?: number` ilk n karakteri ve `…` gösterir; tam metin `title`'da durur.

**`source-badge.ts`** (R6). `KaynakTuru`'na `'standart'` eklenir: metin "Standarttan · kitapta kodu yok",
açıklama "Bu davranış kitabın kodunda yok; tarayıcı ya da paket standardından gelir." Var olan üç türün
metni değişmez.

**`http-cards.ts`.**

- `Metot`'a `'OPTIONS'` eklenir.
- `HttpYanit`'e `eksikBasliklar?: readonly string[]` eklenir. Her biri alarm renginde "`ad`: yok" satırı
  olarak görünür.
- `HttpIstek`'e `kaynak?: string` eklenir (istemci adı, ör. "tarayıcı", "curl"); kartın üst satırında
  görünür.
- R21 madde 2 kapanır.

**`sequence.ts`.** R21 madde 1: `ariaLabel` verilmezse eski `aria-label` kaldırılır.

## Bölüm 2 — `salt-hash` (Bölüm 10, 9 adım)

**Kaynak kod.**

- Kod 10.2 (code_003, L269-298), çıktı L303-304 (`true`, `false`).
- code_004 (L355-366), çıktı L371 (`true`).

**Model (`parola.ts`).**

- `parolaHashle(parola, salt)` → `{ salt, hash }`, `parolaDogrula(parola, kayit)` → `{ sonuc, denemeHash,
  ilkFark }`. `guvensizHashle(parola)` → hex.
- `ilkFark`: iki hex metnin ilk farklı karakterinin indeksi; eşitse `-1`.
- `karsilastirmaAdimi(a, b, yontem)`:
  - `'esittir'`: ilk farka kadar karşılaştırılan karakter sayısı.
  - `'timingSafeEqual'`: her zaman 64 bayt.
- Ders sabitleri (`degerler.ts`, R2/R3):
  - `sha256("123456")` = `8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92`.
  - `guclu-Parola123` + salt `a3f1…8f90` → `cc62223a327ab808…`.
  - `guclu-Parola123` + salt `5e0c…5c4b` → `d3d03cc76308e4e4…`.
  - `yanlis-parola` + salt `a3f1…8f90` → `188d49cb0f92460a…`.
  - Tam değerleri plan verir. Test, `scryptSync` ile yeniden üretir.

**Sahne.**

- Üstte "Kullanıcı tablosu" (`DataTable`: kullaniciAdi, salt, hash; hash kısaltılmış).
- Ortada hesap hattı: parola → (salt +) → `scryptSync`/`sha256` kutusu → hash şeridi (`SegmentStrip`).
- Karşılaştırma adımlarında iki hash şeridi üst üste, farklı karakterler vurgulu.
- Sağda terminal (`HttpCards` terminali); altta kod izleme paneli (Kod 10.2 ya da code_004).

**Adımlar (id — içerik — rozet):**

1. `tanitim` — Tanım (L243) ve ipucu (L240): hash tek yönlüdür, geri çözülmez. Rozet: `kitap`.
2. `tuzsuz` — code_004: `guvensizHashle("123456")` iki kez → iki şeritte aynı 64 karakter. Terminal
   `true` (L371). L344 cümlesi. Rozet: `kitap-kodu` (hex kitapta yok).
3. `salt-uret` — `parolaHashle("guclu-Parola123")`: salt (L282), scrypt (L283), `{ salt, hash }` tabloya
   yazılır. Kod şeridi L283'te. Rozet: `kitap-kodu`.
4. `ayni-parola` — İkinci salt ile aynı parola → farklı hash; fark vurgusu neredeyse bütün şeritte. L331
   cümlesi, L246 (rainbow table). Rozet: `kitap-kodu`.
5. `dogru-parola` — `parolaDogrula("guclu-Parola123", kayitliParola)`: kayıttaki salt ile yeniden
   hesap (L288) → aynı hash → terminal `true` (L303). Rozet: `kitap`.
6. `yanlis-parola` — `"yanlis-parola"` → farklı hash → `false` (L304). Rozet: `kitap`.
7. `zamanlama` — R13: `===` ilk karakterde durur (`1/128`), `timingSafeEqual` 64/64 bayt. Kod şeridi
   L290'da. L316 dikkat notu. Rozet: `kitaba-dayali · L316, L331`.
8. `yavas` — L249 ve L312 cümleleri; alternatifler tablosu (L337-342). Rozet: `kitap`.
9. `ozet` — Kritik satırlar (L311-313) ve doğru yaklaşım cümlesi (L374). Rozet: `kitap`.

**Laboratuvar parametreleri.**

- `parola` (metin, varsayılan `guclu-Parola123`) ve `deneme` (metin, varsayılan `yanlis-parola`).
- `yontem`: `scrypt + salt` (Kod 10.2) / `sha256, salt yok` (code_004).
- `salt`: `sabit 1` / `sabit 2` / `yeni`. `S` tuşu ya da düğme yeni salt üretir.
- `ikinciKullanici` (onay kutusu): aynı parolayla ikinci bir kayıt ekler. sha256'da iki hash aynı,
  scrypt'te farklı çıkar.

Çıktı: tablo, iki hash şeridi, `true`/`false`, ilk fark indeksi, ölçülen süre (R14). Rozet: `kitap-kodu`.

## Bölüm 3 — `jwt-akisi` (Bölüm 10, 11 adım)

**Kaynak kod.**

- Kod 10.3 (code_005, L421-507), çıktı L512-515.
- code_006 (L555-570), çıktı L575.
- Şekil 10.3 başlığı (L399) ve açıklaması (L401).

**Model (`jwt.ts`).** Kod 10.3'ün saf TS kopyası, saat parametreli (R4):

- `tokenUret(payload, anahtar = GIZLI_ANAHTAR)` → `{ header, govde, imza, token }`.
- `tokenDogrula(token, simdi)` → `{ denetimler, sonuc }`. `sonuc` ya `{ payload }` ya `{ hata }`'dır;
  hata metni kitabınkidir.
- Denetim sırası kodunkidir:
  1. `parcalar.length !== 3 || !header || !govde || !imza` → `"401: Token biçimi geçersiz."`
  2. `imza !== beklenenImza` → `"401: Token imzası geçersiz."`
  3. `JSON.parse` (L464). Bozuk JSON'da `SyntaxError` olduğu gibi yükselir. Kitapta yakalanmaz; Lab bunu
     "yakalanmamış hata" diye gösterir.
  4. `typeof payload.sonGecerlilik !== "number"` → `"401: Token süre alanı eksik."`
  5. `Date.now() > payload.sonGecerlilik` → `"401: Token süresi dolmuş."` (`simdi` ile).

  Bir denetim kalınca sonrakiler `atlandi` olur.
- Ders sabitleri (R2, R4), anahtar `kutuphane-sunucu-sirri`:
  - header `eyJhbGciOiJIUzI1NiIsInRpcCI6IkpXVCJ9`
  - govde `eyJrdWxsYW5pY2lBZGkiOiJlbGlmIiwicm9sIjoib2dyZW5jaSIsInNvbkdlY2VybGlsaWsiOjE3ODg2MDc0Mjg2MDB9`
  - imza `p1aKZ8iwwpShCIkzPs1HH23xYmZSUhwPknpJRwVpavM`
  - süresiz govde `eyJrdWxsYW5pY2lBZGkiOiJlbGlmIiwicm9sIjoib2dyZW5jaSJ9`, imzası
    `Nbua2B5HZZaFd1FQ6I_KfnJwFs2vKArT1EX0HUl0dmg`
  - rolü `kutuphaneci` yapılmış govde
    `eyJrdWxsYW5pY2lBZGkiOiJlbGlmIiwicm9sIjoia3V0dXBoYW5lY2kiLCJzb25HZWNlcmxpbGlrIjoxNzg4NjA3NDI4NjAwfQ`

**Sahne.**

- Üstte token şeridi (`SegmentStrip`: header · govde · imza, üç ton).
- Altında iki çözülmüş JSON kutusu (header, payload).
- Sağda denetim listesi (`CheckList`: biçim, imza, süre alanı, süre) ve terminal.
- Altta kod izleme paneli (Kod 10.3).
- İmza adımlarında "gelen imza" ve "beklenen imza" iki şerit olarak durur, farklı karakterler vurgulu.
- Adım 11: Şekil 10.3'ün akışı `SequenceLayer` ile çizilir. Şeritler "İstemci", "Sunucu"; giriş isteği →
  token; korumalı istek + token → doğrulama → yanıt.

**Adımlar:**

1. `tanitim` — Tanım (L382): üç bölüm, nokta ile ayrılmış. Rozet: `kitap`.
2. `header` — `base64UrlKodla({ alg: "HS256", tip: "JWT" })` (L446) → şeridin ilk parçası. Rozet:
   `kitap-kodu`.
3. `payload` — `{ kullaniciAdi: "elif", rol: "ogrenci", sonGecerlilik: 1788607428600 }` → govde (L447).
   Rozet: `kitap-kodu`.
4. `okunur` — code_006: base64url çözülür, payload düz metin okunur. Terminal L575 aynen. L544 cümlesi:
   imzalı, şifreli değil. Rozet: `kitap`.
5. `imza` — `imzaOlustur(header.govde)` (L441-443, L448): HMAC-SHA256, `GIZLI_ANAHTAR`. Token tamamlanır.
   Rozet: `kitap-kodu`.
6. `dogrula` — `tokenDogrula(token)`: dört denetim geçer. Terminal L512 aynen. Rozet: `kitap`.
7. `bozuk-imza` — `token + "bozuk"`: imza şeridinin sonuna 5 karakter eklenir. Biçim geçer, imza kalır.
   Terminal `401: Token imzası geçersiz.` (L513). Rozet: `kitap`.
8. `rol-degisti` — Saldırgan payload'da `rol`'ü `kutuphaneci` yapar, eski imzayı korur. Beklenen imza
   değişir, gelen değişmez → `401: Token imzası geçersiz.` L528 dikkat notu (imza süreden önce). Rozet:
   `kitaba-dayali · L528`.
9. `sure-alani` — Süre alanı eksik payload (L493): imza geçer, süre alanı kalır → `401: Token süre alanı
   eksik.` (L514). Rozet: `kitap`.
10. `fazla-segment` — `${token}.fazladan` → dört parça → `401: Token biçimi geçersiz.` (L515). Sonraki
    denetimler "denenmedi". Rozet: `kitap`.
11. `akis` — Şekil 10.3 akışı ve L401 cümlesi (durumsuzluk, iptal zorluğu L385). Kod 10.3'ün süresi dolmuş
    dalı (L470-472) notta geçer. Rozet: `kitap`.

**Laboratuvar parametreleri.**

- `kullanici`: `elif / ogrenci` / `yasemin / kutuphaneci`.
- `bozulma`: yok / imza bozuk (`+ "bozuk"`) / rol değiştir / süre alanı yok / fazla segment /
  başka anahtarla imzala (`saldirgan-sirri`) / payload bozuk JSON.
- `dakika`: 0–30 (verilişten sonra geçen süre; 15'ten sonra "süresi dolmuş").

`B` tuşu `bozulma`'yı döndürür. Rozet: `kitap-kodu`.

## Bölüm 4 — `cors-preflight` (Bölüm 11, 10 adım)

**Kaynak kod.**

- Kod 11.4 (code_007, L577-609), çıktı L614-621.
- code_008 (L660-668).
- Kod 11.7'nin CORS kısmı (L1111-1118) ve çıktısı L1207-1208.

**Sunucu modeli (`sunucu.ts`).** Her istek için başlık kümesi üretir. Türler:

- `kitap-karari`: her yanıta `corsKarariVer(origin)` başlıkları eklenir. `OPTIONS` → `204`.
- `cors-paketi`: R10.
- `wildcard`: code_008'in başlıkları.
- `kitap-11-7`: `corsKontrolEt(origin)` izinsiz kökende `403 {"mesaj":"Bu köken için CORS izni
  yoktur."}` döner. `OPTIONS` dahil.

`GET /api/kitaplar` → `200`. `POST /api/giris` → Kod 11.7'nin `200 { durumKodu: 200, mesaj: 'Giriş
başarılı.' }` yanıtı.

**Tarayıcı modeli (`tarayici.ts`)** (R8). Fetch standardının sadeleştirilmiş kuralları:

1. **Köken.** Köken protokol + alan adı + porttur (L540). Sayfa ve API kökeni aynıysa CORS denetimi
   yoktur.
2. **İstemci.** `curl` `Origin` göndermez ve CORS başlıklarına bakmaz. Yanıtı her durumda yazdırır.
3. **Preflight gereği.** Metot `GET`, `HEAD` ya da `POST` değilse preflight gerekir. Güvenli listede
   olmayan bir başlık varsa da gerekir:
   - `Content-Type` yalnız `text/plain`, `multipart/form-data` ve
     `application/x-www-form-urlencoded` değerlerinde güvenlidir.
   - `Authorization` hiçbir zaman güvenli değildir.
4. **Preflight isteği.** `OPTIONS`, başlıkları `Origin`, `Access-Control-Request-Method` ve
   `Access-Control-Request-Headers`'dır. Son başlık küçük harfli, virgülle ayrılmış ve sıralıdır.
   Preflight çerez taşımaz.
5. **Preflight denetimleri** (`CheckList`, sırayla):
   1. Durum 2xx.
   2. `Allow-Origin` istek kökenine eşit. Kimlik bilgisiz istekte `*` da olur.
   3. Kimlik bilgisi `include` ise `Allow-Credentials: true` ve `Allow-Origin` `*` değil.
   4. Metot güvenli listede (GET/HEAD/POST) ya da `Allow-Methods`'ta. `*` yalnız kimlik bilgisizken
      geçer.
   5. Her istek başlığı `Allow-Headers`'ta. `*` kimlik bilgisizken geçer ama `authorization`'ı kapsamaz.

   Biri kalırsa asıl istek **hiç gönderilmez**; betik `TypeError` alır.
6. **Asıl istek.** Sunucuya gider ve sunucu onu işler. Yanıtta 5.2 ve 5.3 denetimleri yapılır. Kalırsa
   betik `TypeError` alır, oysa sunucu işi yapmıştır (L556).
7. Preflight önbelleği (`Max-Age`) modellenmez.

**Sahne.**

- `SequenceLayer` şeritleri: "Sayfa betiği (köken)", "Tarayıcı", "API sunucusu". Preflight oku `OPTIONS`
  etiketlidir. Engellenen yanıt tarayıcı şeridinde durur, betiğe `TypeError` oku gider.
- Sağda HTTP kartları (istek ve yanıt başlıkları; eksik başlık alarm satırı) ve tarayıcı denetim
  listesi (`CheckList`).
- Altta kod izleme paneli (Kod 11.4, code_008 ya da Kod 11.7).

**Adımlar:**

1. `tanitim` — Köken tanımı (L540) ve ipucu (L528). Sayfa kökeni ile API kökeni yan yana (R9).
   Rozet: `kitaba-dayali · L540`.
2. `izinli` — `https://kutuphane.mehmetakif.edu.tr` → `GET /api/kitaplar` (basit istek, preflight yok).
   Sunucu `corsKarariVer` başlıklarını ekler. Denetimler geçer, betik yanıtı okur. Terminal L614-620.
   Kod şeridi L592. Rozet: `kitap`.
3. `izinsiz` — `https://kotu-niyetli-site.com` → aynı istek. Sunucu `200` döner ama CORS başlığı yoktur.
   Tarayıcı yanıtı betiğe vermez. Terminal `{ izinliMi: false }` (L621). Not: istek sunucuya ulaştı;
   CORS yalnız okumayı engeller (L552-556). Rozet: `kitap`.
4. `sunucu-reddi` — Kod 11.7 `corsKontrolEt`: izinsiz köken → sunucu tarafında `403` (L1116). Terminal
   L1208. Not: Kod 11.4 başlığı vermez, Kod 11.7 isteği reddeder. İkisi kitabın iki ayrı yaklaşımıdır.
   Rozet: `kitap`.
5. `curl` — `curl` `Origin` göndermez. `corsKarariVer(undefined)` → `izinliMi: false`, ama curl yanıtı
   yazdırır. L543 ve L670 cümleleri. Rozet: `kitaba-dayali · L543, L670`.
6. `wildcard` — code_008: `*` + `Allow-Credentials: true` ve `credentials: "include"` → tarayıcı reddeder.
   L633 ve L649. Rozet: `kitaba-dayali · L633, L649`.
7. `preflight-gerekli` — İzinli kökenden `POST /api/giris`, `Content-Type: application/json`,
   `credentials: "include"`. Tarayıcı önce `OPTIONS` gönderir (kural 3). Rozet: `standart · Fetch`.
8. `preflight-eksik` — Sunucu `kitap-karari`: `OPTIONS` yanıtında yalnız iki başlık var.
   `Access-Control-Allow-Headers: yok` alarm satırı. Denetim 5.5 kalır, `POST` gönderilmez, betik
   `TypeError` alır. Not: `corsKarariVer` yalnız köken kararını verir (L624); L646'ya göre preflight'ı
   `cors` paketi yönetir. Rozet: `standart · Fetch`.
9. `preflight-tamam` — Sunucu `cors-paketi` (R10): `204` ve dört başlık → denetimler geçer → asıl
   `POST` → `{ durumKodu: 200, mesaj: 'Giriş başarılı.' }` (L1207). Rozet: `standart · Fetch, cors`.
10. `ozet` — CORS/CSRF tablosu (L550-554) ve alternatifler tablosu (L644-647). Rozet: `kitap`.

**Laboratuvar parametreleri.**

- `koken`: kutuphane (https) / `http://localhost:5173` / `https://kotu-niyetli-site.com` /
  `http://kutuphane.mehmetakif.edu.tr` (protokol farkı) / `https://api.kutuphane.mehmetakif.edu.tr`
  (aynı köken). `O` tuşu kökeni döndürür.
- `istemci`: tarayıcı / curl.
- `istek`: `GET /api/kitaplar` / `POST /api/giris` (JSON) / `POST` + `Authorization` / `DELETE`.
- `kimlik`: `include` / `omit`.
- `sunucu`: `kitap-karari` / `cors-paketi` / `wildcard` / `kitap-11-7`.

Rozet: preflight olan senaryoda `standart`, olmayanda `kitap-kodu`.

## Bölüm 5 — `rate-limiting` (Bölüm 11, 10 adım)

**Kaynak kod.**

- Kod 11.5 (code_009, L703-751), çıktı L756-760.
- Kod 11.7 (code_015, L1090-1208): limiter L1121-1136, kontrol sırası L1167-1176, çıktı L1207-1208.

**Model (`limiter.ts`).** `SabitPencereRateLimiter`'ın saf TS kopyası. Durum değişmezdir; her çağrı yeni
durum ve bir olay döndürür.

- `istegeIzinVer(durum, anahtar, simdi)` → `{ durum, izin, dal }`. `dal` kodun satırıdır:
  - `'yeni-pencere'`: kayıt yok ya da `simdi - pencereBaslangici >= pencereMs` (L724-727).
  - `'sinirda'`: `sayac >= maksimumIstek` (L729-731).
  - `'artir'`: L733-734.
- Pencere, anahtarın ilk isteğiyle başlar; saate hizalı değildir. Sınırda patlamanın nedeni budur.
- `loginIsteginiIsle(durum, koken, ip, govde, simdi)` Kod 11.7'nin sırasını izler: CORS → limiter →
  validation → secret → kimlik bilgisi. CORS'ta kalan istek limiter sayacını **artırmaz**.

**Sahne.**

- Zaman çizelgesi (`scene-timeline.ts`, d3 SVG). x ekseni saniye; her istek bir nokta (kabul: teal,
  429: turuncu). Pencereler anahtar başına bant olarak çizilir. Aynı anda gelen istekler dikey yığılır.
- Sağda `kayitlar` Map'i (`DataTable`: anahtar, sayac, pencereBaslangici) ve terminal.
- Kod 11.7 adımlarında denetim listesi (`CheckList`: CORS, rate limit, validation, secret, kimlik).
- Altta kod izleme paneli. Kod şeridi `dal` satırına odaklanır.

**Adımlar:**

1. `tanitim` — Tanım (L678) ve dikkat notu (L675). Rozet: `kitap`.
2. `ilk-istek` — `new SabitPencereRateLimiter(3, 60_000)`, `ipAdresi = "203.0.113.10"`, deneme 1:
   `yeni-pencere` → sayaç 1. Terminal `Deneme 1: kabul edildi`. Rozet: `kitap`.
3. `artir` — Deneme 2 ve 3 (`artir`), sayaç 3. Terminal L757-758. Rozet: `kitap`.
4. `sinir` — Deneme 4 ve 5 (`sinirda`) → `429 Too Many Requests` (L759-760). Not: kitabın kodu
   `Retry-After` eklemez (L793). Rozet: `kitap`.
5. `pencere-doldu` — `simdi = baslangic + 60_000` → `yeni-pencere`, sayaç 1, kabul. L763 cümlesi.
   Rozet: `kitap-kodu`.
6. `ayri-anahtar` — `203.0.113.20` kendi sayacıyla başlar. NAT uyarısı (L793). Rozet: `kitap-kodu`.
7. `sinirda-patlama` — Pencere t = 0'da başlar; t = 58 ve 59 s'de iki istek (sayaç 3). t = 60 s'de yeni
   pencere: 60, 60,5 ve 61 s'de üç istek kabul. 58–61 s arasında beş istek geçer. L771 dezavantajı.
   Rozet: `kitap-kodu`.
8. `login-sira` — Kod 11.7'nin iki çağrısı: izinli köken → `200 'Giriş başarılı.'` (sayaç 1). Kötü
   niyetli köken → CORS'ta `403`; limiter çalışmaz, sayaç 1'de kalır. Terminal L1207-1208. L158 dikkat
   notu (ucuz denetimler dışta). Rozet: `kitap`.
9. `login-429` — Aynı IP'den üç giriş daha: 200, 200 (sayaç 3), sonra `429 'Çok fazla giriş denemesi
   yapıldı. Lütfen daha sonra tekrar deneyin.'` (L1171-1172). Rozet: `kitap-kodu`.
10. `ozet` — Alternatifler tablosu (L771-774) ve Redis notu (L763). Rozet: `kitap`.

**Laboratuvar parametreleri.**

- `maksimumIstek`: 1–10 (varsayılan 3).
- `pencere`: 10 / 30 / 60 s.
- `desen`:
  - `kitap`: beş istek, t = 0.
  - `duzenli`: 10 saniyede bir, 12 istek.
  - `sinir`: adım 7'nin deseni.
  - `iki-ip`: iki IP'den sırayla.
  - `elle`: `G` tuşu ya da düğme şimdiki saatte istek gönderir; "+10 s" saati ilerletir; en çok 30 istek.

`[` / `]` önceki/sonraki istek. Rozet: `kitap-kodu`.

## Bölüm 6 — `rbac-401-403` (Bölüm 10, 11 adım)

**Kaynak kod.**

- Kod 10.7 (code_015, L1118-1256), `// Çıktı:` L1254-1256.
- Kod 10.4 (code_007, L621-667).
- Kod 10.6 (code_011, L873-907), çıktı L912-917.
- code_012 (L944-953).
- Kod 10.5 (code_009, L752-792), çıktı L797-798; Lab'daki rol listesi seçeneğinde.

**Model (`auth.ts`).** Kod 10.7'nin saf TS kopyası (R16-R18); `jwt-akisi/jwt.ts` ve `kripto.ts` paylaşılır.

- `kayitOl` sabit salt alır (R17). `girisYap(durum, ad, parola, simdi)` token ya da `"401: Kullanıcı adı
  veya parola hatalı."` hatası döndürür.
- `kitapEkle(token, simdi, izinliRoller)` → `{ olaylar, yanit, denetimler }`:
  - `tokenDogrula` kalırsa `{ durumKodu: 401, mesaj: '401' }`; rol denetimi `atlandi`.
  - `sadeceKutuphaneci` kalırsa `{ durumKodu: 403, mesaj: '403: Bu işlem için yetkiniz yok.' }`.
  - Değilse `{ durumKodu: 201, mesaj: 'Kitap eklendi.' }`.
  - Durum kodu L1235'teki gibi `mesaj.startsWith("403") ? 403 : 401` ile seçilir.
- Kod 10.7'nin `tokenDogrula`'sı (L1169-1179) Kod 10.3'ünkinden kısadır: biçim ve süre alanı denetimi
  yoktur, hata metni `"401"`'dir. Model bu kısa sürümü uygular.
- `authMiddleware(basliklar)` Kod 10.4'ün kopyasıdır. Sonuç `next` ya da `401` ve iki mesajdan biridir:
  `"Token bulunamadı."` ya da `"Token geçersiz veya süresi dolmuş."`.
- `istegiIsle(token, rol)` Kod 10.6'nın kopyasıdır.

**Sahne.**

- `SequenceLayer` şeritleri: "Çağıran kod", "kitapEkle", "tokenDogrula (kimlik)", "sadeceKutuphaneci
  (rol)". Ulaşılmayan şerit soluk. 401 ve 403 dönüş okları alarm tonunda, 201 ok tonunda.
- Sağda `CheckList` (Kimlik doğrulama → 401, Yetkilendirme → 403) ve yanıt kartı (`{ durumKodu, mesaj }`).
- Kayıt ve giriş adımlarında `KullaniciRepository` tablosu (`DataTable`: kullaniciAdi, salt, parolaHash,
  rol).
- Altta kod izleme paneli. Adıma göre Kod 10.7, 10.4, 10.6 ya da code_012.

**Adımlar:**

1. `tanitim` — Sınav notu (L845) ve tanım (L848). Rozet: `kitap`.
2. `kayit` — `kayitOl("yasemin", …, "kutuphaneci")`, `kayitOl("elif", …, "ogrenci")` → tabloda iki satır,
   düz metin parola yok. L1263. Rozet: `kitap-kodu`.
3. `giris` — `girisYap` iki kez → iki token; payload'larda rol görünür. L1264. Rozet: `kitap-kodu`.
4. `kutuphaneci-201` — `kitapEkle(kutuphaneciToken)`: iki denetim geçer → `{ durumKodu: 201, mesaj:
   'Kitap eklendi.' }` (L1254). Rozet: `kitap`.
5. `ogrenci-403` — `kitapEkle(ogrenciToken)`: kimlik geçer, rol kalır → 403 (L1255). L1265. Rozet: `kitap`.
6. `gecersiz-401` — `kitapEkle("gecersiz.token.deger")`: imza kalır → `{ durumKodu: 401, mesaj: '401' }`
   (L1256). Rol şeridi soluk. Rozet: `kitap`.
7. `yanlis-parola` — `girisYap("elif", "yanlis-parola")` → `"401: Kullanıcı adı veya parola hatalı."`
   (L1206). Token üretilmez. L955 (enumeration) notu. Rozet: `kitap-kodu`.
8. `bearer` — Kod 10.4: `Authorization` yok → `401 { mesaj: "Token bulunamadı." }`. `Bearer
   gecerli-token` → `next()`, `istek.kullanici = { kullaniciAdi: "elif", rol: "ogrenci" }`. Kod şeridi
   L645. L679 dikkat notu (yalnız kimlik). Rozet: `kitap-kodu`.
9. `sira` — Kod 10.6'nın üç çağrısı → 401, 403, 200 (L912-917). L920 cümlesi. Rozet: `kitap`.
10. `yanlis-kod` — code_012: öğrenciye `401` döner. Doğrusu `403` (L950). L853: 401 istemciyi gereksiz
    yere girişe yollar. Rozet: `kitap-kodu`.
11. `ozet` — Durum kodu tablosu (L926-931) ve bölüm sınav notu (L1280). Rozet: `kitap`.

**Laboratuvar parametreleri.**

- `kullanici`: `yasemin` / `elif` / `ahmet` (kayıtsız, R19).
- `parola`: doğru / yanlış.
- `token`: girişten gelen / `gecersiz.token.deger` / yok (`""`).
- `dakika`: 0–30 (R4; 15'ten sonra Kod 10.7'nin süre denetimi `401`).
- `roller`: `["kutuphaneci"]` / `["ogrenci", "kutuphaneci"]` (Kod 10.5 deseni).

`R` tuşu `roller`'i döndürür. Giriş başarısızsa "girişten gelen token" seçeneği yoktur; ekranda "token
yok: girisYap 401 fırlattı" durur. Rozet: `kitap-kodu`.

## Bölüm 7 — Kayıt defteri, ana sayfa, README

- `registry.ts`: beş kart `hazir`; `cors-preflight` ve `jwt-akisi` başlıkları kabul tablosundaki gibi
  güncellenir. `vite.config.ts` girdilerine beş sayfa eklenir.
- `tests/e2e/home.spec.ts`: 11 hazır, 4 yakında.
- README: canlı adresler; kısayol tablosuna `S`, `B`, `R`, `O`, `G` satırları ve `[ / ]` satırına
  "istek (rate limiting)" eklenir.

## Arayüzler

```ts
// src/core/kripto.ts
export function sha256Hex(metin: string): string;
export function hmacSha256B64url(anahtar: string, veri: string): string;
export function b64urlJson(deger: object): string;
export function b64urlCoz(parca: string): string;
export interface ScryptAyar { N: number; r: number; p: number; dkLen: number }
export const NODE_SCRYPT: ScryptAyar;                       // { N: 16384, r: 8, p: 1, dkLen: 64 }
export function scryptHex(parola: string, salt: string, ayar?: ScryptAyar): Promise<string>;
export function rastgeleSaltHex(): string;

// src/core/plot/check-list.ts
export type DenetimDurumu = 'gecti' | 'kaldi' | 'atlandi' | 'bekliyor';
export interface Denetim { ad: string; durum: DenetimDurumu; ayrinti?: string; sonuc?: string }
export interface CheckListSpec { baslik: string; denetimler: readonly Denetim[] }
export class CheckList { readonly root: HTMLDivElement; constructor(host: HTMLElement);
  update(spec: CheckListSpec): void; destroy(): void }

// src/core/plot/segment-strip.ts
export interface Parca { metin: string; etiket?: string; ton?: 0 | 1 | 2 | 3;
  fark?: readonly number[]; kisalt?: number }
export interface SegmentStripSpec { baslik?: string; parcalar: readonly Parca[]; ayirici?: string }
export class SegmentStrip { readonly root: HTMLDivElement; constructor(host: HTMLElement);
  update(spec: SegmentStripSpec): void; destroy(): void }
export function farkIndeksleri(a: string, b: string): number[];

// src/core/plot/source-badge.ts (eklenen)
export type KaynakTuru = 'kitap' | 'kitap-kodu' | 'kitaba-dayali' | 'standart';

// src/core/plot/http-cards.ts (eklenen)
export type Metot = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE' | 'OPTIONS';
// HttpIstek += kaynak?: string;  HttpYanit += eksikBasliklar?: readonly string[]

// src/concepts/salt-hash/parola.ts
export interface HashlenmisParola { salt: string; hash: string }
export function parolaHashle(parola: string, salt: string): Promise<HashlenmisParola>;
export function parolaDogrula(parola: string, kayit: HashlenmisParola):
  Promise<{ sonuc: boolean; denemeHash: string; ilkFark: number }>;
export function guvensizHashle(parola: string): string;
export function karsilastirmaAdimi(a: string, b: string, yontem: 'esittir' | 'timingSafeEqual'): number;

// src/concepts/jwt-akisi/jwt.ts
export interface TokenPayload { kullaniciAdi: string; rol: 'ogrenci' | 'kutuphaneci'; sonGecerlilik: number }
export const GIZLI_ANAHTAR = 'kutuphane-sunucu-sirri';
export const DERS_SIMDI = 1788606528600;
export interface UretilenToken { header: string; govde: string; imza: string; token: string }
export function tokenUret(payload: object, anahtar?: string): UretilenToken;
export type DogrulamaSonucu = { payload: TokenPayload } | { hata: string; yakalanmamis?: boolean };
export function tokenDogrula(token: string, simdi: number):
  { denetimler: Denetim[]; sonuc: DogrulamaSonucu; beklenenImza?: string };

// src/concepts/rbac-401-403/auth.ts
export interface KullaniciKaydi { kullaniciAdi: string; salt: string; parolaHash: string; rol: Rol }
export function kitapEkle(token: string, simdi: number, izinliRoller: readonly Rol[]):
  { olaylar: Message[]; yanit: { durumKodu: 201 | 401 | 403; mesaj: string }; denetimler: Denetim[] };
export function authMiddleware(basliklar: { authorization?: string }):
  { next: true; kullanici: { kullaniciAdi: string; rol: Rol } } | { next: false; durumKodu: 401; mesaj: string };
export function istegiIsle(token: string | null, rol: Rol | null): { durumKodu: number; mesaj: string };

// src/concepts/cors-preflight/tarayici.ts
export type SunucuTuru = 'kitap-karari' | 'cors-paketi' | 'wildcard' | 'kitap-11-7';
export interface CorsSenaryo { koken: string; istemci: 'tarayici' | 'curl';
  istek: 'get-kitaplar' | 'post-giris' | 'post-yetkili' | 'delete'; kimlik: 'include' | 'omit';
  sunucu: SunucuTuru }
export interface CorsIzi { preflight?: { istek: HttpIstek; yanit: HttpYanit; denetimler: Denetim[] };
  asil?: { istek: HttpIstek; yanit: HttpYanit; denetimler: Denetim[] };
  betik: { okudu: boolean; metin: string }; olaylar: Message[]; sunucuIsledi: boolean }
export function calistir(s: CorsSenaryo): CorsIzi;

// src/concepts/rate-limiting/limiter.ts
export interface PencereKaydi { sayac: number; pencereBaslangici: number }
export interface LimiterDurum { maksimumIstek: number; pencereMs: number;
  kayitlar: readonly [string, PencereKaydi][] }
export type Dal = 'yeni-pencere' | 'sinirda' | 'artir';
export function istegeIzinVer(d: LimiterDurum, anahtar: string, simdi: number):
  { durum: LimiterDurum; izin: boolean; dal: Dal };
```

Kavram sayfaları `ConceptPage<P>` sözleşmesini değiştirmeden kullanır. Sayfaya özel adlar plan sırasında
değişebilir; ortak parçaların arayüzü bu belgedeki gibidir.

## Hata durumları

- `b64urlCoz` geçersiz girdide fırlatır. `tokenDogrula`'da bu `JSON.parse` adımına düşer ve kitaptaki
  gibi yakalanmaz (`yakalanmamis: true`).
- `scryptHex` sürerken parametre değişirse eski sonuç atılır: yalnız son isteğin sonucu çizilir.
- Lab metin kutuları 32 karakterle sınırlıdır. Boş parola geçerlidir (kitabın kodu engellemez).
- `rate-limiting` `elle` deseni 30 isteği aşmaz; düğme pasifleşir. Kaydırıcı değişince desen baştan
  hesaplanır.
- `cors-preflight` Lab'ında `istemci: curl` iken `kimlik` ve preflight anlamsızdır: o denetimler
  "uygulanmaz" (`atlandi`) diye görünür.
- `prefers-reduced-motion` → geçiş süreleri 0.
- Dar ekran (390 px): sahne üst üste yığılır. Ders'te kod şeridi gizlenebilir. Hash şeritleri karakter
  sınırında kırılır.

## Doğrulama

- **Ortak parçalar.**
  - `tests/unit/kripto.test.ts`: her fonksiyon `node:crypto` ile aynı sonucu verir (SHA-256, HMAC,
    base64url, scrypt Node parametreleriyle). Türkçe karakterli girdi de denenir.
  - `tests/unit/plot/check-list.test.ts`: `kaldi` sonrası `atlandi`, sonuç rozeti.
  - `segment-strip.test.ts`: `fark` vurgusu, `kisalt`, `title`.
  - `source-badge.test.ts`: `standart` türü.
  - `http-cards.test.ts`: `OPTIONS`, `eksikBasliklar`, `kaynak`.
- **`tests/unit/salt-hash/parola.test.ts`.** L303-304 ve L371 çıktıları. Ders sabitleri `scryptSync`
  ile. Aynı parola iki salt → farklı hash. `karsilastirmaAdimi` (1 ve 64).
- **`tests/unit/jwt-akisi/jwt.test.ts`.** L512-515 dört satırı harfiyen (`nodeInspect` ile). L575.
  Ders sabitleri `createHmac` ile. Denetim sırası: rol değişince imza kalır; süre alanı yokken imza
  geçer. `dakika` 15 → geçer, 16 → süresi dolmuş. Bozuk JSON yakalanmaz.
- **`tests/unit/rbac-401-403/auth.test.ts`.** L1254-1256 üç çıktısı; L912-917. Kayıtsız kullanıcı ile
  yanlış parola aynı mesajı verir. Geçersiz tokenda rol denetimi `atlandi`. Kod 10.4'ün iki 401
  mesajı. code_012 → 401.
- **`tests/unit/cors-preflight/tarayici.test.ts`.** L614-621 çıktısı. Preflight kuralları:
  - basit `GET` → preflight yok
  - JSON `POST` → var
  - `Authorization` → var
  - `DELETE` → var

  `kitap-karari` + JSON → 5.5 kalır, asıl istek yok. `cors-paketi` → geçer. `wildcard` + `include` → 5.3
  kalır. İzinsiz köken, basit istek → `sunucuIsledi: true`, `okudu: false`. curl → okur. Aynı köken →
  denetim yok. `kitap-11-7` → 403 (L1208).
- **`tests/unit/rate-limiting/limiter.test.ts`.** L756-760 harfiyen. Pencere dolunca sıfırlanır (tam
  `60_000`'de). Anahtarlar bağımsızdır. Sınır deseni 58–61 s'de beş kabul. Kod 11.7: CORS'ta kalan istek
  sayacı artırmaz. Dördüncü giriş 429 ve mesajı. L1207-1208.
- **`tests/unit/<kavram>/scenario.test.ts`, `scene.test.ts`.** Adım sayıları ve anahtar anlar:

  | Sayfa | Adım → DOM |
  |---|---|
  | salt-hash | 2 iki şerit aynı; 4 fark vurgusu; 7 karşılaştırma sayaçları 1 ve 64 |
  | jwt-akisi | 7 imza denetimi `kaldi`, sonrakiler `atlandi`; 8 gelen ve beklenen imza farklı; 10 biçim `kaldi` |
  | rbac | 5 rol `kaldi` ve 403; 6 rol şeridi soluk; 8 istek kartında `Authorization` yok |
  | cors | 3 betiğe `TypeError`, sunucu işledi; 8 `Allow-Headers: yok` alarm satırı; 9 iki istek (OPTIONS, POST) |
  | rate | 4 iki turuncu nokta; 7 iki pencere bandı; 8 sayaç 1'de kalır |

  Her adımda kaynak rozeti beklenen türde.
- **`scripts/kitap-dogrula.mjs`.** Beş yeni kavram ve önceki altı kavram için temiz.
- **`tests/e2e/<kavram>.spec.ts`.** Ders klavye yürüyüşü, Lab parametre değişimi, sığma (1280×720,
  1280×740, 390), Ders yazı tabanı, kapsayıcılarda yatay kayma yok, `seqOutsideSvg` boş. Ekran
  görüntüsü taban çizgileri yalnız anahtar adımlarda:

  | Sayfa | Taban çizgileri |
  |---|---|
  | salt-hash | ders 4, ders 7 |
  | jwt-akisi | ders 6, ders 8 |
  | rbac | ders 5, lab (ahmet) |
  | cors | ders 3, ders 8 |
  | rate | ders 7, ders 8 |
- **`tests/e2e/dalga3.perf.spec.ts`** (dalga sonunda bir kez): adım değişiminde uzun görev yok (> 50 ms).
  `salt-hash` Lab'ında parola değişince scrypt sürerken uzun görev yok (`scryptAsync` adımlarla kontrolü
  bırakır).
- **Kapı:** `npm run check`.
