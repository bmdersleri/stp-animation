import type { FlowGraphSpec } from '../../core/plot/flow-graph';

const node = (id: string, name: string, desc: string, x: number, y: number) => ({
  id,
  label: [name, desc],
  kind: 'phase' as const,
  x,
  y,
  w: 220,
  h: 64,
});

/** Şekil 4.3: the five phases of one event-loop turn, in the order they are visited. */
export const PHASES: FlowGraphSpec = {
  nodes: [
    node('timers', 'timers', 'süresi dolan setTimeout geri çağrıları', 300, 50),
    node('pending', 'pending callbacks', 'ertelenmiş sistem geri çağrıları', 560, 190),
    node('poll', 'poll', 'dosya ve ağ G/Ç olayları', 460, 400),
    node('check', 'check', 'setImmediate geri çağrıları', 140, 400),
    node('close', 'close callbacks', "kapanış olayları (sunucu.on('close'))", 40, 190),
  ],
  edges: [
    { id: 'timers-pending', from: 'timers', to: 'pending', kind: 'forward' },
    { id: 'pending-poll', from: 'pending', to: 'poll', kind: 'forward' },
    { id: 'poll-check', from: 'poll', to: 'check', kind: 'forward' },
    { id: 'check-close', from: 'check', to: 'close', kind: 'forward' },
    { id: 'close-timers', from: 'close', to: 'timers', kind: 'forward' },
  ],
};

/** The note beside `poll` in Şekil 4.3. */
export const POLL_NOTE = 'Her aşama arasında önce process.nextTick, ardından Promise mikro görev kuyruğu boşaltılır.';

/** The book's sentence on `setTimeout(fn, 0)` and `setImmediate(fn)` (b04, after Şekil 4.3). */
export const IMMEDIATE_NOTE =
  "`setTimeout(fn, 0)` `timers`, `setImmediate(fn)` ise `check` aşamasında çalışır; bu iki çağrı ana modülde yazıldığında hangisinin önce çalışacağı süreç başlangıç gecikmesine bağlı olarak değişebilir, ancak bir G/Ç geri çağrısının içinde yazıldıklarında `setImmediate` her zaman önce çalışır.";
