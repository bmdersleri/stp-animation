import { select } from 'd3-selection';
import type { Mode } from '../../core/mode';
import type { PlayerState, StepPlayer } from '../../core/player';
import { CheckList } from '../../core/plot/check-list';
import { CodeTrace } from '../../core/plot/code-trace';
import { HttpCards } from '../../core/plot/http-cards';
import { SegmentStrip } from '../../core/plot/segment-strip';
import { SequenceLayer } from '../../core/plot/sequence';
import { sourceBadge, type Rozet } from '../../core/plot/source-badge';
import { TextMeasure } from '../../core/plot/text-measure';
import type { SceneHandle } from '../../core/shell';
import { JWT_ROZET, type JwtParams } from './scenario';
import { deriveJwtView, jwtLabRozet } from './view';
import './jwt-akisi.css';

const NS = 'http://www.w3.org/2000/svg';
/** Below this stage width (px) the checks and the terminal sit under the strips and the code strip is left out. */
const NARROW = 700;
/** Lines of code the Ders strip shows around the active one. */
const STRIP_WINDOW = 1;
/** Narrow sequence diagram: at least / at most this tall (px); text lines for its lane titles and per message. */
const NARROW_MIN = 300;
const NARROW_MAX = 700;
const NARROW_HEADER = 6;
const NARROW_ROW = 3.2;

/** The book's definition of a JWT (L382), without the code ticks around the dot. */
const TANIM =
  'JWT (JSON Web Token), üç bölümden oluşan, nokta (.) ile ayrılmış bir metin dizisidir: header, payload ve imza (signature). Header token’ın tipini ve imza algoritmasını; payload kullanıcıya ait iddiaları (claims) — örneğin kullanıcı adı ve rol — imza ise header ve payload’ın değiştirilmediğini garanti eden kriptografik bir doğrulama değerini taşır. Sunucu, gizli bir anahtar (secret key) ile bu imzayı üretir ve doğrular.';

function el<K extends keyof HTMLElementTagNameMap>(doc: Document, tag: K, cls: string, text?: string): HTMLElementTagNameMap[K] {
  const e = doc.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

/** A titled box holding one pre-formatted JSON text. */
function jsonKutu(doc: Document, baslik: string): { root: HTMLElement; pre: HTMLElement } {
  const root = el(doc, 'div', 'json-kutu');
  const pre = el(doc, 'pre', 'json-metin');
  root.append(el(doc, 'div', 'json-baslik', baslik), pre);
  return { root, pre };
}

/**
 * Scene of the jwt-akisi page: the badge top right, the token strip, the decoded header and payload boxes, the
 * incoming and expected signature strips, the check list and terminal beside them and, in Ders, the code strip.
 * The last step swaps all of that for the sequence diagram.
 */
export function mountJwtScene(
  host: HTMLElement,
  player: StepPlayer<JwtParams>,
  initialMode: Mode,
  _opts: { durationScale?: number } = {},
): SceneHandle {
  const doc = host.ownerDocument;
  const scene = el(doc, 'div', 'jwt-scene');
  const rozetYeri = el(doc, 'div', 'rozet-yeri');
  const stage = el(doc, 'div', 'jwt-stage');
  const main = el(doc, 'div', 'jwt-main');
  const yan = el(doc, 'div', 'jwt-yan');

  const tanim = el(doc, 'div', 'tanim kitap-blok');
  const tokenYeri = el(doc, 'div', 'token-yeri');
  const tokenSerit = new SegmentStrip(tokenYeri);
  const kutular = el(doc, 'div', 'json-kutular');
  const headerKutu = jsonKutu(doc, 'header (çözülmüş)');
  const payloadKutu = jsonKutu(doc, 'payload (çözülmüş)');
  kutular.append(headerKutu.root, payloadKutu.root);
  const imzaYeri = el(doc, 'div', 'imzalar');
  const diyagram = el(doc, 'div', 'jwt-diyagram');
  const svg = doc.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'plot');
  const probe = doc.createElementNS(NS, 'text');
  probe.setAttribute('class', 'probe');
  const g = doc.createElementNS(NS, 'g');
  svg.append(probe, g);
  diyagram.append(svg);
  main.append(tanim, tokenYeri, kutular, imzaYeri, diyagram);

  const denetimYeri = el(doc, 'div', 'denetim-yeri');
  const denetim = new CheckList(denetimYeri);
  yan.append(denetimYeri);
  // only the terminal of the shared cards is used here
  const kartlar = new HttpCards(yan);
  stage.append(main, yan);
  const stripHost = el(doc, 'div', 'code-strip');
  const strip = new CodeTrace(stripHost);
  scene.append(rozetYeri, stage, stripHost);
  host.append(scene);

  const measure = new TextMeasure(probe);
  const layer = new SequenceLayer(select(g) as never, measure);
  const imzaSeritleri: SegmentStrip[] = [];

  let mode = initialMode;
  let size: { w: number; h: number } | null = null;
  /** Set by a Lab change, cleared by a step change: which badge the scene shows. */
  let labRozeti = false;

  function rozet(state: PlayerState<JwtParams>): void {
    const r: Rozet = labRozeti ? jwtLabRozet(state.params) : (JWT_ROZET[state.step.id] ?? { tur: 'kitap' });
    rozetYeri.replaceChildren(sourceBadge(doc, r.tur, r.ref));
  }

  function draw(state: PlayerState<JwtParams>): void {
    const p = state.params;
    // the book's accumulated output belongs to the step's own badge; a Lab change drops it
    const v = deriveJwtView(p, !labRozeti);
    const akis = v.sequence !== null;

    const sr = stage.getBoundingClientRect();
    const w = sr.width || size!.w;
    const narrow = w < NARROW;
    stage.toggleAttribute('data-narrow', narrow);
    const yanVar = v.denetim !== null || v.terminal.length > 0;
    stage.toggleAttribute('data-yan', yanVar);
    stage.toggleAttribute('data-akis', akis);
    yan.hidden = !yanVar;

    tanim.hidden = p.asama !== 'tanitim';
    if (p.asama === 'tanitim') {
      const para = el(doc, 'p', 'tanim-metin');
      para.append(el(doc, 'strong', '', 'Tanım. '), TANIM);
      tanim.replaceChildren(para);
    }

    tokenYeri.hidden = v.token === null;
    if (v.token) tokenSerit.update(v.token);

    headerKutu.root.hidden = v.header === null || p.asama === 'okunur';
    payloadKutu.root.hidden = v.payload === null;
    kutular.hidden = headerKutu.root.hidden && payloadKutu.root.hidden;
    headerKutu.pre.textContent = v.header ?? '';
    payloadKutu.pre.textContent = v.payload ?? '';
    // code_006 prints the decoded payload as the book does: one line, not pretty JSON
    kutular.toggleAttribute('data-tek', headerKutu.root.hidden !== payloadKutu.root.hidden);

    while (imzaSeritleri.length < v.imzalar.length) imzaSeritleri.push(new SegmentStrip(imzaYeri));
    while (imzaSeritleri.length > v.imzalar.length) imzaSeritleri.pop()!.destroy();
    v.imzalar.forEach((s, i) => imzaSeritleri[i].update(s));
    imzaYeri.hidden = v.imzalar.length === 0;

    denetimYeri.hidden = v.denetim === null;
    if (v.denetim) denetim.update(v.denetim);
    kartlar.update({ yanitlar: [], terminal: v.terminal });

    diyagram.hidden = !akis;
    if (v.sequence) {
      const tick = measure.fonts(mode).tick;
      const dw = Math.floor(sr.width) || size!.w;
      const dh = narrow
        ? Math.min(NARROW_MAX, Math.max(NARROW_MIN, Math.ceil(tick * (NARROW_HEADER + NARROW_ROW * v.sequence.messages.length))))
        : Math.max(160, Math.floor(sr.height) || Math.max(160, size!.h - 60));
      svg.setAttribute('width', String(dw));
      svg.setAttribute('height', String(dh));
      svg.setAttribute('viewBox', `0 0 ${dw} ${dh}`);
      diyagram.style.setProperty('--diyagram-h', `${dh}px`);
      layer.draw(v.sequence, { left: 0, top: 0, width: dw, height: dh }, 0, tick);
    }

    rozet(state);
    // a phone has no room for the strip under the stage; the book-only views and the diagram run no code line
    stripHost.hidden = mode !== 'ders' || narrow || v.code.active.length === 0;
    strip.update({ ...v.code, window: STRIP_WINDOW });
  }

  function render(state: PlayerState<JwtParams>): void {
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
      tokenSerit.destroy();
      imzaSeritleri.forEach((s) => s.destroy());
      denetim.destroy();
      kartlar.destroy();
      strip.destroy();
      scene.remove();
    },
  };
}

/** Lab-only: the whole listing on screen under the step text, the running line highlighted. */
export function mountJwtExtra(host: HTMLElement, player: StepPlayer<JwtParams>): void {
  const trace = new CodeTrace(host);
  const sync = (): void => trace.update(deriveJwtView(player.state.params).code);
  sync();
  player.subscribe(sync);
}
