import React from 'react';
import { storiesOf } from '@storybook/react';
import AdjusterMark from '../src/components/Widgets/GLeanChartWidget/YAxisMinMaxAdjuster';

const stories = storiesOf('YAxisMinMaxAdjuster', module);

import '../src/components/Widgets/GLeanChartWidget/index.scss';

stories.add('min / max', () => {

  return (
    <>
    <svg width={500} height={400} style={{
      border: '1px solid #eee',
    }}>
      <AdjusterMark
        startY={10}
        x={10}
        shadowWidth={200}
        minY={10}
        maxY={100}
      />
    </svg>
    </>
  )
});

