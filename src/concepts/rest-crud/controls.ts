import type { StepPlayer } from '../../core/player';
import type { Shortcut } from '../../core/keyboard';
import type { ProgramId } from './api';
import { ISTEKLER, type IstekId } from './rota';
import { TUMU, type RestParams } from './scenario';
import { restSira } from './view';

let uid = 0;

const PROGRAMLAR: readonly (readonly [ProgramId, string])[] = [
  ['laboratuvar-api', 'LaboratuvarApi'],
  ['idempotentlik', 'Idempotentlik'],
];
const TEKRARLAR = ['1', '2', '3'] as const;

const sendCount = (p: RestParams): number => restSira(p).length;
/** The send the scene shows (1-based): `gonderim` clamped to the number of sends. */
const shown = (p: RestParams): number => Math.max(1, Math.min(sendCount(p), Math.trunc(p.gonderim) || 1));

/** A Lab change leaves the intro view for the flow view; the earlier requests are dropped and the last send is shown. */
function degistir(player: StepPlayer<RestParams>, patch: Partial<RestParams>): void {
  player.setParams({ ...patch, onceki: [], gonderim: TUMU, gorunum: 'akis' });
}

function programDegistir(player: StepPlayer<RestParams>, program: ProgramId): void {
  degistir(player, { program, istek: ISTEKLER[program][0].id });
}

/**
 * Mounts the Lab controls: program, request and repeat selects and the slider that picks which send the scene shows.
 * On the summary step all controls are disabled (the tables are fixed).
 */
export function mountRestParams(host: HTMLElement, player: StepPlayer<RestParams>): void {
  const doc = host.ownerDocument;
  const prefix = `rest-params-${++uid}`;
  const wrap = doc.createElement('div');
  wrap.className = 'rest-params';
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
  const select = (name: string): HTMLSelectElement => {
    const s = doc.createElement('select');
    s.name = name;
    return s;
  };
  const fill = (s: HTMLSelectElement, options: readonly (readonly [string, string])[]): void => {
    s.replaceChildren(
      ...options.map(([value, text]) => {
        const o = doc.createElement('option');
        o.value = value;
        o.textContent = text;
        return o;
      }),
    );
  };

  const program = select('program');
  fill(program, PROGRAMLAR);
  const istek = select('istek');
  const tekrar = select('tekrar');
  fill(tekrar, TEKRARLAR.map((t) => [t, t] as const));
  const gonderim = doc.createElement('input');
  gonderim.type = 'range';
  gonderim.name = 'gonderim';
  gonderim.min = '1';
  gonderim.step = '1';
  const out = doc.createElement('output');
  out.className = 'gonderim-deger';
  out.htmlFor = `${prefix}-gonderim`;

  row('select', 'Program', program);
  row('select', 'İstek', istek);
  row('select', 'Tekrar sayısı', tekrar);
  const gonderimRow = row('range', 'Gösterilen gönderim', gonderim);
  gonderimRow.append(out);

  program.addEventListener('change', () => programDegistir(player, program.value as ProgramId));
  istek.addEventListener('change', () => degistir(player, { istek: istek.value as IstekId }));
  tekrar.addEventListener('change', () => degistir(player, { tekrar: Number(tekrar.value) as RestParams['tekrar'] }));
  gonderim.addEventListener('input', () => player.setParams({ gonderim: Number(gonderim.value), gorunum: 'akis' }));

  let listed: ProgramId | null = null;
  const sync = (): void => {
    const { params: p } = player.state;
    if (listed !== p.program) {
      fill(istek, ISTEKLER[p.program].map((t) => [t.id, t.etiket] as const));
      listed = p.program;
    }
    program.value = p.program;
    istek.value = p.istek;
    tekrar.value = String(p.tekrar);
    const n = sendCount(p);
    gonderim.max = String(n);
    gonderim.value = String(shown(p));
    out.textContent = `${gonderim.value} / ${n}`;
    const off = p.gorunum === 'ozet';
    for (const c of [program, istek, tekrar, gonderim]) c.disabled = off;
  };
  sync();
  player.subscribe(sync);
}

/** Lab shortcuts: T cycles the repeat count 1 -> 2 -> 3 -> 1, [ and ] move the shown send. */
export function restShortcuts(player: StepPlayer<RestParams>): Shortcut[] {
  const move = (d: number): void => {
    const p = player.state.params;
    player.setParams({ gonderim: Math.max(1, Math.min(sendCount(p), shown(p) + d)), gorunum: 'akis' });
  };
  return [
    {
      keys: ['t', 'T'],
      display: 'T',
      label: 'Tekrar sayısını döndür',
      run: () => degistir(player, { tekrar: ((player.state.params.tekrar % 3) + 1) as RestParams['tekrar'] }),
    },
    { keys: ['['], display: '[', label: 'Bir gönderim geri', run: () => move(-1) },
    { keys: [']'], display: ']', label: 'Bir gönderim ileri', run: () => move(1) },
  ];
}
