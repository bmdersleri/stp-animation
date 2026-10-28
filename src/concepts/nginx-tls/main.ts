import '../../core/theme.css';
import { mountConceptPage, type ConceptPage } from '../../core/shell';
import { concepts } from '../registry';
import { mountNginxParams } from './controls';
import { nginxScenario, type NginxTlsParams } from './scenario';
import { mountNginxExtra, mountNginxScene } from './scene';

const kayit = concepts.find((c) => c.id === 'nginx-tls')!;

export const nginxPage: ConceptPage<NginxTlsParams> = {
  title: 'Nginx reverse proxy ve HTTPS/TLS',
  chapter: `Bölüm ${kayit.chapter} · ${kayit.chapterTitle}`,
  scenario: nginxScenario,
  mountScene: mountNginxScene,
  mountParams: mountNginxParams,
  mountExplainExtra: mountNginxExtra,
};

const app = document.querySelector<HTMLElement>('#app');
if (app) {
  mountConceptPage(app, nginxPage);
}
