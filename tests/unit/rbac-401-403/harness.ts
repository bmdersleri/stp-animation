import { afterEach } from 'vitest';
import '../svg-stubs';
import type { Mode } from '../../../src/core/mode';
import { StepPlayer, stepIndex } from '../../../src/core/player';
import { rbacScenario as sc, type RbacParams } from '../../../src/concepts/rbac-401-403/scenario';
import { mountRbacParams } from '../../../src/concepts/rbac-401-403/controls';
import { mountRbacExtra, mountRbacScene } from '../../../src/concepts/rbac-401-403/scene';

const clean: (() => void)[] = [];
afterEach(() => {
  clean.splice(0).forEach((fn) => fn());
  document.body.replaceChildren();
});

/** Mounts the scene, the Lab controls and the explain extra in jsdom. */
export function setup(w = 1280, h = 540, mode: Mode = 'ders') {
  const host = document.createElement('div');
  const el = document.createElement('div');
  const extra = document.createElement('div');
  document.body.append(host, el, extra);
  const player = new StepPlayer(sc);
  mountRbacParams(host, player);
  mountRbacExtra(extra, player);
  const scene = mountRbacScene(el, player, mode, { durationScale: 0 });
  scene.resize(w, h);
  clean.push(() => {
    scene.destroy();
    player.destroy();
  });
  return { host, el, extra, player, scene };
}

export const go = (player: StepPlayer<RbacParams>, id: string): void => player.goto(stepIndex(sc, id));
export const texts = (root: ParentNode, sel: string): string[] => [...root.querySelectorAll(sel)].map((e) => e.textContent ?? '');
