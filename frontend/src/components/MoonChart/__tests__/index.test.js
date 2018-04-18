import React from 'react';
import { shallow } from 'enzyme';
import MoonChartContainer, { ChartView } from '../index';

test('MoonChartContainer merging of intervals - add before', () => {
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

test('MoonChartContainer merging of intervals - add between', () => {
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

test('ChartView coordinate system transformations - dx', () => {
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

test('ChartView coordinate system transformations - dy', () => {
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

test('ChartView coordinate system transformations - y', () => {
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

