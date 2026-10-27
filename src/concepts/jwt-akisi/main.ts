import '../../core/theme.css';
import { mountConceptPage, type ConceptPage } from '../../core/shell';
import { concepts } from '../registry';
import { jwtShortcuts, mountJwtParams } from './controls';
import { jwtScenario, type JwtParams } from './scenario';
import { mountJwtExtra, mountJwtScene } from './scene';

const kayit = concepts.find((c) => c.id === 'jwt-akisi')!;

export const jwtPage: ConceptPage<JwtParams> = {
  title: 'JWT: üretim ve doğrulama',
  chapter: `Bölüm ${kayit.chapter} · ${kayit.chapterTitle}`,
  scenario: jwtScenario,
  mountScene: mountJwtScene,
  mountParams: mountJwtParams,
  mountExplainExtra: mountJwtExtra,
  shortcuts: jwtShortcuts,
};

const app = document.querySelector<HTMLElement>('#app');
if (app) {
  mountConceptPage(app, jwtPage);
}
