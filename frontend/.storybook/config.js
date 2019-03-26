import { configure } from '@storybook/react';

function loadStories() {
  // require('./IntervalLineChart.js');
  require('./YAxisMinMaxAdjuster.js');
  require('./TimestampXAxis.js');
}

configure(loadStories, module);
