import type { StepPlayer } from '../../core/player';
import type { Shortcut } from '../../core/keyboard';
import { TUMU, type SqlParams } from './scenario';
import { SORGU_IDS, calistir, type SorguId } from './sql';

let uid = 0;

const SORGU_ETIKETI: Readonly<Record<SorguId, string>> = {
  kartezyen: 'JOIN koşulu yok (Kartezyen)',
  inner: 'INNER JOIN',
  left: 'LEFT JOIN',
  'is-null': 'LEFT JOIN + IS NULL',
  'where-tuzagi': 'LEFT JOIN + WHERE (tuzak)',
  'on-filtre': 'LEFT JOIN + ON içinde filtre',
  parametreli: 'Parametreli sorgu ($1)',
};
const DEGERLER = ['1', '2', '3'] as const;

/** The number of row pairs the chosen query walks. */
const ciftSayisi = (p: SqlParams): number => calistir(p.sorgu, p.deger).adimlar.length;
/** The pair the scene shows (0..n): `cift` clamped, TUMU meaning the end. */
const gosterilen = (p: SqlParams): number => Math.max(0, Math.min(ciftSayisi(p), Math.trunc(p.cift) || 0));

/**
 * Mounts the Lab controls: the query select, the `$1` select (parametreli only) and the slider that picks how many
 * row pairs of the nested loop the scene has walked. Choosing a query leaves the intro views and shows the whole result.
 */
export function mountSqlParams(host: HTMLElement, player: StepPlayer<SqlParams>): void {
  const doc = host.ownerDocument;
  const prefix = `sql-params-${++uid}`;
  const wrap = doc.createElement('div');
  wrap.className = 'sql-params';
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
  const select = (name: string, options: readonly (readonly [string, string])[]): HTMLSelectElement => {
    const s = doc.createElement('select');
    s.name = name;
    s.replaceChildren(
      ...options.map(([value, text]) => {
        const o = doc.createElement('option');
        o.value = value;
        o.textContent = text;
        return o;
      }),
    );
    return s;
  };

  const sorgu = select('sorgu', SORGU_IDS.map((id) => [id, SORGU_ETIKETI[id]] as const));
  const deger = select('deger', DEGERLER.map((d) => [d, d] as const));
  const cift = doc.createElement('input');
  cift.type = 'range';
  cift.name = 'cift';
  cift.min = '0';
  cift.step = '1';
  const out = doc.createElement('output');
  out.className = 'cift-deger';
  out.htmlFor = `${prefix}-cift`;

  row('select', 'Sorgu', sorgu);
  row('select', 'Parametre $1', deger);
  const ciftRow = row('range', 'Sınanan satır çifti', cift);
  ciftRow.append(out);

  sorgu.addEventListener('change', () => player.setParams({ sorgu: sorgu.value as SorguId, cift: TUMU, gorunum: 'sorgu' }));
  deger.addEventListener('change', () => player.setParams({ deger: Number(deger.value) as SqlParams['deger'], cift: TUMU, gorunum: 'sorgu' }));
  cift.addEventListener('input', () => player.setParams({ cift: Number(cift.value), gorunum: 'sorgu' }));

  const sync = (): void => {
    const { params: p } = player.state;
    sorgu.value = p.sorgu;
    deger.value = String(p.deger);
    deger.disabled = p.sorgu !== 'parametreli';
    const n = ciftSayisi(p);
    cift.max = String(n);
    cift.value = String(gosterilen(p));
    out.textContent = `${cift.value} / ${n}`;
    const off = p.gorunum === 'ozet';
    sorgu.disabled = off;
    cift.disabled = off;
    if (off) deger.disabled = true;
  };
  sync();
  player.subscribe(sync);
}

/** Lab shortcuts: [ and ] move the pair slider one pair back / forward. */
export function sqlShortcuts(player: StepPlayer<SqlParams>): Shortcut[] {
  const move = (d: number): void => {
    const p = player.state.params;
    player.setParams({ cift: Math.max(0, Math.min(ciftSayisi(p), gosterilen(p) + d)), gorunum: 'sorgu' });
  };
  return [
    { keys: ['['], display: '[', label: 'Bir çift geri', run: () => move(-1) },
    { keys: [']'], display: ']', label: 'Bir çift ileri', run: () => move(1) },
  ];
}
