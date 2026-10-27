import { describe, expect, it } from 'vitest';
import { StepPlayer } from '../../../src/core/player';
import { framesOf } from '../../../src/concepts/event-loop/programs';
import { findFrame, loopScenario as sc } from '../../../src/concepts/event-loop/scenario';
import { labTextTests } from '../lab-text';

const IDS = ['tanitim', 'senkron', 'zamanlayici', 'devam', 'callback', 'sifir', 'await', 'cozuldu', 'mikro-once', 'asamalar', 'engelleme'];

function at(n: number) {
  const p = new StepPlayer(sc);
  p.goto(n - 1);
  return p.state.params;
}

describe('event-loop scenario', () => {
  it('has the eleven steps in order', () => {
    expect(sc.steps.map((s) => s.id)).toEqual(IDS);
    expect(sc.defaults).toEqual({ program: 'kod-4-4', kare: 0, gorunum: 'tahta' });
  });

  it('findFrame returns the first match and throws when none', () => {
    expect(findFrame('kod-4-4', (f) => f.output.length === 1)).toBe(framesOf('kod-4-4').findIndex((f) => f.output.length === 1));
    expect(() => findFrame('kod-4-4', (f) => f.output.length === 99)).toThrow();
  });

  it('kare values resolve from the frames', () => {
    const last = (id: Parameters<typeof framesOf>[0]) => framesOf(id).length - 1;
    expect(at(1)).toMatchObject({ program: 'kod-4-4', kare: 0 });
    expect(framesOf('kod-4-4')[at(2).kare].output).toHaveLength(1);
    expect(framesOf('kod-4-4')[at(3).kare].timers).toHaveLength(1);
    expect(framesOf('kod-4-4')[at(4).kare].output).toHaveLength(2);
    expect(at(5).kare).toBe(last('kod-4-4'));
    expect(at(6)).toMatchObject({ program: 'bitti-gec', kare: last('bitti-gec') });
    expect(framesOf('kod-4-5')[at(7).kare].output).toHaveLength(2);
    expect(at(8)).toMatchObject({ program: 'kod-4-5', kare: last('kod-4-5') });
    expect(at(9)).toMatchObject({ program: 'mikro-makro', kare: last('mikro-makro') });
  });

  it('step 5 resolves to a frame with 3 output lines', () => {
    const p = at(5);
    expect(framesOf(p.program)[p.kare].output).toHaveLength(3);
  });

  it('step 6 after step 5 stays within the bitti-gec frames', () => {
    const p = at(6);
    expect(p.kare).toBeLessThan(framesOf('bitti-gec').length);
  });

  it('step 10 shows the phases on mikro-makro, step 11 returns to the board on engelleme', () => {
    expect(at(10)).toMatchObject({ program: 'mikro-makro', gorunum: 'asamalar' });
    expect(at(11)).toMatchObject({ program: 'engelleme', gorunum: 'tahta', kare: framesOf('engelleme').length - 1 });
  });

  labTextTests(sc.steps, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
});
