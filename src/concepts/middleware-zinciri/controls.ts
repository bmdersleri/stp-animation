import type { StepPlayer } from '../../core/player';
import type { Shortcut } from '../../core/keyboard';
import type { MwAnahtar, MwParams, MwYol } from './scenario';
import { mwIz } from './view';

let uid = 0;

const YOLLAR: readonly MwYol[] = ['/korumali-durum', '/baska', '/hata-ornegi'];
const ANAHTARLAR: readonly (readonly [MwAnahtar, string])[] = [
  ['gecerli', 'Geçerli anahtar'],
  ['yanlis', 'Yanlış anahtar'],
  ['yok', 'Anahtar yok'],
];
type Degisiklik = Partial<Pick<MwParams, 'yol' | 'anahtar' | 'gunlukNext' | 'kontrolGenel' | 'hataKatmani'>>;

const izUzunlugu = (p: MwParams): number => mwIz(p).olaylar.length;

/**
 * Any Lab change runs the book's Kod 5.5 (the two error programs have no switches) and shows its whole new
 * trace (`olay` = its length).
 */
function degistir(player: StepPlayer<MwParams>, patch: Degisiklik): void {
  const p: MwParams = { ...player.state.params, ...patch, program: 'kod-5-5' };
  player.setParams({ ...patch, program: 'kod-5-5', olay: izUzunlugu(p) });
}

/**
 * Mounts the Lab controls: path and key selects, three switches and the event slider. The slider's maximum follows
 * the trace; on the summary step all controls are disabled (the table is fixed).
 */
export function mountMwParams(host: HTMLElement, player: StepPlayer<MwParams>): void {
  const doc = host.ownerDocument;
  const prefix = `mw-params-${++uid}`;
  const wrap = doc.createElement('div');
  wrap.className = 'mw-params';
  host.append(wrap);

  const row = (cls: string, text: string, input: HTMLElement, checkFirst = false): HTMLDivElement => {
    const box = doc.createElement('div');
    box.className = `ctl ${cls}`;
    input.id = `${prefix}-${input.getAttribute('name')}`;
    const label = doc.createElement('label');
    label.className = 'ctl-label';
    label.htmlFor = input.id;
    label.textContent = text;
    box.append(...(checkFirst ? [input, label] : [label, input]));
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
  const check = (name: string): HTMLInputElement => {
    const c = doc.createElement('input');
    c.type = 'checkbox';
    c.name = name;
    return c;
  };

  const yol = select('yol', YOLLAR.map((y) => [y, y] as const));
  const anahtar = select('anahtar', ANAHTARLAR);
  const gunlukNext = check('gunlukNext');
  const kontrolGenel = check('kontrolGenel');
  const hataKatmani = check('hataKatmani');
  const olay = doc.createElement('input');
  olay.type = 'range';
  olay.name = 'olay';
  olay.min = '0';
  olay.step = '1';
  const olayOut = doc.createElement('output');
  olayOut.className = 'olay-deger';
  olayOut.htmlFor = `${prefix}-olay`;

  row('select', 'İstek yolu', yol);
  row('select', 'API anahtarı', anahtar);
  row('check', 'istekGunlugu next çağırsın', gunlukNext, true);
  row('check', 'Anahtar denetimi genel (use)', kontrolGenel, true);
  row('check', "Hata middleware'i tanımlı", hataKatmani, true);
  const olayRow = row('range', 'Gösterilen olay', olay);
  olayRow.append(olayOut);

  yol.addEventListener('change', () => degistir(player, { yol: yol.value as MwYol }));
  anahtar.addEventListener('change', () => degistir(player, { anahtar: anahtar.value as MwAnahtar }));
  gunlukNext.addEventListener('change', () => degistir(player, { gunlukNext: gunlukNext.checked }));
  kontrolGenel.addEventListener('change', () => degistir(player, { kontrolGenel: kontrolGenel.checked }));
  hataKatmani.addEventListener('change', () => degistir(player, { hataKatmani: hataKatmani.checked }));
  olay.addEventListener('input', () => player.setParam('olay', Number(olay.value)));

  const sync = (): void => {
    const { params: p } = player.state;
    const len = izUzunlugu(p);
    yol.value = p.yol;
    anahtar.value = p.anahtar;
    gunlukNext.checked = p.gunlukNext;
    kontrolGenel.checked = p.kontrolGenel;
    hataKatmani.checked = p.hataKatmani;
    olay.max = String(len);
    olay.value = String(Math.min(p.olay, len));
    olayOut.textContent = `${olay.value} / ${len}`;
    const off = p.gorunum === 'ozet';
    for (const c of [yol, anahtar, gunlukNext, kontrolGenel, hataKatmani, olay]) c.disabled = off;
  };
  sync();
  player.subscribe(sync);
}

/** Lab shortcuts: N toggles the logger's next call, [ and ] step the shown event. */
export function mwShortcuts(player: StepPlayer<MwParams>): Shortcut[] {
  const move = (d: number): void => {
    const p = player.state.params;
    player.setParam('olay', Math.max(0, Math.min(izUzunlugu(p), p.olay + d)));
  };
  return [
    {
      keys: ['n', 'N'],
      display: 'N',
      label: 'istekGunlugu next aç/kapa',
      run: () => degistir(player, { gunlukNext: !player.state.params.gunlukNext }),
    },
    { keys: ['['], display: '[', label: 'Bir olay geri', run: () => move(-1) },
    { keys: [']'], display: ']', label: 'Bir olay ileri', run: () => move(1) },
  ];
}
