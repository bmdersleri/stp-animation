import type { Shortcut } from '../../core/keyboard';
import type { StepPlayer } from '../../core/player';
import { TUMU, type CorsParams } from './scenario';
import type { SunucuTuru } from './sunucu';
import type { IstekTuru, Istemci, Koken } from './tarayici';

let uid = 0;

const KOKENLER: readonly (readonly [Koken, string])[] = [
  ['kutuphane', 'kutuphane.mehmetakif.edu.tr (izinli)'],
  ['localhost', 'localhost:5173 (izinli)'],
  ['kotu', 'kotu-niyetli-site.com (izinsiz)'],
  ['http-kutuphane', 'http://kutuphane… (şema farklı)'],
  ['ayni', 'API ile aynı köken'],
];
const ISTEMCILER: readonly (readonly [Istemci, string])[] = [
  ['tarayici', 'tarayıcı (fetch)'],
  ['curl', 'curl (Origin yok)'],
  ['curl-origin', 'curl (Origin başlığıyla)'],
];
const ISTEKLER: readonly (readonly [IstekTuru, string])[] = [
  ['get-kitaplar', 'GET /api/kitaplar'],
  ['post-giris', 'POST /api/giris (JSON)'],
  ['get-yetkili', 'GET + Authorization'],
  ['delete', 'DELETE /api/kitaplar/1'],
];
const KIMLIKLER: readonly (readonly [CorsParams['kimlik'], string])[] = [
  ['include', 'çerez gönder (include)'],
  ['omit', 'çerez gönderme (omit)'],
];
const SUNUCULAR: readonly (readonly [SunucuTuru, string])[] = [
  ['kitap-karari', 'Kod 11.4 (corsKarariVer)'],
  ['cors-paketi', 'cors paketi'],
  ['wildcard', 'Allow-Origin: * (yanlış örnek)'],
  ['kitap-11-7', 'Kod 11.7 (sunucu reddeder)'],
];

/** A Lab change writes `patch`; the Lab always shows the flow, so an intro or summary step switches to it and shows every event. */
function degistir(player: StepPlayer<CorsParams>, patch: Partial<CorsParams>): void {
  player.setParams({ ...patch, asama: 'akis', olay: TUMU });
}

function kokenDondur(player: StepPlayer<CorsParams>): void {
  const sira = KOKENLER.map(([k]) => k);
  const simdiki = sira.indexOf(player.state.params.koken);
  degistir(player, { koken: sira[(simdiki + 1) % sira.length] });
}

/** Mounts the Lab controls: origin, client, request, credentials and server. */
export function mountCorsParams(host: HTMLElement, player: StepPlayer<CorsParams>): void {
  const doc = host.ownerDocument;
  const prefix = `cors-params-${++uid}`;
  const wrap = doc.createElement('div');
  wrap.className = 'cors-params';
  host.append(wrap);

  const row = (text: string, input: HTMLElement): void => {
    const box = doc.createElement('div');
    box.className = 'ctl';
    input.id = `${prefix}-${input.getAttribute('name')}`;
    const label = doc.createElement('label');
    label.className = 'ctl-label';
    label.htmlFor = input.id;
    label.textContent = text;
    box.append(label, input);
    wrap.append(box);
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

  const koken = select('koken', KOKENLER);
  const istemci = select('istemci', ISTEMCILER);
  const istek = select('istek', ISTEKLER);
  const kimlik = select('kimlik', KIMLIKLER);
  const sunucu = select('sunucu', SUNUCULAR);
  row('Sayfa kökeni (O)', koken);
  row('İstemci', istemci);
  row('İstek', istek);
  row('Kimlik bilgisi', kimlik);
  row('Sunucu', sunucu);

  koken.addEventListener('change', () => degistir(player, { koken: koken.value as Koken }));
  istemci.addEventListener('change', () => degistir(player, { istemci: istemci.value as Istemci }));
  istek.addEventListener('change', () => degistir(player, { istek: istek.value as IstekTuru }));
  kimlik.addEventListener('change', () => degistir(player, { kimlik: kimlik.value as CorsParams['kimlik'] }));
  sunucu.addEventListener('change', () => degistir(player, { sunucu: sunucu.value as SunucuTuru }));

  const sync = (): void => {
    const p = player.state.params;
    koken.value = p.koken;
    istemci.value = p.istemci;
    istek.value = p.istek;
    kimlik.value = p.kimlik;
    sunucu.value = p.sunucu;
    // curl sends no cookies: the credentials choice has no effect
    kimlik.disabled = p.istemci !== 'tarayici';
  };
  sync();
  player.subscribe(sync);
}

/** Lab shortcut: O switches the page origin. */
export function corsShortcuts(player: StepPlayer<CorsParams>): Shortcut[] {
  return [{ keys: ['o', 'O'], display: 'O', label: 'Sayfa kökenini değiştir', run: () => kokenDondur(player) }];
}
