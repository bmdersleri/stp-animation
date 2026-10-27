import { describe, expect, it } from 'vitest';
import { StepPlayer } from '../../../src/core/player';
import { PROGRAMS, PROGRAM_IDS, framesOf } from '../../../src/concepts/event-loop/programs';
import { IMMEDIATE_NOTE, PHASES, POLL_NOTE } from '../../../src/concepts/event-loop/phases';
import { loopScenario } from '../../../src/concepts/event-loop/scenario';
import { deriveLoopView, type LoopParams } from '../../../src/concepts/event-loop/view';

const base: LoopParams = { program: 'kod-4-4', kare: 0, gorunum: 'tahta' };

describe('event-loop view', () => {
  it('kare is clamped and resets on program change', () => {
    const v = deriveLoopView({ ...base, kare: 999 });
    expect(v.kare).toBe(v.kareCount - 1);
    expect(v.kareCount).toBe(framesOf('kod-4-4').length);
    expect(v.frame).toBe(framesOf('kod-4-4')[v.kareCount - 1]);
    expect(deriveLoopView({ ...base, kare: -5 }).kare).toBe(0);
    const p = new StepPlayer(loopScenario);
    p.goto(4);
    p.goto(5);
    const s = p.state.params;
    expect(s.program).toBe('bitti-gec');
    expect(s.kare).toBeLessThan(framesOf('bitti-gec').length);
    expect(deriveLoopView(s).kare).toBe(s.kare);
  });

  it('book-based programs carry no note, the two built ones do', () => {
    for (const id of PROGRAM_IDS) {
      const v = deriveLoopView({ ...base, program: id });
      if (PROGRAMS[id].bookBased) expect(v.bookNote).toBeNull();
      else expect(v.bookNote).toMatch(/^Kitabın şu cümlesine dayalı örnek: /);
    }
    expect(deriveLoopView({ ...base, program: 'mikro-makro' }).bookNote).toContain('mikro görev kuyruğunun');
    expect(deriveLoopView({ ...base, program: 'engelleme' }).bookNote).toContain('CPU’yu uzun süre meşgul eden senkron kod');
  });

  it('asamalar shows five phases with poll current and both notes', () => {
    const v = deriveLoopView({ ...base, program: 'mikro-makro', gorunum: 'asamalar' });
    expect(v.phases?.nodes.map((n) => n.id)).toEqual(['timers', 'pending', 'poll', 'check', 'close']);
    expect(v.phases?.current).toBe('poll');
    expect(v.notes).toEqual([POLL_NOTE, IMMEDIATE_NOTE]);
    const t = deriveLoopView(base);
    expect(t.phases).toBeNull();
    expect(PHASES.edges.map((e) => `${e.from}>${e.to}`)).toEqual(['timers>pending', 'pending>poll', 'poll>check', 'check>close', 'close>timers']);
  });

  it('phase notes quote the book', () => {
    expect(POLL_NOTE).toBe('Her aşama arasında önce process.nextTick, ardından Promise mikro görev kuyruğu boşaltılır.');
    expect(IMMEDIATE_NOTE.startsWith('`setTimeout(fn, 0)` `timers`')).toBe(true);
    expect(IMMEDIATE_NOTE.endsWith('her zaman önce çalışır.')).toBe(true);
  });

  it('frame note is shown on the board', () => {
    const i = framesOf('engelleme').findIndex((f) => f.note !== undefined);
    const v = deriveLoopView({ program: 'engelleme', kare: i, gorunum: 'tahta' });
    expect(v.notes).toEqual([framesOf('engelleme')[i].note]);
    expect(deriveLoopView(base).notes).toEqual([]);
  });

  it('code highlights the frame line', () => {
    expect(deriveLoopView(base).code.active).toEqual([]);
    const i = framesOf('kod-4-4').findIndex((f) => f.line === 8);
    const v = deriveLoopView({ ...base, kare: i });
    expect(v.code.active).toEqual([8]);
    expect(v.code.lines).toBe(PROGRAMS['kod-4-4'].code);
    expect(v.code.title).toBe('eventLoopSirasi.ts');
  });
});
