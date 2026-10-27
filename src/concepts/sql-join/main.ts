import '../../core/theme.css';
import { mountConceptPage, type ConceptPage } from '../../core/shell';
import { concepts } from '../registry';
import { mountSqlParams, sqlShortcuts } from './controls';
import { sqlScenario, type SqlParams } from './scenario';
import { mountSqlExtra, mountSqlScene } from './scene';

const kayit = concepts.find((c) => c.id === 'sql-join')!;

export const sqlPage: ConceptPage<SqlParams> = {
  title: 'JOIN ile tabloları birleştirme',
  chapter: `Bölüm ${kayit.chapter} · ${kayit.chapterTitle}`,
  scenario: sqlScenario,
  mountScene: mountSqlScene,
  mountParams: mountSqlParams,
  mountExplainExtra: mountSqlExtra,
  shortcuts: sqlShortcuts,
};

const app = document.querySelector<HTMLElement>('#app');
if (app) {
  mountConceptPage(app, sqlPage);
}
