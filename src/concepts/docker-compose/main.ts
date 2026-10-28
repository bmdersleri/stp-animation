import '../../core/theme.css';
import { mountConceptPage, type ConceptPage } from '../../core/shell';
import { concepts } from '../registry';
import { mountComposeParams } from './controls';
import { composeScenario, type ComposeParams } from './scenario';
import { mountComposeExtra, mountComposeScene } from './scene';

const kayit = concepts.find((c) => c.id === 'docker-compose')!;

export const composePage: ConceptPage<ComposeParams> = {
  title: 'Docker Compose ile çok servisli ortam',
  chapter: `Bölüm ${kayit.chapter} · ${kayit.chapterTitle}`,
  scenario: composeScenario,
  mountScene: mountComposeScene,
  mountParams: mountComposeParams,
  mountExplainExtra: mountComposeExtra,
};

const app = document.querySelector<HTMLElement>('#app');
if (app) {
  mountConceptPage(app, composePage);
}
