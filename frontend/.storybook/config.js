import { configure } from '@storybook/react';

function loadStories() {
  require('./IntervalLineChart.js');
}

configure(loadStories, module);
