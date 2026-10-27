import { scryptHex, sha256Hex } from '../../core/kripto';
import type { Mode } from '../../core/mode';
import type { PlayerState, StepPlayer } from '../../core/player';
import { CodeTrace } from '../../core/plot/code-trace';
import { DataTable, type DataTableSpec } from '../../core/plot/data-table';
import { HttpCards } from '../../core/plot/http-cards';
import { SegmentStrip } from '../../core/plot/segment-strip';
import { sourceBadge, type Rozet } from '../../core/plot/source-badge';
import type { SceneHandle } from '../../core/shell';
import { SCRYPT_ONBELLEK } from './degerler';
import { SALT_ROZET, type SaltParams } from './scenario';
import { deriveSaltView, saltAnahtarlari, saltLabRozet, type SaltView } from './view';
import './salt-hash.css';

const reducedMotion = (): boolean => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** How long (ms) a Lab change waits before scrypt runs, so typing does not start one computation per key (R15). */
const GECIKME_MS = 250;
/** Below this stage width (px) the terminal sits under the strips and the code strip is left out. */
const NARROW = 700;
/** Lines of code the Ders strip shows around the active one. */
const STRIP_WINDOW = 1;

/** The book's definition (L243) and hint (L240), as the first step shows them (no code ticks, no emoji). */
const TANIM =
  'Parola hashing, bir parolayı tek yönlü bir fonksiyondan geçirerek geri döndürülemez bir özet değerine dönüştürme işlemidir. Salt ise her kullanıcı için üretilen, rastgele ve benzersiz bir değerdir; parolayla birlikte hash fonksiyonuna verilir. Salt kullanımı, aynı parolayı kullanan iki kullanıcının veritabanında aynı hash değerine sahip olmasını engeller ve önceden hesaplanmış tablo (rainbow table) saldırılarını etkisiz hale getirir.';
const IPUCU = 'Parolayı “şifrelemek” değil, “tek yönlü özetlemek” doğru terimdir; hash geri çözülemez.';

/** The book's alternatives table (L337-342), verbatim without the code ticks and the bold mark. */
const YAVAS: DataTableSpec = {
  baslik: 'Alternatifler',
  sutunlar: [{ ad: 'Yaklaşım' }, { ad: 'Avantajı' }, { ad: 'Dezavantajı' }, { ad: 'Uygun kullanım' }],
  satirlar: [
    { key: 'scrypt', cells: ['crypto.scryptSync (Node.js yerleşik)', 'Ek bağımlılık gerektirmez', 'Parametre ayarları manuel yapılmalıdır', 'Küçük ve orta ölçekli projeler'] },
    { key: 'bcrypt', cells: ['bcrypt', 'Yaygın kullanılır, salt otomatik yönetilir', 'Bellek maliyeti argon2’den düşüktür', 'Çoğu web uygulaması'] },
    { key: 'argon2', cells: ['argon2', 'Modern, bellek-yoğun, GPU saldırılarına daha dirençli', 'Kurulumda yerel derleme gerekebilir', 'Yüksek güvenlik gereksinimi olan sistemler'] },
    { key: 'sha256', cells: ['Düz SHA-256', 'Hızlıdır', 'Parola hashleme için uygun değildir; kaba kuvvete açıktır', 'Önerilmez'] },
  ],
};

function el<K extends keyof HTMLElementTagNameMap>(doc: Document, tag: K, cls: string, text?: string): HTMLElementTagNameMap[K] {
  const e = doc.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

/** `ms` with a precision that shows a sha256 run (well under 1 ms) and a scrypt run alike. */
const ms = (x: number): string => (x < 10 ? x.toFixed(2) : x.toFixed(0));

/**
 * Scene of the salt-hash page: the badge top right, the user table, the hash line (parola, salt, function, hash;
 * HTML boxes), the hash strips, the comparison counters, the terminal beside them and, in Ders, the code strip.
 * Lab changes compute scrypt 250 ms later; a result is kept only while its generation is still the latest.
 */
export function mountSaltScene(
  host: HTMLElement,
  player: StepPlayer<SaltParams>,
  initialMode: Mode,
  opts: { durationScale?: number; hesapla?: (parola: string, salt: string) => Promise<string> } = {},
): SceneHandle {
  const hesapla = opts.hesapla ?? scryptHex;
  const doc = host.ownerDocument;
  const scene = el(doc, 'div', 'salt-scene');
  scene.style.setProperty('--salt-ms', `${reducedMotion() ? 0 : 200 * (opts.durationScale ?? 1)}ms`);
  const rozetYeri = el(doc, 'div', 'rozet-yeri');
  const stage = el(doc, 'div', 'salt-stage');
  const main = el(doc, 'div', 'salt-main');
  const yan = el(doc, 'div', 'salt-yan');

  const tanim = el(doc, 'div', 'tanim kitap-blok');
  const tabloYeri = el(doc, 'div', 'tablo-yeri');
  const tablo = new DataTable(tabloYeri);
  const hat = el(doc, 'div', 'hat');
  const seritYeri = el(doc, 'div', 'seritler');
  const sayacYeri = el(doc, 'div', 'sayaclar');
  const sonucSatir = el(doc, 'p', 'sonuc-satir');
  const olcum = el(doc, 'p', 'olcum');
  olcum.hidden = true;
  const yavasYeri = el(doc, 'div', 'yavas-tablo');
  const yavas = new DataTable(yavasYeri);
  yavas.update(YAVAS);
  const ozet = el(doc, 'div', 'ozet kitap-blok');
  main.append(tanim, tabloYeri, hat, seritYeri, sayacYeri, sonucSatir, olcum, yavasYeri, ozet);
  // only the terminal of the shared cards is used here
  const kartlar = new HttpCards(yan);
  stage.append(main, yan);
  const stripHost = el(doc, 'div', 'code-strip');
  const strip = new CodeTrace(stripHost);
  scene.append(rozetYeri, stage, stripHost);
  host.append(scene);

  const seritler: SegmentStrip[] = [];

  /** Key `${parola}|${salt}` → scrypt hash: the Ders constants plus what the Lab computed. */
  const onbellek = new Map<string, string>(Object.entries(SCRYPT_ONBELLEK));
  let mode = initialMode;
  let size: { w: number; h: number } | null = null;
  /** Set by a Lab change, cleared by a step change: which badge the scene shows. */
  let labRozeti = false;
  /** Bumped by every player update; a scrypt result counts only while its generation is the latest. */
  let nesil = 0;
  let zamanlayici: ReturnType<typeof setTimeout> | null = null;
  let olcumMetni: string | null = null;

  function rozet(state: PlayerState<SaltParams>): void {
    const r: Rozet = labRozeti ? saltLabRozet(state.params) : (SALT_ROZET[state.step.id] ?? { tur: 'kitap' });
    rozetYeri.replaceChildren(sourceBadge(doc, r.tur, r.ref));
  }

  function hatKutulari(p: SaltParams, v: SaltView): void {
    const sha = p.yontem === 'sha256';
    const dogrulama = p.gorunum === 'dogrula' || p.gorunum === 'karsilastir';
    const kutu = (cls: string, baslik: string, deger?: string, etkin = false): HTMLElement => {
      const k = el(doc, 'div', `hat-kutu ${cls}${etkin ? ' etkin' : ''}`);
      k.append(el(doc, 'span', 'hat-baslik', baslik));
      if (deger !== undefined) k.append(el(doc, 'span', 'hat-deger', deger));
      return k;
    };
    const ok = (): HTMLElement => el(doc, 'span', 'hat-ok', '→');
    const parts: HTMLElement[] = [kutu('hat-parola', dogrulama ? 'deneme' : 'parola', dogrulama ? p.deneme : p.parola)];
    if (!sha) parts.push(el(doc, 'span', 'hat-ok', '+'), kutu('hat-salt', 'salt', String(v.tablo.satirlar[0]?.cells[1] ?? '')));
    parts.push(ok(), kutu('hat-islev', 'işlev', sha ? 'sha256' : 'scryptSync', true), ok(), kutu('hat-hash', 'hash', sha ? '64 hex' : '128 hex'));
    hat.replaceChildren(...parts);
  }

  function draw(state: PlayerState<SaltParams>): void {
    const p = state.params;
    // the book's printed output belongs to the step's own badge; a Lab change drops it
    const v = deriveSaltView(p, onbellek, !labRozeti);
    const tanimGorunumu = p.gorunum === 'tanim';
    const yavasGorunumu = v.yavasTablo;
    const ozetGorunumu = v.ozet !== null;
    const kitap = tanimGorunumu || yavasGorunumu || ozetGorunumu;

    const w = stage.getBoundingClientRect().width || size!.w;
    const narrow = w < NARROW;
    stage.toggleAttribute('data-narrow', narrow);
    stage.toggleAttribute('data-terminal', v.terminal.length > 0);

    // book-only views: the text (or table) replaces the table, the line and the strips
    tanim.hidden = !tanimGorunumu;
    if (tanimGorunumu) {
      const p1 = el(doc, 'p', 'tanim-metin');
      p1.append(el(doc, 'strong', '', 'Tanım. '), TANIM);
      tanim.replaceChildren(p1, el(doc, 'p', 'ipucu', `İpucu: ${IPUCU}`));
    }
    yavasYeri.hidden = !yavasGorunumu;
    ozet.hidden = !ozetGorunumu;
    if (v.ozet) {
      const liste = el(doc, 'ol', 'ozet-liste');
      for (const s of v.ozet.slice(0, 3)) liste.append(el(doc, 'li', '', s));
      ozet.replaceChildren(liste, el(doc, 'p', 'ozet-son', v.ozet[3]));
    }
    tabloYeri.hidden = kitap || v.tablo.satirlar.length === 0;
    if (!kitap) tablo.update(v.tablo);
    hat.hidden = kitap;
    if (!kitap) hatKutulari(p, v);

    while (seritler.length < v.seritler.length) seritler.push(new SegmentStrip(seritYeri));
    while (seritler.length > v.seritler.length) seritler.pop()!.destroy();
    v.seritler.forEach((s, i) => seritler[i].update(s));

    sayacYeri.hidden = v.karsilastirma === null;
    if (v.karsilastirma) {
      sayacYeri.replaceChildren(
        el(doc, 'p', 'sayac', `=== : ${v.karsilastirma.esittir} karakter karşılaştırıldı`),
        el(doc, 'p', 'sayac', `timingSafeEqual : ${v.karsilastirma.timingSafeEqual} bayt karşılaştırıldı`),
      );
    }
    sonucSatir.hidden = v.sonuc === null;
    if (v.sonuc !== null) {
      const fark = v.seritler[1]?.parcalar[0]?.fark;
      sonucSatir.textContent = `sonuç: ${v.sonuc} · ${fark && fark.length > 0 ? `ilk fark: indeks ${fark[0]}` : 'fark yok'}`;
    }
    olcum.hidden = mode !== 'lab' || olcumMetni === null;
    olcum.textContent = olcumMetni ?? '';

    kartlar.update({ yanitlar: [], terminal: v.terminal });
    rozet(state);
    // a phone has no room for the strip under the stage; the book-only views run no code line
    stripHost.hidden = mode !== 'ders' || narrow || kitap;
    strip.update({ ...v.code, window: STRIP_WINDOW });
  }

  function render(state: PlayerState<SaltParams>): void {
    if (size) draw(state);
  }

  /** Computes the scrypt hashes the view lacks, 250 ms after the latest change. */
  function planla(p: SaltParams): void {
    if (zamanlayici !== null) clearTimeout(zamanlayici);
    zamanlayici = null;
    const eksik = saltAnahtarlari(p).filter((k) => !onbellek.has(k));
    if (eksik.length === 0) return;
    const benim = nesil;
    zamanlayici = setTimeout(() => {
      zamanlayici = null;
      const t0 = performance.now();
      void Promise.all(
        eksik.map(async (k) => {
          // the salt is hex, so the last "|" splits the key even when the password holds one
          const i = k.lastIndexOf('|');
          return [k, await hesapla(k.slice(0, i), k.slice(i + 1))] as const;
        }),
      ).then(
        (sonuc) => {
          if (benim !== nesil) return;
          const scryptMs = performance.now() - t0;
          for (const [k, h] of sonuc) onbellek.set(k, h);
          const t1 = performance.now();
          sha256Hex(p.parola);
          olcumMetni = `bu tarayıcıda ölçüldü: sha256 ${ms(performance.now() - t1)} ms, scrypt ${ms(scryptMs)} ms`;
          render(player.state);
        },
        // a failed computation leaves "hesaplanıyor…" on screen; the next change tries again
        () => undefined,
      );
    }, GECIKME_MS);
  }

  const unsubscribe = player.subscribe((s, cause) => {
    if (cause === 'param') labRozeti = true;
    else if (cause === 'step') {
      labRozeti = false;
      olcumMetni = null;
    }
    nesil++;
    planla(s.params);
    render(s);
  });

  // the player may already hold parameters the cache lacks (a Lab opened on them)
  planla(player.state.params);

  return {
    resize(w: number, h: number): void {
      size = { w, h };
      render(player.state);
    },
    setMode(m: Mode): void {
      if (m === mode) return;
      mode = m;
      render(player.state);
    },
    destroy(): void {
      unsubscribe();
      if (zamanlayici !== null) clearTimeout(zamanlayici);
      nesil++;
      seritler.forEach((s) => s.destroy());
      tablo.destroy();
      yavas.destroy();
      kartlar.destroy();
      strip.destroy();
      scene.remove();
    },
  };
}

/** Lab-only: the whole listing on screen under the step text, the running line highlighted. */
export function mountSaltExtra(host: HTMLElement, player: StepPlayer<SaltParams>): void {
  const trace = new CodeTrace(host);
  const sync = (): void => trace.update(deriveSaltView(player.state.params, new Map()).code);
  sync();
  player.subscribe(sync);
}
