import type { StepPlayer } from '../../core/player';
import type { Shortcut } from '../../core/keyboard';
import { notSorgula, YOLLAR } from './flow';
import type { IstekParams } from './scenario';

let uid = 0;

const izUzunlugu = (yol: string, yetkiliMi: boolean): number => notSorgula(yol, yetkiliMi).olaylar.length;

/**
 * Mounts the Lab controls: path select, "yetkili" checkbox and the event slider. Changing the path or the
 * authorization shows the whole new trace (`olay` = its length); the slider's maximum follows the trace.
 */
export function mountIstekParams(host: HTMLElement, player: StepPlayer<IstekParams>): void {
  const doc = host.ownerDocument;
  const prefix = `istek-params-${++uid}`;
  const wrap = doc.createElement('div');
  wrap.className = 'istek-params';
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

  const yol = doc.createElement('select');
  yol.name = 'yol';
  yol.replaceChildren(
    ...YOLLAR.map((y) => {
      const o = doc.createElement('option');
      o.value = y;
      o.textContent = y;
      return o;
    }),
  );
  const yetki = doc.createElement('input');
  yetki.type = 'checkbox';
  yetki.name = 'yetkiliMi';
  const olay = doc.createElement('input');
  olay.type = 'range';
  olay.name = 'olay';
  olay.min = '0';
  olay.step = '1';
  const olayOut = doc.createElement('output');
  olayOut.className = 'olay-deger';
  olayOut.htmlFor = `${prefix}-olay`;

  row('select', 'İstek yolu', yol);
  row('check', 'Kullanıcı yetkili', yetki, true);
  const olayRow = row('range', 'Gösterilen olay', olay);
  olayRow.append(olayOut);

  const newTrace = (patch: Partial<Pick<IstekParams, 'yol' | 'yetkiliMi'>>): void => {
    const p = { ...player.state.params, ...patch };
    player.setParams({ ...patch, olay: izUzunlugu(p.yol, p.yetkiliMi) });
  };
  yol.addEventListener('change', () => newTrace({ yol: yol.value }));
  yetki.addEventListener('change', () => newTrace({ yetkiliMi: yetki.checked }));
  olay.addEventListener('input', () => player.setParam('olay', Number(olay.value)));

  const sync = (): void => {
    const { params: p } = player.state;
    const len = izUzunlugu(p.yol, p.yetkiliMi);
    yol.value = p.yol;
    yetki.checked = p.yetkiliMi;
    olay.max = String(len);
    olay.value = String(Math.min(p.olay, len));
    olayOut.textContent = `${olay.value} / ${len}`;
    // the summary step shows the book's three calls whatever is chosen here
    const off = p.gorunum === 'ozet';
    for (const c of [yol, yetki, olay]) c.disabled = off;
  };
  sync();
  player.subscribe(sync);
}

/** Lab shortcuts: Y toggles authorization, [ and ] step the shown event. */
export function istekShortcuts(player: StepPlayer<IstekParams>): Shortcut[] {
  const move = (d: number): void => {
    const { yol, yetkiliMi, olay } = player.state.params;
    player.setParam('olay', Math.max(0, Math.min(izUzunlugu(yol, yetkiliMi), olay + d)));
  };
  return [
    {
      keys: ['y', 'Y'],
      display: 'Y',
      label: 'Yetkiyi aç / kapat',
      run: () => {
        const { yol, yetkiliMi } = player.state.params;
        player.setParams({ yetkiliMi: !yetkiliMi, olay: izUzunlugu(yol, !yetkiliMi) });
      },
    },
    { keys: ['['], display: '[', label: 'Bir olay geri', run: () => move(-1) },
    { keys: [']'], display: ']', label: 'Bir olay ileri', run: () => move(1) },
  ];
}
