import { configure } from '@storybook/react';

import '@fortawesome/fontawesome-free/css/all.css';
import '@fortawesome/fontawesome-free/css/v4-shims.css';

import '../src/index.scss';


function loadStories() {
  require('./IntervalLineChart.js');
  require('./YAxisMinMaxAdjuster.js');
  require('./TimestampXAxis.js');
  require('./MultiSelect.js');
}

configure(loadStories, module);
