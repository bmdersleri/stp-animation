import '../../core/theme.css';
import { mountConceptPage, type ConceptPage } from '../../core/shell';
import { concepts } from '../registry';
import { katmanShortcuts, mountKatmanParams } from './controls';
import { katmanScenario, type KatmanParams } from './scenario';
import { mountKatmanExtra, mountKatmanScene } from './scene';

const kayit = concepts.find((c) => c.id === 'katmanli-mimari')!;

export const katmanPage: ConceptPage<KatmanParams> = {
  title: 'Katmanlı mimari: controller, service, repository',
  chapter: `Bölüm ${kayit.chapter} · ${kayit.chapterTitle}`,
  scenario: katmanScenario,
  mountScene: mountKatmanScene,
  mountParams: mountKatmanParams,
  mountExplainExtra: mountKatmanExtra,
  shortcuts: katmanShortcuts,
};

const app = document.querySelector<HTMLElement>('#app');
if (app) {
  mountConceptPage(app, katmanPage);
}
