import '../../core/theme.css';
import { mountConceptPage, type ConceptPage } from '../../core/shell';
import { concepts } from '../registry';
import { mountIotParams } from './controls';
import { iotScenario, type IotParams } from './scenario';
import { mountIotExtra, mountIotScene } from './scene';

const kayit = concepts.find((c) => c.id === 'iot-zaman-serisi')!;

export const iotPage: ConceptPage<IotParams> = {
  title: 'IoT: sensör verisi ve zaman serisi',
  chapter: `Bölüm ${kayit.chapter} · ${kayit.chapterTitle}`,
  scenario: iotScenario,
  mountScene: mountIotScene,
  mountParams: mountIotParams,
  mountExplainExtra: mountIotExtra,
};

const app = document.querySelector<HTMLElement>('#app');
if (app) {
  mountConceptPage(app, iotPage);
}
