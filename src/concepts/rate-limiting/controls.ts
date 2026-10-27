import type { Shortcut } from '../../core/keyboard';
import type { StepPlayer } from '../../core/player';
import { desenIstekleri, LOGIN_CAGRILARI, type Desen } from './desenler';
import { ELLE_SINIRI, TUMU, type RateParams } from './scenario';

let uid = 0;

/** The `login` pattern is Ders-only; `pencere` and `ayri-ip` belong to Ders steps 5 and 6. */
const DESENLER: readonly (readonly [Desen, string])[] = [
  ['kitap', 'Kitap: 5 istek aynı anda'],
  ['duzenli', 'Düzenli: 10 sn arayla'],
  ['sinir', 'Pencere sınırında patlama'],
  ['iki-ip', 'İki IP, saniyede bir'],
  ['elle', 'Elle: kendi isteklerim'],
];
const PENCERELER: readonly (readonly [string, string])[] = [['10', '10 s'], ['30', '30 s'], ['60', '60 s']];
const IP = '203.0.113.10';
/** Time step of the "+10 s" button, in ms. */
const ADIM_MS = 10_000;

/** The Lab's current time for the `elle` pattern, per player (it is Lab state, not part of the view). */
const SIMDI = new WeakMap<StepPlayer<RateParams>, { ms: number; dinle: Set<() => void> }>();
function zaman(player: StepPlayer<RateParams>): { ms: number; dinle: Set<() => void> } {
  let z = SIMDI.get(player);
  if (!z) SIMDI.set(player, (z = { ms: 0, dinle: new Set() }));
  return z;
}
const bildir = (player: StepPlayer<RateParams>): void => zaman(player).dinle.forEach((f) => f());

/**
 * A Lab change writes `patch`; the Lab always shows the flow, so an intro or summary step switches to it, every request
 * shows again, and the Ders-only `login` pattern (fixed settings) gives way to the book pattern.
 */
function degistir(player: StepPlayer<RateParams>, patch: Partial<RateParams>): void {
  const desen = patch.desen ?? player.state.params.desen;
  player.setParams({ ...patch, desen: desen === 'login' ? 'kitap' : desen, asama: 'akis', istek: TUMU });
}

/** Number of requests the current pattern plays. */
function istekSayisi(p: RateParams): number {
  if (p.desen === 'login') return LOGIN_CAGRILARI.length;
  if (p.desen === 'elle') return Math.min(p.elle.length, ELLE_SINIRI);
  return desenIstekleri(p.desen).length;
}

function gonder(player: StepPlayer<RateParams>): void {
  const p = player.state.params;
  if (p.desen === 'elle' && p.elle.length >= ELLE_SINIRI) return;
  const onceki = p.desen === 'elle' ? p.elle : [];
  degistir(player, { desen: 'elle', elle: [...onceki, { t: zaman(player).ms, ip: IP }] });
}

function ilerle(player: StepPlayer<RateParams>): void {
  zaman(player).ms += ADIM_MS;
  bildir(player);
}

function sifirla(player: StepPlayer<RateParams>): void {
  zaman(player).ms = 0;
  degistir(player, { desen: 'elle', elle: [] });
  bildir(player);
}

/** Mounts the Lab controls: limit slider, window select, pattern select and, for `elle`, the send / time / reset buttons. */
export function mountRateParams(host: HTMLElement, player: StepPlayer<RateParams>): void {
  const doc = host.ownerDocument;
  const prefix = `rate-params-${++uid}`;
  const wrap = doc.createElement('div');
  wrap.className = 'rate-params';
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
  const button = (text: string, onClick: () => void): HTMLButtonElement => {
    const b = doc.createElement('button');
    b.type = 'button';
    b.textContent = text;
    b.addEventListener('click', onClick);
    return b;
  };

  const maks = doc.createElement('input');
  maks.type = 'range';
  maks.name = 'maksimumIstek';
  maks.min = '1';
  maks.max = '10';
  maks.step = '1';
  const maksCikti = doc.createElement('output');
  maksCikti.className = 'ctl-value';
  row('En fazla istek', maks).append(maksCikti);
  const pencere = select('pencereSn', PENCERELER);
  row('Pencere süresi', pencere);
  const desen = select('desen', DESENLER);
  const yer = doc.createElement('option');
  yer.disabled = true;
  yer.hidden = true;
  desen.prepend(yer);
  row('İstek deseni', desen);

  const elleKutu = doc.createElement('div');
  elleKutu.className = 'elle-kutu';
  const gonderDugme = button('İstek gönder', () => gonder(player));
  gonderDugme.name = 'gonder';
  const ilerleDugme = button('+10 s', () => ilerle(player));
  ilerleDugme.name = 'ilerle';
  const sifirlaDugme = button('Sıfırla', () => sifirla(player));
  sifirlaDugme.name = 'sifirla';
  const simdi = doc.createElement('output');
  simdi.className = 'elle-simdi';
  elleKutu.append(gonderDugme, ilerleDugme, sifirlaDugme, simdi);
  wrap.append(elleKutu);

  maks.addEventListener('input', () => degistir(player, { maksimumIstek: Number(maks.value) }));
  pencere.addEventListener('change', () => degistir(player, { pencereSn: Number(pencere.value) as RateParams['pencereSn'] }));
  desen.addEventListener('change', () => degistir(player, { desen: desen.value as Desen }));

  const sync = (): void => {
    const p = player.state.params;
    maks.value = String(p.maksimumIstek);
    maksCikti.textContent = String(p.maksimumIstek);
    pencere.value = String(p.pencereSn);
    // a Ders-only pattern (pencere, ayri-ip, login) shows as a disabled placeholder option naming it
    const listede = DESENLER.some(([d]) => d === p.desen);
    yer.hidden = listede;
    yer.value = `ders:${p.desen}`;
    yer.textContent = `Ders deseni: ${p.desen}`;
    desen.value = listede ? p.desen : yer.value;
    elleKutu.hidden = p.desen !== 'elle';
    gonderDugme.disabled = p.elle.length >= ELLE_SINIRI;
    simdi.textContent = `Şimdi: ${zaman(player).ms / 1000} s · ${p.elle.length} / ${ELLE_SINIRI} istek`;
  };
  sync();
  player.subscribe(sync);
  zaman(player).dinle.add(sync);
}

/** Lab shortcuts: G sends a request at the current time, [ and ] move the shown request. */
export function rateShortcuts(player: StepPlayer<RateParams>): Shortcut[] {
  const move = (d: number): void => {
    const p = player.state.params;
    const n = istekSayisi(p);
    if (n === 0) return;
    const gorunen = Math.min(Math.max(p.istek, 1), n);
    player.setParams({ istek: Math.max(1, Math.min(n, gorunen + d)), asama: 'akis' });
  };
  return [
    { keys: ['g', 'G'], display: 'G', label: 'İstek gönder', run: () => gonder(player) },
    { keys: ['['], display: '[', label: 'Bir istek geri', run: () => move(-1) },
    { keys: [']'], display: ']', label: 'Bir istek ileri', run: () => move(1) },
  ];
}
