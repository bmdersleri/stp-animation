// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { loopPage } from '../../../src/concepts/event-loop/main';
import { PROGRAM_IDS, PROGRAMS, framesOf } from '../../../src/concepts/event-loop/programs';
import { setup } from './harness';

const sel = (host: HTMLElement) => host.querySelector<HTMLSelectElement>('select[name="program"]')!;
const kare = (host: HTMLElement) => host.querySelector<HTMLInputElement>('input[type="range"][name="kare"]')!;
const key = (player: ReturnType<typeof setup>['player'], k: string): void =>
  loopPage.shortcuts!(player).find((s) => s.keys.includes(k))!.run();

describe('event-loop Lab controls', () => {
  it('program select lists five programs', () => {
    const { host } = setup(1280, 540, 'lab');
    expect([...sel(host).options].map((o) => o.value)).toEqual([...PROGRAM_IDS]);
    expect([...sel(host).options].map((o) => o.textContent)).toEqual(PROGRAM_IDS.map((id) => PROGRAMS[id].title));
    expect(sel(host).value).toBe('kod-4-4');
  });

  it('program switch resets kare and clears board', () => {
    const { host, el, player } = setup(1280, 540, 'lab');
    player.goto(4);
    expect(el.querySelectorAll('.terminal .terminal-satir').length).toBe(3);
    sel(host).value = 'engelleme';
    sel(host).dispatchEvent(new Event('change', { bubbles: true }));
    expect(player.state.params.program).toBe('engelleme');
    expect(player.state.params.kare).toBe(0);
    expect(el.querySelectorAll('.terminal .terminal-satir')).toHaveLength(0);
    expect(kare(host).value).toBe('0');
  });

  it('kare range max follows the program', () => {
    const { host } = setup(1280, 540, 'lab');
    expect(kare(host).max).toBe(String(framesOf('kod-4-4').length - 1));
    sel(host).value = 'bitti-gec';
    sel(host).dispatchEvent(new Event('change', { bubbles: true }));
    expect(kare(host).max).toBe(String(framesOf('bitti-gec').length - 1));
  });

  it('the kare range writes through to the player', () => {
    const { host, player } = setup(1280, 540, 'lab');
    kare(host).value = '3';
    kare(host).dispatchEvent(new Event('input', { bubbles: true }));
    expect(player.state.params.kare).toBe(3);
  });

  it('] and [ move one frame, clamped', () => {
    const { player } = setup(1280, 540, 'lab');
    player.setParam('kare', 2);
    key(player, ']');
    expect(player.state.params.kare).toBe(3);
    key(player, '[');
    key(player, '[');
    expect(player.state.params.kare).toBe(1);
    player.setParam('kare', 0);
    key(player, '[');
    expect(player.state.params.kare).toBe(0);
    const last = framesOf(player.state.params.program).length - 1;
    player.setParam('kare', last);
    key(player, ']');
    expect(player.state.params.kare).toBe(last);
  });

  it('the page describes itself', () => {
    expect(loopPage.title).toBe('Event loop: çağrı yığını ve kuyruklar');
    expect(loopPage.chapter).toBe('Bölüm 4 · Node.js Runtime, npm ve Sunucu Tarafı Programlama');
  });
});
