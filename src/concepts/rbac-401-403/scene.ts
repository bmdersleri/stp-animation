import { select } from 'd3-selection';
import type { Mode } from '../../core/mode';
import type { PlayerState, StepPlayer } from '../../core/player';
import { CheckList } from '../../core/plot/check-list';
import { CodeTrace } from '../../core/plot/code-trace';
import { DataTable } from '../../core/plot/data-table';
import { HttpCards } from '../../core/plot/http-cards';
import { breakWord } from '../../core/plot/lane-words';
import { SequenceLayer } from '../../core/plot/sequence';
import { sourceBadge, type Rozet } from '../../core/plot/source-badge';
import { TextMeasure } from '../../core/plot/text-measure';
import type { SceneHandle } from '../../core/shell';
import { RBAC_ROZET, type RbacParams } from './scenario';
import { deriveRbacView, rbacLabRozet } from './view';
import './rbac-401-403.css';

const NS = 'http://www.w3.org/2000/svg';
/** Below this stage width (px) the checks and cards sit under the diagram and the code strip is left out. */
const NARROW = 700;
/** Lines of code the Ders strip shows around the active one. */
const STRIP_WINDOW = 1;
/** Narrow sequence diagram: at least / at most this tall (px); text lines for its lane titles and per message. */
const NARROW_MIN = 300;
const NARROW_MAX = 760;
const NARROW_HEADER = 8;
const NARROW_ROW = 3.2;
/** Horizontal room (px) a lane title keeps clear of its neighbours; gap (px) between the diagram and the table. */
const LANE_PAD = 12;
const GAP = 8;

/** The book's exam note (L845) and definition (L848). */
const SINAV_NOTU = 'Sınav Notu: 401 “sen kimsin, bilmiyorum” anlamına gelir; 403 “seni tanıyorum ama bu işleme iznin yok” anlamına gelir.';
const TANIM =
  '401 Unauthorized, isteğin kimliği doğrulanamadığında döndürülen HTTP durum kodudur — token eksik, geçersiz veya süresi dolmuş olabilir. 403 Forbidden ise isteğin kimliği başarıyla doğrulanmış olmasına rağmen, o kimliğin istenen işlemi yapmaya yetkisi olmadığında döndürülür. İsimlendirmedeki “Unauthorized” kelimesi kafa karıştırıcı olsa da 401 aslında “authentication başarısız” anlamına gelir.';

function el<K extends keyof HTMLElementTagNameMap>(doc: Document, tag: K, cls: string, text?: string): HTMLElementTagNameMap[K] {
  const e = doc.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

/**
 * Scene of the rbac-401-403 page: the badge top right, the sequence diagram (with the repository table under it on the
 * register step), beside it the token note, the check list and the request, response and terminal cards, and in Ders
 * the code strip. The first and last steps replace the diagram with the book's definition and the status table.
 */
export function mountRbacScene(
  host: HTMLElement,
  player: StepPlayer<RbacParams>,
  initialMode: Mode,
  _opts: { durationScale?: number } = {},
): SceneHandle {
  const doc = host.ownerDocument;
  const scene = el(doc, 'div', 'rbac-scene');
  const rozetYeri = el(doc, 'div', 'rozet-yeri');
  const stage = el(doc, 'div', 'rbac-stage');
  const main = el(doc, 'div', 'rbac-main');
  const yan = el(doc, 'div', 'rbac-yan');

  const tanim = el(doc, 'div', 'tanim kitap-blok');
  const diyagram = el(doc, 'div', 'rbac-diyagram');
  const svg = doc.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'plot');
  const probe = doc.createElementNS(NS, 'text');
  probe.setAttribute('class', 'probe');
  const g = doc.createElementNS(NS, 'g');
  svg.append(probe, g);
  diyagram.append(svg);
  const tabloYeri = el(doc, 'div', 'tablo-yeri');
  const tablo = new DataTable(tabloYeri);
  main.append(tanim, diyagram, tabloYeri);

  const tokenNotu = el(doc, 'p', 'token-notu');
  const denetimYeri = el(doc, 'div', 'denetim-yeri');
  const denetim = new CheckList(denetimYeri);
  // Kod 10.4 sends two requests: the first request card sits in its own cards block above the second one
  const ilkIstek = new HttpCards(yan);
  yan.prepend(tokenNotu, denetimYeri);
  const kartlar = new HttpCards(yan);
  stage.append(main, yan);
  const stripHost = el(doc, 'div', 'code-strip');
  const strip = new CodeTrace(stripHost);
  scene.append(rozetYeri, stage, stripHost);
  host.append(scene);

  const measure = new TextMeasure(probe);
  const layer = new SequenceLayer(select(g) as never, measure);

  let mode = initialMode;
  let size: { w: number; h: number } | null = null;
  /** Set by a Lab change, cleared by a step change: which badge the scene shows. */
  let labRozeti = false;

  function rozet(state: PlayerState<RbacParams>): void {
    const r: Rozet = labRozeti ? rbacLabRozet(state.params) : (RBAC_ROZET[state.step.id] ?? { tur: 'kitap' });
    rozetYeri.replaceChildren(sourceBadge(doc, r.tur, r.ref));
  }

  function draw(state: PlayerState<RbacParams>): void {
    const p = state.params;
    // the book's accumulated output belongs to the step's own badge; a Lab change drops it
    const v = deriveRbacView(p, !labRozeti);
    const akis = v.sequence !== null;

    const sr = stage.getBoundingClientRect();
    const w = sr.width || size!.w;
    const narrow = w < NARROW;
    stage.toggleAttribute('data-narrow', narrow);
    // the strip takes its height from the stage: show or hide it before anything measures the stage
    // a phone has no room for the strip under the stage; the book-only views run no code line
    stripHost.hidden = mode !== 'ders' || narrow || v.code.active.length === 0;
    strip.update({ ...v.code, window: STRIP_WINDOW });
    const yanVar = v.denetim !== null || v.http.yanitlar.length > 0 || v.http.terminal.length > 0 || v.tokenNotu !== null;
    stage.toggleAttribute('data-yan', yanVar);
    stage.toggleAttribute('data-akis', akis);
    // several response cards (Kod 10.6) do not fit above the terminal: the cards column widens and puts them side by side
    stage.toggleAttribute('data-cok', v.http.yanitlar.length > 1);
    yan.hidden = !yanVar;

    tanim.hidden = p.asama !== 'tanitim';
    if (p.asama === 'tanitim') {
      tanim.replaceChildren(el(doc, 'p', 'tanim-not', SINAV_NOTU), el(doc, 'p', 'tanim-metin', TANIM));
    }

    tabloYeri.hidden = v.tablo === null;
    if (v.tablo) tablo.update(v.tablo);

    tokenNotu.hidden = v.tokenNotu === null;
    tokenNotu.textContent = v.tokenNotu ?? '';
    denetimYeri.hidden = v.denetim === null;
    if (v.denetim) denetim.update(v.denetim);
    const iki = v.istekler.length > 1;
    ilkIstek.root.hidden = !iki;
    ilkIstek.update({ istek: iki ? v.istekler[0] : undefined, yanitlar: [], terminal: [] });
    kartlar.update({ ...v.http, istek: iki ? v.istekler[1] : v.http.istek });

    diyagram.hidden = !akis;
    if (v.sequence) {
      const tick = measure.fonts(mode).tick;
      // the diagram shares the row with the cards column: its own box is the width
      const dw = Math.floor(diyagram.getBoundingClientRect().width) || size!.w;
      const tabloH = tabloYeri.hidden ? 0 : tabloYeri.getBoundingClientRect().height + GAP;
      const dh = narrow
        ? Math.min(NARROW_MAX, Math.max(NARROW_MIN, Math.ceil(tick * (NARROW_HEADER + NARROW_ROW * v.sequence.messages.length))))
        : Math.max(160, (Math.floor(stage.getBoundingClientRect().height) || Math.max(160, size!.h - 60)) - tabloH);
      svg.setAttribute('width', String(dw));
      svg.setAttribute('height', String(dh));
      svg.setAttribute('viewBox', `0 0 ${dw} ${dh}`);
      diyagram.style.setProperty('--diyagram-h', `${dh}px`);
      // a lane title wider than its lane breaks at camelCase and space boundaries (phone width)
      const lane = dw / v.sequence.lanes.length - LANE_PAD;
      const lanes = v.sequence.lanes.map((l) => ({ ...l, label: l.label.flatMap((t) => breakWord(t, lane, (x) => measure.width(x, 'seq-lane-label', tick))) }));
      layer.draw({ ...v.sequence, lanes }, { left: 0, top: 0, width: dw, height: dh }, 0, tick);
    }

    rozet(state);
  }

  function render(state: PlayerState<RbacParams>): void {
    if (size) draw(state);
  }

  const unsubscribe = player.subscribe((s, cause) => {
    if (cause === 'param') labRozeti = true;
    else if (cause === 'step') labRozeti = false;
    render(s);
  });

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
      layer.clear();
      tablo.destroy();
      denetim.destroy();
      ilkIstek.destroy();
      kartlar.destroy();
      strip.destroy();
      scene.remove();
    },
  };
}

/** Lab-only: the whole listing on screen under the step text, the running line highlighted. */
export function mountRbacExtra(host: HTMLElement, player: StepPlayer<RbacParams>): void {
  const trace = new CodeTrace(host);
  const sync = (): void => trace.update(deriveRbacView(player.state.params).code);
  sync();
  player.subscribe(sync);
}
