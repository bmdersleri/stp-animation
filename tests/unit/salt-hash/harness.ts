import { afterEach } from 'vitest';
import '../svg-stubs';
import type { Mode } from '../../../src/core/mode';
import { StepPlayer, stepIndex } from '../../../src/core/player';
import { saltScenario as sc, type SaltParams } from '../../../src/concepts/salt-hash/scenario';
import { mountSaltParams } from '../../../src/concepts/salt-hash/controls';
import { mountSaltExtra, mountSaltScene } from '../../../src/concepts/salt-hash/scene';

const clean: (() => void)[] = [];
afterEach(() => {
  clean.splice(0).forEach((fn) => fn());
  document.body.replaceChildren();
});

/** A scrypt call the fake `hesapla` has received and not yet answered. */
export interface Bekleyen {
  parola: string;
  salt: string;
  coz(hash: string): void;
}

/** Mounts the scene, the Lab controls and the explain extra in jsdom; `hesapla` calls are held until a test resolves them. */
export function setup(w = 1280, h = 540, mode: Mode = 'ders', hesapla?: (parola: string, salt: string) => Promise<string>) {
  const host = document.createElement('div');
  const el = document.createElement('div');
  const extra = document.createElement('div');
  document.body.append(host, el, extra);
  const bekleyen: Bekleyen[] = [];
  const sahte =
    hesapla ??
    ((parola: string, salt: string): Promise<string> =>
      new Promise((coz) => {
        bekleyen.push({ parola, salt, coz });
      }));
  const player = new StepPlayer(sc);
  mountSaltParams(host, player);
  mountSaltExtra(extra, player);
  const scene = mountSaltScene(el, player, mode, { durationScale: 0, hesapla: sahte });
  scene.resize(w, h);
  clean.push(() => {
    scene.destroy();
    player.destroy();
  });
  return { host, el, extra, player, scene, bekleyen };
}

export const go = (player: StepPlayer<SaltParams>, id: string): void => player.goto(stepIndex(sc, id));
export const texts = (root: ParentNode, sel: string): string[] => [...root.querySelectorAll(sel)].map((e) => e.textContent ?? '');
