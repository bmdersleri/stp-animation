import type { CodeTraceSpec } from '../../core/plot/code-trace';
import type { FlowGraphSpec } from '../../core/plot/flow-graph';
import { IMMEDIATE_NOTE, PHASES, POLL_NOTE } from './phases';
import { PROGRAMS, framesOf, type Program, type ProgramId } from './programs';
import type { LoopParams } from './scenario';
import type { Frame } from './sim';

export type { LoopParams } from './scenario';

export interface LoopView {
  program: Program;
  frame: Frame;
  kare: number;
  kareCount: number;
  code: CodeTraceSpec;
  bookNote: string | null;
  phases: FlowGraphSpec | null;
  notes: string[];
}

/** The book sentence a built (not book-listed) program rests on. */
const BOOK_SENTENCE: Partial<Record<ProgramId, string>> = {
  'mikro-makro':
    "Bu sıralamanın kesin olarak anlaşılması (mikro görev kuyruğunun -Promise callback'leri- her zaman makro görev kuyruğundan -timer, G/Ç- önce boşaltılması gibi), Node.js'te asenkron kodun çalışma sırasını doğru tahmin edebilmenin kuramsal anahtarıdır.",
  engelleme: 'Ancak event loop sihirli değildir: CPU’yu uzun süre meşgul eden senkron kod, diğer callback’lerin çalışmasını geciktirir.',
};

/** Everything the scene draws for one parameter set; no DOM. */
export function deriveLoopView(p: LoopParams): LoopView {
  const program = PROGRAMS[p.program];
  const frames = framesOf(p.program);
  const kare = Math.max(0, Math.min(frames.length - 1, Math.trunc(p.kare) || 0));
  const frame = frames[kare];
  const sentence = BOOK_SENTENCE[p.program];
  const asamalar = p.gorunum === 'asamalar';
  return {
    program,
    frame,
    kare,
    kareCount: frames.length,
    code: { title: program.file, lines: program.code, active: frame.line > 0 ? [frame.line] : [] },
    bookNote: !program.bookBased && sentence ? `Kitabın şu cümlesine dayalı örnek: ${sentence}` : null,
    phases: asamalar ? { ...PHASES, current: 'poll' } : null,
    notes: asamalar ? [POLL_NOTE, IMMEDIATE_NOTE] : frame.note !== undefined ? [frame.note] : [],
  };
}
