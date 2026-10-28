import { select } from 'd3-selection';
import type { Mode } from '../../core/mode';
import type { PlayerState, StepPlayer } from '../../core/player';
import { CheckList } from '../../core/plot/check-list';
import { CodeTrace } from '../../core/plot/code-trace';
import { DataTable } from '../../core/plot/data-table';
import { HttpCards } from '../../core/plot/http-cards';
import { KitapBlokView } from '../../core/plot/kitap-blok';
import { breakWord } from '../../core/plot/lane-words';
import { SegmentStrip } from '../../core/plot/segment-strip';
import { SequenceLayer } from '../../core/plot/sequence';
import { sourceBadge, type Rozet } from '../../core/plot/source-badge';
import { TextMeasure } from '../../core/plot/text-measure';
import type { SceneHandle } from '../../core/shell';
import { NGINX_ROZET, type NginxTlsParams } from './scenario';
import { VARSAYILAN_NOTU, nginxLabRozet, deriveNginxView } from './view';
import './nginx-tls.css';

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

function el<K extends keyof HTMLElementTagNameMap>(doc: Document, tag: K, cls: string, text?: string): HTMLElementTagNameMap[K] {
  const e = doc.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

/**
 * Scene of the nginx-tls page: the badge on top, the four-lane request sequence diagram (client, UFW, Nginx, application)
 * with beside it the request, response, path checks, what the application sees, the X-Forwarded-For strip and the
 * certificate tables, the notes under them, and in Ders the code strip. The intro and summary steps replace all of it
 * with the book's definition, tables and notes.
 */
export function mountNginxScene(
  host: HTMLElement,
  player: StepPlayer<NginxTlsParams>,
  initialMode: Mode,
  _opts: { durationScale?: number } = {},
): SceneHandle {
  const doc = host.ownerDocument;
  const scene = el(doc, 'div', 'nginx-scene');
  const ust = el(doc, 'div', 'nginx-ust');
  const rozetYeri = el(doc, 'div', 'rozet-yeri');
  ust.append(rozetYeri);

  const stage = el(doc, 'div', 'nginx-stage');
  const kitap = new KitapBlokView(stage);
  const govde = el(doc, 'div', 'nginx-govde');
  const diyagram = el(doc, 'div', 'nginx-diyagram');
  const svg = doc.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'plot');
  const probe = doc.createElementNS(NS, 'text');
  probe.setAttribute('class', 'probe');
  const g = doc.createElementNS(NS, 'g');
  svg.append(probe, g);
  diyagram.append(svg);

  const sag = el(doc, 'div', 'nginx-sag');
  const kartYeri = el(doc, 'div', 'nginx-kartlar');
  const yanitYokYeri = el(doc, 'p', 'yanit-yok');
  const denetimYeri = el(doc, 'div', 'denetim-yeri');
  const gorulenYeri = el(doc, 'div', 'tablo-yeri gorulen-yeri');
  const xffYeri = el(doc, 'div', 'xff-yeri');
  const sertifikaYeri = el(doc, 'div', 'tablo-yeri sertifika-yeri');
  const certbotYeri = el(doc, 'div', 'denetim-yeri certbot-yeri');
  const sagA = el(doc, 'div', 'nginx-sag-kolon');
  const sagB = el(doc, 'div', 'nginx-sag-kolon');
  sagA.append(kartYeri, yanitYokYeri, denetimYeri, certbotYeri);
  const notlarYeri = el(doc, 'div', 'nginx-notlar');
  sagB.append(gorulenYeri, xffYeri, sertifikaYeri, notlarYeri);
  sag.append(sagA, sagB);
  govde.append(diyagram, sag);
  stage.append(kitap.root, govde);
  const gorulen = new DataTable(gorulenYeri);
  const xff = new SegmentStrip(xffYeri);
  const sertifika = new DataTable(sertifikaYeri);
  const certbot = new CheckList(certbotYeri);
  const denetim = new CheckList(denetimYeri);
  const kartlar = new HttpCards(kartYeri);

  const stripHost = el(doc, 'div', 'code-strip');
  const strip = new CodeTrace(stripHost);
  scene.append(ust, stage, stripHost);
  host.append(scene);

  const measure = new TextMeasure(probe);
  const layer = new SequenceLayer(select(g) as never, measure);

  let mode = initialMode;
  let size: { w: number; h: number } | null = null;
  /** Set by a Lab change, cleared by a step change: which badge the scene shows. */
  let labRozeti = false;
  /** Height (px) the diagram was last drawn at; a later change of its box redraws it. */
  let drawnH = 0;

  function rozet(state: PlayerState<NginxTlsParams>): void {
    const r: Rozet = labRozeti ? nginxLabRozet(state.params) : (NGINX_ROZET[state.step.id] ?? { tur: 'kitap' });
    rozetYeri.replaceChildren(sourceBadge(doc, r.tur, r.ref));
  }

  function draw(state: PlayerState<NginxTlsParams>): void {
    // the book's printed output belongs to the step's own badge; a Lab change drops it
    const v = deriveNginxView(state.params, !labRozeti);

    const w = stage.getBoundingClientRect().width || size!.w;
    const narrow = w < NARROW;
    stage.toggleAttribute('data-narrow', narrow);
    stripHost.hidden = mode !== 'ders' || narrow || v.code.active.length === 0;
    strip.update({ ...v.code, window: STRIP_WINDOW });

    // intro and summary: the book's text takes the place of everything else
    kitap.root.hidden = v.kitap === null;
    govde.hidden = v.kitap !== null;
    if (v.kitap) {
      kitap.update(v.kitap);
      layer.clear();
      drawnH = 0;
      rozet(state);
      return;
    }
    kitap.update(null);

    const parca = (yer: HTMLElement, spec: unknown, guncelle: () => void): void => {
      yer.hidden = !spec;
      if (spec) guncelle();
    };
    kartlar.update(v.kartlar);
    kartYeri.hidden = !v.kartlar.istek && v.kartlar.terminal.length === 0 && v.kartlar.yanitlar.length === 0;
    yanitYokYeri.hidden = v.yanitYok === null;
    yanitYokYeri.textContent = v.yanitYok ?? '';
    // with nothing else in the second column (301, no response, 502) the path checks take it; with no application
    // table the certificate lists share it too
    if (v.gorulen === null && v.certbot === null) sagB.prepend(denetimYeri);
    else sagA.append(denetimYeri);
    if (v.gorulen === null) sagB.insertBefore(certbotYeri, notlarYeri);
    else sagA.append(certbotYeri);
    parca(denetimYeri, v.denetim, () => denetim.update(v.denetim!));
    parca(gorulenYeri, v.gorulen, () => gorulen.update(v.gorulen!));
    parca(xffYeri, v.xff, () => xff.update(v.xff!));
    parca(sertifikaYeri, v.sertifika, () => sertifika.update(v.sertifika!));
    parca(certbotYeri, v.certbot, () => certbot.update(v.certbot!));
    // the page's own sentence (R18) is not the book's: it gets its own style
    notlarYeri.replaceChildren(...v.notlar.map((n) => el(doc, 'p', n === VARSAYILAN_NOTU ? 'nginx-not nginx-sayfa-notu' : 'nginx-not', n)));
    notlarYeri.hidden = v.notlar.length === 0;

    // steps 1, 5 and 9 have no diagram: the cards, strip and tables take its place
    const cizgi = v.sequence !== null;
    diyagram.hidden = !cizgi;
    govde.toggleAttribute('data-cizgi', cizgi);
    if (!v.sequence) {
      layer.clear();
      drawnH = 0;
      rozet(state);
      return;
    }

    // measure the diagram box without the previous drawing inside it
    svg.setAttribute('height', '0');
    const tick = measure.fonts(mode).tick;
    const dw = Math.floor(diyagram.getBoundingClientRect().width) || size!.w;
    const dh = narrow
      ? Math.min(NARROW_MAX, Math.max(NARROW_MIN, Math.ceil(tick * (NARROW_HEADER + NARROW_ROW * v.sequence.messages.length))))
      : Math.max(160, Math.floor(diyagram.getBoundingClientRect().height) || Math.max(160, size!.h - 60));
    svg.setAttribute('width', String(dw));
    drawnH = dh;
    svg.setAttribute('height', String(dh));
    svg.setAttribute('viewBox', `0 0 ${dw} ${dh}`);
    diyagram.style.setProperty('--diyagram-h', `${dh}px`);
    const lane = dw / v.sequence.lanes.length - LANE_PAD;
    // only a phone breaks inside a lane title; at desktop widths a title wraps at spaces
    const lanes = narrow ? v.sequence.lanes.map((l) => ({ ...l, label: l.label.flatMap((t) => breakWord(t, lane, (x) => measure.width(x, 'seq-lane-label', tick))) })) : v.sequence.lanes;
    layer.draw({ ...v.sequence, lanes }, { left: 0, top: 0, width: dw, height: dh }, 0, tick);

    rozet(state);
  }

  function render(state: PlayerState<NginxTlsParams>): void {
    if (size) draw(state);
  }

  const boxWatch = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => {
    if (size && !stage.hasAttribute('data-narrow') && !diyagram.hidden && Math.abs(diyagram.clientHeight - drawnH) > 1) render(player.state);
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
      gorulen.destroy();
      xff.destroy();
      sertifika.destroy();
      certbot.destroy();
      kitap.destroy();
      denetim.destroy();
      kartlar.destroy();
      strip.destroy();
      scene.remove();
    },
  };
}

/** Lab-only: the whole listing on screen under the step text, the running line highlighted. */
export function mountNginxExtra(host: HTMLElement, player: StepPlayer<NginxTlsParams>): void {
  const trace = new CodeTrace(host);
  const sync = (): void => trace.update(deriveNginxView(player.state.params).code);
  sync();
  player.subscribe(sync);
}
