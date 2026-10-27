import { afterEach } from 'vitest';
import '../svg-stubs';
import type { Mode } from '../../../src/core/mode';
import { StepPlayer, stepIndex } from '../../../src/core/player';
import { katmanScenario as sc, type KatmanParams } from '../../../src/concepts/katmanli-mimari/scenario';
import { mountKatmanParams } from '../../../src/concepts/katmanli-mimari/controls';
import { mountKatmanExtra, mountKatmanScene } from '../../../src/concepts/katmanli-mimari/scene';

const clean: (() => void)[] = [];
afterEach(() => {
  clean.splice(0).forEach((fn) => fn());
  document.body.replaceChildren();
});

/** Mounts the scene, the Lab controls and the explain extra in jsdom; `w` x `h` is the size the shell would give the stage. */
export function setup(w = 1280, h = 540, mode: Mode = 'ders', durationScale = 0) {
  const host = document.createElement('div');
  const el = document.createElement('div');
  const extra = document.createElement('div');
  document.body.append(host, el, extra);
  const player = new StepPlayer(sc);
  mountKatmanParams(host, player);
  mountKatmanExtra(extra, player);
  const scene = mountKatmanScene(el, player, mode, { durationScale });
  scene.resize(w, h);
  clean.push(() => {
    scene.destroy();
    player.destroy();
  });
  return { host, el, extra, player, scene };
}

export const go = (player: StepPlayer<KatmanParams>, id: string): void => player.goto(stepIndex(sc, id));
export const texts = (root: ParentNode, sel: string): string[] => [...root.querySelectorAll(sel)].map((e) => e.textContent ?? '');
