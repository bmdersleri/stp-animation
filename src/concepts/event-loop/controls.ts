import type { StepPlayer } from '../../core/player';
import type { Shortcut } from '../../core/keyboard';
import { PROGRAMS, PROGRAM_IDS, framesOf, type ProgramId } from './programs';
import type { LoopParams } from './scenario';

let uid = 0;

const lastFrame = (id: ProgramId): number => framesOf(id).length - 1;

/**
 * Mounts the Lab controls: program select and the frame slider (`kare`). Choosing another program starts it at
 * frame 0; the slider's maximum follows the program.
 */
export function mountLoopParams(host: HTMLElement, player: StepPlayer<LoopParams>): void {
  const doc = host.ownerDocument;
  const prefix = `loop-params-${++uid}`;
  const wrap = doc.createElement('div');
  wrap.className = 'loop-params';
  host.append(wrap);

  const row = (cls: string, text: string, input: HTMLElement): HTMLDivElement => {
    const box = doc.createElement('div');
    box.className = `ctl ${cls}`;
    input.id = `${prefix}-${input.getAttribute('name')}`;
    const label = doc.createElement('label');
    label.className = 'ctl-label';
    label.htmlFor = input.id;
    label.textContent = text;
    box.append(label, input);
    wrap.append(box);
    return box;
  };

  const program = doc.createElement('select');
  program.name = 'program';
  program.replaceChildren(
    ...PROGRAM_IDS.map((id) => {
      const o = doc.createElement('option');
      o.value = id;
      o.textContent = PROGRAMS[id].title;
      return o;
    }),
  );
  const kare = doc.createElement('input');
  kare.type = 'range';
  kare.name = 'kare';
  kare.min = '0';
  kare.step = '1';
  const out = doc.createElement('output');
  out.className = 'kare-deger';
  out.htmlFor = `${prefix}-kare`;

  row('select', 'Program', program);
  const kareRow = row('range', 'Gösterilen kare', kare);
  kareRow.append(out);

  program.addEventListener('change', () => player.setParams({ program: program.value as ProgramId, kare: 0 }));
  kare.addEventListener('input', () => player.setParam('kare', Number(kare.value)));

  const sync = (): void => {
    const { params: p } = player.state;
    const last = lastFrame(p.program);
    program.value = p.program;
    kare.max = String(last);
    kare.value = String(Math.min(p.kare, last));
    out.textContent = `${kare.value} / ${last}`;
  };
  sync();
  player.subscribe(sync);
}

/** Lab shortcuts: [ and ] step the shown frame. */
export function loopShortcuts(player: StepPlayer<LoopParams>): Shortcut[] {
  const move = (d: number): void => {
    const { program, kare } = player.state.params;
    player.setParam('kare', Math.max(0, Math.min(lastFrame(program), kare + d)));
  };
  return [
    { keys: ['['], display: '[', label: 'Bir kare geri', run: () => move(-1) },
    { keys: [']'], display: ']', label: 'Bir kare ileri', run: () => move(1) },
  ];
}
