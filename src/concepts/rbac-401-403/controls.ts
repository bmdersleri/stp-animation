import type { Shortcut } from '../../core/keyboard';
import type { StepPlayer } from '../../core/player';
import type { IzinliRoller } from './auth';
import type { RbacParams } from './scenario';

let uid = 0;

export const DAKIKA_EN_COK = 30;

const KULLANICILAR: readonly (readonly [RbacParams['kullanici'], string])[] = [
  ['yasemin', 'yasemin (kayıtlı, kütüphaneci)'],
  ['elif', 'elif (kayıtlı, öğrenci)'],
  ['ahmet', 'ahmet (kayıtsız)'],
];
const PAROLALAR: readonly (readonly [RbacParams['parola'], string])[] = [
  ['dogru', 'doğru parola'],
  ['yanlis', 'yanlış parola'],
];
const TOKENLAR: readonly (readonly [RbacParams['token'], string])[] = [
  ['giris', 'girişten gelen token'],
  ['gecersiz', 'geçersiz token'],
  ['yok', 'token yok'],
];
const ROLLER: readonly (readonly [IzinliRoller, string])[] = [
  ['kutuphaneci', 'yalnız kütüphaneci'],
  ['ikisi', 'öğrenci ve kütüphaneci'],
];

/** A Lab change writes `patch`; the Lab always runs Kod 10.7's kitapEkle, so a step on another program or stage switches to it first. */
function degistir(player: StepPlayer<RbacParams>, patch: Partial<RbacParams>): void {
  const p = player.state.params;
  player.setParams(p.program === 'kod-10-7' && p.asama === 'kitap-ekle' ? patch : { ...patch, program: 'kod-10-7', asama: 'kitap-ekle' });
}

function rollerDondur(player: StepPlayer<RbacParams>): void {
  degistir(player, { roller: player.state.params.roller === 'kutuphaneci' ? 'ikisi' : 'kutuphaneci' });
}

/** Mounts the Lab controls: user, password, token, allowed roles and the minutes since sign-in. */
export function mountRbacParams(host: HTMLElement, player: StepPlayer<RbacParams>): void {
  const doc = host.ownerDocument;
  const prefix = `rbac-params-${++uid}`;
  const wrap = doc.createElement('div');
  wrap.className = 'rbac-params';
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
  const parola = select('parola', PAROLALAR);
  const token = select('token', TOKENLAR);
  const roller = select('roller', ROLLER);
  const dakika = doc.createElement('input');
  dakika.type = 'range';
  dakika.name = 'dakika';
  dakika.min = '0';
  dakika.max = String(DAKIKA_EN_COK);
  dakika.step = '1';
  const dakikaDeger = doc.createElement('output');
  dakikaDeger.className = 'dakika-deger';

  row('Kullanıcı', kullanici);
  row('Parola', parola);
  row('Token', token);
  row('İzinli roller (R)', roller);
  const dakikaSatir = row('Girişten sonra geçen dakika', dakika);
  dakikaSatir.append(dakikaDeger);

  kullanici.addEventListener('change', () => degistir(player, { kullanici: kullanici.value as RbacParams['kullanici'] }));
  parola.addEventListener('change', () => degistir(player, { parola: parola.value as RbacParams['parola'] }));
  token.addEventListener('change', () => degistir(player, { token: token.value as RbacParams['token'] }));
  roller.addEventListener('change', () => degistir(player, { roller: roller.value as IzinliRoller }));
  dakika.addEventListener('input', () => {
    const n = Math.round(Number(dakika.value));
    const v = Number.isFinite(n) ? Math.min(DAKIKA_EN_COK, Math.max(0, n)) : 0;
    if (dakika.value !== String(v)) dakika.value = String(v);
    degistir(player, { dakika: v });
  });

  const sync = (): void => {
    const p = player.state.params;
    kullanici.value = p.kullanici;
    parola.value = p.parola;
    token.value = p.token;
    roller.value = p.roller;
    dakika.value = String(p.dakika);
    dakikaDeger.textContent = `${p.dakika} dk`;
  };
  sync();
  player.subscribe(sync);
}

/** Lab shortcut: R switches the allowed roles. */
export function rbacShortcuts(player: StepPlayer<RbacParams>): Shortcut[] {
  return [{ keys: ['r', 'R'], display: 'R', label: 'İzinli rolleri değiştir', run: () => rollerDondur(player) }];
}
