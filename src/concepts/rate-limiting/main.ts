import '../../core/theme.css';
import { mountConceptPage, type ConceptPage } from '../../core/shell';
import { concepts } from '../registry';
import { mountRateParams, rateShortcuts } from './controls';
import { rateScenario, type RateParams } from './scenario';
import { mountRateExtra, mountRateScene } from './scene';

const kayit = concepts.find((c) => c.id === 'rate-limiting')!;

export const ratePage: ConceptPage<RateParams> = {
  title: 'Rate limiting: istek sınırlama',
  chapter: `Bölüm ${kayit.chapter} · ${kayit.chapterTitle}`,
  scenario: rateScenario,
  mountScene: mountRateScene,
  mountParams: mountRateParams,
  mountExplainExtra: mountRateExtra,
  shortcuts: rateShortcuts,
};

const app = document.querySelector<HTMLElement>('#app');
if (app) {
  mountConceptPage(app, ratePage);
}
