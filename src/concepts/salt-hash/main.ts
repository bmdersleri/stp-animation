import '../../core/theme.css';
import { mountConceptPage, type ConceptPage } from '../../core/shell';
import { concepts } from '../registry';
import { mountSaltParams, saltShortcuts } from './controls';
import { saltScenario, type SaltParams } from './scenario';
import { mountSaltExtra, mountSaltScene } from './scene';

const kayit = concepts.find((c) => c.id === 'salt-hash')!;

export const saltPage: ConceptPage<SaltParams> = {
  title: 'Parola güvenliği: salt ve hashing',
  chapter: `Bölüm ${kayit.chapter} · ${kayit.chapterTitle}`,
  scenario: saltScenario,
  mountScene: mountSaltScene,
  mountParams: mountSaltParams,
  mountExplainExtra: mountSaltExtra,
  shortcuts: saltShortcuts,
};

const app = document.querySelector<HTMLElement>('#app');
if (app) {
  mountConceptPage(app, saltPage);
}
