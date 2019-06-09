import { getMissingIntervals, aggregateIntervalOnTheFly } from '../utils';

test('getMissingIntervals', () => {
  const params = [
    {
      existingIntervals: [{ fromTs: 50, toTs: 100 }],
      wantedInterval: { fromTs: 100, toTs: 150 },
      expectedResult: [{ fromTs: 100, toTs: 150 }],
    },
    {
      existingIntervals: [{ fromTs: 50, toTs: 100 }],
      wantedInterval: { fromTs: 10, toTs: 50 },
      expectedResult: [{ fromTs: 10, toTs: 50 }],
    },
    {
      existingIntervals: [{ fromTs: 50, toTs: 100 }],
      wantedInterval: { fromTs: 10, toTs: 15 },
      expectedResult: [{ fromTs: 10, toTs: 15 }],
    },
    {
      existingIntervals: [{ fromTs: 50, toTs: 100 }],
      wantedInterval: { fromTs: 110, toTs: 150 },
      expectedResult: [{ fromTs: 110, toTs: 150 }],
    },
    {
      existingIntervals: [{ fromTs: 50, toTs: 100 }],
      wantedInterval: { fromTs: 11, toTs: 55 },
      expectedResult: [{ fromTs: 11, toTs: 50 }],
    },
    {
      existingIntervals: [{ fromTs: 50, toTs: 100 }],
      wantedInterval: { fromTs: 88, toTs: 155 },
      expectedResult: [{ fromTs: 100, toTs: 155 }],
    },
    {
      existingIntervals: [{ fromTs: 50, toTs: 100 }],
      wantedInterval: { fromTs: 38, toTs: 155 },
      expectedResult: [{ fromTs: 38, toTs: 50 }, { fromTs: 100, toTs: 155 }],
    },
    {
      existingIntervals: [{ fromTs: 50, toTs: 100 }, { fromTs: 200, toTs: 255 }],
      wantedInterval: { fromTs: 3, toTs: 355 },
      expectedResult: [{ fromTs: 3, toTs: 50 }, { fromTs: 100, toTs: 200 }, { fromTs: 255, toTs: 355 }],
    },
  ];
  for (let param of params) {
    const { existingIntervals, wantedInterval, expectedResult } = param;
    expect(getMissingIntervals(existingIntervals, wantedInterval)).toEqual(expectedResult);
  }
});

test('aggregateIntervalOnTheFly single path, single bucket', () => {
  const fromTs = 2000;
  const toTs = 4000;
  const csData = {
    '0-asdf.123': [{ t: 2010, v: 100.0 }, { t: 2020, v: 150.0 }, { t: 2030, v: 110.0 }],
  };
  const useAggrLevel = -1; // aggr. interval == 1200 s
  const expectedResult = {
    '0-asdf.123': [
      { t: 1800, v: 120.0, minv: 100.0, maxv: 150.0 },
      { t: 3000, v: null, minv: null, maxv: null },
      { t: 4200, v: null, minv: null, maxv: null },
    ],
  };

  const result = aggregateIntervalOnTheFly(fromTs, toTs, csData, useAggrLevel);
  expect(result).toEqual(expectedResult);
});

test('aggregateIntervalOnTheFly single path, multiple buckets', () => {
  const fromTs = 2000;
  const toTs = 4000;
  const csData = {
    '0-asdf.123': [
      { t: 2010, v: 100.0 },
      { t: 2020, v: 150.0 },
      { t: 2030, v: 110.0 },
      { t: 2510, v: 300.0 },
      { t: 2520, v: 350.0 },
      { t: 2530, v: 310.0 },
    ],
  };
  const useAggrLevel = -1; // aggr. interval == 1200 s
  const expectedResult = {
    '0-asdf.123': [
      { t: 1800, v: 120.0, minv: 100.0, maxv: 150.0 },
      { t: 3000, v: 320.0, minv: 300.0, maxv: 350.0 },
      { t: 4200, v: null, minv: null, maxv: null },
    ],
  };

  const result = aggregateIntervalOnTheFly(fromTs, toTs, csData, useAggrLevel);
  expect(result).toEqual(expectedResult);
});

test('aggregateIntervalOnTheFly multiple paths, multiple buckets', () => {
  const fromTs = 2000;
  const toTs = 4000;
  const csData = {
    '0-asdf.123': [
      { t: 2010, v: 100.0 },
      { t: 2020, v: 150.0 },
      { t: 2030, v: 110.0 },
      { t: 2510, v: 300.0 },
      { t: 2520, v: 350.0 },
      { t: 2530, v: 310.0 },
    ],
    '0-asdf.234': [
      { t: 2510, v: 200.0 },
      { t: 2520, v: 250.0 },
      { t: 2530, v: 210.0 },
      { t: 3810, v: 400.0 },
      { t: 3820, v: 450.0 },
      { t: 3830, v: 410.0 },
    ],
  };
  const useAggrLevel = -1; // aggr. interval == 1200 s
  const expectedResult = {
    '0-asdf.123': [
      { t: 1800, v: 120.0, minv: 100.0, maxv: 150.0 },
      { t: 3000, v: 320.0, minv: 300.0, maxv: 350.0 },
      { t: 4200, v: null, minv: null, maxv: null },
    ],
    '0-asdf.234': [
      { t: 1800, v: null, minv: null, maxv: null },
      { t: 3000, v: 220.0, minv: 200.0, maxv: 250.0 },
      { t: 4200, v: 420.0, minv: 400.0, maxv: 450.0 },
    ],
  };

  const result = aggregateIntervalOnTheFly(fromTs, toTs, csData, useAggrLevel);
  expect(result).toEqual(expectedResult);
});

test('aggregateIntervalOnTheFly multiple paths, multiple buckets, aggr -2', () => {
  const fromTs = 2000;
  const toTs = 4000;
  const csData = {
    '0-asdf.123': [
      { t: 2010, v: 100.0 },
      { t: 2020, v: 150.0 },
      { t: 2030, v: 110.0 },
      { t: 2510, v: 300.0 },
      { t: 2520, v: 350.0 },
      { t: 2530, v: 310.0 },
    ],
    '0-asdf.234': [
      { t: 2510, v: 200.0 },
      { t: 2520, v: 250.0 },
      { t: 2530, v: 210.0 },
      { t: 3810, v: 400.0 },
      { t: 3820, v: 450.0 },
      { t: 3830, v: 410.0 },
    ],
  };
  const useAggrLevel = -2; // aggr. interval == 400 s
  const expectedResult = {
    '0-asdf.123': [
      { t: 2200, v: 120.0, minv: 100.0, maxv: 150.0 },
      { t: 2600, v: 320.0, minv: 300.0, maxv: 350.0 },
      { t: 3000, v: null, minv: null, maxv: null },
      { t: 3400, v: null, minv: null, maxv: null },
      { t: 3800, v: null, minv: null, maxv: null },
    ],
    '0-asdf.234': [
      { t: 2200, v: null, minv: null, maxv: null },
      { t: 2600, v: 220.0, minv: 200.0, maxv: 250.0 },
      { t: 3000, v: null, minv: null, maxv: null },
      { t: 3400, v: null, minv: null, maxv: null },
      { t: 3800, v: 420.0, minv: 400.0, maxv: 450.0 },
    ],
  };

  const result = aggregateIntervalOnTheFly(fromTs, toTs, csData, useAggrLevel);
  expect(result).toEqual(expectedResult);
});
