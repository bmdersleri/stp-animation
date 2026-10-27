import { describe, expect, it } from 'vitest';
import { FRAME_LIMIT, simulate, type Op } from '../../../src/concepts/event-loop/sim';
import { PROGRAMS, PROGRAM_IDS, framesOf } from '../../../src/concepts/event-loop/programs';

const lastOutput = (id: Parameters<typeof framesOf>[0]): string[] => {
  const frames = framesOf(id);
  return frames[frames.length - 1].output;
};

// Book output blocks (b04 final.md) as literals.
const KOD_4_4_OUT = ['1. Sipariş alınmaya başlandı.', '2. Başka sipariş işleniyor.', '3. Zamanlayıcı tamamlandı.'];
const KOD_4_5_OUT = ['Hazırlık başlatıldı.', 'Mutfak başka siparişleri karşılıyor.', 'Sipariş hazır.'];
const CALLBACK = '() => coz("Sipariş hazır.")';

describe('event-loop programs', () => {
  it('kod-4-4 prints the book output', () => {
    expect(lastOutput('kod-4-4')).toEqual(KOD_4_4_OUT);
  });

  it('kod-4-4 timer runs at 1000 ms', () => {
    const frames = framesOf('kod-4-4');
    const f = frames.find((x) => x.output.length === 3)!;
    expect(f.clock).toBe(1000);
  });

  it('bitti-gec prints Bitti then Geç', () => {
    expect(lastOutput('bitti-gec')).toEqual(['Bitti', 'Geç']);
  });

  it('kod-4-5 prints the book output', () => {
    expect(lastOutput('kod-4-5')).toEqual(KOD_4_5_OUT);
  });

  it('kod-4-5 the continuation runs at 500 ms from the micro queue', () => {
    const frames = framesOf('kod-4-5');
    const done = frames.findIndex((f) => f.output.includes('Sipariş hazır.'));
    const queued = frames.findIndex((f) => f.micro.includes('mutfagiYonet devamı'));
    expect(queued).toBeGreaterThan(-1);
    expect(queued).toBeLessThan(done);
    expect(frames[done].clock).toBe(500);
    expect(frames.some((f) => f.stack.includes('mutfagiYonet devamı'))).toBe(true);
  });

  it('kod-4-5 await suspends the function', () => {
    const f = framesOf('kod-4-5').find((x) => x.note === 'await: fonksiyon askıya alındı')!;
    expect(f.stack).toEqual(['main']);
    expect(f.line).toBe(14);
    expect(f.output).toEqual(['Hazırlık başlatıldı.']);
    expect(f.timers).toEqual([{ label: CALLBACK, dueAt: 500 }]);
  });

  it('kod-4-5 follows the Node.js runtime model frame by frame', () => {
    const seq = framesOf('kod-4-5').map((f) => [f.clock, f.line, f.stack.join(' › ')]);
    expect(seq).toEqual([
      [0, 0, ''],
      [0, 18, 'main › mutfagiYonet'], // void mutfagiYonet();
      [0, 13, 'main › mutfagiYonet'], // console.log("Hazırlık başlatıldı.");
      [0, 14, 'main › mutfagiYonet › siparisHazirla'], // await siparisHazirla() calls it
      [0, 7, 'main › mutfagiYonet › siparisHazirla'], // return new Promise((coz) => {
      [0, 8, 'main › mutfagiYonet › siparisHazirla'], // setTimeout(() => coz("Sipariş hazır."), 500);
      [0, 14, 'main › mutfagiYonet'], // siparisHazirla returned the pending promise
      [0, 14, 'main'], // await suspended mutfagiYonet
      [0, 18, 'main'], // the main script goes on after the call
      [0, 19, 'main'], // console.log("Mutfak başka siparişleri karşılıyor.");
      [0, 19, ''],
      [500, 8, ''], // timer due: the callback waits in the macro queue
      [500, 8, CALLBACK], // the callback runs line 8
      [500, 8, CALLBACK], // coz(...) resolves the promise, the continuation goes to micro
      [500, 8, ''],
      [500, 14, 'mutfagiYonet devamı'], // resumes at the await
      [500, 15, 'mutfagiYonet devamı'], // console.log(sonucMesaji);
      [500, 15, ''],
    ]);
    const frames = framesOf('kod-4-5');
    expect(frames[5].timers).toEqual([{ label: CALLBACK, dueAt: 500 }]);
    expect(frames[11].macro).toEqual([CALLBACK]);
    expect(frames[13].micro).toEqual(['mutfagiYonet devamı']);
    expect(frames[16].output.at(-1)).toBe('Sipariş hazır.');
  });

  it('kod-4-5 siparisHazirla is on the stack only at t = 0, never at t = 500', () => {
    const frames = framesOf('kod-4-5');
    const at500 = frames.filter((f) => f.clock === 500);
    expect(at500.length).toBeGreaterThan(0);
    for (const f of at500) {
      expect(f.stack).not.toContain('siparisHazirla');
      expect([...f.timers.map((t) => t.label), ...f.macro, ...f.micro]).not.toContain('siparisHazirla');
    }
    expect(frames.filter((f) => f.stack.includes('siparisHazirla')).map((f) => f.line)).toEqual([14, 7, 8]);
    expect(frames.filter((f) => f.stack.includes(CALLBACK)).every((f) => f.clock === 500 && f.line === 8)).toBe(true);
  });

  it('await without a callee registers its timer on the await line', () => {
    const frames = simulate([
      { op: 'call', line: 1, name: 'f', body: [{ op: 'await', line: 2, ms: 10, label: 'cb', rest: [{ op: 'log', line: 3, text: 'x' }] }] },
    ]);
    expect(frames.some((f) => f.stack.length > 2)).toBe(false);
    expect(frames.find((f) => f.macro.includes('cb'))!.line).toBe(2);
    expect(frames.at(-1)!.output).toEqual(['x']);
  });

  it('mikro-makro prints Senkron, Promise, Zamanlayıcı', () => {
    expect(lastOutput('mikro-makro')).toEqual(['Senkron', 'Promise', 'Zamanlayıcı']);
  });

  it('engelleme runs the timer at 2000 ms with 1000 ms delay', () => {
    const f = framesOf('engelleme').find((x) => x.output.includes('Zamanlayıcı çalıştı.'))!;
    expect(f.clock).toBe(2000);
    expect(framesOf('engelleme').some((x) => x.note === 'gecikme: 1000 ms')).toBe(true);
    expect(lastOutput('engelleme')).toEqual(['Döngü bitti.', 'Zamanlayıcı çalıştı.']);
  });

  it('micro drains before any macro', () => {
    for (const id of PROGRAM_IDS) {
      const frames = framesOf(id);
      frames.forEach((f, i) => {
        if (i > 0 && f.macro.length > frames[i - 1].macro.length) expect(frames[i - 1].micro).toEqual([]);
        if (f.macro.length > 0) expect(f.micro).toEqual([]);
      });
    }
  });

  it('first frame is empty', () => {
    for (const id of PROGRAM_IDS) {
      expect(framesOf(id)[0]).toEqual({ clock: 0, line: 0, stack: [], timers: [], micro: [], macro: [], output: [] });
    }
  });

  it('ends with everything empty', () => {
    for (const id of PROGRAM_IDS) {
      const f = framesOf(id).at(-1)!;
      expect([f.stack, f.timers, f.micro, f.macro]).toEqual([[], [], [], []]);
    }
  });

  it('framesOf is memoised', () => {
    expect(framesOf('kod-4-4')).toBe(framesOf('kod-4-4'));
  });

  it('frame limit throws', () => {
    let ops: Op[] = [{ op: 'log', line: 1, text: 'x' }];
    for (let i = 0; i < 300; i++) ops = [{ op: 'timeout', line: 1, ms: 1, label: 't', body: ops }];
    expect(FRAME_LIMIT).toBe(200);
    expect(() => simulate(ops)).toThrow('simulate: kare sınırı');
  });

  it('await outside a call throws', () => {
    expect(() => simulate([{ op: 'await', line: 1, ms: 1, label: 'x', rest: [] }])).toThrow('simulate: await yalnız call içinde');
  });

  it('job pop frame keeps the line of the last op that ran', () => {
    const frames = framesOf('kod-4-4');
    const i = frames.findIndex((f) => f.output.length === 3);
    expect(frames[i].line).toBe(9);
    expect(frames[i + 1].stack).toEqual([]);
    expect(frames[i + 1].line).toBe(9);
  });

  it('code is verbatim', () => {
    expect(PROGRAMS['kod-4-4'].code[0]).toBe('// File: eventLoopSirasi.ts');
    expect(PROGRAMS['kod-4-5'].code).toContain('  const sonucMesaji = await siparisHazirla();');
    expect(PROGRAMS['bitti-gec'].code).toHaveLength(6);
    expect(PROGRAMS['bitti-gec'].code[0]).toBe("// Yanlış beklenti: Bu satır callback'ten önce çalışır.");
    expect(PROGRAMS['kod-4-4'].code).toHaveLength(12);
    expect(PROGRAMS['kod-4-5'].code).toHaveLength(19);
  });

  it('program metadata', () => {
    expect(PROGRAM_IDS).toEqual(['kod-4-4', 'bitti-gec', 'kod-4-5', 'mikro-makro', 'engelleme']);
    expect(PROGRAMS['bitti-gec'].file).toBe('b04-nodejs-runtime_code_008.ts');
    expect(PROGRAM_IDS.filter((id) => PROGRAMS[id].bookBased)).toEqual(['kod-4-4', 'bitti-gec', 'kod-4-5']);
  });

  it('every op line points into its code', () => {
    const check = (code: readonly string[], ops: readonly Op[]): void => {
      for (const o of ops) {
        expect(o.line).toBeGreaterThanOrEqual(1);
        expect(o.line).toBeLessThanOrEqual(code.length);
        const text = code[o.line - 1];
        switch (o.op) {
          case 'log':
            expect(text.includes(o.text) || /console\.log\(\w+\)/.test(text)).toBe(true);
            break;
          case 'timeout':
            expect(text).toContain('setTimeout');
            check(code, o.body);
            break;
          case 'then':
            expect(text).toContain('then');
            check(code, o.body);
            break;
          case 'call':
            expect(text).toContain(o.name);
            check(code, o.body);
            break;
          case 'await':
            expect(text).toContain('await');
            if (o.callee) {
              expect(text).toContain(o.callee.name);
              expect(code[o.callee.promiseLine - 1]).toContain('new Promise');
              expect(code[o.callee.timerLine - 1]).toContain('setTimeout');
              expect(code[o.callee.timerLine - 1]).toContain(o.label);
            }
            check(code, o.rest);
            break;
          case 'busy':
            expect(text).toContain('while');
            break;
        }
      }
    };
    for (const id of PROGRAM_IDS) check(PROGRAMS[id].code, PROGRAMS[id].ops);
  });
});
