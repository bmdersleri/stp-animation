import '../../core/theme.css';
import { mountConceptPage, type ConceptPage } from '../../core/shell';
import { concepts } from '../registry';
import { mountRbacParams, rbacShortcuts } from './controls';
import { rbacScenario, type RbacParams } from './scenario';
import { mountRbacExtra, mountRbacScene } from './scene';

const kayit = concepts.find((c) => c.id === 'rbac-401-403')!;

export const rbacPage: ConceptPage<RbacParams> = {
  title: 'RBAC ve 401 ile 403 ayrımı',
  chapter: `Bölüm ${kayit.chapter} · ${kayit.chapterTitle}`,
  scenario: rbacScenario,
  mountScene: mountRbacScene,
  mountParams: mountRbacParams,
  mountExplainExtra: mountRbacExtra,
  shortcuts: rbacShortcuts,
};

const app = document.querySelector<HTMLElement>('#app');
if (app) {
  mountConceptPage(app, rbacPage);
}
