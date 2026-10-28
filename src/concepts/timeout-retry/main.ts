import '../../core/theme.css';
import { mountConceptPage, type ConceptPage } from '../../core/shell';
import { concepts } from '../registry';
import { mountTimeoutParams } from './controls';
import { timeoutScenario, type TimeoutParams } from './scenario';
import { mountTimeoutExtra, mountTimeoutScene } from './scene';

const kayit = concepts.find((c) => c.id === 'timeout-retry')!;

export const timeoutPage: ConceptPage<TimeoutParams> = {
  title: 'Timeout, retry ve hata izolasyonu',
  chapter: `Bölüm ${kayit.chapter} · ${kayit.chapterTitle}`,
  scenario: timeoutScenario,
  mountScene: mountTimeoutScene,
  mountParams: mountTimeoutParams,
  mountExplainExtra: mountTimeoutExtra,
};

const app = document.querySelector<HTMLElement>('#app');
if (app) {
  mountConceptPage(app, timeoutPage);
}
