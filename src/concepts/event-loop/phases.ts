import type { FlowGraphSpec, FlowNode } from '../../core/plot/flow-graph';

const node = (id: string, name: string, desc: string): FlowNode => ({ id, label: [name, desc], kind: 'phase', x: 0, y: 0, w: 220, h: 64 });

/** Room (px) kept under the lowest node for poll's self-loop, and the margin kept round the ring. */
export const RING_LOOP_ROOM = 34;
const RING_MARGIN = 8;

/**
 * Puts the nodes, in visiting order, on an ellipse inside a `w` x `h` area, the first at the top and the rest
 * clockwise. Each node keeps its own box (a node's x and y are its centre); the ellipse leaves room for the
 * boxes, a margin, and `RING_LOOP_ROOM` below for poll's self-loop. Pure.
 */
export function layoutRing(nodes: readonly FlowNode[], w: number, h: number): FlowNode[] {
  const boxW = Math.max(...nodes.map((n) => n.w));
  const boxH = Math.max(...nodes.map((n) => n.h));
  const cx = w / 2;
  const rx = Math.max(0, (w - boxW) / 2 - RING_MARGIN);
  const top = boxH / 2 + RING_MARGIN;
  const bottom = h - boxH / 2 - RING_MARGIN - RING_LOOP_ROOM;
  const cy = (top + bottom) / 2;
  const ry = Math.max(0, (bottom - top) / 2);
  return nodes.map((n, i) => {
    const a = -Math.PI / 2 + (2 * Math.PI * i) / nodes.length;
    return { ...n, x: Math.round(cx + rx * Math.cos(a)), y: Math.round(cy + ry * Math.sin(a)) };
  });
}

/** Gap (px) between the boxes of a column. */
const COLUMN_GAP = 26;

/**
 * Phone layout: the nodes in one column, top to bottom in visiting order, centred on `cx`, from `top` down.
 * Returns the nodes and the height the column needs (the closing edge and poll's loop run beside it). Pure.
 */
export function layoutColumn(nodes: readonly FlowNode[], cx: number, top = RING_MARGIN, gap = COLUMN_GAP): { nodes: FlowNode[]; height: number } {
  let y = top;
  const out = nodes.map((n) => {
    const c = { ...n, x: Math.round(cx), y: Math.round(y + n.h / 2) };
    y += n.h + gap;
    return c;
  });
  return { nodes: out, height: Math.ceil(y - gap + RING_MARGIN) };
}

/** Şekil 4.3: the five phases of one event-loop turn, in the order they are visited, laid out on a ring (nominal 720 x 460; the scene re-lays it out for the stage). */
export const PHASES: FlowGraphSpec = {
  nodes: layoutRing(
    [
      node('timers', 'timers', 'süresi dolan setTimeout geri çağrıları'),
      node('pending', 'pending callbacks', 'ertelenmiş sistem geri çağrıları'),
      node('poll', 'poll', 'dosya ve ağ G/Ç olayları'),
      node('check', 'check', 'setImmediate geri çağrıları'),
      node('close', 'close callbacks', "kapanış olayları (sunucu.on('close'))"),
    ],
    720,
    460,
  ),
  edges: [
    { id: 'timers-pending', from: 'timers', to: 'pending', kind: 'forward' },
    { id: 'pending-poll', from: 'pending', to: 'poll', kind: 'forward' },
    { id: 'poll-check', from: 'poll', to: 'check', kind: 'forward', label: 'hazır olay işlendi' },
    { id: 'check-close', from: 'check', to: 'close', kind: 'forward' },
    { id: 'close-timers', from: 'close', to: 'timers', kind: 'forward', label: 'tur tamamlandı, döngü yeniden başlar' },
  ],
};

/** Şekil 4.3's edge `poll --> poll` (drawn by the scene, a flow edge needs two nodes) and its exit edge `close --> [*]`. */
export const POLL_LOOP_LABEL = 'kuyruk boş, yeni olay bekleniyor';
export const EXIT_LABEL = 'bekleyen iş kalmadı, süreç sonlanır';

/** The note beside `poll` in Şekil 4.3. */
export const POLL_NOTE = 'Her aşama arasında önce process.nextTick, ardından Promise mikro görev kuyruğu boşaltılır.';

/** The book's sentence on `setTimeout(fn, 0)` and `setImmediate(fn)` (b04, after Şekil 4.3). */
export const IMMEDIATE_NOTE =
  "`setTimeout(fn, 0)` `timers`, `setImmediate(fn)` ise `check` aşamasında çalışır; bu iki çağrı ana modülde yazıldığında hangisinin önce çalışacağı süreç başlangıç gecikmesine bağlı olarak değişebilir, ancak bir G/Ç geri çağrısının içinde yazıldıklarında `setImmediate` her zaman önce çalışır.";
