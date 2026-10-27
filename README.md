# STP Animasyon

Sunucu tabanlı programlama kavramlarını adım adım animasyonlarla anlatan, ders sırasında kullanılmak üzere hazırlanmış statik bir Türkçe öğretim sitesi. Her kavram sayfası bir senaryoyu adım adım oynatır; Ders modu sınıfta projeksiyon için, Laboratuvar modu kendi başına çalışmak için tasarlanmıştır.

İçerik, "Modern Sunucu Tabanlı Programlama" kitabına (Prof. Dr. İsmail KIRBAŞ) dayanır.

## Canlı site

- Ana sayfa: https://bmdersleri.github.io/stp-animation/
- İstek-yanıt yolculuğu: https://bmdersleri.github.io/stp-animation/istek-yanit/
- Event loop: https://bmdersleri.github.io/stp-animation/event-loop/
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
| [ / ] | Event loop (Lab): önceki / sonraki kare |

## Geliştirme

```bash
npm ci
npm run dev        # geliştirme sunucusu, http://localhost:5181
npm test           # birim testleri
npm run check      # yayın öncesi kapı: birim testleri + Playwright
```

## Yeni kavram

1. İskeleti üretin: `npm run yeni-kavram -- <kimlik> "<Başlık>"`.
2. `vite.config.ts` içindeki `input` listesine sayfayı ekleyin.
3. `src/concepts/registry.ts` içinde ilgili kaydı `hazir` durumuna çevirip `href` değerini verin.
