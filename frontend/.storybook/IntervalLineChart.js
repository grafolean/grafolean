import React from 'react';
import { storiesOf } from '@storybook/react';
import { Button } from '@storybook/react/demo';
import IntervalLineChart from '../src/components/Widgets/GLeanChartWidget/IntervalLineChart';
import IntervalLineChartCanvas from '../src/components/Widgets/GLeanChartWidget/IntervalLineChartCanvas';

const stories = storiesOf('IntervalLineChart', module);

stories.add('random data - raw', () => {
  // test data:
  const timeFrom = 1550926131;
  const timeTo = 1551147882;
  const pathsDataRandom = [];
  const pathsDataSin = [];
  for (let t = timeFrom, i=0; t <= timeTo; t +=60.0, i++) {
    pathsDataRandom.push({ t: t, v: Math.random() * 10.0 });
    pathsDataSin.push({ t: t, v: Math.sin(i / 10.0) + 1.0 });
  }
  const YAXIS_TOP_PADDING = 30;
  const yAxisHeight = 200;
  const minY = 0.0;
  const maxY = 10.0;
  const v2y_empty_unit = v => YAXIS_TOP_PADDING + yAxisHeight - ((v - minY) * yAxisHeight) / (maxY - minY)
  const scale = 0.061930808018780474;
  const width = 600;

  // both should have the same props:
  const props = {
    timeFrom: timeFrom,
    timeTo: timeFrom + width / scale,
    scale: scale,
    //width: 500, // derived from timeFrom/To and scale
    // scale: 0.3130274288565287,

    height: yAxisHeight + YAXIS_TOP_PADDING,
    drawnChartSeries: [
      {
        path: 'dummy.sin.1min',
        unit: '',
        index: 0,
      },
      {
        path: 'dummy.random.1min',
        unit: '',
        index: 1,
      },
    ],
    interval: {
      fromTs: timeFrom,
      toTs: timeTo,
      pathsData: {
        'dummy.random.1min': pathsDataRandom,
        'dummy.sin.1min': pathsDataSin,
      }
    },
    isAggr: false,
    v2y: {
      "": v2y_empty_unit,
    },
  }

  return (
    <>
    <p>SVG:</p>
    <svg width={width} height={props.height} style={{
      border: '1px solid #eee',
    }}>
      <IntervalLineChart
        {...props}
        minKnownTs={timeFrom}
      />
    </svg>

    <hr />

    <p>Canvas:</p>
    <svg width={width} height={props.height} style={{
      border: '1px solid #eee',
    }}>
      <IntervalLineChartCanvas {...props} />
    </svg>

    </>
  )
});

stories.add('random data - aggregated', () => {
  // test data:
  const timeFrom = 1550926131;
  const timeTo = 1551147882;
  const width = 600;
  const pathsDataRandom = [];
  const pathsDataSin = [];
  for (let t = timeFrom, i=0; t <= timeTo; t += 600.0, i++) {
    const vRand = Math.random() * 10.0;
    pathsDataRandom.push({
      t: t,
      v: vRand,
      minv: vRand - Math.random() * 2.0,
      maxv: vRand + Math.random() * 2.0,
    });
    const vSin = Math.sin(i / 1.0) + 3.2;
    pathsDataSin.push({
      t: t,
      v: vSin,
      minv: vSin - Math.random() * 2.0,
      maxv: vSin + Math.random() * 2.0,
    });
  }
  const YAXIS_TOP_PADDING = 30;
  const yAxisHeight = 200;
  const minY = 0.0;
  const maxY = 10.0;
  const v2y_empty_unit = v => YAXIS_TOP_PADDING + yAxisHeight - ((v - minY) * yAxisHeight) / (maxY - minY)
  const scale = 0.061930808018780474;

  // both should have the same props:
  const props = {
    timeFrom: timeFrom,
    timeTo: timeFrom + width / scale,
    scale: scale,
    //width: width, // derived from timeFrom/To and scale

    height: yAxisHeight + YAXIS_TOP_PADDING,
    drawnChartSeries: [
      {
        path: 'dummy.sin.1min',
        unit: '',
        index: 0,
      },
      {
        path: 'dummy.random.1min',
        unit: '',
        index: 1,
      },
    ],
    interval: {
      fromTs: timeFrom,
      toTs: timeTo,
      pathsData: {
        'dummy.random.1min': pathsDataRandom,
        'dummy.sin.1min': pathsDataSin,
      }
    },
    isAggr: true,
    v2y: {
      "": v2y_empty_unit,
    },
  };

  return (
    <>
    <p>SVG:</p>
    <svg width={width} height={yAxisHeight + YAXIS_TOP_PADDING} style={{
      border: '1px solid #eee',
    }}>
      <IntervalLineChart
        {...props}
        minKnownTs={timeFrom}
      />
    </svg>

    <hr />

    <p>Canvas:</p>
    <svg width={width} height={yAxisHeight + YAXIS_TOP_PADDING} style={{
      border: '1px solid #eee',
    }}>
      <IntervalLineChartCanvas {...props} />
    </svg>

    </>
  )
});

stories.add('with some emoji', () => (
  <Button><span role="img" aria-label="so cool">😀 😎 👍 💯</span></Button>
));