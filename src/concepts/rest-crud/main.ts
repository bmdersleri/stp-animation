import '../../core/theme.css';
import { mountConceptPage, type ConceptPage } from '../../core/shell';
import { concepts } from '../registry';
import { mountRestParams, restShortcuts } from './controls';
import { restScenario, type RestParams } from './scenario';
import { mountRestExtra, mountRestScene } from './scene';

const kayit = concepts.find((c) => c.id === 'rest-crud')!;

export const restPage: ConceptPage<RestParams> = {
  title: 'CRUD, HTTP metotları ve durum kodları',
  chapter: `Bölüm ${kayit.chapter} · ${kayit.chapterTitle}`,
  scenario: restScenario,
  mountScene: mountRestScene,
  mountParams: mountRestParams,
  mountExplainExtra: mountRestExtra,
  shortcuts: restShortcuts,
};

const app = document.querySelector<HTMLElement>('#app');
if (app) {
  mountConceptPage(app, restPage);
}
