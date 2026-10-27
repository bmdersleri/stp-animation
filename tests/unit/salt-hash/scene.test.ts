// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SALT_1, SCRYPT_ONBELLEK, SHA_123456 } from '../../../src/concepts/salt-hash/degerler';
import { saltScenario } from '../../../src/concepts/salt-hash/scenario';
import { deriveSaltView } from '../../../src/concepts/salt-hash/view';
import { StepPlayer } from '../../../src/core/player';
import { mountSaltScene } from '../../../src/concepts/salt-hash/scene';
import { go, setup, texts } from './harness';

const ONBELLEK = new Map(Object.entries(SCRYPT_ONBELLEK));
const rozetler = (el: HTMLElement): HTMLElement[] => [...el.querySelectorAll<HTMLElement>('.rozet-yeri .kaynak-rozeti')];
const hashler = (el: HTMLElement): string[] => texts(el, '.segment-strip .parca:last-child .parca-metin');

afterEach(() => {
  vi.useRealTimers();
});

describe('salt-hash scene', () => {
  it('step 2 shows two equal strips', () => {
    const { el, player } = setup();
    go(player, 'tuzsuz');
    expect(hashler(el)).toEqual([SHA_123456, SHA_123456]);
    expect(el.querySelectorAll('.segment-strip .fark')).toHaveLength(0);
    expect(texts(el, '.terminal-satir')).toEqual(['true']);
  });

  it('step 7 shows 1 and 64', () => {
    const { el, player } = setup();
    go(player, 'zamanlama');
    expect(texts(el, '.sayac')).toEqual(['=== : 1 karakter karşılaştırıldı', 'timingSafeEqual : 64 bayt karşılaştırıldı']);
  });

  it('book-only steps show their text in place of the table and strips', () => {
    const { el, player } = setup();
    go(player, 'tanitim');
    expect(el.querySelector('.tanim')!.textContent).toContain('Parola hashing, bir parolayı tek yönlü');
    expect(el.querySelectorAll('.segment-strip')).toHaveLength(0);
    expect(el.querySelector<HTMLElement>('.tablo-yeri')!.hidden).toBe(true);
    go(player, 'yavas');
    expect(el.querySelectorAll('.yavas-tablo tbody tr')).toHaveLength(4);
    expect(el.querySelector('.yavas-tablo')!.textContent).toContain('Önerilmez');
    expect(el.querySelector<HTMLElement>('.tanim')!.hidden).toBe(true);
    go(player, 'ozet');
    expect(el.querySelectorAll('.ozet li')).toHaveLength(3);
    expect(el.querySelector('.ozet-son')!.textContent).toBe(deriveSaltView(player.state.params, ONBELLEK).ozet![3]);
  });

  it('stale scrypt result is dropped', async () => {
    vi.useFakeTimers();
    const { el, player, bekleyen } = setup(1280, 540, 'lab');
    go(player, 'salt-uret');
    player.setParam('parola', 'a');
    await vi.advanceTimersByTimeAsync(250);
    player.setParam('parola', 'ab');
    await vi.advanceTimersByTimeAsync(250);
    expect(bekleyen.map((b) => b.parola)).toEqual(['a', 'ab']);
    expect(hashler(el)).toEqual(['hesaplanıyor…']);
    bekleyen[1].coz('b'.repeat(128));
    await vi.advanceTimersByTimeAsync(0);
    expect(hashler(el)).toEqual(['b'.repeat(128)]);
    bekleyen[0].coz('a'.repeat(128));
    await vi.advanceTimersByTimeAsync(0);
    expect(hashler(el)).toEqual(['b'.repeat(128)]);
  });

  it('lab step 6: changing the attempt and changing it back prints only that attempt', async () => {
    vi.useFakeTimers();
    const { el, player, bekleyen } = setup(1280, 540, 'lab');
    go(player, 'yanlis-parola');
    expect(texts(el, '.terminal-satir')).toEqual(['true', 'false']);
    player.setParam('deneme', 'yanlis-parolaX');
    await vi.advanceTimersByTimeAsync(250);
    bekleyen[0].coz('e'.repeat(128));
    await vi.advanceTimersByTimeAsync(0);
    expect(texts(el, '.terminal-satir')).toEqual(['false']);
    player.setParam('deneme', 'yanlis-parola');
    await vi.advanceTimersByTimeAsync(250);
    expect(texts(el, '.terminal-satir')).toEqual(['false']);
    player.next();
    player.prev();
    expect(texts(el, '.terminal-satir')).toEqual(['true', 'false']);
  });

  it('lab measurement line appears after compute', async () => {
    vi.useFakeTimers();
    const { el, player, bekleyen } = setup(1280, 540, 'lab');
    go(player, 'salt-uret');
    expect(el.querySelector<HTMLElement>('.olcum')!.hidden).toBe(true);
    player.setParam('parola', 'yeni-parola');
    await vi.advanceTimersByTimeAsync(250);
    bekleyen[0].coz('c'.repeat(128));
    await vi.advanceTimersByTimeAsync(0);
    const olcum = el.querySelector<HTMLElement>('.olcum')!;
    expect(olcum.hidden).toBe(false);
    expect(olcum.textContent).toMatch(/^bu tarayıcıda ölçüldü: sha256 [\d.]+ ms, scrypt [\d.]+ ms$/);
  });

  it('mount with uncached params computes without a change', async () => {
    vi.useFakeTimers();
    const player = new StepPlayer(saltScenario);
    player.setParams({ parola: 'zzz', gorunum: 'hat' });
    const gelen: string[] = [];
    const el = document.createElement('div');
    document.body.append(el);
    const scene = mountSaltScene(el, player, 'lab', {
      durationScale: 0,
      hesapla: async (parola) => {
        gelen.push(parola);
        return 'd'.repeat(128);
      },
    });
    scene.resize(1280, 540);
    await vi.advanceTimersByTimeAsync(250);
    expect(gelen).toEqual(['zzz']);
    expect(el.querySelector('.olcum')!.textContent).toContain('ölçüldü');
    scene.destroy();
    player.destroy();
  });

  it('rapid step jumps leave no duplicates', () => {
    const { el, player } = setup();
    for (const i of [7, 0, 7, 2]) player.goto(i);
    const v = deriveSaltView(player.state.params, ONBELLEK);
    expect(el.querySelectorAll('.segment-strip')).toHaveLength(v.seritler.length);
    expect(el.querySelectorAll('.tablo-yeri .data-table tbody tr')).toHaveLength(v.tablo.satirlar.length);
    expect(el.querySelectorAll('.hat-kutu.etkin').length).toBeLessThanOrEqual(1);
    expect(el.querySelectorAll('.http-cards')).toHaveLength(1);
  });

  it('badge follows lab change and returns on step change', () => {
    const { el, player } = setup();
    go(player, 'dogru-parola');
    expect(rozetler(el)[0].classList.contains('kaynak-kitap-kodu')).toBe(true);
    go(player, 'yavas');
    expect(rozetler(el)[0].classList.contains('kaynak-kitap')).toBe(true);
    player.setParam('parola', 'x');
    expect(rozetler(el)).toHaveLength(1);
    expect(rozetler(el)[0].classList.contains('kaynak-kitap-kodu')).toBe(true);
    player.next();
    expect(rozetler(el)).toHaveLength(1);
    expect(rozetler(el)[0].classList.contains('kaynak-kitap')).toBe(true);
  });

  it('every step shows exactly one badge', () => {
    const { el, player } = setup();
    saltScenario.steps.forEach((_, i) => {
      player.goto(i);
      expect(el.querySelectorAll('.kaynak-rozeti'), `step ${i + 1}`).toHaveLength(1);
    });
  });

  it('step 3 shows the salt and the full 128-character hash', () => {
    const { el, player } = setup();
    go(player, 'salt-uret');
    expect(texts(el, '.parca-metin')).toEqual([SALT_1, SCRYPT_ONBELLEK[`guclu-Parola123|${SALT_1}`]]);
  });
});
