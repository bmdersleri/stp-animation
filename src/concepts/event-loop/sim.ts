export type Op =
  | { op: 'log'; line: number; text: string }
  | { op: 'timeout'; line: number; ms: number; label: string; body: Op[] }
  | { op: 'then'; line: number; label: string; body: Op[] } // Promise.resolve().then(...)
  | { op: 'call'; line: number; name: string; body: Op[] } // push frame, run body, pop
  | AwaitOp
  | { op: 'busy'; line: number; ms: number; label: string }; // synchronous loop holding the stack

/**
 * `await` on a promise that a timer resolves after `ms`; `label` names the timer callback (the job that resolves the
 * promise), `rest` is the continuation queued on micro when it does. With `callee`, the awaited promise comes from a
 * call on `line`: the callee goes on the stack, runs `new Promise` on `promiseLine`, registers the timer on
 * `timerLine`, returns the pending promise and comes off the stack before the enclosing call is suspended.
 * Without `callee` the timer is registered on `line`.
 */
export interface AwaitOp {
  op: 'await';
  line: number;
  ms: number;
  label: string;
  rest: Op[];
  callee?: { name: string; promiseLine: number; timerLine: number };
}

export interface Frame {
  clock: number;
  line: number;
  stack: string[];
  timers: { label: string; dueAt: number }[];
  micro: string[];
  macro: string[];
  output: string[];
  note?: string;
}

export const FRAME_LIMIT = 200;

interface Job {
  label: string;
  line: number;
  body: Op[];
  /** Await timers: the continuation queued on micro when the timer callback resolves the promise. */
  resolves?: { label: string; line: number; rest: Op[] };
}
interface Timer extends Job {
  dueAt: number;
}

export function simulate(ops: readonly Op[]): Frame[] {
  const frames: Frame[] = [];
  let clock = 0;
  let line = 0;
  const stack: string[] = [];
  const timers: Timer[] = [];
  const micro: Job[] = [];
  const macro: Job[] = [];
  const output: string[] = [];
  let callDepth = 0; // await is only valid directly inside a call

  const emit = (atLine: number, note?: string): void => {
    line = atLine;
    const frame: Frame = {
      clock,
      line,
      stack: [...stack],
      timers: timers.map((t) => ({ label: t.label, dueAt: t.dueAt })),
      micro: micro.map((j) => j.label),
      macro: macro.map((j) => j.label),
      output: [...output],
    };
    if (note !== undefined) frame.note = note;
    frames.push(frame);
    if (frames.length > FRAME_LIMIT) throw new Error('simulate: kare sınırı');
  };

  /** Runs ops on the current stack. Returns true when an `await` suspended the enclosing call. */
  const run = (list: readonly Op[]): boolean => {
    for (const o of list) {
      switch (o.op) {
        case 'log':
          output.push(o.text);
          emit(o.line);
          break;
        case 'timeout':
          timers.push({ label: o.label, line: o.line, body: o.body, dueAt: clock + o.ms });
          emit(o.line);
          break;
        case 'then':
          micro.push({ label: o.label, line: o.line, body: o.body });
          emit(o.line);
          break;
        case 'call': {
          stack.push(o.name);
          emit(o.line);
          callDepth++;
          const suspended = run(o.body);
          callDepth--;
          if (!suspended) stack.pop(); // a suspended call already left the stack at its await
          emit(o.line); // the caller goes on from the call site
          break;
        }
        case 'await': {
          if (callDepth === 0) throw new Error('simulate: await yalnız call içinde');
          const callName = stack[stack.length - 1] ?? 'main';
          const timerLine = o.callee?.timerLine ?? o.line;
          if (o.callee) {
            stack.push(o.callee.name);
            emit(o.line);
            emit(o.callee.promiseLine);
          }
          timers.push({
            label: o.label,
            line: timerLine,
            body: [],
            dueAt: clock + o.ms,
            resolves: { label: `${callName} devamı`, line: o.line, rest: o.rest },
          });
          if (o.callee) {
            emit(timerLine);
            stack.pop(); // the callee returns the pending promise
            emit(o.line);
          }
          stack.pop();
          emit(o.line, 'await: fonksiyon askıya alındı');
          return true;
        }
        case 'busy':
          stack.push(o.label);
          emit(o.line, 'senkron döngü yığını tutuyor');
          clock += o.ms;
          emit(o.line, 'senkron döngü yığını tutuyor');
          stack.pop();
          break;
      }
    }
    return false;
  };

  // A job goes onto the stack, runs, and comes off again.
  const runJob = (job: Job, note?: string): void => {
    stack.push(job.label);
    emit(job.line, note);
    const outerDepth = callDepth;
    callDepth = 0;
    run(job.body);
    callDepth = outerDepth;
    if (job.resolves) {
      // the timer callback resolves the promise on its own line; the continuation resumes at the await
      micro.push({ label: job.resolves.label, line: job.resolves.line, body: job.resolves.rest });
      emit(job.line);
    }
    stack.pop();
    emit(line); // keep the line of the last op that ran in the job
  };

  emit(0);
  stack.push('main');
  run(ops);
  stack.pop();
  emit(line);

  while (micro.length > 0 || timers.length > 0) {
    if (micro.length > 0) {
      runJob(micro.shift()!);
      continue;
    }
    let next = 0;
    for (let i = 1; i < timers.length; i++) if (timers[i].dueAt < timers[next].dueAt) next = i;
    const timer = timers.splice(next, 1)[0];
    clock = Math.max(clock, timer.dueAt);
    macro.push(timer);
    emit(timer.line);
    macro.shift();
    const late = clock - timer.dueAt;
    runJob(timer, late > 0 ? `gecikme: ${late} ms` : undefined);
  }
  return frames;
}
