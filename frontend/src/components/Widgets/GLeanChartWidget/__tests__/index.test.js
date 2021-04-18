import React from 'react';
import { shallow } from 'enzyme';
import ChartContainer from '../ChartContainer';
import { ChartView } from '../ChartView';

const chartSeries = [
  {
    chartSerieId: `0-asdf.123`,
    path: 'asdf.123',
    serieName: 'asdf.123',
    unit: 's',
  },
  {
    chartSerieId: `0-asdf.234`,
    path: 'asdf.234',
    serieName: 'asdf.234',
    unit: 's',
  },
];

test('ChartView coordinate system transformations - dx', () => {
  const comp = shallow(<ChartView scale={0.5} />);
  const inst = comp.instance();

  const params = [
    { dx: 0, dt: 0 },
    { dx: 200, dt: 400 },
    { dx: 300, dt: 600 },
    { dx: 400, dt: 800 },
    { dx: 600, dt: 1200 },
  ];
  for (let param of params) {
    const { dx, dt } = param;
    expect(inst.dx2dt(dx)).toEqual(dt);
    expect(inst.dt2dx(dt)).toEqual(dx);
  }
});

test('ChartView coordinate system transformations - dy', () => {
  const chartContainer = shallow(
    <ChartContainer
      chartSeries={chartSeries}
      drawnChartSeries={chartSeries}
      width={500}
      fromTs={500}
      toTs={600}
      scale={1}
      zoomInProgress={false}
      xAxisHeight={50}
      yAxisWidth={50}
      height={650}
    />,
  );
  const chartContainerInstance = chartContainer.instance();

  const yAxisHeight = 600 - 40;

  chartContainerInstance.yAxesProperties = {
    s: {
      minYValue: 200,
      maxYValue: 800,
    },
  };
  chartContainerInstance.updateYAxisDerivedProperties(chartContainerInstance.props);

  const params = [
    { dv: 0, dy: 0 },
    { dv: 200, dy: yAxisHeight / 3 },
    { dv: 300, dy: yAxisHeight / 2 },
    { dv: 400, dy: (2 * yAxisHeight) / 3 },
    { dv: 600, dy: yAxisHeight },
  ];
  for (let param of params) {
    const { dv, dy } = param;
    expect(chartContainerInstance.yAxesProperties['s'].derived.dv2dy(dv)).toEqual(dy);
    expect(chartContainerInstance.yAxesProperties['s'].derived.dy2dv(dy)).toEqual(dv);
  }
});

test('ChartView coordinate system transformations - x', () => {
  const comp = shallow(
    <ChartView
      minYValue={200}
      maxYValue={800}
      height={650}
      xAxisHeight={50}
      scale={0.5}
      fromTs={1000}
      fetchedIntervalsData={[]}
    />,
  );
  const inst = comp.instance();

  const params = [
    { x: 0, t: 1000 },
    { x: 200, t: 1400 },
    { x: 300, t: 1600 },
    { x: 400, t: 1800 },
    { x: 600, t: 2200 },
  ];
  for (let param of params) {
    const { x, t } = param;
    expect(inst.x2t(x)).toEqual(t);
    expect(inst.t2x(t)).toEqual(x);
  }
});

test('ChartView coordinate system transformations - y', () => {
  const chartContainer = shallow(
    <ChartContainer
      chartSeries={chartSeries}
      drawnChartSeries={chartSeries}
      width={500}
      fromTs={500}
      toTs={600}
      scale={1}
      zoomInProgress={false}
      xAxisHeight={50}
      yAxisWidth={50}
      height={650 + 40}
    />,
  );
  const chartContainerInstance = chartContainer.instance();

  chartContainerInstance.yAxesProperties = {
    s: {
      minYValue: 200,
      maxYValue: 800,
    },
  };
  chartContainerInstance.updateYAxisDerivedProperties(chartContainerInstance.props);

  const params = [
    { y: 0, v: 800 },
    { y: 100, v: 700 },
    { y: 200, v: 600 },
    { y: 300, v: 500 },
    { y: 400, v: 400 },
    { y: 500, v: 300 },
    { y: 600, v: 200 },
  ];
  for (let param of params) {
    const { y, v } = param;
    expect(chartContainerInstance.yAxesProperties['s'].derived.v2y(v)).toEqual(y + 40);
    expect(chartContainerInstance.yAxesProperties['s'].derived.y2v(y + 40)).toEqual(v);
  }
});

test('ChartView getYTicks', () => {
  const params = [
    {
      minYValue: 0,
      maxYValue: 999,
      expectedResult: [0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000],
    },
    {
      minYValue: 0,
      maxYValue: 599,
      expectedResult: [0, 100, 200, 300, 400, 500, 600],
    },
    {
      minYValue: 0,
      maxYValue: 500,
      expectedResult: [0, 100, 200, 300, 400, 500],
    },
    {
      minYValue: 0,
      maxYValue: 499,
      expectedResult: [0, 50, 100, 150, 200, 250, 300, 350, 400, 450, 500],
    },
    {
      minYValue: 0,
      maxYValue: 200,
      expectedResult: [0, 50, 100, 150, 200],
    },
    {
      minYValue: 0,
      maxYValue: 199,
      expectedResult: [0, 20, 40, 60, 80, 100, 120, 140, 160, 180, 200],
    },
    {
      minYValue: 0,
      maxYValue: 100,
      expectedResult: [0, 20, 40, 60, 80, 100],
    },
    {
      minYValue: 0,
      maxYValue: 99,
      expectedResult: [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
    },
    {
      minYValue: 0,
      maxYValue: 9.99,
      expectedResult: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    },
    {
      minYValue: 0,
      maxYValue: 0.99,
      expectedResult: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
      expectedDecimals: 1,
    },
    {
      minYValue: 0,
      maxYValue: 1.5,
      expectedResult: [0, 0.2, 0.4, 0.6, 0.8, 1.0, 1.2, 1.4, 1.6],
      expectedDecimals: 1,
    },
    {
      minYValue: 0,
      maxYValue: 3.5,
      expectedResult: [0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5],
      expectedDecimals: 1,
    },
    {
      minYValue: 0,
      maxYValue: 0.099,
      expectedResult: [0, 0.01, 0.02, 0.03, 0.04, 0.05, 0.06, 0.07, 0.08, 0.09, 0.1],
      expectedDecimals: 2,
    },
    {
      minYValue: 0,
      maxYValue: 0.199,
      expectedResult: [0, 0.02, 0.04, 0.06, 0.08, 0.1, 0.12, 0.14, 0.16, 0.18, 0.2],
      expectedDecimals: 2,
    },
    {
      minYValue: 0,
      maxYValue: 0.399,
      expectedResult: [0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4],
      expectedDecimals: 2,
    },

    {
      minYValue: 10,
      maxYValue: 100,
      expectedResult: [10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
    },
    {
      minYValue: 50,
      maxYValue: 100,
      expectedResult: [50, 60, 70, 80, 90, 100],
    },
    {
      minYValue: -50,
      maxYValue: 100,
      expectedResult: [-60, -40, -20, 0, 20, 40, 60, 80, 100],
    },
    {
      minYValue: -50,
      maxYValue: -11,
      expectedResult: [-50, -45, -40, -35, -30, -25, -20, -15, -10],
    },
    {
      minYValue: -50,
      maxYValue: -9,
      expectedResult: [-50, -45, -40, -35, -30, -25, -20, -15, -10, -5],
    },
  ];

  for (let param of params) {
    const { minYValue, maxYValue, expectedResult, expectedDecimals } = param;
    const result = ChartView.getYTicks(minYValue, maxYValue);
    result.forEach((r, i) => {
      const expectedString = expectedResult[i].toFixed(expectedDecimals || 0);
      expect(r).toEqual(expectedString);
    });
  }
});
