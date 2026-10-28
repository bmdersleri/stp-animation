import { select } from 'd3-selection';
import type { Mode } from '../../core/mode';
import type { PlayerState, StepPlayer } from '../../core/player';
import { CheckList } from '../../core/plot/check-list';
import { CodeTrace } from '../../core/plot/code-trace';
import { DataTable } from '../../core/plot/data-table';
import { HttpCards } from '../../core/plot/http-cards';
import { KitapBlokView } from '../../core/plot/kitap-blok';
import { breakWord } from '../../core/plot/lane-words';
import { SegmentStrip, type SegmentStripSpec } from '../../core/plot/segment-strip';
import { SequenceLayer } from '../../core/plot/sequence';
import { rozetSatiri, sourceBadge, type Rozet } from '../../core/plot/source-badge';
import { TextMeasure } from '../../core/plot/text-measure';
import type { SceneHandle } from '../../core/shell';
import { fitDrops, type Birakilabilir } from '../../core/plot/fit-drops';
import { SeriLayer } from './scene-seri';
import { IOT_ROZET, type IotParams } from './scenario';
import { BIRLESTIRME_NOTU, KITAP_NOT_SATIRI, deriveIotView, iotLabRozet } from './view';
import './iot-zaman-serisi.css';

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
/** Chart height (px) on a narrow screen. */
const NARROW_SERI = 240;
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

function svgKutu(doc: Document): { svg: SVGSVGElement; probe: SVGTextElement; g: SVGGElement } {
  const svg = doc.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'plot');
  const probe = doc.createElementNS(NS, 'text');
  probe.setAttribute('class', 'probe');
  const g = doc.createElementNS(NS, 'g');
  svg.append(probe, g);
  return { svg, probe, g };
}

/**
 * Scene of the iot-zaman-serisi page: the badge on top, the time-series chart under it, then the three-lane sequence
 * diagram with beside it the `dogrula` arguments, the check list, the signature strips, the stored record and the
 * terminal, the notes under them, and in Ders the code strip. The intro and summary steps replace all of it with the
 * book's definition, tables and notes; step 10 shows the hourly summary and the buffer.
 */
export function mountIotScene(
  host: HTMLElement,
  player: StepPlayer<IotParams>,
  initialMode: Mode,
  opts: { durationScale?: number } = {},
): SceneHandle {
  const doc = host.ownerDocument;
  const ds = reducedMotion() ? 0 : (opts.durationScale ?? 1);
  const scene = el(doc, 'div', 'iot-scene');
  const ust = el(doc, 'div', 'iot-ust');
  const rozetYeri = el(doc, 'div', 'rozet-yeri');
  ust.append(rozetYeri);

  const stage = el(doc, 'div', 'iot-stage');
  const kitap = new KitapBlokView(stage);
  const govde = el(doc, 'div', 'iot-govde');

  const seriYeri = el(doc, 'div', 'iot-seri');
  const seriKutu = svgKutu(doc);
  seriYeri.append(seriKutu.svg);

  const alt = el(doc, 'div', 'iot-alt');
  const diyagram = el(doc, 'div', 'iot-diyagram');
  const sira = svgKutu(doc);
  diyagram.append(sira.svg);

  const sag = el(doc, 'div', 'iot-sag');
  const kolonlar = el(doc, 'div', 'iot-kolonlar');
  const argumanYeri = el(doc, 'div', 'tablo-yeri arguman-yeri');
  const imzaYeri = el(doc, 'div', 'imza-yeri');
  const denetimYeri = el(doc, 'div', 'denetim-yeri');
  const kayitYeri = el(doc, 'div', 'tablo-yeri kayit-yeri');
  const ozetYeri = el(doc, 'div', 'tablo-yeri ozet-yeri');
  const tamponYeri = el(doc, 'div', 'tablo-yeri tampon-yeri');
  const terminalYeri = el(doc, 'div', 'iot-terminal');
  const notlarYeri = el(doc, 'div', 'iot-notlar');
  kolonlar.append(argumanYeri, imzaYeri, ozetYeri, tamponYeri, denetimYeri, kayitYeri, terminalYeri);
  sag.append(kolonlar, notlarYeri);
  alt.append(diyagram, sag);
  govde.append(seriYeri, alt);
  stage.append(kitap.root, govde);

  const argumanlar = new DataTable(argumanYeri);
  const denetim = new CheckList(denetimYeri);
  const kayit = new DataTable(kayitYeri);
  const ozet = new DataTable(ozetYeri);
  const tampon = new DataTable(tamponYeri);
  const terminal = new HttpCards(terminalYeri);
  const seritler: SegmentStrip[] = [];

  const stripHost = el(doc, 'div', 'code-strip');
  const strip = new CodeTrace(stripHost);
  scene.append(ust, stage, stripHost);
  host.append(scene);

  const measure = new TextMeasure(seriKutu.probe);
  const seqMeasure = new TextMeasure(sira.probe);
  const seri = new SeriLayer(seriKutu.svg, measure);
  const layer = new SequenceLayer(select(sira.g) as never, seqMeasure);

  let mode = initialMode;
  let size: { w: number; h: number } | null = null;
  /** Set by a Lab change, cleared by a step change: which badge the scene shows. */
  let labRozeti = false;
  /** Heights (px) the diagram and the chart were last drawn at; a later change of their boxes redraws them. */
  let drawnH = 0;
  let drawnSeriH = 0;

  const aktifRozet = (state: PlayerState<IotParams>): Rozet =>
    labRozeti ? iotLabRozet(state.params) : (IOT_ROZET[state.step.id] ?? { tur: 'kitap' });

  function rozet(state: PlayerState<IotParams>): void {
    const r = aktifRozet(state);
    rozetYeri.replaceChildren(sourceBadge(doc, r.tur, r.ref));
  }

  function seritGuncelle(specler: readonly SegmentStripSpec[]): void {
    while (seritler.length < specler.length) seritler.push(new SegmentStrip(imzaYeri));
    while (seritler.length > specler.length) seritler.pop()!.destroy();
    specler.forEach((s, i) => seritler[i].update(s));
  }

  function bosalt(): void {
    layer.clear();
    drawnH = 0;
    drawnSeriH = 0;
  }

  function draw(state: PlayerState<IotParams>): void {
    // the book's printed output belongs to the step's own badge; a Lab change drops it
    const v = deriveIotView(state.params, !labRozeti);

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

    const parca = (yer: HTMLElement, spec: unknown, guncelle: () => void): void => {
      yer.hidden = !spec;
      if (spec) guncelle();
    };
    parca(argumanYeri, v.argumanlar, () => argumanlar.update(v.argumanlar!));
    parca(denetimYeri, v.denetim, () => denetim.update(v.denetim!));
    parca(kayitYeri, v.kayit, () => kayit.update(v.kayit!));
    parca(ozetYeri, v.ozet, () => ozet.update(v.ozet!));
    parca(tamponYeri, v.tampon, () => tampon.update(v.tampon!));
    seritGuncelle(v.imzalar);
    imzaYeri.hidden = v.imzalar.length === 0;
    terminal.update({ yanitlar: [], terminal: v.terminal });
    terminalYeri.hidden = v.terminal.length === 0;
    // the page's own sentence (R24) is not the book's: it gets its own style; a book note carries its book line
    notlarYeri.replaceChildren(...v.notlar.map((n) => {
      const p = el(doc, 'p', n === BIRLESTIRME_NOTU ? 'iot-not iot-sayfa-notu' : 'iot-not', n);
      const satir = KITAP_NOT_SATIRI.get(n);
      if (satir !== undefined) p.dataset.kitapSatir = String(satir);
      return p;
    }));
    notlarYeri.hidden = v.notlar.length === 0;

    // wide screens: what does not fit under the chart is left out, least important first (the Ders stage is only ~375 px
    // tall). The spec's key pieces (checks, record, terminal, strips) and every book note the badge cites are never left
    // out: the arguments, the sequence diagram, the chart's spare height, the page's own note and the uncited book notes
    // go first, in that order.
    const grafik = v.seri !== null;
    seriYeri.hidden = !grafik;
    govde.toggleAttribute('data-grafik', grafik);
    let cizgi = v.sequence !== null;
    let seriDar = false;
    const notlar = [...notlarYeri.children] as HTMLElement[];
    const ref = aktifRozet(state).ref;
    const sayfaNotlari = notlar.filter((n) => n.classList.contains('iot-sayfa-notu'));
    const kitapNotlari = notlar.filter((n) => !n.classList.contains('iot-sayfa-notu'));
    const atlanabilir = kitapNotlari.filter((n) => !rozetSatiri(ref, Number(n.dataset.kitapSatir)));
    const ayarla = (): void => {
      diyagram.hidden = !cizgi;
      govde.toggleAttribute('data-cizgi', cizgi);
      govde.toggleAttribute('data-seri-dar', seriDar);
      kolonlar.hidden = [argumanYeri, imzaYeri, ozetYeri, tamponYeri, denetimYeri, kayitYeri, terminalYeri].every((y) => y.hidden);
      const kol = narrow ? 1 : cizgi || !ozetYeri.hidden ? 2 : 3;
      kolonlar.style.setProperty('--kol', String(kol));
      kolonlar.toggleAttribute('data-ozet', !narrow && !ozetYeri.hidden);
      // checks, record and terminal side by side: each column as wide as its content, so the record keeps one line per row
      kolonlar.toggleAttribute('data-icerik', kol === 3 && !kayitYeri.hidden && argumanYeri.hidden === true && imzaYeri.hidden === true);
      notlarYeri.hidden = notlar.every((n) => n.hidden);
    };
    ayarla();
    if (!narrow && govde.clientHeight > 0) {
      const gizle = (y: HTMLElement): Birakilabilir => ({ hide: () => { if (y.hidden) return false; y.hidden = true; return true; }, show: () => { y.hidden = false; } });
      fitDrops(
        [
          gizle(argumanYeri),
          { hide: () => { if (!cizgi) return false; cizgi = false; return true; }, show: () => { cizgi = true; } },
          { hide: () => { if (!grafik || seriDar) return false; seriDar = true; return true; }, show: () => { seriDar = false; } },
          ...[...sayfaNotlari].reverse().map(gizle),
          ...[...atlanabilir].reverse().map(gizle),
        ],
        () => sag.getBoundingClientRect().height + (grafik ? seriYeri.getBoundingClientRect().height + 6 : 0) <= govde.clientHeight - SLACK,
        ayarla,
      );
    }
    govde.dataset.birakilan = [
      argumanYeri.hidden && v.argumanlar ? 'arguman' : '',
      !cizgi && v.sequence ? 'sira' : '',
      seriDar ? 'seri-dar' : '',
      sayfaNotlari.some((n) => n.hidden) ? 'sayfa-notu' : '',
      kitapNotlari.some((n) => n.hidden) ? 'not' : '',
    ].filter(Boolean).join(' ');
    if (!cizgi) {
      layer.clear();
      drawnH = 0;
    }
    if (!grafik) drawnSeriH = 0;

    // the chart: its box is measured before drawing
    if (v.seri) {
      const sw = Math.floor(seriYeri.getBoundingClientRect().width) || size!.w;
      const sh = narrow ? NARROW_SERI : Math.max(100, Math.floor(seriYeri.getBoundingClientRect().height) || 140);
      seriKutu.svg.setAttribute('width', String(sw));
      seriKutu.svg.setAttribute('height', String(sh));
      seriKutu.svg.setAttribute('viewBox', `0 0 ${sw} ${sh}`);
      seriYeri.style.setProperty('--seri-h', `${sh}px`);
      drawnSeriH = sh;
      seri.update(v.seri, { left: 0, top: 0, width: sw, height: sh }, Math.round(300 * ds));
    }

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

  function render(state: PlayerState<IotParams>): void {
    if (size) draw(state);
  }

  const boxWatch = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => {
    if (!size || stage.hasAttribute('data-narrow')) return;
    const eski = (!diyagram.hidden && Math.abs(diyagram.clientHeight - drawnH) > 1) || (!seriYeri.hidden && Math.abs(seriYeri.clientHeight - drawnSeriH) > 1);
    if (eski) render(player.state);
  });
  boxWatch?.observe(diyagram);
  boxWatch?.observe(seriYeri);

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
      seri.destroy();
      argumanlar.destroy();
      denetim.destroy();
      kayit.destroy();
      ozet.destroy();
      tampon.destroy();
      terminal.destroy();
      seritler.splice(0).forEach((s) => s.destroy());
      kitap.destroy();
      strip.destroy();
      scene.remove();
    },
  };
}

/** Lab-only: the whole listing on screen under the step text, the running line highlighted. */
export function mountIotExtra(host: HTMLElement, player: StepPlayer<IotParams>): void {
  const trace = new CodeTrace(host);
  const sync = (): void => trace.update(deriveIotView(player.state.params).code);
  sync();
  player.subscribe(sync);
}
