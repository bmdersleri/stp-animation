import { select } from 'd3-selection';
import type { Mode } from '../../core/mode';
import type { PlayerState, StepPlayer } from '../../core/player';
import { CheckList } from '../../core/plot/check-list';
import { CodeTrace } from '../../core/plot/code-trace';
import { DataTable } from '../../core/plot/data-table';
import { fitDrops, type Birakilabilir } from '../../core/plot/fit-drops';
import { HttpCards } from '../../core/plot/http-cards';
import { KitapBlokView } from '../../core/plot/kitap-blok';
import { breakWord } from '../../core/plot/lane-words';
import { SequenceLayer } from '../../core/plot/sequence';
import { rozetSatiri, sourceBadge, type Rozet } from '../../core/plot/source-badge';
import { TextMeasure } from '../../core/plot/text-measure';
import type { SceneHandle } from '../../core/shell';
import { ZamanLayer } from './scene-zaman';
import { TIMEOUT_ROZET, type TimeoutParams } from './scenario';
import { KITAP_NOT_SATIRI, SAYFA_NOTLARI, deriveTimeoutView, timeoutLabRozet } from './view';
import './timeout-retry.css';

const NS = 'http://www.w3.org/2000/svg';
/** Below this stage width (px) the boxes stack and the code strip is left out. */
const NARROW = 700;
/** Lines of code the Ders strip shows around the active one. */
const STRIP_WINDOW = 1;
/** Narrow sequence diagram: at least / at most this tall (px); text lines for its lane titles and per message. */
const NARROW_MIN = 300;
const NARROW_MAX = 900;
const NARROW_HEADER = 8;
const NARROW_ROW = 3.2;
/** Horizontal room (px) a lane title keeps clear of its neighbours. */
const LANE_PAD = 12;
/** Room (px) the wide layout keeps free under its content. */
const SLACK = 6;
const reducedMotion = (): boolean => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

function el<K extends keyof HTMLElementTagNameMap>(doc: Document, tag: K, cls: string, text?: string): HTMLElementTagNameMap[K] {
  const e = doc.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function svgKutu(doc: Document, cls = 'plot'): { svg: SVGSVGElement; probe: SVGTextElement; g: SVGGElement } {
  const svg = doc.createElementNS(NS, 'svg');
  svg.setAttribute('class', cls);
  const probe = doc.createElementNS(NS, 'text');
  probe.setAttribute('class', 'probe');
  const g = doc.createElementNS(NS, 'g');
  svg.append(probe, g);
  return { svg, probe, g };
}

/**
 * Scene of the timeout-retry page: the badge on top, the time axis under it (attempt bars, waits, the timeout line),
 * then the three-lane sequence diagram with beside it the answer card and terminal, the check list and the error table;
 * the notes and the warning under them, and in Ders the code strip. The intro and summary steps replace all of it with
 * the book's definition, table and notes.
 */
export function mountTimeoutScene(
  host: HTMLElement,
  player: StepPlayer<TimeoutParams>,
  initialMode: Mode,
  opts: { durationScale?: number } = {},
): SceneHandle {
  const doc = host.ownerDocument;
  const ds = reducedMotion() ? 0 : (opts.durationScale ?? 1);
  const scene = el(doc, 'div', 'timeout-scene');
  const ust = el(doc, 'div', 'timeout-ust');
  const rozetYeri = el(doc, 'div', 'rozet-yeri');
  ust.append(rozetYeri);

  const stage = el(doc, 'div', 'timeout-stage');
  const kitap = new KitapBlokView(stage);
  const govde = el(doc, 'div', 'timeout-govde');

  const zamanYeri = el(doc, 'div', 'timeout-zaman');
  const zamanKutu = svgKutu(doc, 'plot zaman');
  zamanYeri.append(zamanKutu.svg);

  const alt = el(doc, 'div', 'timeout-alt');
  const diyagram = el(doc, 'div', 'timeout-diyagram');
  const sira = svgKutu(doc);
  diyagram.append(sira.svg);

  const sag = el(doc, 'div', 'timeout-sag');
  const kolonlar = el(doc, 'div', 'timeout-kolonlar');
  const kartYeri = el(doc, 'div', 'timeout-kart');
  const denetimYeri = el(doc, 'div', 'denetim-yeri');
  const tabloYeri = el(doc, 'div', 'tablo-yeri hata-yeri');
  const notlarYeri = el(doc, 'div', 'timeout-notlar');
  kolonlar.append(kartYeri, denetimYeri, tabloYeri);
  sag.append(kolonlar, notlarYeri);
  alt.append(diyagram, sag);
  govde.append(zamanYeri, alt);
  stage.append(kitap.root, govde);

  const kartlar = new HttpCards(kartYeri);
  const denetim = new CheckList(denetimYeri);
  const tablo = new DataTable(tabloYeri);

  const stripHost = el(doc, 'div', 'code-strip');
  const strip = new CodeTrace(stripHost);
  scene.append(ust, stage, stripHost);
  host.append(scene);

  const zamanMeasure = new TextMeasure(zamanKutu.probe);
  const seqMeasure = new TextMeasure(sira.probe);
  const zaman = new ZamanLayer(zamanKutu.svg, zamanMeasure);
  const layer = new SequenceLayer(select(sira.g) as never, seqMeasure);

  let mode = initialMode;
  let size: { w: number; h: number } | null = null;
  /** Set by a Lab change, cleared by a step change: which badge the scene shows. */
  let labRozeti = false;
  /** Height (px) the diagram was last drawn at; a later change of its box redraws it. */
  let drawnH = 0;

  const aktifRozet = (state: PlayerState<TimeoutParams>): Rozet =>
    labRozeti ? timeoutLabRozet(state.params) : (TIMEOUT_ROZET[state.step.id] ?? { tur: 'kitap' });

  function rozet(state: PlayerState<TimeoutParams>): void {
    const r = aktifRozet(state);
    rozetYeri.replaceChildren(sourceBadge(doc, r.tur, r.ref));
  }

  function bosalt(): void {
    layer.clear();
    drawnH = 0;
  }

  function draw(state: PlayerState<TimeoutParams>): void {
    // the book's printed output belongs to the step's own badge; a Lab change drops it
    const v = deriveTimeoutView(state.params, !labRozeti);

    const w = stage.getBoundingClientRect().width || size!.w;
    const narrow = w < NARROW;
    stage.toggleAttribute('data-narrow', narrow);
    // the intro and summary steps have no code to follow; a phone has no room for the strip
    stripHost.hidden = mode !== 'ders' || narrow || v.kitap !== null || v.code.active.length === 0;
    strip.update({ ...v.code, window: STRIP_WINDOW });

    // intro and summary: the book's text takes the place of everything else
    kitap.root.hidden = v.kitap === null;
    govde.hidden = v.kitap !== null;
    if (v.kitap) {
      kitap.update(v.kitap);
      bosalt();
      rozet(state);
      return;
    }
    kitap.update(null);

    const kartVar = v.kartlar.yanitlar.length > 0 || v.kartlar.terminal.length > 0;
    kartYeri.hidden = !kartVar;
    if (kartVar) kartlar.update(v.kartlar);
    denetimYeri.hidden = !v.denetim;
    if (v.denetim) denetim.update(v.denetim);
    tabloYeri.hidden = !v.hataTablosu;
    if (v.hataTablosu) tablo.update(v.hataTablosu);
    // the page's own sentences (R29-R31) are not the book's: they get their own style; a book note carries its book line
    const sayfa = (n: string): boolean => SAYFA_NOTLARI.includes(n);
    notlarYeri.replaceChildren(
      ...v.notlar.map((n) => {
        const p = el(doc, 'p', sayfa(n) ? 'timeout-not timeout-sayfa-notu' : 'timeout-not', n);
        const satir = KITAP_NOT_SATIRI.get(n);
        if (satir !== undefined) p.dataset.kitapSatir = String(satir);
        return p;
      }),
      ...(v.uyari ? [el(doc, 'p', 'uyari', v.uyari)] : []),
    );

    // the time axis: its box is sized to its rows before anything is fitted
    const grafik = v.zaman !== null;
    zamanYeri.hidden = !grafik;
    govde.toggleAttribute('data-grafik', grafik);
    let zamanH = 0;
    if (v.zaman) {
      const zw = Math.floor(zamanYeri.getBoundingClientRect().width) || size!.w;
      zamanH = zaman.height(v.zaman, zw);
      zamanKutu.svg.setAttribute('width', String(zw));
      zamanKutu.svg.setAttribute('height', String(zamanH));
      zamanKutu.svg.setAttribute('viewBox', `0 0 ${zw} ${zamanH}`);
      zamanYeri.style.height = `${zamanH}px`;
      zaman.update(v.zaman, { left: 0, top: 0, width: zw, height: zamanH }, Math.round(300 * ds));
    }

    // wide screens: what does not fit under the axis is left out, least important first (the Ders stage is only ~375 px
    // tall). The key pieces (axis, cards, terminal, checks, table), every book note the badge cites and the warning never
    // go: the uncited book notes go first, then the page's own notes, then the diagram.
    let cizgi = v.sequence !== null;
    const ref = aktifRozet(state).ref;
    const kitapNotlari = [...notlarYeri.querySelectorAll<HTMLElement>('.timeout-not:not(.timeout-sayfa-notu)')];
    const sayfaNotlari = [...notlarYeri.querySelectorAll<HTMLElement>('.timeout-sayfa-notu')];
    const atlanabilir = kitapNotlari.filter((n) => !rozetSatiri(ref, Number(n.dataset.kitapSatir)));
    const ayarla = (): void => {
      diyagram.hidden = !cizgi;
      govde.toggleAttribute('data-cizgi', cizgi);
      kolonlar.hidden = [kartYeri, denetimYeri, tabloYeri].every((y) => y.hidden);
      notlarYeri.hidden = [...notlarYeri.children].every((n) => (n as HTMLElement).hidden);
    };
    ayarla();
    if (!narrow && govde.clientHeight > 0) {
      const gizle = (y: HTMLElement): Birakilabilir => ({ hide: () => { if (y.hidden) return false; y.hidden = true; return true; }, show: () => { y.hidden = false; } });
      fitDrops(
        [
          ...[...atlanabilir].reverse().map(gizle),
          ...[...sayfaNotlari].reverse().map(gizle),
          { hide: () => { if (!cizgi) return false; cizgi = false; return true; }, show: () => { cizgi = true; } },
        ],
        () => sag.getBoundingClientRect().height + zamanH + (grafik ? 6 : 0) <= govde.clientHeight - SLACK,
        ayarla,
      );
    }
    govde.dataset.birakilan = [
      !cizgi && v.sequence ? 'sira' : '',
      sayfaNotlari.some((n) => n.hidden) ? 'sayfa-notu' : '',
      kitapNotlari.some((n) => n.hidden) ? 'not' : '',
    ].filter(Boolean).join(' ');
    if (!cizgi) bosalt();

    if (v.sequence && cizgi) {
      // measure the diagram box without the previous drawing inside it
      sira.svg.setAttribute('height', '0');
      const tick = seqMeasure.fonts(mode).tick;
      const dw = Math.floor(diyagram.getBoundingClientRect().width) || size!.w;
      const dh = narrow
        ? Math.min(NARROW_MAX, Math.max(NARROW_MIN, Math.ceil(tick * (NARROW_HEADER + NARROW_ROW * v.sequence.messages.length))))
        : Math.max(160, Math.floor(diyagram.getBoundingClientRect().height) || Math.max(160, size!.h - 60));
      sira.svg.setAttribute('width', String(dw));
      drawnH = dh;
      sira.svg.setAttribute('height', String(dh));
      sira.svg.setAttribute('viewBox', `0 0 ${dw} ${dh}`);
      diyagram.style.setProperty('--diyagram-h', `${dh}px`);
      const lane = dw / v.sequence.lanes.length - LANE_PAD;
      // only a phone breaks inside a lane title; at desktop widths a title wraps at spaces
      const lanes = narrow ? v.sequence.lanes.map((l) => ({ ...l, label: l.label.flatMap((t) => breakWord(t, lane, (x) => seqMeasure.width(x, 'seq-lane-label', tick))) })) : v.sequence.lanes;
      layer.draw({ ...v.sequence, lanes }, { left: 0, top: 0, width: dw, height: dh }, 0, tick);
    }
    rozet(state);
  }

  function render(state: PlayerState<TimeoutParams>): void {
    if (size) draw(state);
  }

  const boxWatch = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => {
    if (!size || stage.hasAttribute('data-narrow')) return;
    if (!diyagram.hidden && Math.abs(diyagram.clientHeight - drawnH) > 1) render(player.state);
  });
  boxWatch?.observe(diyagram);

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
      boxWatch?.disconnect();
      layer.clear();
      zaman.destroy();
      kartlar.destroy();
      denetim.destroy();
      tablo.destroy();
      kitap.destroy();
      strip.destroy();
      scene.remove();
    },
  };
}

/** Lab-only: the whole listing on screen under the step text, the running line highlighted. */
export function mountTimeoutExtra(host: HTMLElement, player: StepPlayer<TimeoutParams>): void {
  const trace = new CodeTrace(host);
  const sync = (): void => trace.update(deriveTimeoutView(player.state.params).code);
  sync();
  player.subscribe(sync);
}
