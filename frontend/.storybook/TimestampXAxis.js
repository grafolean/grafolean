import React from 'react';
import { storiesOf } from '@storybook/react';
import TimestampXAxis from '../src/components/Widgets/GLeanChartWidget/TimestampXAxis';

const stories = storiesOf('TimestampXAxis', module);

stories.add('list of possible scales', () => {
  const width = 1000;
  const height = 43;
  const scales = [
    73.0,
    72.0,
    25.0,
    7.4,
    4.1,
    0.9,
    0.5,
    0.28,
    0.082,
    0.035,
    0.016,
    0.01,
    0.0048,
    0.0027,
    0.00138,
    0.0008,
    0.0007,
    0.00036,
    0.00016,
    0.0001,
    0.00007,
    0.000049,
    0.000033,
    0.000015,
    0.0000089,
    0.0000028,
    0.0000017,
    0.00000074,
    0.00000042,
  ];
  const fromTs = 1545946675;
  return (
    <div>
      <svg
        width={width}
        height={(height + 10) * scales.length}
        style={{
          border: '1px solid #eee',
          backgroundColor: '#f2f2f2',
        }}
      >
        {scales.map((scale, i) => (
          <g transform={`translate(${0} ${i * (height + 10)})`}>
            <TimestampXAxis
              width={width}
              height={height}
              color="#999999"
              scale={scale}
              panX={fromTs * scale}
            />
          </g>
        ))}
      </svg>
    </div>
  );
});
