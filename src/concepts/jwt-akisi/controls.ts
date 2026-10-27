import type { Shortcut } from '../../core/keyboard';
import type { StepPlayer } from '../../core/player';
import type { Bozulma } from './jwt';
import type { JwtParams } from './scenario';

let uid = 0;

export const DAKIKA_EN_COK = 30;

const KULLANICILAR: readonly (readonly [JwtParams['kullanici'], string])[] = [
  ['elif', 'elif / ogrenci'],
  ['yasemin', 'yasemin / kutuphaneci'],
];
/** The seven tampering choices, in the order the B key cycles them. */
const BOZULMALAR: readonly (readonly [Bozulma, string])[] = [
  ['yok', 'yok (sağlam token)'],
  ['imza-bozuk', 'imza bozuk'],
  ['rol-degisti', 'rol değişti'],
  ['sure-alani-yok', 'süre alanı yok'],
  ['fazla-segment', 'fazla segment'],
  ['baska-anahtar', 'başka anahtar'],
  ['bozuk-json', 'bozuk JSON'],
];

/** A Lab change writes `patch`; the Lab always shows the verification, so a step on another stage switches to `dogrula` too. */
function degistir(player: StepPlayer<JwtParams>, patch: Partial<JwtParams>): void {
  player.setParams(player.state.params.asama === 'dogrula' ? patch : { ...patch, asama: 'dogrula' });
}

function sonrakiBozulma(player: StepPlayer<JwtParams>): void {
  const i = BOZULMALAR.findIndex(([v]) => v === player.state.params.bozulma);
  degistir(player, { bozulma: BOZULMALAR[(i + 1) % BOZULMALAR.length][0] });
}

/** Mounts the Lab controls: user, tampering and the minutes since issue. */
export function mountJwtParams(host: HTMLElement, player: StepPlayer<JwtParams>): void {
  const doc = host.ownerDocument;
  const prefix = `jwt-params-${++uid}`;
  const wrap = doc.createElement('div');
  wrap.className = 'jwt-params';
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

  const kullanici = select('kullanici', KULLANICILAR);
  const bozulma = select('bozulma', BOZULMALAR);
  const dakika = doc.createElement('input');
  dakika.type = 'range';
  dakika.name = 'dakika';
  dakika.min = '0';
  dakika.max = String(DAKIKA_EN_COK);
  dakika.step = '1';
  const dakikaDeger = doc.createElement('output');
  dakikaDeger.className = 'dakika-deger';

  row('Kullanıcı', kullanici);
  row('Bozulma (B)', bozulma);
  const dakikaSatir = row('Verilişten sonra geçen dakika', dakika);
  dakikaSatir.append(dakikaDeger);

  kullanici.addEventListener('change', () => degistir(player, { kullanici: kullanici.value as JwtParams['kullanici'] }));
  bozulma.addEventListener('change', () => degistir(player, { bozulma: bozulma.value as Bozulma }));
  dakika.addEventListener('input', () => {
    const n = Math.round(Number(dakika.value));
    const v = Number.isFinite(n) ? Math.min(DAKIKA_EN_COK, Math.max(0, n)) : 0;
    if (dakika.value !== String(v)) dakika.value = String(v);
    degistir(player, { dakika: v });
  });

  const sync = (): void => {
    const p = player.state.params;
    kullanici.value = p.kullanici;
    bozulma.value = p.bozulma;
    dakika.value = String(p.dakika);
    dakikaDeger.textContent = `${p.dakika} dk${p.dakika > 15 ? ' (süre 15 dk)' : ''}`;
  };
  sync();
  player.subscribe(sync);
}

/** Lab shortcut: B cycles the tampering. */
export function jwtShortcuts(player: StepPlayer<JwtParams>): Shortcut[] {
  return [{ keys: ['b', 'B'], display: 'B', label: 'Bozulmayı değiştir', run: () => sonrakiBozulma(player) }];
}
