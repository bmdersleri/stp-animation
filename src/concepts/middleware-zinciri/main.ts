import '../../core/theme.css';
import { mountConceptPage, type ConceptPage } from '../../core/shell';
import { mountMwParams, mwShortcuts } from './controls';
import { mwScenario, type MwParams } from './scenario';
import { mountMwExtra, mountMwScene } from './scene';

export const mwPage: ConceptPage<MwParams> = {
  title: 'Middleware zinciri: istek işlem hattı',
  chapter: 'Bölüm 5 · Express ile Web Sunucusu ve Routing',
  scenario: mwScenario,
  mountScene: mountMwScene,
  mountParams: mountMwParams,
  mountExplainExtra: mountMwExtra,
  shortcuts: mwShortcuts,
};

const app = document.querySelector<HTMLElement>('#app');
if (app) {
  mountConceptPage(app, mwPage);
}
