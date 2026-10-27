import '../../core/theme.css';
import { mountConceptPage, type ConceptPage } from '../../core/shell';
import { istekShortcuts, mountIstekParams } from './controls';
import { istekScenario, type IstekParams } from './scenario';
import { mountIstekExtra, mountIstekScene } from './scene';

export const istekPage: ConceptPage<IstekParams> = {
  title: "İstek-yanıt yolculuğu: istemciden backend'e",
  chapter: 'Bölüm 1 · Modern Backend Programlamaya Giriş ve Web Mimarisi',
  scenario: istekScenario,
  mountScene: mountIstekScene,
  mountParams: mountIstekParams,
  mountExplainExtra: mountIstekExtra,
  shortcuts: istekShortcuts,
};

const app = document.querySelector<HTMLElement>('#app');
if (app) {
  mountConceptPage(app, istekPage);
}
