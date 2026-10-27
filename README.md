# STP Animasyon

Sunucu tabanlı programlama kavramlarını adım adım animasyonlarla anlatan, ders sırasında kullanılmak üzere hazırlanmış statik bir Türkçe öğretim sitesi. Her kavram sayfası bir senaryoyu adım adım oynatır; Ders modu sınıfta projeksiyon için, Laboratuvar modu kendi başına çalışmak için tasarlanmıştır.

İçerik, "Modern Sunucu Tabanlı Programlama" kitabına (Prof. Dr. İsmail KIRBAŞ) dayanır.

## Canlı site

- Ana sayfa: https://bmdersleri.github.io/stp-animation/
- İstek-yanıt yolculuğu: https://bmdersleri.github.io/stp-animation/istek-yanit/
- Event loop: https://bmdersleri.github.io/stp-animation/event-loop/
- Middleware zinciri: https://bmdersleri.github.io/stp-animation/middleware-zinciri/
- REST CRUD: https://bmdersleri.github.io/stp-animation/rest-crud/
- SQL JOIN: https://bmdersleri.github.io/stp-animation/sql-join/
- Katmanlı mimari: https://bmdersleri.github.io/stp-animation/katmanli-mimari/
- Parola güvenliği: https://bmdersleri.github.io/stp-animation/salt-hash/
- JWT akışı: https://bmdersleri.github.io/stp-animation/jwt-akisi/
- RBAC, 401 ve 403: https://bmdersleri.github.io/stp-animation/rbac-401-403/
- CORS ve preflight: https://bmdersleri.github.io/stp-animation/cors-preflight/
- Rate limiting: https://bmdersleri.github.io/stp-animation/rate-limiting/
- Ders modu: https://bmdersleri.github.io/stp-animation/istek-yanit/?mod=ders

Site, GitHub Pages etkinleştirildiğinde (Settings > Pages > Source: GitHub Actions) `main` dalına her push ile yayına girer. GitHub Actions yalnızca derleyip yayınlar; testler yerelde çalışır. `npm ci` bir push öncesi kancası (`.githooks/pre-push`) kurar: `main`'e her push'tan önce `npm run check` kendiliğinden çalışır ve geçmezse push durur.

## Ders modu

Herhangi bir kavram sayfasına `?mod=ders` eklemek, sınıfta projeksiyon için tasarlanmış ders modunu açar.

## Klavye kısayolları

| Tuş | İşlev |
| --- | --- |
| → / Boşluk | Sonraki adım |
| ← | Önceki adım |
| P | Oynat / duraklat |
| F | Tam ekran |
| Home / End | İlk / son adım |
| ? | Yardım |
| Y | İstek-yanıt: yetkiyi aç / kapa |
| N | Middleware zinciri: istekGunlugu'nda next'i aç / kapa |
| T | REST CRUD: tekrar sayısını döndür |
| U | Katmanlı mimari: kitap uygunluğunu değiştir |
| S | Parola güvenliği: yeni salt |
| B | JWT akışı: bozulmayı değiştir |
| R | RBAC: izinli rolleri değiştir |
| O | CORS: kökeni döndür |
| G | Rate limiting: istek gönder |
| [ / ] | Bütün sayfalar (Lab): önceki / sonraki kare (event loop), olay (istek-yanıt, middleware, katmanlı mimari), gönderim (REST CRUD), çift (SQL JOIN), istek (rate limiting) |

390 px genişliğindeki telefonlarda Ders modundaki kod şeridi gizlenir.

## Bağımlılıklar

`@noble/hashes`, tarayıcıda Node `crypto` ile aynı hash sonucunu vermek için kullanılır (parola güvenliği sayfası).

## Geliştirme

```bash
npm ci
npm run dev        # geliştirme sunucusu, http://localhost:5181
npm test           # birim testleri
npm run check      # yayın öncesi kapı: birim testleri + Playwright
```

## Kitap doğrulama

`npm run kitap-dogrula`, ekrandaki kod satırlarını kitaptaki listing'lerle harfiyen karşılaştıran yerel bir araçtır; kapıda (`npm run check`) çalışmaz. Kitap deposunun yolu `KITAP_DIZINI` ortam değişkeniyle verilir (varsayılan `C:/projects/modernSunucuTabProg`). Bütün kavramlar `tamam` çıkmalıdır.

## Yeni kavram

1. İskeleti üretin: `npm run yeni-kavram -- <kimlik> "<Başlık>"`.
2. `vite.config.ts` içindeki `input` listesine sayfayı ekleyin.
3. `src/concepts/registry.ts` içinde ilgili kaydı `hazir` durumuna çevirip `href` değerini verin.
