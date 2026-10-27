# Dalga 1 — Temel: çekirdek, istek-yanıt ve event loop — Tasarım

- **Tarih:** 2026-10-27
- **Kaynak:** Öğretmen: "sorulari atla, vmAnimation yapısıyla başla. kararları sen ve projeyi yönet.
  token optimizasyonu yap." Dalga planı (4 dalga) ve Dalga 1 kapsamı sohbette onaylandı.
  Kitap: `C:\projects\modernSunucuTabProg` (salt okunur), Bölüm 1
  (`chapters/b01-modern-backend-web-mimarisi/content/final.md`) ve Bölüm 4
  (`chapters/b04-nodejs-runtime/content/final.md`).
- **Yetki:** Bütün tasarım kararları benimdir ("Benim kararım"). Kararlar ledger'da `Ruling:`
  satırı olarak durur ve iş sonunda öğretmene listelenir. Yayın onayı **yok**: GitHub deposu
  açmak ve `main`'e push öğretmenin sohbetteki onayını bekler.
- **Kardeş proje:** `C:\projects\vmAnimation` (salt okunur). Çekirdek oradan **kopyalanır**,
  yeniden yazılmaz; yalnız proje adları, portlar ve kitap bilgisi değişir.

## Amaç ve kabul ölçütleri

"Modern Sunucu Tabanlı Programlama" kitabı için vmAnimation'ın kardeşi olan, adım adım kavram
animasyonları sitesinin temelini kurmak ve ilk iki kavramı yayına hazır getirmek. Öğrenci şunları
kavramalı:

1. **Bir istek katman katman ilerler, yanıt aynı yoldan döner.** İstemci → ters vekil → API →
   backend servisi; her katman kendi kuralını uygular ve isteği durdurabilir. Hata kodu, isteği
   durduran katmanda üretilir (401 ters vekilde, 400 API'de, 404 backend'de ya da ters vekilde).
2. **Kimlik denetimi yol eşleşmesinden önce gelir** (kitap, Bölüm 1 uyarı kutusu).
3. **Node.js tek iş parçacıklı ana çağrı yığınında çalışır; bekleyen iş kuyruğa alınır.**
   `setTimeout(…, 0)` bile yığın boşalmadan çalışmaz; `await` fonksiyonu askıya alır ama
   programı durdurmaz.
4. **Mikro görev kuyruğu (Promise) makro görev kuyruğundan (zamanlayıcı) önce boşaltılır;**
   uzun senkron kod bütün callback'leri geciktirir.

Kabul ölçütleri:

1. Site iskeleti vmAnimation çekirdeğiyle çalışır: ana sayfa, kavram sayfası kabuğu, adım
   oynatıcı, klavye kısayolları, Ders (`?mod=ders`) ve Laboratuvar modu, yardım katmanı, tam ekran.
   vmAnimation'ın ilgili çekirdek birim testleri buraya taşınır ve geçer.
2. Ana sayfa başlığı "Modern Sunucu Tabanlı Programlama", alt başlık "Kavram Animasyonları",
   yazar "Prof. Dr. İsmail KIRBAŞ". 18 bölüm başlığı kayıtlıdır; 2 kavram **hazır**, Dalga 2–4'ün
   13 kavramı **yakında** kartı olarak görünür.
3. İki yeni sayfa: `istek-yanit/` ("İstek-yanıt yolculuğu: istemciden backend'e", Bölüm 1,
   10 adım) ve `event-loop/` ("Event loop: çağrı yığını ve kuyruklar", Bölüm 4, 11 adım); ikisi de
   Ders ve Laboratuvar modunda çalışır.
4. Ekrandaki her kod satırı, mesaj, durum kodu ve terminal çıktısı kitaptakiyle **harfiyen**
   aynıdır. Akışlar saf TypeScript fonksiyonlarıyla üretilir ve kitabın çıktı blokları birim
   testinde sabit metin olarak doğrulanır (Python üreticisi yok; bkz. Kararlar).
5. Yeni ortak sahne parçaları `src/core/plot/` altındadır: **sıra diyagramı** (`sequence.ts`) ve
   **kod izleme paneli** (`code-trace.ts`). Sonraki dalgalar bunları kullanır.
6. Her adım 1280×720, 1280×740 ve 390 px genişlikte sahneye sığar; Ders modunda yazı tabanları
   vmAnimation'daki gibidir.
7. `npm run check` yeşil; pre-push kancası ve GitHub Pages iş akışı hazır (çalıştırılmaz).

## Kararlar

| Konu | Karar | Neden |
|---|---|---|
| Teknoloji | vmAnimation ile aynı: TypeScript, Vite, d3 (`d3-selection`, `d3-transition`, `d3-ease`, `d3-scale`), Vitest + jsdom, Playwright (sistem Chrome). Aynı sürümler, `package-lock.json` sıfırdan `npm install` ile | Benim kararım. Öğretmen "vmAnimation yapısıyla" dedi; iki site aynı bakımla yaşar |
| Çekirdeğin taşınması | `cp` ile kopya, ardından yalnız ad/port/kitap metni değişiklikleri. Kopyalanan dosyalar: `src/core/{shell,player,keyboard,mode}.ts`, `theme.css`; `src/core/plot/{transition,viewport,text-measure,flow-graph(.css),code-panel(.css),label-place,dodge,marks,format}.ts`; `src/home/*`; `scripts/yeni-kavram.mjs` (+`.d.mts`); `tests/unit/svg-stubs.ts`, `tests/e2e/helpers.ts`; bunlara karşılık gelen çekirdek birim testleri; `.githooks/pre-push`; `.github/workflows/deploy.yml`; `public/favicon.svg` | Benim kararım. Token tasarrufu ve kanıtlanmış kod. Grafik türleri (`axes`, `line-chart`, `hbars` …) şimdi alınmaz; bir sonraki dalga ihtiyaç duyarsa o zaman kopyalanır |
| Alınmayanlar | `matrix.ts`, `cluster-scatter.ts`, `dendrogram.ts`, `point-kinds.ts`, `stats.ts`, `random.ts`, `text-input.ts`, bütün `scripts/make_*_data.py`, fixture'lar, kavram klasörleri | Veri madenciliğine özgü |
| Veri üretimi | Python yok. Kitabın kodu saf TS fonksiyonu olarak yeniden kurulur (`flow.ts`, `sim.ts`); kitabın çıktı blokları birim testinde **sabit metin** olarak durur | Benim kararım. Bu kitapta sayısal veri yok, akış var; kitabın çıktısı zaten altın değerdir |
| Proje adları | `package.json` adı `stp-animasyon`; site başlık soneki "· Sunucu Programlama Animasyonları"; GitHub deposu (öğretmen onayıyla) `bmdersleri/stp-animation` | Benim kararım; vm-animation adlandırmasının eşi |
| Portlar | Dev 5181 (`server.port`, `strictPort`), e2e `vite preview` 4174 | vmAnimation'ın 5180/4173'üyle çakışmasın |
| Favicon yolu | Sayfalarda `href="../favicon.svg"`, ana sayfada `href="favicon.svg"` | Alt yolda (`/stp-animation/`) mutlak `/favicon.svg` kırılır |
| Kayıt defteri | `src/concepts/registry.ts`, vmAnimation biçimi; `CH` 18 bölüm başlığını kitabın `chapter_manifest.yaml` / bölüm başlıklarından alır | Ana sayfa yol haritasını gösterir |
| Yakında kartları | Dalga 2–4'ün 13 kavramı: `middleware-zinciri` (5), `rest-crud` (6), `sql-join` (7), `katmanli-mimari` (9), `salt-hash`, `jwt-akisi`, `rbac-401-403` (10), `cors-preflight`, `rate-limiting` (11), `docker-compose` (14), `nginx-tls` (15), `iot-zaman-serisi` (16), `timeout-retry` (17); başlıkları planda | Onaylanan dalga planı |
| istek-yanıt kaynağı | Kitabın Kod 1.5 mini uygulaması (`ChapterMiniApp.ts`): `TarayiciIstemcisi` → `TersVekil` → `NotApi` → `NotBackendServisi`; şeritler Şekil 1.3'ün adlarıyla etiketlenir | Kitapta bütün katmanları ve üç sonucu çalıştıran tek somut akış bu |
| event-loop kaynağı | Kod 4.4 (`eventLoopSirasi.ts`), Kod 4.5 (`asenkronMesaj.ts`), "Bitti / Geç" kodu, Şekil 4.3 (aşamalar). Kitapta liste olarak bulunmayan iki örnek (mikro/makro sırası, engelleme) kitabın cümlelerinden kurulur ve ekranda "Kitabın şu cümlesine dayalı örnek" notuyla işaretlenir | Kitap mikro görev önceliğini ve engellemeyi yalnız düz yazıda anlatır |
| `process.nextTick` ve `setImmediate` | Simülasyona **girmez**; yalnız aşama adımındaki not metninde kitabın cümleleriyle geçer | ESM'de nextTick/Promise sırası CommonJS'ten farklıdır, `setTimeout(0)`/`setImmediate` sırası ana modülde belirsizdir (kitap da böyle der); yanlış öğretmemek için |
| Sanal saat | Event loop simülasyonu sanal milisaniye saatiyle çalışır; gerçek zamanlayıcı kullanılmaz | Deterministik, test edilebilir |
| Ortak sahne parçaları | `sequence.ts` (şeritler + mesaj okları + hareket eden jeton) ve `code-trace.ts` (satır vurgulu salt-okunur kod paneli, DOM). Event loop kuyruk tahtası şimdilik kavram içinde (`scene-board.ts`); ikinci bir sayfa isterse `core/plot`'a taşınır | AGENTS.md "Shared scene parts" kuralı |
| Görev incelemesi | Akış/simülasyon ve sahne görevleri inceleyici alır; iskelet kopyası, kayıt defteri, README ve e2e almaz (son büyük inceleme hepsini görür) | Bölüm temposu kuralı |

## Kapsam dışı

- Dalga 2–4 kavram sayfaları (yalnız "yakında" kartı).
- Öğrencinin kendi kodunu yazıp çalıştırdığı serbest editör (Lab yalnız hazır seçenekler sunar).
- `process.nextTick`, `setImmediate`, G/Ç (`fs`) callback'lerinin simülasyonu.
- Gerçek HTTP, gerçek Node.js çalıştırma; Nginx, PostgreSQL ayrıntısı (Bölüm 7 ve 15 dalgaları).
- GitHub deposunu açmak, push, Pages'i etkinleştirmek (öğretmen onayı).
- Kitapta düzeltme (bookMaker üzerinden, ayrı iş).

## Bölüm 1 — İskelet ve ana sayfa

- Kök dosyalar vmAnimation'dan: `index.html`, `vite.config.ts` (girdi listesi: `main`,
  `istek-yanit`, `event-loop`; `base: './'`; `server.port: 5181, strictPort: true`),
  `playwright.config.ts` (4174; `webServer.url` `…/istek-yanit/`), `tsconfig.json`,
  `package.json` (aynı betikler; adı `stp-animasyon`), `.githooks/pre-push`, `deploy.yml`.
- `index.html` açıklaması: "Sunucu tabanlı programlama kavramlarını adım adım animasyonlarla
  keşfedin: Modern Sunucu Tabanlı Programlama kitabı için etkileşimli kavram animasyonları."
  Başlık: "Sunucu Programlama Animasyonları".
- `src/home/main.ts`: başlık, alt başlık, yazar, `INTRO` metni bu kitaba uyarlanır; `glyph()`
  `knn` özel durumu kaldırılır (genel glif kalır).
- `scripts/yeni-kavram.mjs`: şablon olarak `istek-yanit/index.html` kullanır, başlık soneki
  değişir; davranış aynı.
- `README.md`: vmAnimation README'sinin yapısı (canlı site adresleri
  `https://bmdersleri.github.io/stp-animation/…`, Ders modu, klavye kısayolları, geliştirme,
  yeni kavram ekleme).

## Bölüm 2 — Ortak sahne parçaları

**Sıra diyagramı (`src/core/plot/sequence.ts`).** SVG katmanı; şeritler (lane) soldan sağa eşit
aralıklı dikey çizgiler, başlıkları üstte kutu. Mesajlar yukarıdan aşağı sırayla; istek mesajı
düz ok, yanıt kesikli ok (Şekil 1.3'ün `->>` / `-->>` ayrımı), hata yanıtı `tone: 'alarm'`
renginde. Etkin mesajın üzerinde bir jeton (küçük zarf/daire) kaynaktan hedefe kayar; durduran
katmanda şeridin üzerinde "durdu" işareti çıkar. Mesaj sayısı sahneye sığmazsa satır aralığı
küçülür; en az aralık altında en eski mesajlar soluklaşarak yukarı kayar (en çok 8 görünür satır).

**Kod izleme paneli (`src/core/plot/code-trace.ts`).** `CodePanel` gibi DOM tabanlı; başlık
(dosya adı, ör. `ChapterMiniApp.ts`), satır numaralı `<pre>` satırları, etkin satır(lar)
vurgulu, isteğe bağlı satır yanı not (ör. `→ 401`). Uzun kod kaydırılabilir; etkin satır görünür
alana kaydırılır. Ders modunda yalnız etkin satırın ±4 komşusu gösterilebilir (`window` seçeneği).

## Bölüm 3 — `istek-yanit` (Bölüm 1, 10 adım)

**Akış modeli (`flow.ts`).** Kitabın Kod 1.5'i saf fonksiyonla aynen kurulur:
`notSorgula(ogrenciNumarasi | yol, yetkiliMi)` bir **iz** (`Hop[]`) ve son `UygulamaYaniti`
döndürür. Kurallar kitaptaki sırayla: `TersVekil` → `!yetkiliMi` ise 401 "Kimlik doğrulaması
gerekli."; yol `/api/notlar/` ile başlamıyorsa 404 "Proxy için uygun yol bulunamadı.";
`NotApi` → `yol.split("/")[3]` boşsa 400 "Öğrenci numarası eksik."; `NotBackendServisi`
(`notlar = {"2026001": 88}`) → yoksa 404 "Öğrenci kaydı bulunamadı.", varsa 200
"`${no}` numaralı öğrencinin notu: `${not}`". İstek nesnesi
`{ yol, kullaniciAdi: "ayse", yetkiliMi }`. İstemci çıktısı `` `[${durumKodu}] ${mesaj}` ``.

**Sahne.** Solda/üstte sıra diyagramı (4 şerit: "İstemci" `TarayiciIstemcisi`, "Ters vekil"
`TersVekil`, "API" `NotApi`, "Backend servisi" `NotBackendServisi`); yanında **istek kartı**
(`GET /api/notlar/2026001`, `kullaniciAdi`, `yetkiliMi`) ve **yanıt kartı** (durum kodu rozeti +
mesaj). Laboratuvar modunda açıklama alanında Kod 1.5'in kod izleme paneli (etkin satır vurgulu);
Ders modunda kod paneli sahnenin altında dar şerit (etkin satır ±2).

**Adımlar (id — içerik):**

1. `tanitim` — İstemci-sunucu modeli; dört şerit belirir, terim "istemci-sunucu".
2. `istek` — İstemci istek nesnesini kurar (`/api/notlar/2026001`, `ayse`, `yetkiliMi: true`);
   istek kartı dolar.
3. `kimlik` — Ters vekil: kimlik denetimi geçti (kitap: denetim yol eşleşmesinden önce).
4. `yol` — Ters vekil: yol `/api/notlar/` ile başlıyor → API'ye iletir.
5. `ayristir` — API: `yol.split("/")[3]` → `"2026001"` (dizi gösterimi `["", "api", "notlar",
   "2026001"]`).
6. `veri` — Backend servisi: `notlar["2026001"]` → `88`; iş kuralı katmanı burada.
7. `yanit-200` — Yanıt aynı yoldan geri döner; terminal: `[200] 2026001 numaralı öğrencinin
   notu: 88`.
8. `yanit-401` — Aynı istek `yetkiliMi: false`: ters vekilde durur; `[401] Kimlik doğrulaması
   gerekli.` API ve backend şeritleri soluk (hiç çalışmadılar).
9. `yanit-404` — `2026999`: backend'e kadar gider; `[404] Öğrenci kaydı bulunamadı.`
10. `ozet` — Üç sonucun tablosu: istek, durduran katman, kod, mesaj; terminal kitabın üç satırını
    sırayla gösterir. Not: hata kodu isteği durduran katmanda üretilir.

**Laboratuvar parametreleri.** `yol` seçimi: `/api/notlar/2026001`, `/api/notlar/2026999`,
`/api/notlar/` (→ 400), `/api/odeme` (→ 404 ters vekilde; kitabın yönlendirme anlatısındaki ödeme
yolu); `yetkiliMi` onay kutusu. Her değişiklikte iz baştan oynar. Kısayol: `Y` yetkiyi aç/kapa.

## Bölüm 4 — `event-loop` (Bölüm 4, 11 adım)

**Simülasyon (`sim.ts`).** Küçük, deterministik bir model: program, ifadeler listesidir
(`log(metin)`, `timeout(ms, gövde)`, `promiseThen(gövde)`, `asyncCall(fonksiyon)`,
`await(timeoutPromise(ms, değer))`, `busy(ms)`). `simulate(program)` bir **kare listesi**
(`Frame[]`) döndürür; her kare: `{ clock, line, stack: string[], timers: {label, dueAt}[],
micro: string[], macro: string[], output: string[], note? }`. Kurallar: senkron kod yığında
çalışır; `timeout` zamanlayıcıyı (libuv) `clock + ms` için kaydeder; yığın boşalınca önce mikro
görev kuyruğu tamamen boşaltılır, sonra süresi dolan en erken zamanlayıcı makro kuyruğa geçer ve
çalışır (aynı süre için kayıt sırası); `busy(ms)` saati ilerletir ve yığını o kadar tutar;
`await` fonksiyonun devamını Promise çözülünce mikro kuyruğa koyar.

**Hazır programlar** (kod metni kitaptan harfiyen):

- `kod-4-4` — Kod 4.4; çıktı "1. Sipariş alınmaya başlandı." / "2. Başka sipariş işleniyor." /
  "3. Zamanlayıcı tamamlandı."
- `bitti-gec` — `setTimeout(() => console.log("Geç"), 0); console.log("Bitti");` → "Bitti", "Geç".
- `kod-4-5` — Kod 4.5; çıktı "Hazırlık başlatıldı." / "Mutfak başka siparişleri karşılıyor." /
  "Sipariş hazır."
- `mikro-makro` — Kitabın cümlesine dayalı örnek (Bölüm 4, "mikro görev kuyruğunun … makro görev
  kuyruğundan … önce boşaltılması"):
  `setTimeout(() => console.log("Zamanlayıcı"), 0); Promise.resolve().then(() =>
  console.log("Promise")); console.log("Senkron");` → "Senkron", "Promise", "Zamanlayıcı".
- `engelleme` — Kitabın cümlesine dayalı örnek ("CPU'yu uzun süre meşgul eden senkron kod, diğer
  callback'lerin çalışmasını geciktirir."): 1000 ms'lik zamanlayıcı, ardından 2000 ms süren
  senkron döngü; zamanlayıcı 2000. ms'de çalışır (gecikme 1000 ms ekranda yazılır).

**Sahne.** Kod izleme paneli (etkin satır), **ana çağrı yığını** (alttan üste kutular),
**zamanlayıcılar (libuv)** (kalan süre çubuğu), **mikro görev kuyruğu**, **makro görev kuyruğu
(zamanlayıcı kuyruğu)**, **terminal çıktısı**, üstte sanal saat ("t = 1000 ms"). Bir iş kuyruktan
yığına geçerken kutu kayarak hareket eder. Aşama adımında tahta yerine Şekil 4.3'ün aşama
çemberi (`FlowGraphLayer`): timers → pending callbacks → poll → check → close callbacks →
timers; poll üzerinde kitabın notu.

**Adımlar (id — program, kare):**

1. `tanitim` — Tek iş parçacığı, ana çağrı yığını; boş tahta, Kod 4.4 panelde.
2. `senkron` — Kod 4.4 satır 1: yığın → "1. Sipariş alınmaya başlandı."
3. `zamanlayici` — `setTimeout(…, 1000)`: libuv'a kayıt, yığın hemen boşalır.
4. `devam` — "2. Başka sipariş işleniyor."; zamanlayıcı geri sayıyor.
5. `callback` — 1000 ms: callback makro kuyruğa, yığın boş olduğu için çalışır → "3. …".
6. `sifir` — `bitti-gec`: 0 ms bile yığın boşalmasını bekler.
7. `await` — `kod-4-5`: "Hazırlık başlatıldı.", `await` askıya alır, ana akış sürer.
8. `cozuldu` — 500 ms: Promise çözülür, devam mikro kuyruğa → "Sipariş hazır."
9. `mikro-once` — `mikro-makro`: Promise, 0 ms zamanlayıcıdan önce.
10. `asamalar` — Şekil 4.3 aşama çemberi; not: her aşama arasında önce `process.nextTick`, sonra
    Promise mikro görevleri; `setTimeout(fn, 0)` ile `setImmediate` sırası ana modülde değişebilir.
11. `engelleme` — `engelleme`: 2000 ms'lik döngü yığını tutar; zamanlayıcı 1000 ms gecikir.
    Özet cümlesi: "Event loop'u bloklama."

**Laboratuvar parametreleri.** `program` seçimi (beş hazır program) ve `kare` kaydırıcısı
(seçili programın kareleri arasında); oynat düğmesi kareleri `sweep` ile dolaşır. Kısayollar:
`[` / `]` önceki/sonraki kare.

## Arayüzler

```ts
// src/core/plot/sequence.ts
export interface Lane { id: string; label: string[]; sub?: string }      // sub: sınıf adı
export type MsgKind = 'request' | 'response';
export interface Message { id: string; from: string; to: string; label: string;
  kind: MsgKind; tone?: 'ok' | 'alarm' }
export interface SequenceSpec { lanes: Lane[]; messages: Message[];
  active?: string;            // jetonun üzerinde olduğu mesaj
  stopAt?: string;            // isteği durduran şerit
  dim?: string[] }            // hiç çalışmayan şeritler
export class SequenceLayer {
  constructor(parent: Selection<SVGGElement, unknown, null, undefined>, measure: TextMeasure);
  draw(spec: SequenceSpec, box: Rect, ms: number, fontPx: number): void;
  laneX(id: string): number; interrupt(): void; clear(): void }

// src/core/plot/code-trace.ts
export interface CodeTraceSpec { title: string; lines: readonly string[];
  active: readonly number[];  // 1 tabanlı satır numaraları
  notes?: Readonly<Record<number, string>>; window?: number }
export class CodeTrace { readonly root: HTMLDivElement; constructor(host: HTMLElement);
  update(spec: CodeTraceSpec): void; destroy(): void }

// src/concepts/istek-yanit/flow.ts
export interface UygulamaIstegi { yol: string; kullaniciAdi: string; yetkiliMi: boolean }
export interface UygulamaYaniti { durumKodu: 200 | 400 | 401 | 404; mesaj: string }
export type Katman = 'istemci' | 'tersVekil' | 'notApi' | 'backend';
export interface Hop { from: Katman; to: Katman; kind: MsgKind; label: string; line: number }
export interface Iz { istek: UygulamaIstegi; hops: Hop[]; yanit: UygulamaYaniti;
  durduran: Katman; cikti: string }
export function notSorgula(yol: string, yetkiliMi: boolean): Iz;

// src/concepts/event-loop/sim.ts
export type ProgramId = 'kod-4-4' | 'bitti-gec' | 'kod-4-5' | 'mikro-makro' | 'engelleme';
export interface Frame { clock: number; line: number; stack: string[];
  timers: { label: string; dueAt: number }[]; micro: string[]; macro: string[];
  output: string[]; note?: string }
export interface Program { id: ProgramId; file: string; code: readonly string[];
  bookBased: boolean }       // false → "kitabın cümlesine dayalı örnek" notu
export const PROGRAMS: Record<ProgramId, Program>;
export function simulate(id: ProgramId): Frame[];
```

Kavram sayfaları `ConceptPage<P>` sözleşmesini (vmAnimation `shell.ts`) değiştirmeden kullanır.

## Hata durumları

- Bilinmeyen `yol` (Lab'da yalnız seçim var) → `notSorgula` kitabın kurallarına göre yine bir
  yanıt üretir; fırlatmaz.
- `simulate` sonsuz döngüye girmesin: kare sayısı 200'ü aşarsa `Error('simulate: kare sınırı')`
  (birim testinde her hazır program için sınırın altında kaldığı doğrulanır).
- Kare kaydırıcısı program değişince 0'a döner; aralık dışı değer sıkıştırılır.
- `prefers-reduced-motion` → geçiş süreleri 0 (vmAnimation'daki `durationScale` / `reducedMotion`).
- Dar ekran (390 px): sahne üst üste yığılır (diyagram, kartlar, kod); taşma olmaz.

## Doğrulama

- `tests/unit/core/*`: vmAnimation'dan taşınan çekirdek testleri (player, shell, keyboard, mode,
  home, viewport, text-measure, flow-graph, code-panel, scaffold) + yeni `sequence.test.ts`,
  `code-trace.test.ts` (mesaj sırası, ok türleri, soluk şeritler, etkin satır, pencere).
- `tests/unit/istek-yanit/flow.test.ts`: kitabın üç çıktı satırı harfiyen
  (`[200] 2026001 numaralı öğrencinin notu: 88`, `[401] Kimlik doğrulaması gerekli.`,
  `[404] Öğrenci kaydı bulunamadı.`) + 400 ve proxy-404 dalları + durduran katmanlar.
- `tests/unit/event-loop/sim.test.ts`: beş programın çıktı sırası harfiyen; Kod 4.4'te
  zamanlayıcının 1000. ms'de çalıştığı; `engelleme`de 2000. ms; her karede yığın boşken mikro
  kuyruğun makrodan önce boşaltıldığı; kare sınırı.
- `tests/unit/<kavram>/scenario.test.ts`, `scene.test.ts`: adım sayıları, adım → DOM anahtar
  anları (istek-yanıt: adım 7 yanıt kartı 200, adım 8 API/backend soluk; event-loop: adım 5
  terminalde 3 satır, adım 9 çıktı sırası, adım 10 aşama çemberi).
- `tests/e2e/istek-yanit.spec.ts`, `event-loop.spec.ts`: Ders klavye yürüyüşü, Lab parametre
  değişimi, sığma (1280×720, 1280×740, 390), Ders yazı tabanı; ekran görüntüsü taban çizgileri
  yalnız anahtar adımlar (istek-yanıt ders 7, ders 8, lab 9; event-loop ders 5, ders 10, lab 8).
- `tests/e2e/home.spec.ts`: 2 hazır, 13 yakında kart; "Ders modunda aç" bağlantıları.
- `tests/e2e/dalga1.perf.spec.ts` (dalga sonunda bir kez): adım değişiminde uzun görev yok
  (> 50 ms), Lab'da kare kaydırıcısı p95 < 16 ms.
- Kapı: `npm run check`.
