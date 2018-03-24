import React from 'react';
import { shallow } from 'enzyme';
import MoonChartContainer from '../index';

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

