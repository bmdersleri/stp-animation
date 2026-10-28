import type { StepPlayer } from '../../core/player';
import type { Senaryo, TimeoutParams } from './scenario';

let uid = 0;

const SENARYOLAR: readonly (readonly [Senaryo, string])[] = [
  ['hizli', 'hızlı servis'], ['yavas', 'yavaş servis'], ['gecici', 'geçici yavaşlık'],
  ['http-500', 'HTTP 500'], ['bos-ozet', 'boş özet'], ['bozuk-govde', 'bozuk gövde'],
];
const TABANLAR = [0, 500, 1000, 2000];

/** A Lab change writes `patch`; the Lab always runs one request of Kod 17.5, whatever step it came from. */
function degistir(player: StepPlayer<TimeoutParams>, patch: Partial<TimeoutParams>): void {
  player.setParams({ ...patch, asama: 'akis', surum: '17.5' });
}

/** Mounts the Lab controls: timeout, scenario, retry count, wait base and (slow scenarios only) the service delay. */
export function mountTimeoutParams(host: HTMLElement, player: StepPlayer<TimeoutParams>): void {
  const doc = host.ownerDocument;
  const prefix = `timeout-params-${++uid}`;
  const wrap = doc.createElement('div');
  wrap.className = 'timeout-params';
  host.append(wrap);

  const row = (text: string, input: HTMLElement): HTMLDivElement => {
    const box = doc.createElement('div');
    box.className = 'ctl';
    input.id = `${prefix}-${input.getAttribute('name')}`;
    const label = doc.createElement('label');
    label.className = 'ctl-label';
    label.htmlFor = input.id;
    label.textContent = text;
    box.append(label, input);
    wrap.append(box);
    return box;
  };
  const slider = (name: string, min: number, max: number, step: number): HTMLInputElement => {
    const i = doc.createElement('input');
    i.type = 'range';
    i.name = name;
    i.min = String(min);
    i.max = String(max);
    i.step = String(step);
    return i;
  };
  const cikti = (): HTMLOutputElement => {
    const o = doc.createElement('output');
    o.className = 'ctl-value';
    return o;
  };
  const secim = (name: string, secenekler: readonly (readonly [string, string])[]): HTMLSelectElement => {
    const s = doc.createElement('select');
    s.name = name;
    s.replaceChildren(...secenekler.map(([value, text]) => {
      const o = doc.createElement('option');
      o.value = value;
      o.textContent = text;
      return o;
    }));
    return s;
  };

  const asim = slider('zamanAsimiMs', 1000, 10_000, 500);
  const asimCikti = cikti();
  row('Zaman aşımı (ms)', asim).append(asimCikti);
  const senaryo = secim('senaryo', SENARYOLAR);
  row('Servis senaryosu', senaryo);
  const retry = slider('maksRetry', 0, 3, 1);
  const retryCikti = cikti();
  row('En çok yeniden deneme', retry).append(retryCikti);
  const taban = secim('beklemeTabanMs', TABANLAR.map((t) => [String(t), `${t} ms`] as const));
  row('Bekleme tabanı', taban);
  const gecikme = slider('servisGecikmesiMs', 500, 12_000, 500);
  const gecikmeCikti = cikti();
  const gecikmeKutu = row('Servis gecikmesi (ms)', gecikme);
  gecikmeKutu.append(gecikmeCikti);

  asim.addEventListener('input', () => degistir(player, { zamanAsimiMs: Number(asim.value) }));
  senaryo.addEventListener('change', () => degistir(player, { senaryo: senaryo.value as Senaryo }));
  retry.addEventListener('input', () => degistir(player, { maksRetry: Number(retry.value) }));
  taban.addEventListener('change', () => degistir(player, { beklemeTabanMs: Number(taban.value) }));
  gecikme.addEventListener('input', () => degistir(player, { servisGecikmesiMs: Number(gecikme.value) }));

  const sync = (): void => {
    const p = player.state.params;
    asim.value = String(p.zamanAsimiMs);
    asimCikti.textContent = `${p.zamanAsimiMs} ms`;
    senaryo.value = p.senaryo;
    retry.value = String(p.maksRetry);
    retryCikti.textContent = String(p.maksRetry);
    taban.value = String(p.beklemeTabanMs);
    gecikme.value = String(p.servisGecikmesiMs);
    gecikmeCikti.textContent = `${p.servisGecikmesiMs} ms`;
    // only the slow scenarios use the slow leg; the others answer in 1200 ms
    gecikmeKutu.hidden = p.senaryo !== 'yavas' && p.senaryo !== 'gecici';
  };
  sync();
  player.subscribe(sync);
}
