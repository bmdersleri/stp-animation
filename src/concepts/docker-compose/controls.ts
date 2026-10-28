import type { StepPlayer } from '../../core/player';
import { saniyeEtiketi } from './compose';
import type { ComposeParams } from './scenario';

let uid = 0;

const MODLAR: readonly (readonly [ComposeParams['mod'], string])[] = [
  ['sira', 'depends_on (sıra)'],
  ['saglikli', 'service_healthy'],
];
const HOSTLAR: readonly (readonly [ComposeParams['hostAdi'], string])[] = [
  ['kutuphane-db', 'kutuphane-db'],
  ['localhost', 'localhost'],
];

/** A Lab change writes `patch`; the Lab always shows the start flow, so `asama` is `compose`. */
function degistir(player: StepPlayer<ComposeParams>, patch: Partial<ComposeParams>): void {
  player.setParams({ ...patch, asama: 'compose' });
}

/** Mounts the Lab controls: database ready time, start mode, probe retries, attempt limit and host name. */
export function mountComposeParams(host: HTMLElement, player: StepPlayer<ComposeParams>): void {
  const doc = host.ownerDocument;
  const prefix = `compose-params-${++uid}`;
  const wrap = doc.createElement('div');
  wrap.className = 'compose-params';
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
  const select = (name: string, options: readonly (readonly [string, string])[]): HTMLSelectElement => {
    const s = doc.createElement('select');
    s.name = name;
    s.replaceChildren(...options.map(([value, text]) => {
      const o = doc.createElement('option');
      o.value = value;
      o.textContent = text;
      return o;
    }));
    return s;
  };
  const range = (name: string, min: number, max: number, step: number): HTMLInputElement => {
    const r = doc.createElement('input');
    r.type = 'range';
    r.name = name;
    r.min = String(min);
    r.max = String(max);
    r.step = String(step);
    return r;
  };
  const cikti = (): HTMLOutputElement => {
    const o = doc.createElement('output');
    o.className = 'ctl-value';
    return o;
  };

  const db = range('dbHazirMs', 0, 30_000, 500);
  const dbCikti = cikti();
  row('Veritabanı hazır olma süresi', db).append(dbCikti);
  const mod = select('mod', MODLAR);
  row('Başlatma modu', mod);
  const retries = range('retries', 1, 10, 1);
  const retriesCikti = cikti();
  const retriesKutu = row('Prob deneme hakkı (retries)', retries);
  retriesKutu.append(retriesCikti);
  const maks = range('maksimumDeneme', 1, 10, 1);
  const maksCikti = cikti();
  row('En fazla bağlantı denemesi', maks).append(maksCikti);
  const hostAdi = select('hostAdi', HOSTLAR);
  row('Veritabanı host adı', hostAdi);

  db.addEventListener('input', () => degistir(player, { dbHazirMs: Number(db.value) }));
  mod.addEventListener('change', () => degistir(player, { mod: mod.value as ComposeParams['mod'] }));
  retries.addEventListener('input', () => degistir(player, { retries: Number(retries.value) }));
  maks.addEventListener('input', () => degistir(player, { maksimumDeneme: Number(maks.value) }));
  hostAdi.addEventListener('change', () => degistir(player, { hostAdi: hostAdi.value as ComposeParams['hostAdi'] }));

  const sync = (): void => {
    const p = player.state.params;
    db.value = String(p.dbHazirMs);
    dbCikti.textContent = saniyeEtiketi(p.dbHazirMs);
    mod.value = p.mod;
    retries.value = String(p.retries);
    retriesCikti.textContent = String(p.retries);
    retriesKutu.hidden = p.mod !== 'saglikli';
    maks.value = String(p.maksimumDeneme);
    maksCikti.textContent = String(p.maksimumDeneme);
    hostAdi.value = p.hostAdi;
  };
  sync();
  player.subscribe(sync);
}
