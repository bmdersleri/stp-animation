import { rastgeleSaltHex } from '../../core/kripto';
import type { Shortcut } from '../../core/keyboard';
import type { StepPlayer } from '../../core/player';
import type { SaltGorunum, SaltParams } from './scenario';

let uid = 0;

/** The longest password or attempt the Lab takes (R15). */
export const EN_COK = 32;

const YONTEMLER: readonly (readonly [string, string])[] = [
  ['scrypt', 'scrypt + salt (Kod 10.2)'],
  ['sha256', 'sha256, salt yok (code_004)'],
];
const SALTLAR: readonly (readonly [string, string])[] = [
  ['sabit-1', 'sabit 1'],
  ['sabit-2', 'sabit 2'],
  ['yeni', 'yeni'],
];
const GORUNUMLER: readonly (readonly [SaltGorunum, string])[] = [
  ['hat', 'Hesap hattı'],
  ['dogrula', 'Doğrulama'],
  ['karsilastir', 'Karşılaştırma'],
];

/** The views the Lab select does not offer: a Lab change leaves them for the hash line. */
const SADECE_KITAP: readonly SaltGorunum[] = ['tanim', 'yavas', 'ozet'];

/** A Lab change writes `patch`; from a book-only view it also switches the view to `hat`, so the change shows. */
function degistir(player: StepPlayer<SaltParams>, patch: Partial<SaltParams>): void {
  const kitap = SADECE_KITAP.includes(player.state.params.gorunum);
  player.setParams(kitap && patch.gorunum === undefined ? { ...patch, gorunum: 'hat' } : patch);
}

function yeniSalt(player: StepPlayer<SaltParams>): void {
  degistir(player, { yeniSalt: rastgeleSaltHex(), salt: 'yeni' });
}

/** Mounts the Lab controls: password and attempt, method, salt choice, second user and view. */
export function mountSaltParams(host: HTMLElement, player: StepPlayer<SaltParams>): void {
  const doc = host.ownerDocument;
  const prefix = `salt-params-${++uid}`;
  const wrap = doc.createElement('div');
  wrap.className = 'salt-params';
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
  const metin = (name: string): HTMLInputElement => {
    const i = doc.createElement('input');
    i.type = 'text';
    i.name = name;
    i.maxLength = EN_COK;
    i.autocomplete = 'off';
    i.spellcheck = false;
    return i;
  };

  const parola = metin('parola');
  const deneme = metin('deneme');
  const yontem = select('yontem', YONTEMLER);
  const salt = select('salt', SALTLAR);
  const yeni = doc.createElement('button');
  yeni.type = 'button';
  yeni.className = 'yeni-salt';
  yeni.textContent = 'Yeni salt (S)';
  const ikinci = doc.createElement('input');
  ikinci.type = 'checkbox';
  ikinci.name = 'ikinciKullanici';
  const gorunum = select('gorunum', GORUNUMLER);

  row('text', 'Parola', parola);
  row('text', 'Deneme', deneme);
  row('select', 'Yöntem', yontem);
  row('select', 'Salt', salt).append(yeni);
  row('check', 'İkinci kullanıcı aynı parolayı seçer', ikinci);
  row('select', 'Görünüm', gorunum);

  const yaz = (input: HTMLInputElement, key: 'parola' | 'deneme'): void => {
    const v = input.value.slice(0, EN_COK);
    if (input.value !== v) input.value = v;
    degistir(player, { [key]: v });
  };
  parola.addEventListener('input', () => yaz(parola, 'parola'));
  deneme.addEventListener('input', () => yaz(deneme, 'deneme'));
  yontem.addEventListener('change', () => degistir(player, { yontem: yontem.value as SaltParams['yontem'] }));
  salt.addEventListener('change', () => {
    const secim = salt.value as SaltParams['salt'];
    // a typed salt that was never generated would fall back to sabit 1: give "yeni" a value of its own
    if (secim === 'yeni' && player.state.params.yeniSalt === '') yeniSalt(player);
    else degistir(player, { salt: secim });
  });
  yeni.addEventListener('click', () => yeniSalt(player));
  ikinci.addEventListener('change', () => degistir(player, { ikinciKullanici: ikinci.checked }));
  gorunum.addEventListener('change', () => degistir(player, { gorunum: gorunum.value as SaltGorunum }));

  const sync = (): void => {
    const p = player.state.params;
    if (parola.value !== p.parola) parola.value = p.parola;
    if (deneme.value !== p.deneme) deneme.value = p.deneme;
    yontem.value = p.yontem;
    salt.value = p.salt;
    ikinci.checked = p.ikinciKullanici;
    // the select offers the hash line only; a book-only view reads as `hat`, which is what the first change gives
    gorunum.value = SADECE_KITAP.includes(p.gorunum) ? 'hat' : p.gorunum;
  };
  sync();
  player.subscribe(sync);
}

/** Lab shortcut: S makes a new salt. */
export function saltShortcuts(player: StepPlayer<SaltParams>): Shortcut[] {
  return [{ keys: ['s', 'S'], display: 'S', label: 'Yeni salt üret', run: () => yeniSalt(player) }];
}
