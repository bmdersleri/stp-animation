# Dalga 4 — Docker Compose, Nginx/TLS, IoT zaman serisi, timeout ve retry — Tasarım

- **Tarih:** 2026-10-28
- **Kaynak:** Öğretmen: "diğer bölümleri de hazırla ve push la." Kitap: `C:\projects\modernSunucuTabProg` (salt
  okunur), `chapters/<bölüm>/content/final.md`:
  - `b14-docker-compose` (1270 satır)
  - `b15-linux-deployment` (1213)
  - `b16-iot-backend` (1228)
  - `b17-ai-ml-service-integration` (1045)
  - `b11-secure-backend` (1493; yalnız Dalga 3 rozet aralıkları, R3)
- **Yetki:** Bütün tasarım kararları benimdir. Kararlar aşağıdaki tabloda `R1`… numarasıyla durur, ledger'a
  `Ruling:` satırı olarak geçer ve iş sonunda öğretmene listelenir. Öğretmenin "push la" sözü, yeşil
  `npm run check`'ten sonra merge ve `main`'e push onayıdır (R7).
- **Satır numaraları** `final.md` satırlarıdır (`L357-400` biçiminde; aralık, kod çitlerinin içidir).
  Kontrolcü bütün aralıkları node ile çıkardı. Bu belgedeki bütün HMAC değerlerini `node:crypto` ile, bütün
  süreleri, sağlık denetimi anlarını ve saatlik özet sayılarını node ile hesapladı.
- **Dalga 1–3 dersleri.** Her brief'e girer:
  - Alt ajanlar LF ve UTF-8 yazar.
  - Kart ve tablo sütunları 1280 px'te kaymaz. E2e gerçek kapsayıcıları ölçer.
  - Sıra diyagramı satırları kendi SVG'sinin içinde kalır (`seqOutsideSvg`).
  - Ders kod şeridi, kararın verildiği satıra odaklanır. Her adım odak satırını bu belgede adlandırır.
  - Rozetler veriye dürüsttür. `kitap` yalnız ekrandaki her değer kitapta basılıysa verilir.
  - Tanıtım ve özet adımları, rozetlerinin iddia ettiği kitap metnini **gösterir** (Dalga 3 I1). Dört yeni
    sayfa bunu ortak `kitap-blok.ts` ile yapar (R2).
  - Kitabın bir aracı (Docker, Nginx, Express, TLS) için kodu yoksa davranış `standart` rozeti alır.
  - `npm run kitap-dogrula` listing'leri `final.md` ile karşılaştırır.
  - Sahne erken, gerçek tarayıcıda denetlenir.

## Amaç ve kabul ölçütleri

Öğrenci şunları kavramalı:

1. **Başlatma sırası, hazır olma değildir.**
   - `depends_on` yalnız container'ın başlama sırasını belirler.
   - `healthcheck` + `condition: service_healthy`, API'yi veritabanı sağlıklı olunca başlatır.
   - Uygulamanın yeniden denemesi yine de gerekir.
   - Container'lar adla bulunur; `localhost` container'ın kendisidir. Volume olmadan veri kaybolur.
2. **Nginx trafiği karşılar, uygulama yalnız yerelde dinler.**
   - Dışarıda yalnız 22, 80 ve 443 açıktır.
   - Nginx gerçek istemci IP'sini ve protokolü başlıklarla taşır; başlık yoksa herkes Nginx'in IP'si olur.
   - `X-Forwarded-For`'un ilk adresi istemcinin uydurabileceği değerdir.
   - 80 portu 301 ile HTTPS'e yönlenir. TLS Nginx'te biter; uygulamaya düz HTTP gider.
   - 502 uygulamada değil, Nginx'te üretilir.
3. **IoT verisi imzalı, aralıkta ve sunucu saatiyle kaydedilir.**
   - HMAC imzası gövdeyi ve zaman damgasını birlikte korur; anahtar ağda gitmez.
   - ±60 saniyelik pencere eski paketi reddeder ama pencere içi tekrarı engellemez.
   - Tip doğru diye değer anlamlı değildir: `-999` reddedilir.
   - Ölçümler tamponda toplanıp topluca yazılır; saatlik özet yalnız yazılmış satırları görür.
4. **Timeout beklemeyi sınırlar, izolasyon hatayı yutar, retry yalnız geçici hatada çalışır.**
   - `AbortController` süre dolunca isteği iptal eder; `finally` zamanlayıcıyı her yolda temizler.
   - Hata yakalanır, özet `null` olur, ana yanıt yine 200'dür.
   - Gelen yanıt da doğrulanır: boş özet `null`'a düşer.
   - Sınırlı ve beklemeli retry kitabın kodunda yoktur; bu sayfanın uzantısıdır.

Kabul ölçütleri:

1. Dört yeni sayfa açılır; hepsi Ders (`?mod=ders`) ve Laboratuvar modunda çalışır:

   | Sayfa | Başlık | Bölüm | Adım |
   |---|---|---|---|
   | `docker-compose/` | "Docker Compose ile çok servisli ortam" | 14 | 11 |
   | `nginx-tls/` | "Nginx reverse proxy ve HTTPS/TLS" | 15 | 11 |
   | `iot-zaman-serisi/` | "IoT: sensör verisi ve zaman serisi" | 16 | 11 |
   | `timeout-retry/` | "Timeout, retry ve hata izolasyonu" | 17 | 10 |

   Ana sayfada 15 kavram **hazır**, 0 kavram **yakında** görünür.
2. Ekrandaki her kod satırı kitaptakiyle **harfiyen** aynıdır.
   - Kitabın çıktı blokları ve `// Çıktı:` yorumları birim testinde sabit metin olarak doğrulanır.
   - Kitapta olmayan her girdi, çıktı, ara değer ya da kural bir **kaynak rozeti** taşır.
3. Her sayfanın modeli saf TypeScript'tir. Gerçek ağ, Docker, Nginx, saat yoktur; saat parametredir.
   - Her çalışma zamanı kuralının birim testi vardır.
   - HMAC değerleri gerçektir: birim testi her sabiti `node:crypto` ile yeniden hesaplar.
4. Yeni ortak parça `src/core/plot/kitap-blok.ts`'tir. `cors-preflight` ve `rate-limiting` ona geçer; ekran
   görüntüsü taban çizgileri değişmez. `kripto.ts`'e `hmacSha256Hex` eklenir.
5. `npm run kitap-dogrula` dört yeni sayfa ve eski on bir sayfa için temiz çıkar.
6. Her adım 1280×720, 1280×740 ve 390 px genişlikte sahneye sığar. Kart, tablo ve şerit kapsayıcıları
   1280'de yatay kaymaz. Sıra diyagramı satırları kendi SVG'sinin içinde kalır.
7. `npm run check` yeşil.

## Kararlar

| # | Konu | Karar | Neden / yanlışsa maliyeti |
|---|---|---|---|
| R1 | Sayfalar | Dört sayfa, kayıt defterindeki başlıklarla (kabul tablosu). Adım sayıları 11, 11, 11, 10 | Öğretmenin isteği; başlıklar zaten yayında "yakında" kartında |
| R2 | Kitap bloğu | `src/core/plot/kitap-blok.ts`: `KitapBlok { tanim?, paragraflar?, tablolar, notlar }`, `KitapBlokView` (`update`, `destroy`), tek CSS dosyası. Dört yeni sayfanın `tanitim` ve `ozet` adımları kullanır. `cors-preflight` ve `rate-limiting` geçer; DOM ve CSS aynı kalır, taban çizgileri değişmez. `salt-hash`, `jwt-akisi`, `rbac-401-403`'ün kendi blokları kalır | Dalga 3 I1 dersi. Üçüncü sayfa isteyince parça `core/plot`'a gider (AGENTS.md). Yanlışsa: dört kopya daha |
| R3 | Dalga 3 rozet aralıkları | Node ile doğrulandı, aynen uygulanır: `cors-preflight` `tanitim` → `kitaba-dayali · L528, L540`; `ozet` → `kitap · L548-554, L640-647`; `rate-limiting` `ozet` → `kitap · L763, L767-774`. Taban çizgilerinin hiçbiri bu adımlarda değil (cors 3/8/9, rate 7/8); güncelleme gerekmez | Başlık (L548, L640, L767) ve ipucu (L528) ekranda görünüyor ama rozette yoktu |
| R4 | HMAC hex | `kripto.ts`'e `hmacSha256Hex(anahtar, veri)` eklenir: `createHmac("sha256", anahtar).update(veri).digest("hex")` ile aynı. Kitabın `Buffer.from(imza, "hex")` davranışı (ilk geçersiz hex çiftinde durur) sayfa modelinde `hexBayt` olarak kopyalanır | Kitap imzayı hex üretir (L411, L414-415). b64url kitabın imzasını göstermez |
| R5 | Zaman katmanları | Sayfada kalır: `timeout-retry/scene-zaman.ts` (deneme çubukları, bekleme boşlukları), `iot-zaman-serisi/scene-seri.ts` (çizgi grafik). `rate-limiting/scene-timeline.ts` taşınmaz. `docker-compose` saati `SequenceLayer` etiketlerinde taşır. `nginx-tls` sertifika katmanı yazmaz | Üç zaman katmanının biçimi farklı; ortak parça zorlama olurdu |
| R6 | Kitap tutarsızlıkları | Ekranda düzeltilmez. Hepsi son bölümde listelenir, bookMaker'a gider | Dalga 3 R23. Kitap salt okunur |
| R7 | Push | Öğretmenin "push la" sözü merge ve push onayıdır; ön koşul yeşil `npm run check` | AGENTS.md push kuralı |
| R8 | `docker-compose` hazır olma süresi | `dbHazirMs` kitapta sayı değildir (L567 "birkaç saniye", L892 "2-3 saniye"). Ders: Kod 14.9 adımında 1000 ms, Compose adımlarında 4000 ms. Ekranda "sayfa varsayımı: veritabanı t = 4 s'de hazır" notu durur | Sayı uydurulup kitaba atfedilmez |
| R9 | `cok-asamali` rozeti | `kitap` kalır: tablo hücreleri yalnız Kod 14.3'ün yorum satırlarıdır (L293, L302, L305, L309, L313, L322, L327) ve aşama adlarıdır (L295, L315). Boyut sayısı yoktur | KARARLAR koşulu sağlandı. L337'deki "%85" temsilîdir (L818-820) |
| R10 | Compose sağlık denetimi | `standart` (Compose): ilk prob `t = interval`'da, sonra her `interval`'da. Prob `t >= dbHazirMs` ise geçer. `start_period` içindeki kalan prob sayılmaz. Ardışık sayılan kalan `>= retries` → `unhealthy`. Prob süresi 0; `timeout` yalnız gösterilir. `unhealthy` iken `service_healthy` bağımlısı hiç başlamaz; metin Türkçe açıklamadır | Kitap yalnız anahtarları verir (L677-681). Docker'ın hata metni sürüme göre değişir |
| R11 | Kod 14.9 adımının rozeti | `kitap-kodu · L986, L990, L1002` (taslak `kitap` diyordu). Terminal satırı kitabındır, ama deneme anları ve `dbHazirMs 1000` sayfanındır. Birim testi kitabın sayaçlı `sahteBaglanFn`'iyle (L977-983) aynı satırın çıktığını da doğrular | Rozet veriye dürüst olur |
| R12 | `depends_on` adımı | API `t = 0`'da tek deneme yapar (code_012'nin Hata 2'si, `maksimumDeneme = 1`), host `kutuphane-db`. Sıra diyagramında ret notu "ECONNREFUSED" yazar; IP yazılmaz. Rozet `kitaba-dayali · L567, L612, L892` | L886'nın `127.0.0.1` adresi yalnız `localhost` içindir; db'nin IP'si uydurulmaz |
| R13 | `docker-compose` şerit kapsamı | Şeride girenler: Kod 14.3, 14.4, 14.5, 14.6, 14.9, code_008, code_012, code_014. Girmeyenler: Kod 14.1 (çıktısı `...` ile kısaltılmış; Kod 14.4 aynı fikri iki container ile gösterir), Kod 14.2 (14.3 ile aynı iş), Kod 14.7 (`compose ps` çıktısı gerçek biçim değil), Kod 14.8 (prod, başka servis adları), code_011 (çıktısı boş) | Sayfa tek hikâyede kalır |
| R14 | `nginx-tls` Lab | Altı parametre: `hedef`, `ayar`, `uygulama`, `trustProxy`, `sahteXff`, `kalanGun` (0–90 kaydırıcı). `hedef`: `http:80`, `https:443`, `:3000`, `:5432`. Port 22 seçenek değildir | KARARLAR. SSH bu sayfanın akışı değil; 22 seçilse gösterecek bir yanıt olmazdı |
| R15 | Sertifika | Yeni katman yok. Sertifika durumu bir `DataTable` satırıdır (kalan gün, durum) ve certbot'un üç aşaması bir `CheckList`'tir (L526-528 adları). certbot adımı yalnız komutları gösterir; certbot çıktısı uydurulmaz. Rozeti `kitaba-dayali · L524-528, L566` (taslak `kitap` diyordu; "geçti" durumları sayfanın canlandırmasıdır) | KARARLAR. Basılı certbot çıktısı yok |
| R16 | Nginx başlık kuralları | `standart` (Nginx): istemcinin başlıkları olduğu gibi geçer (`proxy_pass_request_headers` açık). `Host` verilmezse `$proxy_host` = `127.0.0.1:3000`. `$proxy_add_x_forwarded_for` = gelen XFF varsa `"<gelen>, <istemciIp>"`, yoksa `istemciIp`. `$scheme` 80 bloğunda `http`. Kod 15.5'in 443 bloğu XFF eklemez; istemcinin sahte XFF'si uygulamaya aynen ulaşır | Kitapta bu kuralların kodu yok. Sahte XFF'nin 443'te geçmesi gerçek davranıştır ve öğreticidir |
| R17 | Express `trust proxy` | `standart` (Express, `proxy-addr`): zincir = `[soketIp, ...XFF sağdan sola]`. `trustProxy = n` iken ilk `n` adres güvenilir; `req.ip` ilk güvenilmeyen adrestir, hepsi güvenilirse zincirin sonudur. `0` (kapalı) iken `req.ip = soketIp`. `req.protocol`: güvenilirse `X-Forwarded-Proto`'nun ilk değeri, değilse `http`. Ekrana Express kodu yazılmaz | Kitap yalnız "güvenilir bir reverse proxy'den geldiği doğrulandığında" der (L355) |
| R18 | Kod 15.5 harfiyen | 443 bloğu yalnız `X-Forwarded-Proto https` ekler; `Host`/XFF eksikliği "Nginx varsayılanı" notuyla açıklanır. 443 bloğu olmayan ayarlarda (`kod-15-3`, `basliksiz`) `https:443` → "443'te dinleyen blok yok: bağlantı reddedildi", yanıt yok (`standart`). `code-007` ayarı = code_007'nin 80 bloğu + Kod 15.5'in 443 bloğu (L518 yorumu) | Kitap kodu sessizce "düzeltilmez" |
| R19 | Nginx simülasyon sınırı | Yalnız "uygulama kapalı → 502" (`kitaba-dayali · L278`). 504, `proxy_connect_timeout`, `server_name` uyuşmazlığı, HSTS, TLS sürümleri, `limit_req_zone`, systemd yoktur. TLS el sıkışması yalnız sıra olarak çizilir (ClientHello → sertifika → anahtar anlaşması → şifreli kanal), `standart`. Docker'ın UFW'yi atlaması ekranda yoktur | Kitap yalnız 502'den söz eder. UFW tuzağı kitabın L174 cümlesiyle çelişir; handoff'a yazılır |
| R20 | Nginx sabitleri | İstemci IP `203.0.113.7` (L363). Sunucu adı `kutuphane.mehmetakif.edu.tr` (L300). Uygulama `127.0.0.1:3000` (L303). Soket IP `127.0.0.1`. Yol `/api/kitaplar` (sayfanın; Dalga 3 R9 ile aynı). Uygulamanın yanıtı `200`, gövde "kitap listesi (JSON)" diye özetlenir | Kitabın değerleri; yol ve gövde uydurulmaz |
| R21 | `iot` alarm | Alarm yoktur (Lab'da da modelde de). L448 cümlesi yalnız `ozet`'te alıntılanır | KARARLAR. Kitapta eşik kodu yok |
| R22 | `iot` sabit seri | 2026-09-05 07:00:00Z'den başlayarak 90 saniyede bir 120 okuma (i = 0…119). `deger = (200 + floor(i / 4) + (7·i mod 5)) / 10` °C, `sensorId = 1`. 100. okuma (i = 99, 09:28:30Z) tamponu boşaltır; 20 okuma tamponda kalır. Değerler ve özet Bölüm 4'tedir. Rozet `kitap-kodu` | Deterministik; tampon ve özetin kesin beklenen sayıları olur. `sensorId` kitapta yok |
| R23 | `iot` gövde ve cihaz | Lab ve imza adımlarının cihazı `esp32-lab101-temp`'tir (anahtarı kitapta olan tek cihaz, L390). Gövde `{"cihazId":"esp32-lab101-temp","sicaklik":21.5,"nem":45.2}` (`JSON.stringify`, Kod 16.4'ün alanları, Kod 16.1'in değerleri). Ders "şimdi"si `1788602400` = 2026-09-05T10:00:00Z (L111-112) | Kod 16.4'ün `TelemetriVerisi`'ne aynen girer |
| R24 | `iot` denetim zinciri | Sayfa Kod 16.3 ile Kod 16.4'ü birleştirir: pencere → UUID → HMAC (ilk kalanda durur) → sıcaklık ve nem (ikisi de çalışır, Kod 16.4 hataları toplar) → tampona ekleme. Ekranda "birleştirme bu sayfanındır" notu durur | Kitap ikisini bağlamaz (tutarsızlık B16-2) |
| R25 | `iot` istek gösterimi | HTTP istek kartı yoktur, çünkü kitapta uç nokta yolu ve `cihazUuid` başlık adı yok. İstek, `dogrula(basliklar, govdeMetni)`'nin argüman tablosudur: `X-Timestamp`, `X-Signature` (L360), `cihazUuid`, gövde | Yol ve başlık adı uydurulmaz |
| R26 | `iot` cihaz saati adımı | Cihaz saati 45 s geridedir (`zamanDamgasi = 1788602355`): pencereden geçer, kayıt yine `2026-09-05T10:00:00.000Z` alır. Taslağın "2 saat geri" örneği Kod 16.3'ün penceresinde reddedilirdi | Sayfa kendi kodunda tutarlı kalır |
| R27 | `iot` rozetleri | Adım 2 `kitaba-dayali · L203, L572` (grafiğin serisi sayfanındır). Adım 8 grafiği ve istek tablosunu gizler; yalnız Kod 16.4'ün kendi çağrıları görünür → `kitap · L544-546` | Rozet veriye dürüst olur |
| R28 | `iot` sınırlar ve tampon | Aralıklar yalnız Kod 16.4'ünkiler: sıcaklık −40…85, nem 0…100. Tampon yalnız boyutla (100) boşalır; "2 saniye" zamanlayıcısı yoktur. Saatler UTC'dir, ekranda "UTC" etiketi durur | Kitabın üç farklı aralığı ve kodsuz zamanlayıcısı (tutarsızlık B16-1, B16-4) |
| R29 | `timeout-retry` retry | Adım 7–8 ve Lab'ın retry'ı `kitaba-dayali`'dir. Ekranda "Kod 17.3/17.5 tek deneme yapar (L339); yeniden deneme bu sayfanın uzantısıdır" notu durur. Retry yalnız `GeciciAiHatasi`'nde (iptal) çalışır; `n`. denemeden sonra `beklemeTabanMs · 2^(n−1)` beklenir | KARARLAR. L339, L806 |
| R30 | `timeout-retry` sabitleri | Kitaptan: `zamanAsimiMs` 5000 (L362, L717), Ders `maksRetry` 1 (L335, L794). Sayfanın: bekleme tabanı 1000 ms, yavaş servis 8000 ms, hızlı servis 1200 ms; ekranda "sayfa varsayımı" notu. Jitter yoktur | Kitap "artan bekleme" der, sayı vermez (L471) |
| R31 | Kitabın sinyalsiz çağrıları | Kitabın örnek çağrıları sinyali dinlemez ve hemen döner ya da fırlatır (L390, L393-395, L752-762). Adım 5 ve 9 bunları aynen çalıştırır; zaman ekseni gizlidir, saat gösterilmez. Adım 3, 4, 7, 8 sinyali dinleyen sayfa çağrısını kullanır (`kitap-kodu`/`kitaba-dayali`) | Kitap çıktısı harfiyen kalır; sayfa süresi kitaba atfedilmez |
| R32 | Sınır eşitliği | `gecikmeMs >= zamanAsimiMs` → iptal (zamanlayıcı yanıttan önce kurulur) | 5000/5000 Lab durumu belirsiz kalmaz |
| R33 | `http-500` | Lab'daki 500 senaryosu Kod 17.1'in kalıbıyla `AI servisi hata döndürdü: 500` fırlatır (L124); tekrar denenmez. Rozet `kitap-kodu` | Kod 17.5'te 500 üreten çağrı yok |
| R34 | Circuit breaker, önbellek | Çizilmez, simüle edilmez; yalnız `ozet` tablosunda geçer. Sıra diyagramında önbellek şeridi yoktur | L323, L806: kodlanmadı |
| R35 | Klavye | Yeni kısayol yoktur. Lab sonucu her parametre durumunda bütün olarak çizilir | Dalga dar kalır; README tablosu değişmez |
| R36 | Ders sabitleri | `iot-zaman-serisi/degerler.ts` imza ve özet sabitlerini taşır. Birim testi her imzayı `createHmac` ile, özeti bağımsız bir tamsayı hesabıyla yeniden üretir; `kripto.ts`'in aynı değeri verdiğini doğrular. Lab canlı hesaplar | Dalga 3 R2 ile aynı ilke |
| R37 | Görev incelemesi | Model, sahne ve `kitap-blok` göçü görevleri inceleyici alır. E2e, README ve kayıt defteri görevleri almaz. Son inceleme opus'tadır, alt ajanlar sonnet | AGENTS.md bölüm temposu |
| R38 | Rozetin andığı notlar (son düzeltme turu) | Bir Ders adımının rozetinin andığı satırın kitap notu anahtar parçadır; yer açmak için gizlenmez. 1280×720 ve 1280×740'ta yer yetmezse önce sayfanın kendi notları gider: `iot` adım 7 ve 9'da birleştirme notu (R24'ün notu adım 4–6'da durur), `timeout-retry` adım 8'de "sayfa varsayımı" notu (R30; adım 7'de durur). `iot` grafiği gerekirse 100 px tabanına iner; denetim, kayıt ve terminal yan yanayken sütunlar içerik kadar geniştir. `timeout-retry`'da diyagram satırının sağ sütunu daha geniştir (0,85 : 1,15). Lab'da rozet satır anmaz; notlar önce gider. E2e her Ders adımında anılan notun görünür ve kesilmemiş olduğunu doğrular | Son inceleme I1; Dalga 3 I1 dersi. Rozet okurun göremediği metni iddia etmez |

## Kapsam dışı

- Kod 14.8 (prod Compose), Kubernetes, imaj katmanı, önbellek ve boyut simülasyonu.
- Kod 15.1, 15.7, 15.8, 15.9: SSH dağıtımı, ortam değişkenleri, systemd, sağlık uç noktası.
- Kod 16.1, 16.2, 16.5, 16.7: API anahtarı, MQTT, WebSocket, uçtan uca uygulama. Nonce kaydı.
- Alarm (R21), anomali tespiti, dayanıklı kuyruk.
- Circuit breaker, fallback cache, önbellek (R34).
- Gerçek ağ, gerçek Docker/Nginx/certbot, serbest kod editörü.
- Dalga 3 "can wait" maddeleri; `salt-hash`, `jwt-akisi`, `rbac-401-403`'ün kitap blokları (R2).
- Kitapta düzeltme.

## Bölüm 1 — Ortak parçalar

**`src/core/plot/kitap-blok.ts`** (R2). `KitapBlokView`, `div.kitap-blok`:

- `update(blok)` içeriği yeniden kurar; `null` boşaltır. `hidden` sayfanın işidir.
- Sıra: kalın "Tanım. " + `tanim` (`p.tanim-metin`); `paragraflar` (`p.kitap-paragraf`); her `tablolar`
  öğesi için bir `DataTable`; `notlar` (`p.kitap-not`, soluk).
- Metinler kitaptan harfiyen alınır; kod tırnakları, kalın işaretleri ve emoji atılır. Etiket kalır
  ("Dikkat: …", "Sınav Notu: …").
- `destroy()` tabloları yok eder, kökü kaldırır.
- `kitap-blok.css`, rate ve cors CSS'lerindeki kuralların kapsamsız hâlidir: `flex:none`, `min-width:0`,
  `--fs-body`, `line-height:1.35`; `p` alt boşluğu 6 px; tablo hücresi `padding:2px 6px`, `overflow-wrap:normal`.
  Dar ekran kuralı `[data-narrow] .kitap-blok` ile `overflow-wrap:anywhere` olur.
- Göç: `RateKitapBlok` ve `CorsKitapBlok` silinir, ikisi `KitapBlok`'u içe aktarır. Sahnelerin `kitapYaz`
  ve `kitapTemizle`'si `KitapBlokView`'a döner. İki sayfanın CSS'inden `.kitap-blok` kuralları çıkar.
- Kabul: `cors-preflight` (ders 3, 8, 9) ve `rate-limiting` (ders 7, 8) taban çizgileri `--update-snapshots`
  olmadan geçer. Tanıtım ve özet DOM'u (`p.tanim-metin`, tablolar, `p.kitap-not`) birim testinde aynı kalır.

**`src/core/kripto.ts`** (R4): `hmacSha256Hex(anahtar, veri)` — `bytesToHex(hmac(sha256, …))`. Var olan
fonksiyonlar değişmez.

**Dalga 3 rozetleri** (R3): `CORS_ROZET.tanitim`, `CORS_ROZET.ozet`, `RATE_ROZET.ozet` yeni aralıkları alır.
View testleri güncellenir.

## Bölüm 2 — `docker-compose` (Bölüm 14, 11 adım)

**Kaynak kod** (`b14` = `b14-docker-compose`).

| id | satirlar | title |
|---|---|---|
| `kod-14-3` | 292–334 | `Kod 14.3 · Çok aşamalı üretim Dockerfile'ı` |
| `kod-14-4` / `kod-14-4-cikti` | 390–406 / 395–396 | `Kod 14.4 · Aynı imajdan çoklu container` |
| `kod-14-5` | 488–508 | `Kod 14.5 · Volume ve network` |
| `code-008` | 547–554 | `Yanlış: volume'suz veritabanı` |
| `kod-14-6` | 589–610 | `Kod 14.6 · docker-compose.yml` |
| `code-014` | 668–681 | `healthcheck ve service_healthy` |
| `code-012` / `code-012-cikti` | 862–886 / 886–886 | `Yanlış: localhost ve tek deneme` |
| `kod-14-9` / `kod-14-9-cikti` | 933–986 / 990–990 | `Kod 14.9 · ChapterMiniAppDockerCompose.ts` |

`code-012-cikti` yorumdur (L886, `OUTPUT_FOR` yok). Kod 14.4'ün çıktısı yalnız `# Çıktı:` yorumlarıdır.

**Model (`compose.ts`).** Saf TS, sanal saat (ms).

- `saglikliBaglantiKur(secenekler, hazirMi, baslangicMs, maksimumDeneme = 5, bekleMs = 500)` Kod 14.9'un
  (L946-966) kopyasıdır; `setTimeout` yerine sanal saat ilerler:
  - Deneme `n`, `t = baslangicMs + (n − 1) · bekleMs` anındadır (L952, L963).
  - Başarıda log `[${host}] Bağlantı ${n}. denemede kuruldu.` (L955).
  - Kalan denemede log yoktur (`catch` sessiz, L957).
  - Son denemede beklemeden hata: `${maksimumDeneme} denemede veritabanına bağlanılamadı: ${host}` (L960).
  - `hazirMi(t)` = `host === "kutuphane-db" && t >= dbHazirMs`. `localhost` hiç bağlanmaz (L868-870).
- `saglikDegerlendir(dbHazirMs, saglik)` R10'u uygular. `KITAP_SAGLIK = { interval: 2000, timeout: 3000,
  retries: 10, startPeriod: 0 }` (L679-681; `start_period` code_014'te yok).
- `composeUp(senaryo)`:
  - db `t = 0`'da `starting` olur.
  - `mod: 'sira'` (Kod 14.6): API `t = 0`'da başlar.
  - `mod: 'saglikli'` (code_014): API `saglikliMs`'de başlar; `unhealthy` ise hiç başlamaz.
  - API başlayınca `saglikliBaglantiKur` çalışır.
  - Sonuç: `apiBaslangicMs`, problar, denemeler, son durum (`kuruldu` / `hata` / `bagimlilik-basarisiz`) ve
    sıra diyagramı mesajları.

**Hesaplanmış değerler** (node):

| Senaryo | Sonuç |
|---|---|
| Kod 14.9, `dbHazirMs` 1000 | denemeler 0 ✗, 500 ✗, 1000 ✓ → `[kutuphane-db] Bağlantı 3. denemede kuruldu.` (L990) |
| `saglikli`, 4000 | prob 2 s ✗ (1/10), 4 s ✓ → `healthy` 4 s; API 4 s; `Bağlantı 1. denemede kuruldu.` |
| `sira`, 4000, 5 deneme | 0, 0,5, 1, 1,5, 2 s ✗ → `5 denemede veritabanına bağlanılamadı: kutuphane-db` |
| `sira`, 4000, 10 deneme | 9. deneme (4 s) ✓ |
| `sira`, 1500, 5 deneme | 4. deneme (1,5 s) ✓ |
| `saglikli`, 0 | ilk prob 2 s ✓ → `healthy` 2 s |
| `saglikli`, 20 000 | 10. prob 20 s ✓ → `healthy` 20 s |
| `saglikli`, 20 500 / 30 000, retries 10 | 2…20 s on ✗ → `unhealthy` 20 s; API başlamaz |
| `saglikli`, 30 000, retries 3 | `unhealthy` 6 s |
| `saglikli`, 30 000, `startPeriod` 10 000 (yalnız test) | 2–8 s sayılmaz; 10…28 s on ✗ → `unhealthy` 28 s (taslak 30 s diyordu) |
| `saglikli`, 4000, `localhost` | API 4 s; 4, 4,5, 5, 5,5, 6 s ✗ → `5 denemede veritabanına bağlanılamadı: localhost` |

**Sahne.** Yeni katman yok (R5).

- `SequenceLayer` şeritleri: "Compose", "kutuphane-db", "kutuphane-api". Mesajlar: başlatma notları,
  `pg_isready` probları, bağlantı denemeleri. Saat etiketlerdedir: "t = 1,5 s".
- Sağda `DataTable`. Adıma göre servis tablosu (`servis | durum | t`), volume tablosu (`kaynak | durum`) ya
  da DNS tablosu (`ad | çözüm`). IP yazılmaz.
- Sağ altta `CheckList` (sağlık probları) ve terminal (`HttpCards` terminali).
- Altta kod şeridi.

**Adımlar (id — içerik — odak — rozet):**

1. `tanitim` — `KitapBlok`: tanım (L564), not: sınav notu (L1014). Rozet: `kitap · L564, L1014`.
2. `image-container` — Kod 14.4: bir image'dan iki container. Tablo `container | port` yalnız L395-396'nın
   değerleridir; terminal L395-396. Not L351 (image ve container tanımı, harfiyen). Odak L391-392.
   Rozet: `kitap · L351, L395-396`.
3. `cok-asamali` — Kod 14.3: tablo `aşama | içerik` (R9). Satır 1 "1. Aşama: Derleme (Builder)" (`derleyici`):
   L302, L305, L309 yorumları. Satır 2 "2. Aşama: Çalışma Zamanı (Production Runner)" (`uretim`): L322, L327
   yorumları. Odak L322-325. Rozet: `kitap · L293-334`.
4. `volume-yok` — code_008: `kutuphane-db-gecici` silinir, veri satırı `silindi`. L550 yorumu terminalde
   değil, şeritte. Odak L549. Rozet: `kitaba-dayali · L468, L550`.
5. `volume-var` — code_008 "Doğru": container silinir, `kutuphane-db-verisi` satırı `etkin` kalır. Not:
   `down -v` volume'u da siler (L720). Odak L553. Rozet: `kitaba-dayali · L523, L720`.
6. `ag-dns` — Kod 14.5: `kutuphane-network`; DNS tablosunda `kutuphane-db` → "kutuphane-db container'ı".
   Dikkat notu L520. Odak L506. Rozet: `kitaba-dayali · L516-517, L520`.
7. `localhost-hatasi` — code_012: `localhost` → "kutuphane-api'nin kendi container'ı". Terminal
   `Error: connect ECONNREFUSED 127.0.0.1:5432` (L886). Odak L872. Rozet: `kitap · L868-870, L886`.
8. `depends-on-sira` — Kod 14.6, `dbHazirMs` 4000 (R8): Compose db'yi ve API'yi `t = 0`'da başlatır. API'nin
   tek denemesi reddedilir (R12). Servis tablosu: db `starting`, API `başladı · t = 0 s`. Odak L596-597.
   Rozet: `kitaba-dayali · L567, L612, L892`.
9. `healthcheck-bekle` — code_014: prob 2 s `kaldi` ("hazır değil, 1/10"), 4 s `gecti` → `healthy`; API 4 s'de
   başlar. Odak L673, L678-681. Rozet: `standart · Compose; L657, L683`.
10. `yeniden-deneme` — Kod 14.9, `dbHazirMs` 1000: API `t = 0`'da; 0 ve 0,5 s kalır, 1 s'de kurulur. Terminal
    L990 harfiyen. Dikkat notu L1002. Odak L955, L963. Rozet: `kitap-kodu · L986, L990, L1002` (R11).
11. `ozet` — `KitapBlok`: kavram sorumluluk matrisi (başlık L67, tablo L69-77; sütunlar "Kavram", "Temel Görevi",
    "Ne Yapmaz? (Sorumluluk Sınırı)"; tablo notu "tam tablo L69-77") ve not L683. Rozet: `kitap · L67-77, L683`.

**Laboratuvar parametreleri.**

- `dbHazirMs`: 0–30 000 ms, adım 500, varsayılan 4000.
- `mod`: `depends_on` (sıra) / `service_healthy` (varsayılan).
- `retries`: 1–10, varsayılan 10 (`interval` 2 s, `startPeriod` 0 sabit).
- `maksimumDeneme`: 1–10, varsayılan 5 (`bekleMs` 500 sabit). 1, code_012'nin tek denemesidir.
- `hostAdi`: `kutuphane-db` (varsayılan) / `localhost`.

Çıktı: servis tablosu, problar, denemeler, terminal satırı. Rozet: `kitap-kodu`.

## Bölüm 3 — `nginx-tls` (Bölüm 15, 11 adım)

**Kaynak kod** (`b15` = `b15-linux-deployment`).

| id | satirlar | title |
|---|---|---|
| `kod-15-2` | 207–242 | `Kod 15.2 · UFW güvenlik duvarı betiği` |
| `kod-15-3` | 298–309 | `Kod 15.3 · Nginx reverse proxy` |
| `code-004` / `code-004-cikti` | 348–364 / 369–369 | `Yaygın hata: XFF'den istemci IP'si` |
| `kod-15-5` | 453–470 | `Kod 15.5 · HTTPS yönlendirmesi ve TLS sonlandırma` |
| `code-007` | 509–518 | `Yanlış: yönlendirmesiz HTTP bloğu` |
| `kod-15-6` | 544–559 | `Kod 15.6 · Certbot ile TLS kurulumu` |

Kod 15.4 (L417-421) yalnız ref olarak anılır; Kod 15.6 aynı komutları taşır.

**Model (`proxy.ts`).** Kitabın yapılandırmalarını okuyan saf yorumlayıcı:

- `ufwKarari(port)` (Kod 15.2, L215-221): 22, 80, 443 `izin`; diğerleri `engel`.
- `proxyBasliklari(ayar, blok, gelenBasliklar, istemciIp)` R16'yı uygular:
  - `kod-15-3`, 80 (L304-307): `Host $host`, `X-Real-IP $remote_addr`, `X-Forwarded-For
    $proxy_add_x_forwarded_for`, `X-Forwarded-Proto $scheme`.
  - `kod-15-5`, 443 (L467-468): yalnız `X-Forwarded-Proto https`; `Host` = `127.0.0.1:3000`.
  - `code-007`, 80 (L513-515) ve `basliksiz` (Kod 15.3, L304-307 çıkarılmış): eklenen başlık yok.
- `yanlisIstemciIpAl(baglantiIp)` (L350-352) ve `dogruIstemciIpAl(xff, baglantiIp)` (L356-361): birebir.
- `expressReqIp(soketIp, xff, trustProxy)` ve `expressProtokol(...)`: R17.
- `sertifikaDurumu(kalanGun)`: `<= 0` → `suresi-doldu`; `< 30` → `yenilenecek` (certbot.timer, L528); yoksa
  `gecerli`. Geçerlilik 90 gün (L524).
- `istekIsle(params)` sırası:
  1. UFW. `:3000` ve `:5432` düşer; yanıt yok.
  2. Blok seçimi. 80 → 80 bloğu. 443 → 443 bloğu ya da R18'in reddi.
  3. 443'te TLS. `suresi-doldu` ise tarayıcı reddeder; yanıt yok (L520).
  4. `kod-15-5` 80 → `301`, `Location: https://kutuphane.mehmetakif.edu.tr/api/kitaplar` (L456 açılımı).
  5. Proxy. Uygulama kapalıysa `127.0.0.1:3000` bağlantısı reddedilir → Nginx `502 Bad Gateway`.
  6. Uygulama: soket `127.0.0.1`; görülen başlıklar, `req.ip`, `req.protocol`, `dogruIstemciIpAl`; `200`.

**Hesaplanmış değerler.**

| Bileşim | Uygulamanın gördüğü / yanıt |
|---|---|
| `http:80`, `kod-15-3` | Host `kutuphane.mehmetakif.edu.tr`, X-Real-IP `203.0.113.7`, XFF `203.0.113.7`, Proto `http`; `req.ip` kapalı `127.0.0.1`, 1 → `203.0.113.7`; `dogruIstemciIpAl` `203.0.113.7` |
| aynı + sahte XFF `1.2.3.4` | XFF `1.2.3.4, 203.0.113.7`; `dogruIstemciIpAl` `1.2.3.4`; `req.ip` 1 → `203.0.113.7`, 2 → `1.2.3.4` |
| `https:443`, `kod-15-5` (Lab varsayılanı) | Host `127.0.0.1:3000`, XFF yok, Proto `https`; `req.ip` `127.0.0.1`; `req.protocol` kapalı `http`, 1 → `https` |
| aynı + sahte XFF | XFF `1.2.3.4` aynen geçer; `req.ip` 1 → `1.2.3.4`; `dogruIstemciIpAl` `1.2.3.4` |
| `http:80`, `kod-15-5` | `301`, `Location: https://kutuphane.mehmetakif.edu.tr/api/kitaplar`; uygulamaya istek yok |
| `https:443`, `kalanGun` 0 | TLS kalır; yanıt yok, "tarayıcı güvensiz uyarısı" |
| `https:443`, uygulama kapalı | UFW ✓, TLS ✓, proxy ✗ → `502 Bad Gateway`; uygulama `atlandi` |

**Sahne.**

- `SequenceLayer` şeritleri: "İstemci", "UFW", "Nginx", "Uygulama (127.0.0.1:3000)". Engellenen ok UFW'de durur.
  TLS adımında el sıkışma mesajları (R19). Diyagram en çok 8 mesaj gösterir; dokuz mesajlık tam TLS yolu (adım 8,
  10, Lab'da `https:443`) istemcinin isteğini ve UFW geçişini tek okta toplar: `GET :443 · UFW izin`. Böylece
  diyagram istemciden başlar; hiçbir Ders adımında soluk (`old`) mesaj kalmaz.
- Sağda `HttpCards`: istek kartı (`kaynak` = istemci IP'si), yanıt kartı (301 + `Location`, 502), terminal.
- `CheckList`: UFW → TLS → yönlendirme → proxy → uygulama. Sayfa satırları kendisi kurar; 301'de yönlendirme
  `gecti · 301`, sonrakiler `atlandi`.
- `DataTable` "Uygulamanın gördüğü": bağlantı IP'si, `Host`, `X-Real-IP`, `X-Forwarded-For`,
  `X-Forwarded-Proto`, `req.ip`.
- `SegmentStrip` XFF zincirini parçalar (adım 5, 6): istemcinin gönderdiği, Nginx'in eklediği.
- Sertifika `DataTable`'ı ve certbot `CheckList`'i (adım 9, Lab'da `https`) (R15).
- Altta kod şeridi.

**Adımlar:**

1. `tanitim` — `KitapBlok`: tanım (L259), paragraf L266, not L278 ("502 Bad Gateway yanıtı bu nedenle uygulama
   kodunda değil, Nginx tarafında üretilir"; `127.0.0.1` cümlesi), kitaptaki sırasıyla.
   Rozet: `kitap · L259, L266, L278`.
2. `guvenlik-duvari` — Kod 15.2: `:443` izin, `:3000` ve `:5432` engel. Odak L215, L219-221.
   Rozet: `kitap-kodu · L174, L215-221`.
3. `proxy-80` — Kod 15.3: `http://kutuphane.mehmetakif.edu.tr/api/kitaplar`; dört başlık tabloda (ilk
   satır). Odak L303-307. Rozet: `kitap-kodu · L303-307, L317-318`.
4. `basliksiz-ip` — Başlıklar yok (`basliksiz`): uygulama `127.0.0.1` görür; `yanlisIstemciIpAl` herkese aynı
   anahtarı verir. Dikkat notu L321. Odak L351. Rozet: `kitaba-dayali · L321, L351`.
5. `xff-ayikla` — code_004'ün kendi çağrısı: XFF `203.0.113.7, 10.0.0.5`, bağlantı IP'si `10.0.0.5`; şeridin
   ilk parçası seçilir. Terminal `203.0.113.7` (L369). Odak L360. Rozet: `kitap · L363-364, L369`.
6. `trust-proxy` — İstemci sahte `X-Forwarded-For: 1.2.3.4` gönderir; Kod 15.3 sonuna ekler. `[0]` →
   `1.2.3.4`; `trust proxy = 1` → `203.0.113.7`. Odak L360. Rozet: `standart · Express; L355`.
7. `yonlendirme-301` — Kod 15.5 ilk blok: `301` + `Location`. Uygulama şeridine ok yok. Not L482 (301 önbelleği)
   ve L498 (yönlendirmesiz hata, code_007). Odak L456. Rozet: `kitap-kodu · L456, L477, L482`.
8. `tls-sonlandirma` — 443: el sıkışma; Nginx çözer, `127.0.0.1:3000`'e düz HTTP. Tablo: Host
   `127.0.0.1:3000`, XFF yok, Proto `https`. "Nginx varsayılanı" notu (R18). Odak L460, L463-464, L468.
   Rozet: `standart · TLS, Nginx; L479`.
9. `certbot` — Kod 15.6 komutları; certbot `CheckList`'i "HTTP-01 Challenge", "Sertifika Enjeksiyonu",
   "Otomatik Yenileme" (`gecti`). Sertifika satırı: kalan gün 90, durum `gecerli`, eşik 30 gün. Çıktı yok.
   Odak L548-553. Rozet: `kitaba-dayali · L524-528, L566` (R15).
10. `bad-gateway-502` — Uygulama kapalı, `https:443`: UFW ✓, TLS ✓, proxy ✗ → `502 Bad Gateway`; uygulama
    `atlandi`. Odak L467. Rozet: `kitaba-dayali · L278`.
11. `ozet` — `KitapBlok`: sınav notu (L959) ve iki alternatif tablosu (başlıklarıyla L328-335, L489-496).
    Rozet: `kitap · L328-335, L489-496, L959`.

**Laboratuvar parametreleri** (R14).

| Parametre | Değerler | Varsayılan |
|---|---|---|
| `hedef` | `http:80` / `https:443` / `:3000` / `:5432` | `https:443` |
| `ayar` | `kod-15-3` / `kod-15-5` / `code-007` / `basliksiz` | `kod-15-5` |
| `uygulama` | ayakta / kapalı | ayakta |
| `trustProxy` | kapalı / 1 / 2 | kapalı |
| `sahteXff` | yok / `1.2.3.4` | yok |
| `kalanGun` | 0–90, adım 1 | 60 |

Çıktı: sıra diyagramı, `CheckList`, kartlar, "Uygulamanın gördüğü" tablosu, sertifika satırı. Rozet: `kitap-kodu`.

## Bölüm 4 — `iot-zaman-serisi` (Bölüm 16, 11 adım)

**Kaynak kod** (`b16` = `b16-iot-backend`).

| id | satirlar | title |
|---|---|---|
| `code-002` / `code-002-cikti` | 192–198 / 203–203 | `Yanlış: doğrulamasız telemetri` |
| `kod-16-3` | 377–425 | `Kod 16.3 · HMAC-SHA256 imza ve zaman penceresi` |
| `kod-16-4` / `kod-16-4-cikti` | 482–539 / 544–546 | `Kod 16.4 · Aralık doğrulaması ve zaman serisi kaydı` |
| `kod-16-6` | 704–752 | `Kod 16.6 · Telemetri tamponlayıcı ve saatlik özet` |

Kod 16.3'ün çıktısı yoktur (`Date.now()`'a bağlı).

**Model (`telemetri.ts`).** Saf TS; saat parametre (`suAn` saniye, `simdiIso`).

- `imzaUret(anahtar, zamanDamgasi, govdeMetni)` = `hmacSha256Hex(anahtar, `${zamanDamgasi}.${govdeMetni}`)`
  (L410-411).
- `dogrula(basliklar, govdeMetni, suAn)` Kod 16.3'ün kopyasıdır. Sıra ve metinler kitabındır:
  1. `Math.abs(suAn - zamanDamgasi) > 60` → `"Zaman damgası süresi dolmuş veya geçersiz (Replay Attack
     riski)."` (L399-401). Sınır: 60 geçer, 61 kalır; iki yönde.
  2. Anahtar yok → `"Bilinmeyen cihaz UUID'si."` (L404-406).
  3. Uzunluk farkı ya da sabit zamanlı eşitsizlik → `"HMAC imzası geçersiz; veri yolda değiştirilmiş
     olabilir."` (L417-420). `hexBayt` R4'tür; karşılaştırma bütün baytları XOR'lar.
- `telemetriyiDogrula(veri)` (L493-502) ve `olcumuKaydet(veri, simdiIso)` (L511-524) birebir; kayıt
  `sunucuZamanDamgasi: simdiIso` alır.
- `tamponaEkle(durum, olcum, yazmaBasarili = true)` `TelemetriTamponlayici`'nin (L710-734) saf kopyasıdır:
  `length >= 100` → toplu yazma; başarısızsa kayıtlar başa geri döner (L731).
- `saatlikOzet(olcumler, baslangic)` L740-749'un TS karşılığıdır: `zaman >= baslangic` süzülür, UTC saat başına
  gruplanır. Ortalama tamsayı onda birlerle hesaplanır, 2 ondalığa yarım-yukarı yuvarlanır (`numeric(5,2)`).
  Artan saat sırasıyla döner.
- `saatlikOzetSorgusuUret(sensorId, baslangicTarihi)` L738-751'in şablonudur; adım 10'da ortak girintisi
  atılmış hâliyle terminalde görünür. Çalıştırılmaz.
- Sayfanın zinciri R24'tür: `istegiIsle(istek, suAn, durum)` → denetimler, `kaydedildi`, yeni tampon.

**Ders sabitleri (`degerler.ts`, R23, R36).** Anahtar `super-gizli-cihaz-anahtari-12345`. `G` = gövde
`{"cihazId":"esp32-lab101-temp","sicaklik":21.5,"nem":45.2}`; `G'` = `sicaklik` 31.5 olan aynı gövde.

| Ad | `zamanDamgasi` | Gövde | HMAC-SHA256 hex |
|---|---|---|---|
| `IMZA` | 1788602400 | G | `bc27259801b8ac4b17c1cfe70a03f12f71ad16c462699066c5a221494bf08732` |
| `IMZA_ESKI` | 1788602339 | G | `ae65743bc19dea7ff85bf5f36d1ceb81bb2f5ada4d026f5b95be69b0cb0f02ee` |
| `IMZA_DEGISMIS` | 1788602400 | G' | `40a614a3127ec472f3e6595a1836e996c6ee9e2489d8d0068e3b3423e1308603` |
| `IMZA_GERIDE` | 1788602355 | G | `16a2a5dfc935eb193a2b6688305e73731a5987bb791250cf503a543a45939108` |
| test: +60 s | 1788602460 | G | `5a598d1400fc3434a6aa19eec11dfc6338ab0a58f399422daa6e7687cfde277d` |
| test: −999 | 1788602400 | `sicaklik` −999 | `ea489e28ee17d10a5e610b6c773cbb91897ed08f006967baf53545bdb1824a4b` |

**Sabit seri (R22).** `SABIT_SERI[i] = { sensorId: 1, deger, zaman }`, i = 0…119,
`zaman = 2026-09-05T07:00:00Z + 90 s · i`, `deger = (200 + floor(i/4) + (7·i mod 5)) / 10`.

- İlk okumalar: 07:00:00 → 20.0, 07:01:30 → 20.2, 07:03:00 → 20.4, 07:04:30 → 20.1.
- Son okuma: 09:58:30 → 23.2.
- i = 99 (09:28:30) eklenince ilk 100 okuma topluca yazılır. Tamponda i = 100…119 (09:30:00–09:58:30) kalır.
- Tamponun 20 değeri: 22.5, 22.7, 22.9, 22.6, 22.9, 22.6, 22.8, 23.0, 22.8, 23.0, 22.7, 22.9, 23.2, 22.9, 23.1,
  22.8, 23.1, 23.3, 23.0, 23.2.

Saatlik özet, yazılmış 100 satır üzerinde, `baslangic = '2026-09-05T07:00:00Z'`:

| saat_dilimi (UTC) | ortalama_sicaklik | en_dusuk | en_yuksek | ornek_sayisi |
|---|---|---|---|---|
| 2026-09-05 07:00 | 20.65 | 20.0 | 21.3 | 40 |
| 2026-09-05 08:00 | 21.65 | 21.0 | 22.3 | 40 |
| 2026-09-05 09:00 | 22.40 | 22.0 | 22.8 | 20 |

Karşılaştırma (yalnız test): 120 okumanın hepsi yazılsaydı 09:00 satırı 22.65, 22.0, 23.3, 40 olurdu. Toplamlar
onda bir cinsinden 8260, 8660, 4480.

**Sahne.**

- `SequenceLayer` şeritleri Şekil 16.2'nin adlarıdır: "Sensör cihazı", "Telemetri API", "Zaman serisi". Red
  noktasında ok alarm tonunda biter.
- `scene-seri.ts` (R5, d3 SVG): x saat (UTC), y °C. Seri çizgisi; kabul noktası teal, red noktası turuncu
  ("kaydedilmedi"). y alanı seri ve kabul edilenlerin uç değerleri ±1'dir. Eksen dışındaki red noktası kenarda
  değeriyle etiketlenir. Kabul edilen −999 alanı genişletir; çizgi düzleşir (adım 2).
- `CheckList`: zaman penceresi → cihaz UUID → HMAC → sıcaklık → nem. İlk üçte zincir (`zincirle`), son ikisi
  bağımsız (R24).
- `DataTable` "dogrula argümanları" (R25); `SegmentStrip` gelen ve beklenen imza, fark vurgulu (adım 6); özet
  ve tampon tabloları (adım 10).
- Terminal ve altta kod şeridi.

**Adımlar:**

1. `tanitim` — `KitapBlok`: tanım (L84), not L81. Rozet: `kitap · L81, L84`.
2. `dogrulamasiz` — code_002: `-999` kabul edilir; terminal `Kaydedildi: -999°C` (L203). Grafikte −999 10:00'a
   eklenir, seri düzleşir. Odak L194. Rozet: `kitaba-dayali · L203, L572` (R27).
3. `imza-uret` — `zamanDamgasi` 1788602400, gövde G → `IMZA`. Argüman tablosu; anahtar tabloda yok (L360).
   Odak L410-411. Rozet: `kitap-kodu · L360, L409-411`.
4. `zaman-penceresi` — Cihaz saati 61 s geride: `zamanDamgasi` 1788602339, imza `IMZA_ESKI`. Pencere `kaldi`,
   kalanlar `atlandi`; terminal L401 metni. Odak L399. Rozet: `kitap-kodu · L399-401`.
5. `imza-dogrula` — `IMZA` ile istek: pencere, UUID, HMAC `gecti`; aralık denetimleri `bekliyor`. Odak
   L417-418. Rozet: `kitap-kodu · L404-423`.
6. `govde-degisti` — Yolda 21.5 → 31.5: gelen `IMZA`, beklenen `IMZA_DEGISMIS`; şeritler farklı. Terminal
   L420 metni. Not L434. Odak L417-420. Rozet: `kitap-kodu · L420, L434`.
7. `pencere-ici-tekrar` — Aynı paket 20 s sonra (`suAn` 1788602420): pencere içinde, imza doğru → ikisi de
   kabul; grafikte 10:00:00 ve 10:00:20 iki nokta. Not L433 ve L770 (nonce). Odak L398-399.
   Rozet: `kitaba-dayali · L398, L433, L770`.
8. `aralik-dogrulama` — Kod 16.4'ün iki çağrısı aynen; grafik ve argüman tablosu gizli (R27). İkinci çağrıda
   sıcaklık `kaldi`, nem `gecti`; denetim listesi yalnız bu iki satırdır (sayfanın `atlandi` satırları yoktur, rozet
   `kitap`). Terminal L544-546. Odak L495-496, L516-517. Rozet: `kitap · L544-546`.
9. `sunucu-zamani-kayit` — Cihaz saati 45 s geride (`IMZA_GERIDE`, R26): pencere geçer; kayıt
   `sunucuZamanDamgasi: 2026-09-05T10:00:00.000Z`. Not L554 ve L558. Odak L521.
   Rozet: `kitap-kodu · L521, L554, L558`.
10. `tampon-saatlik` — Sabit seri: 100. okumada tek toplu yazma, tamponda 20 kayıt. Özet tablosu ve üretilen
    SQL (`saatlikOzetSorgusuUret(1, "2026-09-05T07:00:00Z")`). 09:00 satırı 20 örnek gösterir: tampondakiler
    henüz yazılmadı. Not L761. Odak L718, L741-742. Rozet: `kitap-kodu · L716-734, L740-749, L761`.
11. `ozet` — `KitapBlok`: paragraf L462 (401/403/400), alternatifler tablosu (başlığıyla L565-572), notlar L998 ve
    L448. Rozet: `kitap · L448, L462, L565-572, L998`.

**Laboratuvar parametreleri.** Her Lab durumu tek istektir; seri sabittir, Lab okuması 10:00:00'a eklenir.

- `saatFarki`: −120…+120 s, adım 5, varsayılan 0. `zamanDamgasi = 1788602400 + saatFarki`.
- `sicaklik`: −999…120, adım 0.5, varsayılan 21.5.
- `nem`: −10…110, adım 0.1, varsayılan 45.2.
- `govde`:
  - `sağlam`: imza gönderilen gövdeyle hesaplanır.
  - `bir hane değişmiş`: imza `sicaklik` ile, gövde `sicaklik + 10` ile gider.
  - `bilinmeyen cihaz`: aynı paket, `cihazUuid` `esp32-lab102-temp`.

Çıktı: `CheckList`, argüman tablosu, grafikte nokta, terminal. Kod 16.3 kalırsa hata metni yazılır. Kod 16.4
sonucu `true` ya da `false [ '…' ]` biçimindedir (`nodeInspect`). Kabulde tampon 21 kayıt olur. Rozet: `kitap-kodu`.

## Bölüm 5 — `timeout-retry` (Bölüm 17, 10 adım)

**Kaynak kod** (`b17` = `b17-ai-ml-service-integration`).

| id | satirlar | title |
|---|---|---|
| `kod-17-3` / `kod-17-3-cikti` | 357–400 / 405–407 | `Kod 17.3 · AI isteklerinde zaman aşımı ve hata izolasyonu` |
| `kod-17-5` / `kod-17-5-cikti` | 698–767 / 772–776 | `Kod 17.5 · ChapterMiniAppAiIntegration.ts` |
| `code-002` | 173–176 | `Yanlış: zaman aşımsız fetch` |
| `code-006` | 459–471 | `Yanlış: agresif retry` |

**Model (`istek.ts`).** Saf TS, sanal saat; `setTimeout`, `fetch`, `Date.now` yoktur.

- Servis davranışı deneme başınadır: `{ gecikmeMs, sonuc: 'ok' | 'http-500' | 'bos-ozet' | 'bozuk-govde' }`.
  Deneme `n`, listenin `min(n − 1, uzunluk − 1)` öğesini kullanır.
- Kurallar:
  1. Zamanlayıcı denemeyle kurulur (L364-365, L719-720). `gecikmeMs >= zamanAsimiMs` → `t0 + zamanAsimiMs`'de
     `abort()`, `AbortError` (R32). Değilse yanıt `t0 + gecikmeMs`'de gelir.
  2. `finally` her yolda `clearTimeout` olayı üretir (L373-375, L728-730).
  3. `AbortError` → `GeciciAiHatasi("AI servisi zaman aşımına uğradı.")`. Kod 17.3'te diğer hata →
     `KaliciAiHatasi("AI servisi kalıcı bir hata döndürdü.")` (L372). Kod 17.5'te diğer hata aynen fırlar (L727).
  4. İzolasyon: hata yakalanır, konsola yazılır, `null` döner (L383-387, L739-742). Ana yanıt her zaman `200`.
  5. Doğrulama (Kod 17.5): `ozet` metin değilse ya da `trim()` boşsa log L745, `null` (L705-711, L744-747).
     `bos-ozet` → `{ ozet: "" }`, `bozuk-govde` → `{}`.
  6. Retry R29'dur; yalnız iptalde. `maksRetry = 0` kitabın davranışıdır.
- `kitapCagrilari173()` ve `kitapCagrilari175()` kitabın örnek çağrılarını aynen çalıştırır (R31). Testte
  L405-407 ve L772-776 harfiyen çıkar.

**Hesaplanmış süreler** (zaman aşımı 5000 ms):

| Senaryo | Olaylar | Sonuç |
|---|---|---|
| yavaş 8000, retry 0 | 1. deneme 0–5000 iptal | `null`, 5000 ms |
| hızlı 1200, retry 0 | 1. deneme 0–1200 yanıt | özet, 1200 ms |
| geçici (8000, sonra 1200), retry 1, taban 1000 | 0–5000 iptal; bekle 5000–6000; 6000–7200 yanıt | özet, 7200 ms |
| yavaş, retry 1, taban 1000 | 0–5000 iptal; bekle 1000; 6000–11000 iptal | `null`, 11 000 ms |
| yavaş, retry 3, taban 1000 | bekleme 1000, 2000, 4000; dört iptal | `null`, 27 000 ms |
| yavaş, retry 3, taban 0 | dört iptal, bekleme yok | `null`, 20 000 ms; uyarı satırı |
| yavaş, retry 2, taban 500 | bekleme 500, 1000 | `null`, 16 500 ms |
| gecikme 5000 / 4999, retry 0 | iptal / yanıt | `null` 5000 ms / özet 4999 ms |
| zaman aşımı 10 000, gecikme 8000 | yanıt | özet, 8000 ms |

**Sahne.**

- `SequenceLayer` şeritleri Şekil 17.2'nin adlarıdır: "İstemci", "Node.js API", "FastAPI çıkarım servisi".
  Her deneme `POST /predict` okudur; iptal "yanıt gelmedi". Son ok `200 OK (özet yok, temel veri korunur)`
  yalnız adım 8'de ve Lab'da.
- `scene-zaman.ts` (R5, d3 SVG): x sanal ms. Her deneme bir çubuktur (iptalde alarm ucu, yanıtta teal);
  denemeler arası "bekle 1000 ms" boşluğu; `zamanAsimiMs` dikey çizgi; sağda toplam süre etiketi.
- `HttpCards`: ana yanıt kartı `200` ("özet: …" ya da "özet yok") ve terminal (konsol satırları).
- `CheckList` (adım 9, Lab): zaman aşımı → doğrulama. `DataTable` hata türleri (adım 6).
- Altta kod şeridi.

**Adımlar:**

1. `tanitim` — `KitapBlok`: tanım (L316), paragraf L318. Rozet: `kitap · L316, L318`.
2. `zamansiz` — code_002: servis yanıt vermez; çubuk eksenin sonuna kadar uzar, bitiş yok. Odak L175.
   Rozet: `kitaba-dayali · L162, L175`.
3. `abort` — Kod 17.3, servis 8000 ms, sinyali dinler: 5000'de `abort()`, `AbortError` → `GeciciAiHatasi`.
   Not: kitabın çağrıları sinyali kullanmaz (R31). Odak L365, L369-370. Rozet: `kitap-kodu · L360-376`.
4. `basarili` — Aynı kod, servis 1200 ms: yanıt gelir, `finally` zamanlayıcıyı temizler. Terminal `Kısa bir
   özet metni.` (L405). Not L419. Odak L374. Rozet: `kitap-kodu · L373-375, L405`.
5. `izolasyon` — Kitabın iki çağrısı aynen (L390-396): terminal L405-407; ana yanıt `200` (kart adımın çerçevesidir,
   kitabın bastığı bir değer değildir). Zaman ekseni gizli. Odak L384-386. Rozet: `kitap · L405-407`.
6. `gecici-kalici` — Tablo: `AbortError` → `GeciciAiHatasi`; `AI servisi hata döndürdü: 500` → `KaliciAiHatasi`.
   Terminal: `Özet alınamadı, kitap bilgisi özetsiz gösterilecek: AI servisi kalıcı bir hata döndürdü.` Not
   L337. Odak L369-372. Rozet: `kitap-kodu · L337, L369-372`.
7. `retry-bekle` — Sayfanın uzantısı (R29 notu): 1. deneme 5000'de iptal, bekle 1000, 2. deneme 1200 ms'de
   yanıt; toplam 7200 ms. Odak Kod 17.5 L724-725. Rozet: `kitaba-dayali · L335, L443, L794`.
8. `retry-tukendi` — 2. deneme de iptal: toplam 11 000 ms; terminal `Özet alınamadı: AI servisi zaman aşımına
   uğradı.`; `200 OK (özet yok, temel veri korunur)`. code_006'nın beklemesiz on denemesi karşıt not olarak
   durur (L448). Odak code_006 L461, L465. Rozet: `kitaba-dayali · L335, L448, L471`.
9. `dogrulama` — Kod 17.5'in üç çağrısı aynen: ikinci çağrıda zaman aşımı `gecti`, doğrulama `kaldi`. Ekranda
   yalnız kitap metni durur (rozet `kitap`): yanıt kartı yoktur; `kaldi` satırının ayrıntısı kitabın log satırıdır
   (L745, çıktıda L773), `gecti` satırının ayrıntısı yoktur. Terminal L772-776. Zaman ekseni gizli. Odak L744-745.
   Rozet: `kitap · L772-776`.
10. `ozet` — `KitapBlok`: alternatifler tablosu (başlığıyla L438-446), not L806. Rozet: `kitap · L438-446, L806`.

**Laboratuvar parametreleri.** Altyapı Kod 17.5'tir; R29 notu durur.

| Parametre | Değerler | Varsayılan |
|---|---|---|
| `zamanAsimiMs` | 1000–10 000, adım 500 | 5000 |
| `senaryo` | `hizli` / `yavas` / `gecici` / `http-500` / `bos-ozet` / `bozuk-govde` | `gecici` |
| `maksRetry` | 0–3 | 1 |
| `beklemeTabanMs` | 0 / 500 / 1000 / 2000 | 1000 |
| `servisGecikmesiMs` | 500–12 000, adım 500 (yavaş ayak; hızlı 1200 sabit) | 8000 |

`http-500`, `bos-ozet`, `bozuk-govde` 1200 ms'de yanıt verir ve tekrar denenmez. `beklemeTabanMs = 0` iken ve en az
iki yeniden deneme gerçekten çalıştıysa "bekleme yok: code_006'nın deseni (L448)" uyarısı çıkar; tek yeniden deneme
çalışan ya da hiç çalışmayan durumda uyarı çıkmaz. Rozet: `kitap-kodu`; retry
denemesi olan durumda `kitaba-dayali`.

## Bölüm 6 — Kayıt defteri, ana sayfa, README

- `registry.ts`: dört kart `hazir`, `href` ile. `vite.config.ts` girdilerine dört sayfa eklenir.
- `tests/e2e/home.spec.ts` ve ana sayfa birim testi: 15 hazır, 0 yakında. "Yakında" bölümü boşsa gizlenir.
- README: canlı adresler. Kısayol tablosu değişmez (R35).

## Arayüzler

```ts
// src/core/plot/kitap-blok.ts
export interface KitapBlok { tanim?: string; paragraflar?: readonly string[];
  tablolar: readonly DataTableSpec[]; notlar: readonly string[] }
export class KitapBlokView { readonly root: HTMLDivElement; constructor(host: HTMLElement);
  update(blok: KitapBlok | null): void; destroy(): void }

// src/core/kripto.ts (eklenen)
export function hmacSha256Hex(anahtar: string, veri: string): string;

// src/concepts/docker-compose/compose.ts
export interface BaglantiSecenekleri { host: string; port: number; veritabaniAdi: string }
export interface Deneme { deneme: number; t: number; basari: boolean }
export interface BaglantiSonucu { denemeler: Deneme[]; durum: 'kuruldu' | 'hata'; log: string[]; hata?: string }
export function saglikliBaglantiKur(s: BaglantiSecenekleri, hazirMi: (t: number) => boolean,
  baslangicMs: number, maksimumDeneme?: number, bekleMs?: number): BaglantiSonucu;
export interface Saglik { interval: number; timeout: number; retries: number; startPeriod: number }
export const KITAP_SAGLIK: Saglik;                      // { 2000, 3000, 10, 0 }
export interface Prob { k: number; t: number; durum: 'gecti' | 'kaldi' | 'sayilmadi'; ardisikHata: number }
export function saglikDegerlendir(dbHazirMs: number, s: Saglik):
  { problar: Prob[]; saglikliMs: number | null; unhealthyMs: number | null };
export interface ComposeSenaryo { mod: 'sira' | 'saglikli'; dbHazirMs: number; retries: number;
  maksimumDeneme: number; hostAdi: 'kutuphane-db' | 'localhost' }
export function composeUp(s: ComposeSenaryo): { apiBaslangicMs: number | null;
  saglik?: ReturnType<typeof saglikDegerlendir>; baglanti?: BaglantiSonucu;
  durum: 'kuruldu' | 'hata' | 'bagimlilik-basarisiz'; olaylar: Message[] };

// src/concepts/nginx-tls/proxy.ts
export type Hedef = 'http-80' | 'https-443' | 'port-3000' | 'port-5432';
export type Ayar = 'kod-15-3' | 'kod-15-5' | 'code-007' | 'basliksiz';
export interface NginxParams { hedef: Hedef; ayar: Ayar; uygulama: 'ayakta' | 'kapali';
  trustProxy: 0 | 1 | 2; sahteXff: boolean; kalanGun: number }
export function ufwKarari(port: number): 'izin' | 'engel';
export function proxyBasliklari(ayar: Ayar, blok: 80 | 443, gelen: readonly [string, string][],
  istemciIp: string): [string, string][];
export function yanlisIstemciIpAl(baglantiIp: string): string;
export function dogruIstemciIpAl(xForwardedFor: string | undefined, baglantiIp: string): string;
export function expressReqIp(soketIp: string, xff: string | undefined, trustProxy: 0 | 1 | 2): string;
export function sertifikaDurumu(kalanGun: number): 'gecerli' | 'yenilenecek' | 'suresi-doldu';
export interface NginxIzi { denetimler: Denetim[]; olaylar: Message[]; istek: HttpIstek;
  yanit: HttpYanit | null; uygulamaGorur: [string, string][] | null }
export function istekIsle(p: NginxParams, yol?: string): NginxIzi;

// src/concepts/iot-zaman-serisi/telemetri.ts
export const GECERLILIK_PENCERESI_SANIYE = 60;
export const DERS_SIMDI = 1788602400;
export interface ImzaliIstekBasliklari { cihazUuid: string; imza: string; zamanDamgasi: number }
export function imzaUret(anahtar: string, zamanDamgasi: number, govdeMetni: string): string;
export function dogrula(b: ImzaliIstekBasliklari, govdeMetni: string, suAn: number):
  { gecerliMi: boolean; hata?: string; beklenenImza?: string };
export interface TelemetriVerisi { cihazId: string; sicaklik: number; nem: number }
export function telemetriyiDogrula(v: TelemetriVerisi): { gecerli: boolean; hatalar: string[] };
export interface HamOlcum { sensorId: number; deger: number; zaman: number }   // zaman: UTC ms
export interface TamponDurumu { tampon: readonly HamOlcum[]; yazilan: readonly HamOlcum[] }
export function tamponaEkle(d: TamponDurumu, o: HamOlcum, yazmaBasarili?: boolean): TamponDurumu;
export interface SaatOzeti { saatDilimi: number; ortalama: string; enDusuk: number; enYuksek: number;
  ornekSayisi: number }
export function saatlikOzet(olcumler: readonly HamOlcum[], baslangic: number): SaatOzeti[];
export function saatlikOzetSorgusuUret(sensorId: number, baslangicTarihi: string): string;
export const SABIT_SERI: readonly HamOlcum[];

// src/concepts/timeout-retry/istek.ts
export type ServisSonucu = 'ok' | 'http-500' | 'bos-ozet' | 'bozuk-govde';
export interface Davranis { gecikmeMs: number; sonuc: ServisSonucu }
export interface IstekAyar { zamanAsimiMs: number; maksRetry: number; beklemeTabanMs: number;
  surum: '17.3' | '17.5' }
export type OlayTuru = 'istek' | 'iptal' | 'yanit' | 'temizle' | 'bekle' | 'dogrulama' | 'sonuc';
export interface IstekOlayi { t: number; tur: OlayTuru; deneme: number; metin?: string }
export function beklemeMs(retryNo: number, tabanMs: number): number;   // tabanMs * 2 ** (retryNo - 1)
export function ozetiAl(davranislar: readonly Davranis[], ayar: IstekAyar):
  { olaylar: IstekOlayi[]; ozet: string | null; konsol: string[]; bitisMs: number };
export function kitapCagrilari173(): string[];   // L405-407
export function kitapCagrilari175(): string[];   // L772-776
```

Kavram sayfaları `ConceptPage<P>` sözleşmesini değiştirmeden kullanır. Sayfaya özel adlar plan sırasında
değişebilir; ortak parçaların arayüzü bu belgedeki gibidir.

## Hata durumları

- `KitapBlokView.update(null)` tabloları yok eder; arka arkaya çağrı sızıntı bırakmaz.
- `docker-compose`: `unhealthy` iken API satırı "başlamadı" olur, deneme listesi boştur. `maksimumDeneme = 1`
  iken bekleme yoktur.
- `nginx-tls`: UFW'de düşen istekte yanıt kartı yoktur; kartın yerinde "yanıt yok: paket düşürüldü" yazar.
  `kalanGun` 0'da da yanıt yoktur. `trustProxy` ve `sahteXff` 301'de anlamsızdır: tablo gizlenir.
- `iot-zaman-serisi`: `Buffer.from` davranışıyla kısa ya da geçersiz hex imza uzunluk dalına düşer. Lab
  kaydırıcıları aralık dışına çıkmaz; ondalıklar `Number(input.value)` ile okunur. −999 grafikte kenarda
  etiketlenir.
- `timeout-retry`: toplam süre ekseni aşarsa eksen genişler (en çok 30 000 ms). Adım 2'nin çubuğu sonsuzu
  "…" ucuyla gösterir.
- `prefers-reduced-motion` → geçiş süreleri 0.
- Dar ekran (390 px): sahne üst üste yığılır. Ders'te kod şeridi gizlenebilir. İmza şeritleri karakter
  sınırında kırılır; tablolarda tam 64 hex, şeritte `kisalt: 16`.

## Doğrulama

- **Ortak parçalar.**
  - `tests/unit/core/kripto.test.ts`: `hmacSha256Hex` `createHmac(...).digest("hex")` ile aynı; Türkçe
    karakterli girdi de denenir.
  - `tests/unit/plot/kitap-blok.test.ts`: sıra (tanım, paragraf, tablo, not), `update(null)`, `destroy`.
  - `cors-preflight` ve `rate-limiting` scene testleri: tanıtım ve özet DOM'u değişmez; rozet aralıkları R3.
- **`tests/unit/docker-compose/compose.test.ts`.** L990 harfiyen; aynı satır kitabın sayaçlı fonksiyonuyla
  da çıkar. Son denemede bekleme yok, hata metni. `localhost` hiç bağlanmaz; code_012 çıktısı L886.
  Bölüm 2'nin hesaplanmış değerler tablosunun her satırı.
- **`tests/unit/nginx-tls/proxy.test.ts`.** `dogruIstemciIpAl("203.0.113.7, 10.0.0.5", "10.0.0.5")` →
  `203.0.113.7` (L369); başlıksız → bağlantı IP'si; `yanlisIstemciIpAl`. UFW 22/80/443 izin, 3000/5432 engel.
  Bölüm 3'ün hesaplanmış değerler tablosunun her satırı. `sertifikaDurumu` 30 ve 0'da geçiş.
- **`tests/unit/iot-zaman-serisi/telemetri.test.ts`.** Altı HMAC değeri `createHmac` ile. Pencere ±60 geçer,
  ±61 kalır; pencere UUID'den önce. Üç hata metni harfiyen. Pencere içi tekrar kabul. Aralık sınırları
  −40/85/0/100 geçer, −40.1/85.1/−0.1/100.1 kalır. L544-546 ve L203 harfiyen. 99 okumada yazma yok,
  100.'de tek toplu; başarısız yazmada kayıtlar başa döner. Sabit serinin özet tablosu ve karşılaştırma satırı.
- **`tests/unit/timeout-retry/istek.test.ts`.** L405-407 ve L772-776 harfiyen. Bölüm 5'in süre tablosunun her
  satırı. `finally` her yolda. Retry yalnız iptalde. `beklemeMs` 1000, 2000, 4000. Ana yanıt hep `200`.
- **`tests/unit/<kavram>/scenario.test.ts`, `scene.test.ts`.** Adım sayıları ve anahtar anlar:

  | Sayfa | Adım → DOM |
  |---|---|
  | docker-compose | 7 terminalde L886; 8 API `t = 0 s` "başladı", db `starting`; 9 iki prob (`kaldi`, `gecti`), API `t = 4 s`; 10 terminal L990 |
  | nginx-tls | 2 `:5432` oku UFW'de durur; 5 terminal `203.0.113.7`, şeridin ilk parçası vurgulu; 7 `301` ve `Location`, uygulama şeridine ok yok; 10 `502`, uygulama `atlandi` |
  | iot-zaman-serisi | 4 pencere `kaldi`, kalan dört `atlandi`; 6 iki imza şeridi farklı; 8 grafik gizli, terminal L546; 10 özet 20.65 / 21.65 / 22.40, tampon 20 |
  | timeout-retry | 3 çubuk 5000'de alarm ucuyla biter; 5 zaman ekseni gizli, terminal L406; 7 "bekle 1000 ms" ve `7200 ms`; 9 doğrulama `kaldi`, terminal L772-776 |

  Her adımda kaynak rozeti beklenen türde ve aralıkta. Tanıtım ve özet adımlarında `.kitap-blok` görünür.
- **`scripts/kitap-dogrula.mjs`.** Dört yeni kavram ve önceki on bir kavram için temiz.
- **`tests/e2e/<kavram>.spec.ts`.** Ders klavye yürüyüşü, Lab parametre değişimi, sığma (1280×720, 1280×740,
  390), kapsayıcılarda yatay kayma yok, `seqOutsideSvg` boş. Taban çizgileri yalnız anahtar adımlarda:

  | Sayfa | Taban çizgileri |
  |---|---|
  | docker-compose | ders 9, ders 10 |
  | nginx-tls | ders 6, ders 10 |
  | iot-zaman-serisi | ders 6, ders 10 |
  | timeout-retry | ders 7, ders 9 |
  | cors-preflight, rate-limiting | değişmez (R2) |
- **`tests/e2e/dalga4.perf.spec.ts`** (dalga sonunda bir kez): adım değişiminde ve Lab değişiminde uzun görev
  yok (> 50 ms). `iot` Lab'ında HMAC eşzamanlıdır ve kısa kalır.
- **Kapı:** `npm run check`.

## Kitap tutarsızlıkları (bookMaker'a)

Ekranda hiçbiri düzeltilmez (R6). Satırlar `final.md`'dir.

**Bölüm 14 (`b14-docker-compose`).**

1. L612: "Compose, `services` altında tanımlanan her servis için otomatik olarak bir network oluşturur".
   Compose proje başına tek varsayılan network kurar. Sayfa yalnız "servisler adla ulaşır" der.
2. Kod 14.7 (L635-637): `docker compose ps` çıktısı `NAME / STATUS running` gerçek biçim değildir (`Up …`,
   `(healthy)`, proje öneki yok).
3. code_011'in `OUTPUT_FOR` bloğu (L716-718) boştur; kodun çağrısı yoktur. "Yanlış varsayım" başlığı doğru
   yazılmış bir yeniden deneme fonksiyonuyla uyuşmaz.
4. İz tablosu (L902) "5 denemeli `retryWithBackoff`" der. Bu ad kodda yoktur; `saglikliBaglantiKur` sabit
   bekler. Üstel bekleme L1007'de alıştırmadır.
5. Kod 14.9'un yorumu (L935-936) yalnız `code_003` ve `code_009`'u anar; çok aşamalı `code_015` ve
   healthcheck'li `code_014` anılmaz. Kod 14.2 (`code_003`) ve Kod 14.3 (`code_015`) aynı işi iki kez anlatır;
   aşama adları `build`/`production` (L207, L215) ile `derleyici`/`uretim` (L295, L315).
6. Kod 14.9 üst düzey `await` kullanır (L985); `runnable` işaretlidir ama modül ayarı verilmez.
7. Servis adı örnekleri L468 "`postgres-db`" ve L891 "`postgres`"; kodlar `kutuphane-db` der.
8. Kod 14.8 servis adları (`api`, `veritabani`) Kod 14.6'dan farklıdır; kitap bunu L803'te kendisi belirtir.
9. Boyut sayıları (L337 "%85", L822 "1.1 GB'tan 124 MB'a") temsilîdir (L819-820 `CLAIM_META`); L337 "Kodun
   amacı" cümlesi bunu ölçülmüş gibi yazar.

**Bölüm 15 (`b15-linux-deployment`).**

1. L384: "sözdizimi hatası içeren bir değişiklik `nginx -s reload` ile uygulanırsa Nginx tamamen durabilir".
   Hatalı yapılandırmada reload reddedilir, eski yapılandırma çalışmayı sürdürür. Aynı yerde reload "yeniden
   başlatma" diye adlandırılır.
2. Kod 15.5'in 443 bloğu (L466-469) `Host`, `X-Real-IP`, `X-Forwarded-For` ayarlamaz; L317-321 bunların
   gerekli olduğunu söyler. L435 bu yapılandırmayı certbot'un ürettiği yapılandırma gibi sunar.
3. `dogruIstemciIpAl` (L356-361) XFF'nin ilk adresini alır. `$proxy_add_x_forwarded_for` istemcinin XFF'sinin
   sonuna ekler; ilk adres istemcinin uydurabileceği değerdir. L355 notu güvenli yolu göstermez.
4. L174 UFW'nin 5432'yi koruduğunu söyler. Kitabın kendi CLAIM_META'sı (L182) Docker'ın yayınlanan portlarda
   UFW'yi atlayabildiğini kaydeder; L174 cümlesi bunu anmaz. Çözüm (`127.0.0.1:3000:3000`) L161-172'dedir.
5. Numaralandırma: `code_002`, `code_004`, `code_007` "Kod 15.n" başlığı taşımaz. Kod 15.2 `code_012`, Kod
   15.6 `code_013`'tür. L1125 `evidence: Kod 15.11` der; bölümde en büyük numara Kod 15.9'dur.
6. L562 "tek bir komutla" der; Kod 15.6 dört adımdır. L567 `--dry-run`'ı "test ortamında simüle eder" diye
   anlatır; gerçekte staging sunucusuyla yapılan bir yenileme denemesidir.
7. Kod 15.2 L240 `systemctl reload sshd`: Ubuntu/Debian'da birim adı genellikle `ssh`'tir.

**Bölüm 16 (`b16-iot-backend`).**

1. Üç sıcaklık aralığı: Kod 16.4 ve 16.7 −40…85 (L495, L934), Kod 16.5 −30…70 (L656), sohbet −10…60 (L840).
2. Kod 16.3 bölümün akışına bağlanmaz: Kod 16.7 yalnız API anahtarı kullanır (L901-907); bölüm hedefi (L34)
   "cihaz kimliği API anahtarıyla doğrulanacak" der. Kod 16.3'ün alanı `cihazUuid`, diğerlerinin `cihazId`.
3. Devre dışı cihaz Kod 16.2'de 403'tür (L277); Kod 16.7 aynı durumu 401 "Cihaz doğrulanamadı." ile birleştirir
   (L903-904). L462 ve Şekil 16.2 403'ü ayrı tutar.
4. Tampon: metin "2 saniye veya 100 kayıt" (L686), "2 saniyelik mikro-tamponlar" (L774), "5-10 saniyelik
   paketler" (L791) der; Kod 16.6 yalnız `length >= 100` ile boşaltır (L718).
5. Kod 16.6: `HamOlcum.zaman` (L707) kaynağı söylenmez (L998 sunucu saatini şart koşar). `void
   this.tamponuBosalt()` (L719) ile `throw hata` (L732) yakalanmamış promise reddi doğurur. `HamOlcum`
   `sensorId: number` der, Kod 16.4 `cihazId: string`.
6. Kod 16.7'nin logu `.slice(0, 10)` (L952) yüzünden yalnız `Kaydedildi` yazar.
7. Numaralandırma: Kod 16.3 `code_009`, 16.4 `code_005`, 16.5 `code_010`, 16.6 `code_011`, 16.7 `code_008`.
8. Kod 16.3 ile Kod 16.4'teki cihaz adları farklıdır: `esp32-lab101-temp` (L390), `esp32-okuma-salonu-01`
   (L527). Uç nokta yolu ve `cihazUuid` başlık adı kitapta yoktur.
9. Kod 16.5 nem için aralık denetlemez (L656); `Number.isFinite` (L650) JSON girdisinde gereksizdir.

**Bölüm 17 (`b17-ai-ml-service-integration`).**

1. Retry anlatılır ama kodlanmaz: Şekil 17.2, L320, L443 bunu ders konusu gibi sunar; L339 kodun tek deneme
   yaptığını söyler. L471 "code_005'teki gibi" artan bekleme der; code_005'te bekleme yoktur.
2. Deneme sayısı: L335 ve L794 "bir kez", L471 "2-3".
3. Zaman aşımı: kod varsayılanı 5000 ms (L362, L717); L655 "3-5 saniyelik", L664 `AbortController(3000ms)`.
4. Kod 17.3 her `AbortError` dışı hatayı (503 dahil) kalıcı sayar. Kod 17.5 `KaliciAiHatasi` tanımlamaz ve
   hatayı aynen fırlatır: aynı bölümde iki sözleşme.
5. Doğrulama eşiği: L665 "`ozet.trim().length < 10`", Kod 17.5 `trim().length > 0` (L710).
6. Kod 17.3/17.5'in örnek çağrıları sinyali kullanmaz (L390, L393-395, L752-762); zamanlayıcı hiç sınanmaz.
   Kod 17.1 `fetch`'e `signal` vermez.
7. "Yaygın hatalar" paragrafları "En yaygın"dan "Dördüncü"ye atlar (L162, L448); "İkinci/Üçüncü" kod
   çitinden sonra gelir.
8. L321 Bulkhead'i anar; alternatifler tablosunda (L440-446) satırı yoktur.
9. L320 yazım: "köküleri" (kökleri). Sayfa bu cümleyi alıntılamaz.
