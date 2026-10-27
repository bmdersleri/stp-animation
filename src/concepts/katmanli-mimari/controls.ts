import type { StepPlayer } from '../../core/player';
import type { Shortcut } from '../../core/keyboard';
import type { KatmanParams } from './scenario';
import { deriveKatmanView } from './view';

let uid = 0;

const OGRENCILER: readonly (readonly [string, string])[] = [
  ['2024001', '2024001'],
  ['2024999', '2024999 (kayıtlı değil)'],
  ['', '(boş)'],
];
const KITAPLAR: readonly (readonly [string, string])[] = [
  ['JAVA-101', 'JAVA-101'],
  ['TS-201', 'TS-201 (kayıtlı değil)'],
  ['', '(boş)'],
];
const ODUNC: readonly (readonly [string, string])[] = [0, 1, 2, 3].map((n) => [String(n), String(n)] as const);
const TEKRARLAR: readonly (readonly [string, string])[] = [
  ['1', '1'],
  ['2', '2'],
];

/** Number of trace events the request with these parameters produces. */
function izUzunlugu(p: KatmanParams): number {
  return deriveKatmanView({ ...p, gorunum: 'akis', olay: Number.MAX_SAFE_INTEGER }).sequence.messages.length;
}

/** Events the scene shows: `olay` clamped to the trace. */
const shown = (p: KatmanParams): number => Math.max(0, Math.min(izUzunlugu(p), Math.trunc(p.olay) || 0));

/** A Lab change leaves the intro views for the flow view and shows the whole trace of the new request. */
function degistir(player: StepPlayer<KatmanParams>, patch: Partial<KatmanParams>): void {
  const next: KatmanParams = { ...player.state.params, ...patch, gorunum: 'akis' };
  player.setParams({ ...patch, gorunum: 'akis', olay: izUzunlugu(next) });
}

/**
 * Mounts the Lab controls: student, book, starting data, repeat and the slider that picks how many trace events the
 * scene shows.
 */
export function mountKatmanParams(host: HTMLElement, player: StepPlayer<KatmanParams>): void {
  const doc = host.ownerDocument;
  const prefix = `katman-params-${++uid}`;
  const wrap = doc.createElement('div');
  wrap.className = 'katman-params';
  host.append(wrap);

  const row = (cls: string, text: string, input: HTMLElement): HTMLDivElement => {
    const box = doc.createElement('div');
    box.className = `ctl ${cls}`;
    input.id = `${prefix}-${input.getAttribute('name')}`;
    const label = doc.createElement('label');
    label.className = 'ctl-label';
    label.htmlFor = input.id;
    label.textContent = text;
    if (cls === 'check') box.append(input, label);
    else box.append(label, input);
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

  const ogrenci = select('ogrenciNumarasi', OGRENCILER);
  const kitap = select('kitapKodu', KITAPLAR);
  const uygun = doc.createElement('input');
  uygun.type = 'checkbox';
  uygun.name = 'uygunMu';
  const oduncSayisi = select('mevcutOduncSayisi', ODUNC);
  const tekrar = select('tekrar', TEKRARLAR);
  const olay = doc.createElement('input');
  olay.type = 'range';
  olay.name = 'olay';
  olay.min = '0';
  olay.step = '1';
  const out = doc.createElement('output');
  out.className = 'olay-deger';
  out.htmlFor = `${prefix}-olay`;

  row('select', 'Öğrenci numarası', ogrenci);
  row('select', 'Kitap kodu', kitap);
  row('check', 'Kitap başlangıçta uygun', uygun);
  row('select', 'Başlangıçta ödünç sayısı', oduncSayisi);
  row('select', 'İstek sayısı', tekrar);
  row('range', 'Gösterilen olay', olay).append(out);

  ogrenci.addEventListener('change', () => degistir(player, { ogrenciNumarasi: ogrenci.value as KatmanParams['ogrenciNumarasi'] }));
  kitap.addEventListener('change', () => degistir(player, { kitapKodu: kitap.value as KatmanParams['kitapKodu'] }));
  uygun.addEventListener('change', () => degistir(player, { uygunMu: uygun.checked }));
  oduncSayisi.addEventListener('change', () => degistir(player, { mevcutOduncSayisi: Number(oduncSayisi.value) as KatmanParams['mevcutOduncSayisi'] }));
  tekrar.addEventListener('change', () => degistir(player, { tekrar: Number(tekrar.value) as KatmanParams['tekrar'] }));
  olay.addEventListener('input', () => player.setParams({ olay: Number(olay.value), gorunum: 'akis' }));

  const sync = (): void => {
    const { params: p } = player.state;
    ogrenci.value = p.ogrenciNumarasi;
    kitap.value = p.kitapKodu;
    uygun.checked = p.uygunMu;
    oduncSayisi.value = String(p.mevcutOduncSayisi);
    tekrar.value = String(p.tekrar);
    const n = izUzunlugu(p);
    olay.max = String(n);
    olay.value = String(shown(p));
    out.textContent = `${olay.value} / ${n}`;
  };
  sync();
  player.subscribe(sync);
}

/** Lab shortcuts: U toggles the book's starting availability, [ and ] move the shown event. */
export function katmanShortcuts(player: StepPlayer<KatmanParams>): Shortcut[] {
  const move = (d: number): void => {
    const p = player.state.params;
    player.setParams({ olay: Math.max(0, Math.min(izUzunlugu(p), shown(p) + d)), gorunum: 'akis' });
  };
  return [
    {
      keys: ['u', 'U'],
      display: 'U',
      label: 'Kitap uygunluğunu değiştir',
      run: () => degistir(player, { uygunMu: !player.state.params.uygunMu }),
    },
    { keys: ['['], display: '[', label: 'Bir olay geri', run: () => move(-1) },
    { keys: [']'], display: ']', label: 'Bir olay ileri', run: () => move(1) },
  ];
}
