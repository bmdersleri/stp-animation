# Dalga 1 — Temel — Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** vmAnimation çekirdeğini taşıyarak STP Animasyon sitesini kurmak ve `istek-yanit` (Bölüm 1) ile `event-loop` (Bölüm 4) sayfalarını Ders ve Laboratuvar modunda hazır getirmek.

**Architecture:** Çekirdek (`src/core`, `src/home`, yapılandırma, test yardımcıları) `C:\projects\vmAnimation`'dan `cp` ile kopyalanır, yalnız ad/port/kitap metni değişir. İki yeni ortak sahne parçası `src/core/plot/sequence.ts` ve `code-trace.ts`. Her kavram vmAnimation `src/concepts/crisp-dm/` desenini izler: saf model (`flow.ts` / `sim.ts`) → senaryo (`scenario.ts`) → saf görünüm modeli (`view.ts`) → d3 sahnesi (`scene*.ts`) → kontroller (`controls.ts`) → `main.ts`.

**Tech Stack:** TypeScript 7, Vite 8, d3 (selection, transition, ease, scale), Vitest 5 + jsdom, Playwright (sistem Chrome).

**Spec:** `docs/superpowers/specs/2026-10-27-dalga1-temel-design.md`

---

## Global Constraints / Genel kısıtlar

- **Off-limits:**
  - The book project `C:\projects\modernSunucuTabProg` is read-only for animation work (source material only);
    book edits go through bookMaker in that repo, never from an animation task.
  - `C:\projects\vmAnimation` is read-only from here (copy from it, never edit it).
  - Ports 5180 and 4173 belong to vmAnimation and are left alone; this project uses 5181 (dev) and 4174 (e2e `vite preview`).
- **Commits:** commit after every successful step; end every commit message with the commit trailer below. If it says there is none, add no trailer line, including any harness default.
- **Commit trailer:** `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
- **Push / merge:** commit only; push or merge only per this policy: Every push to `main` publishes GitHub Pages, so merge or push to `main` only after the teacher approves that push in chat, and only with `npm run check` green (the pre-push hook enforces it). Creating the GitHub repository also needs the teacher's approval. Feature branches are pushed only on request.
- **Focused tests:**
  - `npx vitest run tests/unit/<file>.test.ts`
  - `npx playwright test tests/e2e/<file>.spec.ts` (builds the site first)
- **Before every commit:**
  - `npx tsc --noEmit`
  - `npm test`
- **Host:**
  - Windows 11 with Git Bash; use POSIX shell syntax.
  - Files are written with LF line endings (`.gitattributes` sets `eol=lf`).
  - Node 24 runs `.ts` scripts directly, but absolute imports must be `file:///C:/…` URLs.
  - Playwright uses the system Chrome (`channel: 'chrome'`); functional e2e runs in parallel, the performance project (`*.perf.spec.ts`) with one worker.
  - Do not run the gate while other heavy work runs; timing tests are load-sensitive.
- **Doc language:** specs and plans are written in Turkish; agent files (`AGENTS.md`, `CLAUDE.md`, ledgers, dispatches) are English.

Plana özgü:

- Kitap metni **harfiyen**: kod satırları, mesajlar, çıktılar kitaptaki gibi (Türkçe karakterler, tırnaklar, noktalama). Kaynak satırları:
  - Kod 1.5 `ChapterMiniApp.ts`: `chapters/b01-modern-backend-web-mimarisi/content/final.md` satır 1145–1237 (çıktı 1241–1245).
  - Kod 4.4 `eventLoopSirasi.ts`: `chapters/b04-nodejs-runtime/content/final.md` satır 407–418 (çıktı 422–426).
  - Kod 4.5 `asenkronMesaj.ts`: aynı dosya 460–478 (çıktı 482–486).
  - "Bitti / Geç": aynı dosya 518–523 (çıktı 527–530).
  - Şekil 4.3: `chapters/b04-nodejs-runtime/content/diagrams/fig_03.mmd` (aşama adları ve poll notu).
- Kitap dosyalarını okumak serbest; kopyalanan metin kod içinde sabit dizi olarak durur. Testler kitap deposunu okumaz.
- vmAnimation'dan kopyalanan bir dosya gerekmedikçe değiştirilmez; değişiklik yalnız ad, port, kitap metni ve kaldırılan kavramlara başvurulardır.
- UI metinleri Türkçe; kod tanımlayıcıları vmAnimation'daki gibi (İngilizce çekirdek, Türkçe alan adları).

## Review Focus / Gözden geçirme odağı

- Lab'da oynatma sürerken parametre (yol / yetki / program) değişince eski jeton veya ok sahnede kalmaz, iz baştan kurulur — Task 4 test `lab param change mid-animation leaves one token`, Task 8 test `program switch resets kare and clears board`.
- Hızlı adım atlama (Home/End, art arda →) geçişin ortasında yapılınca yinelenen şerit, mesaj ya da kutu oluşmaz — Task 4 test `rapid step jumps leave no duplicates`, Task 8 test `rapid step jumps leave no duplicates`.
- Sahne yeniden boyutlanınca (ResizeObserver) katmanlar çoğalmaz — Task 2 test `draw twice keeps one lane per id`, Task 4 test `resize twice keeps four lanes`.
- Kare / olay kaydırıcısı aralık dışına çıkmaz; program değişince 0'a (event-loop) ya da son olaya (istek-yanit) döner — Task 3 test `olay is clamped to the trace length`, Task 7 test `kare is clamped and resets on program change`.
- 390 px genişlikte ve Ders modunda metin taşmaz, yazı tabanları korunur — Task 5 ve Task 9 e2e `every step fits` ve `ders font floors`.

---

### Task 1: İskelet — çekirdeğin taşınması, ana sayfa, kayıt defteri, araçlar

**Files:**
- Copy from `C:\projects\vmAnimation` (same relative paths): `index.html`, `tsconfig.json`, `vite.config.ts`, `playwright.config.ts`, `.githooks/pre-push`, `.github/workflows/deploy.yml`, `public/favicon.svg`, `src/core/{shell,player,keyboard,mode}.ts`, `src/core/theme.css`, `src/core/plot/{transition,viewport,text-measure,flow-graph,code-panel,label-place,dodge,marks,format}.ts`, `src/core/plot/{flow-graph,code-panel}.css`, `src/home/{main.ts,home.css}`, `scripts/yeni-kavram.mjs`, `scripts/yeni-kavram.d.mts`, `tests/unit/{player,shell,keyboard,mode,smoke}.test.ts`, `tests/unit/{svg-stubs,lab-text}.ts`, `tests/unit/core/{viewport,text-measure,format,svg-stubs,scaffold}.test.ts`, `tests/unit/core/node-modules.d.ts`, `tests/e2e/helpers.ts`
- Create: `package.json`, `src/concepts/registry.ts`, `scripts/kavram-sablonu.html`, `README.md`, `tests/unit/home.test.ts`, `tests/e2e/home.spec.ts`
- Modify (after copy): `index.html`, `vite.config.ts`, `playwright.config.ts`, `src/home/main.ts`, `src/core/plot/marks.ts`, `src/core/theme.css`, `scripts/yeni-kavram.mjs`, `tests/unit/core/scaffold.test.ts`

**Interfaces:**
- Consumes: vmAnimation sources as listed.
- Produces: `ConceptPage<P>`, `SceneHandle`, `mountConceptPage` (`src/core/shell.ts`); `StepPlayer`, `Scenario`, `Step` (`src/core/player.ts`); `Mode` (`src/core/mode.ts`); `TextMeasure`, `tr`, `FlowGraphLayer`, `Rect` exactly as in vmAnimation. `src/concepts/registry.ts` exports `ConceptEntry` (same shape as vmAnimation) and `concepts: ConceptEntry[]`. `tests/unit/svg-stubs.ts`, `tests/unit/lab-text.ts` (`labTextTests`), `tests/e2e/helpers.ts` (`open`, `gotoStep`, `stepCount`, `fontSizes`, `pageOverflow`, `outsideStage`, `clippedBoxes`, `p95`, `round`).

- [ ] **Step 1: Copy the files** listed above with `cp` (create directories first). Confirm none of them imports `src/concepts/*` other than `registry` (`grep -rn "concepts/" src/core src/home tests/unit/*.test.ts tests/unit/core`); remove any such import found.

- [ ] **Step 2: Write `package.json`** — vmAnimation's file with `"name": "stp-animasyon"`, the same `scripts`, `dependencies` and `devDependencies` versions, and `"dev": "vite --port 5181 --strictPort"`. Run `npm install` (creates `package-lock.json`; `prepare` sets `core.hooksPath`).

- [ ] **Step 3: Adapt the configs.**
  - `vite.config.ts`: `input` holds only `main: resolve(root, 'index.html')` (concept entries are added by Tasks 4 and 8); add `server: { port: 5181, strictPort: true }`; keep `base: './'` and the `test` block.
  - `playwright.config.ts`: every `4173` → `4174`; the comment names this project's ports (5181 dev, 4174 preview); `webServer.url` → `http://localhost:4174/`.
  - `index.html`: favicon `href="favicon.svg"`; description "Sunucu tabanlı programlama kavramlarını adım adım animasyonlarla keşfedin: Modern Sunucu Tabanlı Programlama kitabı için etkileşimli kavram animasyonları."; title "Sunucu Programlama Animasyonları".
  - `src/core/plot/marks.ts` and `src/core/theme.css`: drop the data-mining comments ("Kaldı", "Ayrıldı"); values unchanged.

- [ ] **Step 4: Write `src/concepts/registry.ts`** in vmAnimation's shape. `CH` maps 1–18 to the book's chapter titles:
  1 "Modern Backend Programlamaya Giriş ve Web Mimarisi", 2 "Backend için Modern JavaScript Temelleri", 3 "TypeScript ile Güvenli Backend Kodlama", 4 "Node.js Runtime, npm ve Sunucu Tarafı Programlama", 5 "Express ile Web Sunucusu ve Routing", 6 "HTTP ve RESTful API Tasarımı", 7 "PostgreSQL ve SQL ile Kalıcı Veri Yönetimi", 8 "Prisma ORM ve Veri Erişim Katmanı", 9 "Katmanlı Backend Mimarisi ve Uygulama Tasarımı", 10 "Kimlik Doğrulama ve Yetkilendirme", 11 "Güvenli Backend: Validation, Middleware ve Hata Yönetimi", 12 "Dosya İşlemleri, E-posta ve Harici API Entegrasyonu", 13 "OpenAPI Dokümantasyonu ve Backend Testleri", 14 "Docker ile Backend Uygulamalarını Konteynerleştirme", 15 "Linux Sunucuya Yayınlama: Nginx, HTTPS ve Operasyon", 16 "IoT Sistemleri için Backend Geliştirme", 17 "Yapay Zekâ ve ML Servislerinin Backend'e Entegrasyonu", 18 "Capstone: Üniversite Laboratuvar Yönetim Sistemi".
  `concepts` (15 entries, in this order, all `status: 'yakinda'` in this task; Tasks 4 and 8 flip theirs to `'hazir'` with `href`):
  `istek-yanit` (1) "İstek-yanıt yolculuğu: istemciden backend'e"; `event-loop` (4) "Event loop: çağrı yığını ve kuyruklar"; `middleware-zinciri` (5) "Middleware zinciri: istek işlem hattı"; `rest-crud` (6) "CRUD, HTTP metotları ve durum kodları"; `sql-join` (7) "JOIN ile tabloları birleştirme"; `katmanli-mimari` (9) "Katmanlı mimari: controller, service, repository"; `salt-hash` (10) "Parola güvenliği: salt ve hashing"; `jwt-akisi` (10) "JWT ile kimlik doğrulama akışı"; `rbac-401-403` (10) "RBAC ve 401 ile 403 ayrımı"; `cors-preflight` (11) "CORS ve preflight isteği"; `rate-limiting` (11) "Rate limiting: istek sınırlama"; `docker-compose` (14) "Docker Compose ile çok servisli ortam"; `nginx-tls` (15) "Nginx reverse proxy ve HTTPS/TLS"; `iot-zaman-serisi` (16) "IoT: sensör verisi ve zaman serisi"; `timeout-retry` (17) "Timeout, retry ve hata izolasyonu".

- [ ] **Step 5: Adapt `src/home/main.ts`**: h1 "Modern Sunucu Tabanlı Programlama", subtitle "Kavram Animasyonları", author "Prof. Dr. İsmail KIRBAŞ"; `INTRO` rewritten for this book (same Ders/Laboratuvar explanation, "sunucu tabanlı programlama kavramları"); remove the `knn` special case from `glyph()`.

- [ ] **Step 6: Scaffold template.** `scripts/kavram-sablonu.html` = vmAnimation `knn/index.html` with favicon `href="../favicon.svg"`, title `__BASLIK__ · Sunucu Programlama Animasyonları`, description `__ACIKLAMA__`, script `/src/concepts/__ID__/main.ts`. `scripts/yeni-kavram.mjs` reads this template (placeholders replaced) instead of `knn/index.html` and uses the new title suffix; everything else unchanged. Update `tests/unit/core/scaffold.test.ts` so its temp root gets `scripts/kavram-sablonu.html` copied in (instead of `knn/index.html`) and the expected title suffix is "· Sunucu Programlama Animasyonları".

- [ ] **Step 7: Write the home tests.**
  `tests/unit/home.test.ts` (jsdom): `one card per concept` — `.card` count equals `concepts.length` and `concepts.length === 15`; `chapters render in book order` — `h2` texts start with "Bölüm 1 ·", "Bölüm 4 ·", "Bölüm 5 ·", … (distinct chapters 1, 4, 5, 6, 7, 9, 10, 11, 14, 15, 16, 17 in order); `hazir cards link to href and ders mode` — for each `hazir` entry an `a.card.hazir[href="<href>"]` and an `a[href="<href>?mod=ders"]` exist (no-op loop while none are ready); `header shows the book` — h1 "Modern Sunucu Tabanlı Programlama", author "Prof. Dr. İsmail KIRBAŞ".
  `tests/e2e/home.spec.ts`: opens `/`, expects the h1 text and 15 `.card` elements, and no page overflow at 1280×720 and 390×844 (`pageOverflow` from helpers).

- [ ] **Step 8: Write `README.md`** in vmAnimation README's structure: title "STP Animasyon"; one-paragraph description; "İçerik, "Modern Sunucu Tabanlı Programlama" kitabına (Prof. Dr. İsmail KIRBAŞ) dayanır."; Canlı site `https://bmdersleri.github.io/stp-animation/` (+ `istek-yanit/`, `event-loop/` and `?mod=ders` lines); Ders modu; Klavye kısayolları table (vmAnimation's generic rows only); Geliştirme (`npm ci`, `npm run dev` → 5181, `npm test`, `npm run check`); Yeni kavram (`npm run yeni-kavram -- <id> "<Başlık>"`, then add to `vite.config.ts` input and `registry.ts`).

- [ ] **Step 9: Verify.** `npx tsc --noEmit` exits 0; `npm test` PASS; `npx playwright test tests/e2e/home.spec.ts` PASS.

- [ ] **Step 10: Commit.**

```bash
git add -A -- package.json package-lock.json index.html tsconfig.json vite.config.ts playwright.config.ts .githooks .github public src scripts tests README.md
git commit -m "feat(core): port vmAnimation core, home page and registry"
```

---

### Task 2: Ortak sahne parçaları — sıra diyagramı ve kod izleme paneli

**Files:**
- Create: `src/core/plot/sequence.ts`, `src/core/plot/sequence.css`, `src/core/plot/code-trace.ts`, `src/core/plot/code-trace.css`
- Test: `tests/unit/core/sequence.test.ts`, `tests/unit/core/code-trace.test.ts`

**Interfaces:**
- Consumes: `TextMeasure`, `tr`, `Rect` (Task 1).
- Produces (spec § Arayüzler, with one addition — `MsgKind` gains `'note'`, a self-message drawn as a box on its lane for a rule check):

```ts
export interface Lane { id: string; label: string[]; sub?: string }
export type MsgKind = 'request' | 'response' | 'note';
export interface Message { id: string; from: string; to: string; label: string; kind: MsgKind; tone?: 'ok' | 'alarm' }
export interface SequenceSpec { lanes: Lane[]; messages: Message[]; active?: string; stopAt?: string; dim?: string[] }
export class SequenceLayer {
  constructor(parent: Selection<SVGGElement, unknown, null, undefined>, measure: TextMeasure);
  draw(spec: SequenceSpec, box: Rect, ms: number, fontPx: number): void;
  laneX(id: string): number; interrupt(): void; clear(): void }

export interface CodeTraceSpec { title: string; lines: readonly string[]; active: readonly number[]; notes?: Readonly<Record<number, string>>; window?: number }
export class CodeTrace { readonly root: HTMLDivElement; constructor(host: HTMLElement); update(spec: CodeTraceSpec): void; destroy(): void }
```

DOM contract (tests and later scenes rely on it): lanes `g.seq-lane[data-id]` with `text.seq-lane-label` and `line.seq-lifeline`; messages `g.seq-msg[data-id][data-kind]` with `path.seq-arrow` (`stroke-dasharray` set for `response`) and `text.seq-msg-label`; `g.seq-msg.alarm` for `tone: 'alarm'`; `g.seq-lane.dim` for dimmed lanes; `g.seq-stop` drawn on the `stopAt` lane; one `circle.seq-token` on the `active` message (none when `active` is unset). Rows are evenly spaced; when `messages.length > 8` only the last 8 rows are shown and older ones get class `old`. CodeTrace: `.code-trace` root, `.code-trace-title`, `ol.code-trace-lines > li[data-line]` (1-based), `li.active` for active lines, `span.code-trace-note` inside a line that has a note; with `window: n` only lines within ±n of the first active line are rendered; the first active line is scrolled into view (`scrollIntoView({ block: 'nearest' })`, guarded when absent in jsdom).

- [ ] **Step 1: Write the failing tests** (jsdom; import `../svg-stubs`; `ms = 0`).
  `sequence.test.ts`: `draws one lane per id in order` (4 lanes → `.seq-lane` data-ids in order, x increasing); `draw twice keeps one lane per id`; `request is solid, response dashed` (`stroke-dasharray` absent/present); `note sits on its lane` (note `from === to`, its x within ±1 px of `laneX`); `alarm tone and dim lanes get classes`; `token only on active message` (0 tokens without `active`, 1 with); `stopAt draws one stop mark`; `more than 8 messages keeps 8 rows visible, older marked old`; `clear removes everything`.
  `code-trace.test.ts`: `renders numbered lines` (`li[data-line="1"]` … ); `marks active lines`; `note text appears in its line`; `window limits rendered lines` (10 lines, active [5], window 2 → lines 3–7); `update replaces, does not append`; `destroy removes root`.

- [ ] **Step 2: Run and confirm they fail.** Run: `npx vitest run tests/unit/core/sequence.test.ts tests/unit/core/code-trace.test.ts` — Expected: FAIL (modules missing).

- [ ] **Step 3: Implement `SequenceLayer`** (d3 data joins keyed by id so redraws update in place; transitions via `tr` named `seq-*`; `interrupt()` interrupts all named transitions; the token moves from `from` x to `to` x along the arrow). Labels are wrapped to the lane gap with `measure.wrap`. Styles in `sequence.css` use theme variables (`--ink`, `--muted`, alarm colour as in `flow-graph.css`).

- [ ] **Step 4: Implement `CodeTrace`** (plain DOM like `code-panel.ts`; monospace; `code-trace.css`).

- [ ] **Step 5: Run and confirm they pass**, then `npx tsc --noEmit` and `npm test`.

- [ ] **Step 6: Commit.** `git commit -m "feat(plot): sequence diagram layer and code trace panel"` (add the six files).

---

### Task 3: istek-yanit — akış modeli, kitap kodu, senaryo ve görünüm modeli

**Files:**
- Create: `src/concepts/istek-yanit/{flow.ts,code-text.ts,scenario.ts,view.ts}`
- Test: `tests/unit/istek-yanit/{flow,scenario,view}.test.ts`

**Interfaces:**
- Consumes: `Scenario`, `Step` (Task 1); `SequenceSpec`, `Message`, `Lane`, `CodeTraceSpec` (Task 2).
- Produces:

```ts
// code-text.ts — Kod 1.5 lines 1145–1237 of the b01 final.md, verbatim, one string per line
export const MINI_APP_FILE = 'ChapterMiniApp.ts';
export const MINI_APP: readonly string[];
export function lineOf(fragment: string): number;   // 1-based; first line containing fragment; throws if absent

// flow.ts
export interface UygulamaIstegi { yol: string; kullaniciAdi: string; yetkiliMi: boolean }
export interface UygulamaYaniti { durumKodu: 200 | 400 | 401 | 404; mesaj: string }
export type Katman = 'istemci' | 'tersVekil' | 'notApi' | 'backend';
export interface Olay { kind: 'request' | 'response' | 'note'; from: Katman; to: Katman; label: string; line: number; ok?: boolean }
export interface Iz { istek: UygulamaIstegi; olaylar: Olay[]; yanit: UygulamaYaniti; durduran: Katman; cikti: string }
export const YOLLAR: readonly string[];   // ['/api/notlar/2026001', '/api/notlar/2026999', '/api/notlar/', '/api/odeme']
export function notSorgula(yol: string, yetkiliMi: boolean): Iz;

// scenario.ts
export interface IstekParams { yol: string; yetkiliMi: boolean; olay: number; gorunum: 'akis' | 'ozet' }
export const istekScenario: Scenario<IstekParams>;

// view.ts
export interface IstekView { sequence: SequenceSpec; istekKarti: UygulamaIstegi | null; yanit: UygulamaYaniti | null; code: CodeTraceSpec; terminal: string[]; ozet: { yol: string; yetkiliMi: boolean; durduran: Katman; yanit: UygulamaYaniti }[] | null }
export const LANES: Lane[];   // istemci "İstemci" sub "TarayiciIstemcisi"; tersVekil "Ters vekil" sub "TersVekil"; notApi "API" sub "NotApi"; backend "Backend servisi" sub "NotBackendServisi"
export function deriveIstekView(p: IstekParams): IstekView;
```

**Olay order produced by `notSorgula`** (kitabın kuralları sırasıyla; a failing check is followed by response events back to `istemci`, then stops):
1. request istemci→tersVekil, label `GET ${yol}`, line `lineOf('this.tersVekil.yonlendir(istek)')`.
2. note tersVekil "Kimlik denetimi", ok = `yetkiliMi`, line `lineOf('if (!istek.yetkiliMi)')`. Fail → response tersVekil→istemci `401`.
3. note tersVekil "Yol /api/notlar/ ile mi başlıyor?", ok = `yol.startsWith('/api/notlar/')`, line `lineOf('startsWith("/api/notlar/")')`. Fail → response tersVekil→istemci `404`.
4. request tersVekil→notApi "İsteği ilet", line `lineOf('this.notApi.istekIsle(istek)')`.
5. note notApi `yol.split("/")[3] → "${no}"`, ok = `no !== ''` (an absent index also counts as missing), line `lineOf('yolParcalari[3]')`. Fail → responses notApi→tersVekil, tersVekil→istemci `400`.
6. request notApi→backend `notGetir("${no}")`, line `lineOf('this.backendServisi.notGetir(')`.
7. note backend `notlar["${no}"] → ${value ?? 'undefined'}`, ok = value defined, line `lineOf('this.notlar[ogrenciNumarasi]')`.
8–10. responses backend→notApi, notApi→tersVekil, tersVekil→istemci, label `${durumKodu}` (200 or 404).
Last event in every trace: note istemci with label = `cikti`, line `lineOf('console.log(')`.
Response line numbers point at the `return { durumKodu: … }` line of the layer that produced the code. `cikti = \`[${durumKodu}] ${mesaj}\``; `istek.kullaniciAdi = 'ayse'`.

**Steps** (id, params set; `olay` values come from a helper that finds the index in `notSorgula(...).olaylar`, never hard-coded numbers):

| # | id | params | term |
|---|---|---|---|
| 1 | `tanitim` | defaults `{ yol: '/api/notlar/2026001', yetkiliMi: true, olay: 0, gorunum: 'akis' }` | istemci-sunucu |
| 2 | `istek` | `olay: 1` | istek |
| 3 | `kimlik` | `olay` = through event 2 | kimlik doğrulama |
| 4 | `yol` | through event 4 | reverse proxy |
| 5 | `ayristir` | through event 5 | uç nokta |
| 6 | `veri` | through event 7 | iş kuralı |
| 7 | `yanit-200` | all events | HTTP durum kodu |
| 8 | `yanit-401` | `yetkiliMi: false`, all events | 401 |
| 9 | `yanit-404` | `yetkiliMi: true, yol: '/api/notlar/2026999'`, all events | 404 |
| 10 | `ozet` | `gorunum: 'ozet'` | API sözleşmesi |

Each step has Turkish `title`, `text` (Ders) and `labText` (Lab; no number the Lab controls change, per `labTextTests`). Texts follow the book's wording (b01 § İstemci-sunucu, § Reverse proxy — "kimlik doğrulama, yönlendirmeden önce", § Backend ve iş kuralları). Step 10 text ends with: "Hata kodu, isteği durduran katmanda üretilir."

**View rules:** `sequence.messages` = events `0..olay-1` mapped to `Message` (id `m${i}`, `tone: 'alarm'` for a failed note and for responses with `durumKodu >= 400`); `active` = last shown message; `stopAt` = `durduran` once the first response is shown; `dim` = lanes no shown event touches, only when `olay` = all events. `istekKarti` null when `olay = 0`. `yanit` set once the last event is shown. `code.active` = `[line of last shown event]`. `terminal` = `[cikti]` when complete. `gorunum: 'ozet'` → `ozet` holds the book's three calls (`2026001`/true, `2026001`/false, `2026999`/true) and `terminal` their three outputs; `sequence` is the full 200 trace. `olay` is clamped to `[0, olaylar.length]`.

- [ ] **Step 1: Write the failing tests.**
  `flow.test.ts`: `book output, authorised` — `notSorgula('/api/notlar/2026001', true).cikti === '[200] 2026001 numaralı öğrencinin notu: 88'`; `book output, unauthorised` — `…('/api/notlar/2026001', false).cikti === '[401] Kimlik doğrulaması gerekli.'`, `durduran === 'tersVekil'`, no event touches `notApi`/`backend`; `book output, unknown student` — `…('/api/notlar/2026999', true).cikti === '[404] Öğrenci kaydı bulunamadı.'`, `durduran === 'backend'`; `missing number gives 400 at the API` — `'/api/notlar/'` → `[400] Öğrenci numarası eksik.`, `durduran === 'notApi'`; `foreign path stops at the proxy` — `'/api/odeme'` → `[404] Proxy için uygun yol bulunamadı.`, `durduran === 'tersVekil'`; `auth is checked before the path` — `'/api/odeme', false` → 401; `every line points into the listing` — each event's `line` is in `1..MINI_APP.length` and the 401 response line contains `durumKodu: 401`; `MINI_APP starts and ends like the book` — first line `// File: ChapterMiniApp.ts`, contains `istemci.notSorgula("2026999", true);`.
  `scenario.test.ts`: 10 steps with the ids above; `stepIndex` finds each; `labTextTests(istekScenario.steps, [1,…,10])`; step 8 effective params `yetkiliMi === false`; going back from step 10 to step 9 yields `gorunum === 'akis'`.
  `view.test.ts`: `step 1 shows lanes only` (0 messages, `istekKarti` null); `step 7 shows the 200 response` (`yanit.durumKodu === 200`, terminal `['[200] 2026001 numaralı öğrencinin notu: 88']`, `dim` empty); `step 8 dims API and backend` (`dim` = `['notApi','backend']`, `stopAt === 'tersVekil'`); `olay is clamped to the trace length` (`olay: 999` equals full trace; `olay: -3` equals 0); `ozet lists the three book calls` (three rows, terminal = the three book lines in order); `code highlights the active event line`.

- [ ] **Step 2: Run and confirm they fail.** `npx vitest run tests/unit/istek-yanit` — FAIL (modules missing).

- [ ] **Step 3: Implement** `code-text.ts` (copy lines 1145–1237 verbatim; check by eye against the book file), `flow.ts`, `scenario.ts`, `view.ts` per the rules above.

- [ ] **Step 4: Run and confirm they pass**, then `npx tsc --noEmit` and `npm test`.

- [ ] **Step 5: Commit.** `git commit -m "feat(istek-yanit): book mini-app flow, scenario and view model"`

---

### Task 4: istek-yanit — sahne, kontroller ve sayfa

**Files:**
- Create: `istek-yanit/index.html` (from `scripts/kavram-sablonu.html`), `src/concepts/istek-yanit/{scene.ts,scene-cards.ts,controls.ts,main.ts,istek-yanit.css}`
- Modify: `vite.config.ts` (input `'istek-yanit'`), `src/concepts/registry.ts` (`istek-yanit` → `hazir`, `href: 'istek-yanit/'`), `tests/unit/home.test.ts` (1 hazir)
- Test: `tests/unit/istek-yanit/{scene,controls}.test.ts`

**Interfaces:**
- Consumes: Task 1 shell/player/mode/text-measure; Task 2 `SequenceLayer`, `CodeTrace`; Task 3 `istekScenario`, `IstekParams`, `deriveIstekView`, `LANES`, `YOLLAR`, `notSorgula`.
- Produces: `mountIstekScene(el: HTMLElement, player: StepPlayer<IstekParams>, mode: Mode, opts?: { durationScale?: number }): SceneHandle`; `mountIstekParams(el: HTMLElement, player: StepPlayer<IstekParams>): void`; `istekPage: ConceptPage<IstekParams>` (title "İstek-yanıt yolculuğu: istemciden backend'e", chapter "Bölüm 1 · Modern Backend Programlamaya Giriş ve Web Mimarisi").

**Scene layout** (follow vmAnimation `src/concepts/crisp-dm/scene.ts` for the orchestrator, `durationScale`/`reducedMotion`, resize and `setMode`): `svg.plot` holds the `SequenceLayer`; HTML cards beside it (wide) or below it (narrow, width < 700 px): `.istek-karti` (method + path line `GET /api/notlar/2026001`, `kullaniciAdi`, `yetkiliMi`), `.yanit-karti` (status badge `.durum-kodu` with the code, class `ok`/`alarm`, and the message), `.terminal` (lines). Ders: `CodeTrace` strip under the stage with `window: 2`; Lab: `CodeTrace` full listing in `mountExplainExtra`. `ozet` view: `.ozet-tablosu` table (Yol, Yetki, Durduran katman, Kod, Mesaj) replaces the cards; the diagram stays.

**Lab controls** (`controls.ts`, vmAnimation `crisp-dm/controls.ts` style): `select[name="yol"]` with `YOLLAR`; `input[type=checkbox][name="yetkiliMi"]`; `input[type=range][name="olay"]` 0..trace length (max updates when yol/yetki change). Changing yol or yetki sets `olay` to the new trace length. Shortcuts: `Y` toggles yetki, `[` / `]` olay −1 / +1.

- [ ] **Step 1: Write the failing tests** (jsdom, `../svg-stubs`, `durationScale: 0`).
  `scene.test.ts`: `step 7 shows four lanes, the 200 badge and the book line in the terminal`; `step 8 dims two lanes and shows 401 alarm`; `resize twice keeps four lanes`; `rapid step jumps leave no duplicates` (goto 9, 0, 9, 4 → 4 lanes, message count equals the view's); `ders mode shows the code strip, lab mode the full listing in explain extra`; `ozet step shows the three-row table`.
  `controls.test.ts`: `yol select lists the four paths`; `choosing /api/odeme sets olay to its trace length`; `lab param change mid-animation leaves one token` (play, change `yetkiliMi`, then `.seq-token` count ≤ 1); `Y toggles yetki`.

- [ ] **Step 2: Run and confirm they fail.** `npx vitest run tests/unit/istek-yanit/scene.test.ts tests/unit/istek-yanit/controls.test.ts`

- [ ] **Step 3: Implement** the scene, cards, controls, `main.ts` (vmAnimation `crisp-dm/main.ts` shape), CSS, `istek-yanit/index.html` (title "İstek-yanıt yolculuğu · Sunucu Programlama Animasyonları"), the `vite.config.ts` entry and the registry flip; update `home.test.ts` expectations (1 hazir card).

- [ ] **Step 4: Run and confirm they pass**, then `npx tsc --noEmit`, `npm test`, and open `npm run dev` → `http://localhost:5181/istek-yanit/` once to check the page renders (no console errors).

- [ ] **Step 5: Commit.** `git commit -m "feat(istek-yanit): scene, Lab controls and page"`

---

### Task 5: istek-yanit — e2e ve ekran görüntüsü taban çizgileri

**Files:**
- Create: `tests/e2e/istek-yanit.spec.ts` (+ generated `tests/e2e/istek-yanit.spec.ts-snapshots/`)

**Interfaces:**
- Consumes: Task 1 `helpers.ts`; Task 4 page and DOM classes.

- [ ] **Step 1: Write the spec** (pattern: vmAnimation `tests/e2e/crisp-dm.spec.ts` and `knn.spec.ts`; `test.use({ reducedMotion: 'reduce' })`):
  `ders keyboard walkthrough` — open `/istek-yanit/?mod=ders`, `Adım 1 / 10`, → nine times reaches `Adım 10 / 10`, ← back to 9; `lab: choosing /api/notlar/ shows 400` — `.durum-kodu` text `400` and terminal `[400] Öğrenci numarası eksik.`; `every step fits` at 1280×720, 1280×740, 390×844 for both modes (`pageOverflow`, `outsideStage`, `clippedBoxes` empty); `ders font floors` (`fontSizes` ≥ vmAnimation's ders floors); screenshots `istek-yanit-ders-7.png`, `istek-yanit-ders-8.png`, `istek-yanit-lab-9.png`.

- [ ] **Step 2: Create baselines** `npx playwright test tests/e2e/istek-yanit.spec.ts --update-snapshots`, look at the three PNGs (Read tool) for overlap or clipping, then run again without the flag — PASS.

- [ ] **Step 3: Commit.** `git commit -m "test(istek-yanit): e2e walkthrough, fit checks and baselines"`

---

### Task 6: event-loop — simülasyon ve programlar

**Files:**
- Create: `src/concepts/event-loop/{sim.ts,programs.ts}`
- Test: `tests/unit/event-loop/sim.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:

```ts
// sim.ts
export type Op =
  | { op: 'log'; line: number; text: string }
  | { op: 'timeout'; line: number; ms: number; label: string; body: Op[] }
  | { op: 'then'; line: number; label: string; body: Op[] }            // Promise.resolve().then(...)
  | { op: 'call'; line: number; name: string; body: Op[] }             // push frame, run body, pop
  | { op: 'await'; line: number; ms: number; label: string; rest: Op[] } // await a promise a timer resolves after ms
  | { op: 'busy'; line: number; ms: number; label: string };            // synchronous loop holding the stack
export interface Frame { clock: number; line: number; stack: string[]; timers: { label: string; dueAt: number }[]; micro: string[]; macro: string[]; output: string[]; note?: string }
export const FRAME_LIMIT = 200;
export function simulate(ops: readonly Op[]): Frame[];

// programs.ts
export type ProgramId = 'kod-4-4' | 'bitti-gec' | 'kod-4-5' | 'mikro-makro' | 'engelleme';
export interface Program { id: ProgramId; file: string; title: string; code: readonly string[]; ops: Op[]; bookBased: boolean }
export const PROGRAM_IDS: readonly ProgramId[];
export const PROGRAMS: Record<ProgramId, Program>;
export function framesOf(id: ProgramId): Frame[];   // memoised simulate(PROGRAMS[id].ops)
```

**Semantics of `simulate`** (virtual clock in ms, starts at 0; first frame is the empty start state, `line: 0`):
- The main script runs as stack entry `"main"`; each op that runs pushes a frame (`line` = op line). `log` appends to `output`. `timeout` registers `{label, dueAt: clock + ms}` in `timers`. `then` puts `label` (with its body) on `micro`. `call` pushes `name` on `stack`, runs its body, pops. `await` registers a timer `{label, dueAt: clock + ms}` whose callback resolves the promise, then suspends: the rest of the current `call` is dropped from the stack (frame note "await: fonksiyon askıya alındı"). `busy` advances `clock` by `ms` while the stack stays occupied (one frame before, one after; note "senkron döngü yığını tutuyor").
- When the stack is empty: (1) drain `micro` completely, one frame per moved job and one per run (job onto stack, then off); (2) if `micro` is empty and timers exist, advance `clock` to `max(clock, earliest dueAt)` (ties in registration order), move that timer's label to `macro` (frame), then run it on the stack (frame). A resolved `await` timer callback queues the `rest` continuation on `micro` as label `"${callName} devamı"`; the continuation re-enters `stack` as that label. (3) Repeat until stack, micro, macro and timers are empty.
- More than `FRAME_LIMIT` frames → `throw new Error('simulate: kare sınırı')`.
- A timer that runs later than its `dueAt` gets the note `gecikme: ${clock - dueAt} ms`.

**Programs** (`code` lines verbatim from the book ranges in Global Constraints; `ops` line numbers index into `code`, 1-based):
- `kod-4-4`, file `eventLoopSirasi.ts`, title "Kod 4.4", bookBased true: log "1. Sipariş alınmaya başlandı." · timeout 1000 label "setTimeout callback" body [log "3. Zamanlayıcı tamamlandı."] · log "2. Başka sipariş işleniyor.".
- `bitti-gec`, file `b04-nodejs-runtime_code_008.ts` (the book's CODE_META file name), title "Yaygın hata: setTimeout(…, 0)", bookBased true: timeout 0 body [log "Geç"] · log "Bitti".
- `kod-4-5`, file `asenkronMesaj.ts`, title "Kod 4.5", bookBased true: call `mutfagiYonet` [log "Hazırlık başlatıldı." · await 500 label "siparisHazirla" rest [log "Sipariş hazır."]] · log "Mutfak başka siparişleri karşılıyor.".
- `mikro-makro`, file `mikroMakro.ts`, title "Mikro görev önce", bookBased false, ops: timeout 0 [log "Zamanlayıcı"] · then label "Promise callback" [log "Promise"] · log "Senkron"; code exactly:
  ```
  // Kitabın cümlesine dayalı örnek: mikro görevler makro görevlerden önce.
  setTimeout(() => console.log("Zamanlayıcı"), 0);
  Promise.resolve().then(() => console.log("Promise"));
  console.log("Senkron");
  ```
- `engelleme`, file `engelleme.ts`, title "Event loop'u bloklama", bookBased false, code exactly:
  ```
  // Kitabın cümlesine dayalı örnek: uzun senkron kod callback'leri geciktirir.
  setTimeout(() => console.log("Zamanlayıcı çalıştı."), 1000);
  const bitis = Date.now() + 2000;
  while (Date.now() < bitis) {
    // 2000 ms boyunca ana iş parçacığı meşgul.
  }
  console.log("Döngü bitti.");
  ```
  ops: timeout 1000 [log "Zamanlayıcı çalıştı."] · busy 2000 label "while döngüsü" (line 4) · log "Döngü bitti.".

- [ ] **Step 1: Write the failing tests** in `sim.test.ts`:
  `kod-4-4 prints the book output` (last frame `output` = the three lines of b04 422–426); `kod-4-4 timer runs at 1000 ms` (frame whose output gains line 3 has `clock === 1000`); `bitti-gec prints Bitti then Geç`; `kod-4-5 prints the book output` (482–486) and `the continuation runs at 500 ms from the micro queue` (a frame with `micro` containing "mutfagiYonet devamı" exists before "Sipariş hazır." is output); `mikro-makro prints Senkron, Promise, Zamanlayıcı`; `engelleme runs the timer at 2000 ms with 1000 ms delay` (`clock === 2000`, note `gecikme: 1000 ms`); `micro drains before any macro` (for every program, no frame moves a label onto `macro` while `micro` is non-empty); `first frame is empty` (clock 0, empty stack/queues/output); `frame limit throws` (a `timeout` whose body re-registers itself 300 times via a generated nested op list → throws 'simulate: kare sınırı'); `code is verbatim` (`PROGRAMS['kod-4-4'].code[0] === '// File: eventLoopSirasi.ts'`, `PROGRAMS['kod-4-5'].code` includes `'  const sonucMesaji = await siparisHazirla();'`); `every op line points into its code` (each op's `line` in `1..code.length` and the line contains the op's log text or `setTimeout`/`await`/`while`/`then`/`mutfagiYonet` as fits).

- [ ] **Step 2: Run and confirm they fail.** `npx vitest run tests/unit/event-loop/sim.test.ts`

- [ ] **Step 3: Implement** `sim.ts` and `programs.ts` per the semantics above.

- [ ] **Step 4: Run and confirm they pass**, then `npx tsc --noEmit` and `npm test`.

- [ ] **Step 5: Commit.** `git commit -m "feat(event-loop): deterministic event loop simulation and book programs"`

---

### Task 7: event-loop — senaryo ve görünüm modeli

**Files:**
- Create: `src/concepts/event-loop/{scenario.ts,view.ts,phases.ts}`
- Test: `tests/unit/event-loop/{scenario,view}.test.ts`

**Interfaces:**
- Consumes: Task 6 `framesOf`, `PROGRAMS`, `ProgramId`, `Frame`; Task 1 `Scenario`, `FlowNode`, `FlowEdge`, `FlowGraphSpec`; Task 2 `CodeTraceSpec`.
- Produces:

```ts
export interface LoopParams { program: ProgramId; kare: number; gorunum: 'tahta' | 'asamalar' }
export const loopScenario: Scenario<LoopParams>;
export function findFrame(id: ProgramId, pred: (f: Frame) => boolean): number;   // first matching index; throws if none
// phases.ts — Şekil 4.3
export const PHASES: FlowGraphSpec;   // nodes timers, pending, poll, check, close (labels: name + book description), forward edges timers→pending→poll→check→close→timers
export const POLL_NOTE: string;       // "Her aşama arasında önce process.nextTick, ardından Promise mikro görev kuyruğu boşaltılır." (verbatim from fig_03.mmd)
export const IMMEDIATE_NOTE: string;  // b04 line 387 sentence from "`setTimeout(fn, 0)` `timers`…" to "…her zaman önce çalışır.", verbatim
// view.ts
export interface LoopView { program: Program; frame: Frame; kare: number; kareCount: number; code: CodeTraceSpec; bookNote: string | null; phases: FlowGraphSpec | null; notes: string[] }
export function deriveLoopView(p: LoopParams): LoopView;
```

**Steps** (kare from `findFrame`, never hard-coded):

| # | id | program | kare | term |
|---|---|---|---|---|
| 1 | `tanitim` | kod-4-4 | 0 | tek iş parçacığı |
| 2 | `senkron` | kod-4-4 | first `output.length === 1` | ana çağrı yığını |
| 3 | `zamanlayici` | kod-4-4 | first `timers.length === 1` | zamanlayıcı kuyruğu |
| 4 | `devam` | kod-4-4 | first `output.length === 2` | engellemeyen |
| 5 | `callback` | kod-4-4 | last | callback |
| 6 | `sifir` | bitti-gec | last | setTimeout(…, 0) |
| 7 | `await` | kod-4-5 | first `output.length === 2` | async/await |
| 8 | `cozuldu` | kod-4-5 | last | Promise |
| 9 | `mikro-once` | mikro-makro | last | mikro görev kuyruğu |
| 10 | `asamalar` | mikro-makro, `gorunum: 'asamalar'` | last | event loop aşamaları |
| 11 | `engelleme` | engelleme, `gorunum: 'tahta'` | last | bloklama |

Texts follow b04 § Event loop wording (e.g. step 3 uses "yalnızca en az 1000 ms sonra çalıştırılmak üzere event loop'un zamanlayıcı kuyruğuna kaydeder"; step 7 "await, yalnızca bu async fonksiyonun devamını bekletir"; step 11 quotes "CPU'yu uzun süre meşgul eden senkron kod, diğer callback'lerin çalışmasını geciktirir." and names worker thread from line 494). Each step has `labText` passing `labTextTests`.

**View rules:** `kare` clamped to `[0, kareCount − 1]`; `code.active = [frame.line]` (empty when 0); `bookNote` = "Kitabın şu cümlesine dayalı örnek: …" (quoting line 367 for `mikro-makro`, line 373 for `engelleme`) when `!program.bookBased`, else null; `phases` = `PHASES` with `current: 'poll'` when `gorunum === 'asamalar'`, else null; `notes` = `[POLL_NOTE, IMMEDIATE_NOTE]` in `asamalar`, `frame.note` otherwise (if any).

- [ ] **Step 1: Write the failing tests.** `scenario.test.ts`: 11 ids in order; `labTextTests(loopScenario.steps, [1,…,11])`; step 5 effective params resolve to a frame with 3 output lines; step 11 `gorunum === 'tahta'` after step 10. `view.test.ts`: `kare is clamped and resets on program change` (`kare: 999` → last; scenario step 6 after step 5 has `kare` within the bitti-gec frames); `book-based programs carry no note, the two built ones do`; `asamalar shows five phases with poll current and both notes`; `code highlights the frame line`.

- [ ] **Step 2: Run and confirm they fail.** `npx vitest run tests/unit/event-loop/scenario.test.ts tests/unit/event-loop/view.test.ts`

- [ ] **Step 3: Implement** `phases.ts`, `scenario.ts`, `view.ts`.

- [ ] **Step 4: Run and confirm they pass**, then `npx tsc --noEmit` and `npm test`.

- [ ] **Step 5: Commit.** `git commit -m "feat(event-loop): scenario, phases and view model"`

---

### Task 8: event-loop — sahne, kontroller ve sayfa

**Files:**
- Create: `event-loop/index.html`, `src/concepts/event-loop/{scene.ts,scene-board.ts,controls.ts,main.ts,event-loop.css}`
- Modify: `vite.config.ts` (input `'event-loop'`), `src/concepts/registry.ts` (`event-loop` → `hazir`, `href: 'event-loop/'`), `tests/unit/home.test.ts` (2 hazir)
- Test: `tests/unit/event-loop/{scene,controls}.test.ts`

**Interfaces:**
- Consumes: Task 1 shell/player/`FlowGraphLayer`/`TextMeasure`; Task 2 `CodeTrace`; Task 6 `PROGRAM_IDS`, `PROGRAMS`, `framesOf`; Task 7 `loopScenario`, `LoopParams`, `deriveLoopView`.
- Produces: `mountLoopScene(el, player, mode, opts?: { durationScale?: number }): SceneHandle`; `mountLoopParams(el, player): void`; `loopPage: ConceptPage<LoopParams>` (title "Event loop: çağrı yığını ve kuyruklar", chapter "Bölüm 4 · Node.js Runtime, npm ve Sunucu Tarafı Programlama").

**Board** (`scene-board.ts`, HTML/CSS grid; keyed joins so boxes move rather than re-create): `.saat` ("t = 1000 ms"); `.kutu-yigin` "Ana çağrı yığını" (entries bottom-up, `.is` items); `.kutu-zamanlayici` "Zamanlayıcılar (libuv)" (label + remaining-time bar `dueAt − clock`); `.kutu-mikro` "Mikro görev kuyruğu (Promise)"; `.kutu-makro` "Makro görev kuyruğu (zamanlayıcı)"; `.terminal` lines; `.kitap-notu` for `bookNote`; `.not` for `notes`. An item moving between boxes uses a FLIP transform transition (skipped when `durationScale` is 0 or reduced motion). Code: `CodeTrace` (Ders: `window: 3` strip; Lab: full in explain extra). `gorunum: 'asamalar'` hides the board and draws `PHASES` with `FlowGraphLayer` in `svg.plot`, notes beneath. Narrow (< 700 px): boxes stack in one column.

**Lab controls:** `select[name="program"]` (titles of `PROGRAM_IDS`); `input[type=range][name="kare"]` 0..frames−1 (max follows program); program change sets `kare: 0`. Oynat (P) sweeps `kare` with `sweep: { key: 'kare', values: [...indexes], intervalMs: 900 }` on a Lab step, as vmAnimation sweeps do. Shortcuts `[` / `]` kare −1 / +1.

- [ ] **Step 1: Write the failing tests** (jsdom, `durationScale: 0`). `scene.test.ts`: `step 5 shows three terminal lines and an empty stack`; `step 3 shows one timer in libuv`; `step 8 frame before output shows the continuation in the micro queue` (use `findFrame`); `step 10 shows five phase nodes and hides the board`; `step 9 shows the book-based note`; `rapid step jumps leave no duplicates` (goto 10, 0, 10, 4 → one `.kutu-yigin`, item counts equal the view's); `resize twice keeps one board`. `controls.test.ts`: `program select lists five programs`; `program switch resets kare and clears board` (step through, switch program → `kare` 0, terminal empty); `kare range max follows the program`; `] and [ move one frame`.

- [ ] **Step 2: Run and confirm they fail.** `npx vitest run tests/unit/event-loop/scene.test.ts tests/unit/event-loop/controls.test.ts`

- [ ] **Step 3: Implement** board, scene, controls, `main.ts`, CSS, `event-loop/index.html` (title "Event loop · Sunucu Programlama Animasyonları"), the `vite.config.ts` entry and the registry flip; update `home.test.ts` (2 hazir).

- [ ] **Step 4: Run and confirm they pass**, then `npx tsc --noEmit`, `npm test`, and open `http://localhost:5181/event-loop/` once (no console errors).

- [ ] **Step 5: Commit.** `git commit -m "feat(event-loop): queue board, phase ring, Lab controls and page"`

---

### Task 9: event-loop e2e, dalga performans testi ve README

**Files:**
- Create: `tests/e2e/event-loop.spec.ts` (+ snapshots), `tests/e2e/dalga1.perf.spec.ts`
- Modify: `README.md` (both concept lines confirmed, keyboard rows `Y`, `[`, `]`), `tests/e2e/home.spec.ts` (2 hazir links open their pages)

**Interfaces:**
- Consumes: Task 8 page and DOM classes; Task 5 spec as pattern.

- [ ] **Step 1: Write `event-loop.spec.ts`** (`reducedMotion: 'reduce'`): `ders keyboard walkthrough` (`Adım 1 / 11` → `Adım 11 / 11`); `lab: mikro-makro last frame prints Senkron, Promise, Zamanlayıcı` (choose program, End key on the range or set it to max); `every step fits` (1280×720, 1280×740, 390×844, both modes); `ders font floors`; screenshots `event-loop-ders-5.png`, `event-loop-ders-10.png`, `event-loop-lab-8.png`. Extend `home.spec.ts`: clicking each hazir card opens a page whose `h1.title` matches the registry title.

- [ ] **Step 2: Write `dalga1.perf.spec.ts`** (pattern: vmAnimation `knn.perf.spec.ts`; fixed budgets, "a miss is fixed in the code, never here"): `step changes cause no long task` — walk all steps of both pages in Ders mode with `PerformanceObserver('longtask')`, none > 50 ms; `kare range stays under 16 ms` — on `/event-loop/` Lab, 30 range changes, p95 of `performance.measure('loop-render')` < 16 ms (Task 8's render emits `performance.mark/measure('loop-render')`; add it there if missing).

- [ ] **Step 3: Create baselines and run.** `npx playwright test tests/e2e/event-loop.spec.ts --update-snapshots`, inspect the PNGs, rerun without the flag — PASS. Then `npm run check` — exit 0.

- [ ] **Step 4: Commit.** `git commit -m "test(event-loop): e2e, wave perf budgets and README"`

---

## Step → DOM → test (anahtar anlar)

| Sayfa / adım | DOM | Test |
|---|---|---|
| istek-yanit 7 | `.durum-kodu.ok` "200", `.terminal` kitap satırı | Task 4 `step 7 shows four lanes…`, Task 5 screenshot |
| istek-yanit 8 | `.seq-lane.dim` ×2, `.durum-kodu.alarm` "401", `.seq-stop` | Task 4 `step 8 dims two lanes…` |
| istek-yanit 10 | `.ozet-tablosu` 3 satır | Task 4 `ozet step…` |
| event-loop 5 | `.terminal` 3 satır, `.kutu-yigin` boş | Task 8 `step 5…` |
| event-loop 8 | `.kutu-mikro` "mutfagiYonet devamı" (önceki kare) | Task 8 `step 8…` |
| event-loop 10 | `svg.plot` 5 aşama düğümü, `.not` ×2 | Task 8 `step 10…` |
