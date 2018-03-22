import React from 'react';
import { getMissingIntervals } from '../utils';

test('getMissingIntervals', () => {
  const params = [
    {
      existingIntervals: [ {fromTs: 50, toTs: 100} ],
      wantedInterval: {fromTs: 100, toTs: 150},
      expectedResult: [ {fromTs: 100, toTs: 150} ],
    },
    {
      existingIntervals: [ {fromTs: 50, toTs: 100} ],
      wantedInterval: {fromTs: 10, toTs: 50},
      expectedResult: [ {fromTs: 10, toTs: 50} ],
    },
    {
      existingIntervals: [ {fromTs: 50, toTs: 100} ],
      wantedInterval: {fromTs: 10, toTs: 15},
      expectedResult: [ {fromTs: 10, toTs: 15} ],
    },
    {
      existingIntervals: [ {fromTs: 50, toTs: 100} ],
      wantedInterval: {fromTs: 110, toTs: 150},
      expectedResult: [ {fromTs: 110, toTs: 150} ],
    },
    {
      existingIntervals: [ {fromTs: 50, toTs: 100} ],
      wantedInterval: {fromTs: 11, toTs: 55},
      expectedResult: [ {fromTs: 11, toTs: 50} ],
    },
    {
      existingIntervals: [ {fromTs: 50, toTs: 100} ],
      wantedInterval: {fromTs: 88, toTs: 155},
      expectedResult: [ {fromTs: 100, toTs: 155} ],
    },
    {
      existingIntervals: [ {fromTs: 50, toTs: 100} ],
      wantedInterval: {fromTs: 38, toTs: 155},
      expectedResult: [ {fromTs: 38, toTs: 50}, {fromTs: 100, toTs: 155} ],
    },
    {
      existingIntervals: [ {fromTs: 50, toTs: 100}, {fromTs: 200, toTs: 255} ],
      wantedInterval: {fromTs: 3, toTs: 355},
      expectedResult: [ {fromTs: 3, toTs: 50}, {fromTs: 100, toTs: 200}, {fromTs: 255, toTs: 355} ],
    },
  ];
  for (let param of params) {
    const { existingIntervals, wantedInterval, expectedResult } = param;
    expect(getMissingIntervals(existingIntervals, wantedInterval)).toEqual(expectedResult);
  }
});

