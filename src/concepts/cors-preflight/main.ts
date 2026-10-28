import '../../core/theme.css';
import { mountConceptPage, type ConceptPage } from '../../core/shell';
import { concepts } from '../registry';
import { corsShortcuts, mountCorsParams } from './controls';
import { corsScenario, type CorsParams } from './scenario';
import { mountCorsExtra, mountCorsScene } from './scene';

const kayit = concepts.find((c) => c.id === 'cors-preflight')!;

export const corsPage: ConceptPage<CorsParams> = {
  title: 'CORS: köken kararı ve preflight',
  chapter: `Bölüm ${kayit.chapter} · ${kayit.chapterTitle}`,
  scenario: corsScenario,
  mountScene: mountCorsScene,
  mountParams: mountCorsParams,
  mountExplainExtra: mountCorsExtra,
  shortcuts: corsShortcuts,
};

const app = document.querySelector<HTMLElement>('#app');
if (app) {
  mountConceptPage(app, corsPage);
}
