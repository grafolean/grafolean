import React from 'react';
import { storiesOf } from '@storybook/react';

import LineChartCanvases from '../../src/components/Widgets/GLeanChartWidget/LineChartCanvas';
import ChartView from '../../src/components/Widgets/GLeanChartWidget/ChartView';

const stories = storiesOf('Line chart - components', module);

// test data:
const timeFrom = 1550926131;
const timeTo = 1551147882;
const csDataRandom = [];
const csDataSin = [];
for (let t = timeFrom, i = 0; t <= timeTo; t += 600.0, i++) {
  const vRand = Math.random() * 10.0;
  csDataRandom.push({
    t: t,
    v: vRand,
    minv: vRand - Math.random() * 2.0,
    maxv: vRand + Math.random() * 2.0,
  });
  const vSin = Math.sin(i / 1.0) + 3.2;
  csDataSin.push({
    t: t,
    v: vSin,
    minv: vSin - Math.random() * 2.0,
    maxv: vSin + Math.random() * 2.0,
  });
}
const csDataRandomRaw = csDataRandom.map(d => ({ t: d.t, v: d.v }));
const csDataSinRaw = csDataSin.map(d => ({ t: d.t, v: d.v }));
const drawnChartSeries = [
  {
    chartSerieId: '0-dummy.sin.1min',
    path: 'dummy.sin.1min',
    unit: '',
    index: 0,
  },
  {
    chartSerieId: '0-dummy.random.1min',
    path: 'dummy.random.1min',
    unit: '',
    index: 1,
  },
];

const YAXIS_TOP_PADDING = 30;
const yAxisHeight = 200;
const minY = 0.0;
const maxY = 10.0;
const v2y_empty_unit = v => YAXIS_TOP_PADDING + yAxisHeight - ((v - minY) * yAxisHeight) / (maxY - minY);
const width = 600;

stories.add('LineChartCanvases - random data - raw', () => {
  const scale = 0.061930808018780474;

  // both should have the same props:
  const props = {
    fromTs: timeFrom,
    toTs: timeFrom + width / scale,
    scale: scale,
    //width: 500, // derived from timeFrom/To and scale
    // scale: 0.3130274288565287,

    height: yAxisHeight + YAXIS_TOP_PADDING,
    drawnChartSeries: drawnChartSeries,
    intervals: [
      {
        fromTs: timeFrom,
        toTs: timeTo,
        csData: {
          '0-dummy.random.1min': csDataRandomRaw,
          '0-dummy.sin.1min': csDataSinRaw,
        },
      },
    ],
    isAggr: false,
    yAxesProperties: {
      '': {
        minYValue: minY,
        maxYValue: maxY,
        derived: {
          ticks: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'],
          v2y: v2y_empty_unit,
        },
      },
    },
  };

  return (
    <>
      <p>Canvas:</p>
      <svg
        width={width}
        height={props.height}
        style={{
          border: '1px solid #999',
          backgroundColor: '#eee',
        }}
      >
        <LineChartCanvases {...props} />
      </svg>
    </>
  );
});

stories.add('LineChartCanvases - random data - aggregated', () => {
  const scale = 0.061930808018780474;

  // both should have the same props:
  const props = {
    fromTs: timeFrom,
    toTs: timeFrom + width / scale,
    scale: scale,
    //width: width, // derived from timeFrom/To and scale

    height: yAxisHeight + YAXIS_TOP_PADDING,
    drawnChartSeries: drawnChartSeries,
    intervals: [
      {
        fromTs: timeFrom,
        toTs: timeTo,
        csData: {
          '0-dummy.random.1min': csDataRandom,
          '0-dummy.sin.1min': csDataSin,
        },
      },
    ],
    isAggr: true,
    yAxesProperties: {
      '': {
        minYValue: minY,
        maxYValue: maxY,
        derived: {
          ticks: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'],
          v2y: v2y_empty_unit,
        },
      },
    },
  };

  return (
    <>
      <p>Canvas:</p>
      <svg
        width={width}
        height={yAxisHeight + YAXIS_TOP_PADDING}
        style={{
          border: '1px solid #eee',
        }}
      >
        <LineChartCanvases {...props} />
      </svg>
    </>
  );
});

stories.add('ChartView', () => {
  const scale = 0.061930808018780474;
  const props = {
    aggrLevel: 2,
    chartSeries: drawnChartSeries,
    drawnChartSeries: drawnChartSeries,
    errorMsg: null,
    fetchedIntervalsData: [
      {
        fromTs: timeFrom,
        toTs: timeTo,
        csData: {
          '0-dummy.random.1min': csDataRandom,
          '0-dummy.sin.1min': csDataSin,
        },
      },
    ],
    fetching: false,
    fromTs: timeFrom,
    toTs: timeTo,
    isAggr: true,
    minKnownTs: timeFrom,
    nDecimals: 2,
    registerClickHandler: () => {},
    registerMouseMoveHandler: () => {},
    scale: scale,
    width: width,
    xAxisHeight: 43,
    yAxesProperties: {
      '': {
        minYValue: minY,
        maxYValue: maxY,
        derived: {
          ticks: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'],
          v2y: v2y_empty_unit,
        },
      },
    },
    yAxisHeight: yAxisHeight,
    yAxisWidth: 70,
    height: yAxisHeight + YAXIS_TOP_PADDING + 43,
    zoomInProgress: false,
  };

  return <ChartView {...props} />;
});
