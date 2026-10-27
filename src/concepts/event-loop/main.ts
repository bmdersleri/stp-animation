import '../../core/theme.css';
import { mountConceptPage, type ConceptPage } from '../../core/shell';
import { loopShortcuts, mountLoopParams } from './controls';
import { loopScenario, type LoopParams } from './scenario';
import { mountLoopExtra, mountLoopScene } from './scene';

export const loopPage: ConceptPage<LoopParams> = {
  title: 'Event loop: çağrı yığını ve kuyruklar',
  chapter: 'Bölüm 4 · Node.js Runtime, npm ve Sunucu Tarafı Programlama',
  scenario: loopScenario,
  mountScene: mountLoopScene,
  mountParams: mountLoopParams,
  mountExplainExtra: mountLoopExtra,
  shortcuts: loopShortcuts,
};

const app = document.querySelector<HTMLElement>('#app');
if (app) {
  mountConceptPage(app, loopPage);
}
