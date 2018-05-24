import React from 'react';
import { shallow } from 'enzyme';
import MoonChartContainer, { ChartView } from '../index';

test.skip('MoonChartContainer merging of intervals - add before', () => {
  const moonChart = shallow(
    <MoonChartContainer
      chartId={123}
      paths={["asdf.123", "asdf.234"]}
      portWidth={100}
      portHeight={100}
      fromTs={500}
      toTs={600}
      scale={1}
      zoomInProgress={false}
    />
  );
  const moonChartInstance = moonChart.instance();

  expect(moonChartInstance.fetchedData).toEqual({});
  moonChart.instance().saveResponseData(400, 700, 2, {
    paths: {
      "asdf.123": {
        data: [
          {t: 444, v: 100.1},
          {t: 555, v: 200.2},
          {t: 666, v: 300.3},
        ],
      },
      "asdf.234": {
        data: [
          {t: 449, v: 109.1},
          {t: 559, v: 209.2},
          {t: 669, v: 309.3},
        ],
      },
    },
  });
  // console.log(moonChartInstance.fetchedData)
  // console.log(moonChartInstance.fetchedData['2'][0].pathsData)
  expect(moonChartInstance.fetchedData).toEqual({
    '2': [
      {
        fromTs: 400,
        toTs: 700,
        pathsData: {
          'asdf.123': [
            { t: 444, v: 100.1 },
            { t: 555, v: 200.2 },
            { t: 666, v: 300.3 },
          ],
          'asdf.234': [
            { t: 449, v: 109.1 },
            { t: 559, v: 209.2 },
            { t: 669, v: 309.3 },
          ],
        },
      },
    ],
  });
  moonChart.instance().saveResponseData(300, 400, 2, {
    paths: {
      "asdf.123": {
        data: [
          {t: 333, v: 50.1},
        ],
      },
      "asdf.234": {
        data: [
          {t: 339, v: 59.1},
        ],
      },
    },
  });
  expect(moonChartInstance.fetchedData).toEqual({
    '2': [
      {
        fromTs: 300,
        toTs: 700,
        pathsData: {
          'asdf.123': [
            { t: 333, v: 50.1 },
            { t: 444, v: 100.1 },
            { t: 555, v: 200.2 },
            { t: 666, v: 300.3 },
          ],
          'asdf.234': [
            { t: 339, v: 59.1 },
            { t: 449, v: 109.1 },
            { t: 559, v: 209.2 },
            { t: 669, v: 309.3 },
          ],
        },
      },
    ],
  });
});

test.skip('MoonChartContainer merging of intervals - add between', () => {
  const moonChart = shallow(
    <MoonChartContainer
      chartId={123}
      paths={["asdf.123", "asdf.234"]}
      portWidth={100}
      portHeight={100}
      fromTs={500}
      toTs={600}
      scale={1}
      zoomInProgress={false}
    />
  );
  const moonChartInstance = moonChart.instance();

  expect(moonChartInstance.fetchedData).toEqual({});
  moonChart.instance().saveResponseData(400, 700, 2, {
    paths: {
      "asdf.123": {
        data: [
          {t: 444, v: 100.1},
          {t: 555, v: 200.2},
          {t: 666, v: 300.3},
        ],
      },
      "asdf.234": {
        data: [
          {t: 449, v: 109.1},
          {t: 559, v: 209.2},
          {t: 669, v: 309.3},
        ],
      },
    },
  });
  moonChart.instance().saveResponseData(200, 300, 2, {
    paths: {
      "asdf.123": {
        data: [
          {t: 222, v: 20.1},
        ],
      },
      "asdf.234": {
        data: [
          {t: 229, v: 29.1},
        ],
      },
    },
  });
  // console.log(moonChartInstance.fetchedData)
  // console.log(moonChartInstance.fetchedData['2'][0].pathsData)
  expect(moonChartInstance.fetchedData).toEqual({
    '2': [
      {
        fromTs: 200,
        toTs: 300,
        pathsData: {
          'asdf.123': [
            { t: 222, v: 20.1 },
          ],
          'asdf.234': [
            { t: 229, v: 29.1 },
          ],
        },
      },
      {
        fromTs: 400,
        toTs: 700,
        pathsData: {
          'asdf.123': [
            { t: 444, v: 100.1 },
            { t: 555, v: 200.2 },
            { t: 666, v: 300.3 },
          ],
          'asdf.234': [
            { t: 449, v: 109.1 },
            { t: 559, v: 209.2 },
            { t: 669, v: 309.3 },
          ],
        },
      },
    ],
  });
  moonChart.instance().saveResponseData(300, 400, 2, {
    paths: {
      "asdf.123": {
        data: [
          {t: 333, v: 50.1},
        ],
      },
      "asdf.234": {
        data: [
          {t: 339, v: 59.1},
        ],
      },
    },
  });
  expect(moonChartInstance.fetchedData).toEqual({
    '2': [
      {
        fromTs: 200,
        toTs: 700,
        pathsData: {
          'asdf.123': [
            { t: 222, v: 20.1 },
            { t: 333, v: 50.1 },
            { t: 444, v: 100.1 },
            { t: 555, v: 200.2 },
            { t: 666, v: 300.3 },
          ],
          'asdf.234': [
            { t: 229, v: 29.1 },
            { t: 339, v: 59.1 },
            { t: 449, v: 109.1 },
            { t: 559, v: 209.2 },
            { t: 669, v: 309.3 },
          ],
        },
      },
    ],
  });
});

test.skip('ChartView coordinate system transformations - dx', () => {
  const comp = shallow(
    <ChartView
      minYValue={200}
      maxYValue={800}
      height={650}
      xAxisHeight={50}
      scale={0.5}
      fetchedIntervalsData={[]}
    />
  );
  const inst = comp.instance();
  const yAxisHeight=600;

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

test.skip('ChartView coordinate system transformations - dy', () => {
  const comp = shallow(
    <ChartView
      minYValue={200}
      maxYValue={800}
      height={650}
      xAxisHeight={50}
      scale={0.5}
      fetchedIntervalsData={[]}
    />
  );
  const inst = comp.instance();
  const yAxisHeight=600;

  const params = [
    { dv: 0, dy: 0 },
    { dv: 200, dy: yAxisHeight / 3 },
    { dv: 300, dy: yAxisHeight / 2 },
    { dv: 400, dy: 2 * yAxisHeight / 3 },
    { dv: 600, dy: yAxisHeight },
  ];
  for (let param of params) {
    const { dv, dy } = param;
    expect(inst.dv2dy(dv)).toEqual(dy);
    expect(inst.dy2dv(dy)).toEqual(dv);
  }
})

test.skip('ChartView coordinate system transformations - x', () => {
  const comp = shallow(
    <ChartView
      minYValue={200}
      maxYValue={800}
      height={650}
      xAxisHeight={50}
      scale={0.5}
      fromTs={1000}
      fetchedIntervalsData={[]}
    />
  );
  const inst = comp.instance();
  const yAxisHeight=600;

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

test.skip('ChartView coordinate system transformations - y', () => {
  const comp = shallow(
    <ChartView
      minYValue={200}
      maxYValue={800}
      height={650}
      xAxisHeight={50}
      scale={0.5}
      fromTs={1000}
      fetchedIntervalsData={[]}
    />
  );
  const inst = comp.instance();
  const yAxisHeight=600;

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
    expect(inst.y2v(y)).toEqual(v);
    expect(inst.v2y(v)).toEqual(y);
  }
});

test('ChartView getYTicks', () => {
  const params = [
    {
      minYValue: 0,
      maxYValue: 999,
      expectedResult: [ 0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000 ],
    },
    {
      minYValue: 0,
      maxYValue: 599,
      expectedResult: [ 0, 100, 200, 300, 400, 500, 600 ],
    },
    {
      minYValue: 0,
      maxYValue: 500,
      expectedResult: [ 0, 100, 200, 300, 400, 500 ],
    },
    {
      minYValue: 0,
      maxYValue: 499,
      expectedResult: [ 0, 50, 100, 150, 200, 250, 300, 350, 400, 450, 500 ],
    },
    {
      minYValue: 0,
      maxYValue: 200,
      expectedResult: [ 0, 50, 100, 150, 200 ],
    },
    {
      minYValue: 0,
      maxYValue: 199,
      expectedResult: [ 0, 20, 40, 60, 80, 100, 120, 140, 160, 180, 200 ],
    },
    {
      minYValue: 0,
      maxYValue: 100,
      expectedResult: [ 0, 20, 40, 60, 80, 100 ],
    },
    {
      minYValue: 0,
      maxYValue: 99,
      expectedResult: [ 0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100 ],
    },
    {
      minYValue: 0,
      maxYValue: 9.99,
      expectedResult: [ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10 ],
    },
    {
      minYValue: 0,
      maxYValue: 0.99,
      expectedResult: [ 0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0 ],
    },
    {
      minYValue: 0,
      maxYValue: 0.099,
      expectedResult: [ 0, 0.01, 0.02, 0.03, 0.04, 0.05, 0.06, 0.07, 0.08, 0.09, 0.1 ],
    },

    {
      minYValue: 10,
      maxYValue: 100,
      expectedResult: [ 10, 20, 30, 40, 50, 60, 70, 80, 90, 100 ],
    },
    {
      minYValue: 50,
      maxYValue: 100,
      expectedResult: [ 50, 60, 70, 80, 90, 100 ],
    },
    {
      minYValue: -50,
      maxYValue: 100,
      expectedResult: [ -60, -40, -20, 0, 20, 40, 60, 80, 100 ],
    },
    {
      minYValue: -50,
      maxYValue: -11,
      expectedResult: [ -50, -45, -40, -35, -30, -25, -20, -15, -10 ],
    },
    {
      minYValue: -50,
      maxYValue: -9,
      expectedResult: [ -50, -45, -40, -35, -30, -25, -20, -15, -10, -5 ],
    },
  ]

  for (let param of params) {
    const { minYValue, maxYValue, expectedResult } = param;
    //ChartView.getYTicks(minYValue, maxYValue);
    const result = ChartView.getYTicks(minYValue, maxYValue);
    result.map((r, i) => {
      expect(r).toBeCloseTo(expectedResult[i]);
    })
  };
})

