import type { StepPlayer } from '../../core/player';
import type { GovdeSecimi, IotParams } from './scenario';

let uid = 0;

const GOVDELER: readonly (readonly [GovdeSecimi, string])[] = [
  ['saglam', 'sağlam'], ['degismis', 'bir hane değişmiş'], ['bilinmeyen', 'bilinmeyen cihaz'],
];

/** A Lab change writes `patch`; the Lab always shows one request, so `asama` is `istek` and `tekrar` stays as set. */
function degistir(player: StepPlayer<IotParams>, patch: Partial<IotParams>): void {
  player.setParams({ ...patch, asama: 'istek' });
}

const sayi = (v: number, ondalik: number): string => v.toFixed(ondalik).replace('-', '−').replace('.', ',');

/** Mounts the Lab controls: device clock offset, temperature, humidity, body choice and the repeat switch. */
export function mountIotParams(host: HTMLElement, player: StepPlayer<IotParams>): void {
  const doc = host.ownerDocument;
  const prefix = `iot-params-${++uid}`;
  const wrap = doc.createElement('div');
  wrap.className = 'iot-params';
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

  const fark = slider('saatFarki', -120, 120, 1);
  const farkCikti = cikti();
  row('Cihaz saati − sunucu saati (s)', fark).append(farkCikti);
  const sicaklik = slider('sicaklik', -999, 120, 0.5);
  const sicaklikCikti = cikti();
  row('Sıcaklık (°C)', sicaklik).append(sicaklikCikti);
  const nem = slider('nem', -10, 110, 0.1);
  const nemCikti = cikti();
  row('Nem (%)', nem).append(nemCikti);
  const govde = doc.createElement('select');
  govde.name = 'govde';
  govde.replaceChildren(...GOVDELER.map(([value, text]) => {
    const o = doc.createElement('option');
    o.value = value;
    o.textContent = text;
    return o;
  }));
  row('Gövde', govde);
  const tekrar = doc.createElement('input');
  tekrar.type = 'checkbox';
  tekrar.name = 'tekrar';
  row('Aynı paketi 20 s sonra tekrar gönder', tekrar);

  fark.addEventListener('input', () => degistir(player, { saatFarki: Number(fark.value) }));
  sicaklik.addEventListener('input', () => degistir(player, { sicaklik: Number(sicaklik.value) }));
  nem.addEventListener('input', () => degistir(player, { nem: Number(nem.value) }));
  govde.addEventListener('change', () => degistir(player, { govde: govde.value as GovdeSecimi }));
  tekrar.addEventListener('change', () => degistir(player, { tekrar: tekrar.checked }));

  const sync = (): void => {
    const p = player.state.params;
    fark.value = String(p.saatFarki);
    farkCikti.textContent = `${p.saatFarki > 0 ? '+' : ''}${sayi(p.saatFarki, 0)} s`;
    sicaklik.value = String(p.sicaklik);
    sicaklikCikti.textContent = `${sayi(p.sicaklik, 1)} °C`;
    nem.value = String(p.nem);
    nemCikti.textContent = `%${sayi(p.nem, 1)}`;
    govde.value = p.govde;
    tekrar.checked = p.tekrar;
  };
  sync();
  player.subscribe(sync);
}
