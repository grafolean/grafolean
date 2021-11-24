import React from 'react';
import { storiesOf } from '@storybook/react';
import YAxisMinMaxAdjuster from '../../src/components/Widgets/GLeanChartWidget/YAxisMinMaxAdjuster';

const stories = storiesOf('YAxisMinMaxAdjuster', module);

stories.add('min / max', () => {
  return (
    <svg
      width={500}
      height={400}
      style={{
        border: '1px solid #eee',
      }}
    >
      <YAxisMinMaxAdjuster
        startY={10}
        x={10}
        shadowWidth={300}
        topLimit={10}
        bottomLimit={100}
        onChangeEnd={y => console.log('New y is: ' + y)}
      />
    </svg>
  );
});
