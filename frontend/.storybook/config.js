import { configure } from '@storybook/react';

function loadStories() {
  // require('./IntervalLineChart.js');
  require('./YAxisMinMaxAdjuster.js');
}

configure(loadStories, module);
