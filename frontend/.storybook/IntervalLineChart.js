import React from 'react';
import { storiesOf } from '@storybook/react';
import IntervalLineChart from '../src/components/Widgets/GLeanChartWidget/IntervalLineChart';
import IntervalLineChartCanvas from '../src/components/Widgets/GLeanChartWidget/IntervalLineChartCanvas';
import { ChartView } from '../src/components/Widgets/GLeanChartWidget';

const stories = storiesOf('IntervalLineChart', module);

// test data:
const timeFrom = 1550926131;
const timeTo = 1551147882;
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
const pathsDataRandomRaw = pathsDataRandom.map(d => ({ t: d.t, v: d.v }));
const pathsDataSinRaw = pathsDataSin.map(d => ({ t: d.t, v: d.v }));
const drawnChartSeries = [
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
];

const YAXIS_TOP_PADDING = 30;
const yAxisHeight = 200;
const minY = 0.0;
const maxY = 10.0;
const v2y_empty_unit = v => YAXIS_TOP_PADDING + yAxisHeight - ((v - minY) * yAxisHeight) / (maxY - minY)
const width = 600;

stories.add('random data - raw', () => {
  const scale = 0.061930808018780474;

  // both should have the same props:
  const props = {
    timeFrom: timeFrom,
    timeTo: timeFrom + width / scale,
    scale: scale,
    //width: 500, // derived from timeFrom/To and scale
    // scale: 0.3130274288565287,

    height: yAxisHeight + YAXIS_TOP_PADDING,
    drawnChartSeries: drawnChartSeries,
    interval: {
      fromTs: timeFrom,
      toTs: timeTo,
      pathsData: {
        'dummy.random.1min': pathsDataRandomRaw,
        'dummy.sin.1min': pathsDataSinRaw,
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
  const scale = 0.061930808018780474;

  // both should have the same props:
  const props = {
    timeFrom: timeFrom,
    timeTo: timeFrom + width / scale,
    scale: scale,
    //width: width, // derived from timeFrom/To and scale

    height: yAxisHeight + YAXIS_TOP_PADDING,
    drawnChartSeries: drawnChartSeries,
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

stories.add('whole chart', () => {
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
        pathsData: {
          'dummy.random.1min': pathsDataRandom,
          'dummy.sin.1min': pathsDataSin,
        },
      },
    ],
    fetching: false,
    fromTs: timeFrom,
    height: yAxisHeight + YAXIS_TOP_PADDING,
    isAggr: true,
    minKnownTs: timeFrom,
    nDecimals: 2,
    registerClickHandler: () => {},
    registerMouseMoveHandler: () => {},
    scale: scale,
    toTs: timeTo,
    width: width,
    xAxisHeight: 43,
    yAxesProperties: {
      '': {
        minYValue: minY,
        maxYValue: maxY,
        derived: {
          ticks: [
            "0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10",
          ],
          v2y: v2y_empty_unit,
        }
      }
    },
    yAxisHeight: yAxisHeight,
    yAxisWidth: 70,
    zoomInProgress: false,
  };

  return (
    <ChartView
      {...props}
    />
  )
});