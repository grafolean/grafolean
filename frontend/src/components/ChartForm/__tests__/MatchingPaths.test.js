import React from 'react';
import { shallow } from 'enzyme';

import MatchingPaths from '../MatchingPaths';

test('MatchingPaths breakMatchingPath', () => {
  const params = [
    {
      path: "asdf.1234.qwer.aaaa",
      partialPathFilter: "asdf.*",
      expectedResult: [
        { part: 'asdf.', match: MatchingPaths.MATCH_EXACT },
        { part: '1234.qwer.aaaa', match: MatchingPaths.MATCH_WILDCARD },
        { part: '', match: MatchingPaths.MATCH_RESIDUAL },
      ],
    },
    {
      path: "asdf.1234.qwer.aaaa",
      partialPathFilter: "asdf.?",
      expectedResult: [
        { part: 'asdf.', match: MatchingPaths.MATCH_EXACT },
        { part: '1234', match: MatchingPaths.MATCH_WILDCARD},
        { part: '.qwer.aaaa', match: MatchingPaths.MATCH_RESIDUAL },
      ],
    },
    {
      path: "asdf.1234.qwer.aaaa",
      partialPathFilter: "?.123",
      expectedResult: [
        { part: 'asdf', match: MatchingPaths.MATCH_WILDCARD },
        { part: '.123', match: MatchingPaths.MATCH_EXACT },
        { part: '4.qwer.aaaa', match: MatchingPaths.MATCH_RESIDUAL },
      ],
    },
    {
      path: "asdf.1234.qwer.aaaa",
      partialPathFilter: "asdf.?.?.a",
      expectedResult: [
        { part: 'asdf.', match: MatchingPaths.MATCH_EXACT },
        { part: '1234', match: MatchingPaths.MATCH_WILDCARD },
        { part: '.', match: MatchingPaths.MATCH_EXACT },
        { part: 'qwer', match: MatchingPaths.MATCH_WILDCARD },
        { part: '.a', match: MatchingPaths.MATCH_EXACT },
        { part: 'aaa', match: MatchingPaths.MATCH_RESIDUAL },
      ],
    },
  ];

  for (let param of params) {
    const { path, partialPathFilter, expectedResult } = param;
    expect(MatchingPaths.breakMatchingPath(path, partialPathFilter)).toEqual(expectedResult);
  };
});

test('MatchingPaths constructPathName', () => {
  const params = [
    {
      path: "asdf.1234.qwer.aaaa",
      partialPathFilter: "asdf.*",
      pathRenamer: "Test $1",
      expectedResult: "Test 1234.qwer.aaaa",
    },
    {
      path: "asdf.1234.qwer.aaaa",
      partialPathFilter: "asdf.?",
      pathRenamer: "Test $1",
      expectedResult: "Test 1234",
    },
    {
      path: "asdf.1234.qwer.aaaa",
      partialPathFilter: "asdf.1234.?.?",
      pathRenamer: "Test $1 $2 $1",
      expectedResult: "Test qwer aaaa qwer",
    },
    {
      path: "asdf.1234.qwer.aaaa.zxcv",
      partialPathFilter: "asdf.?.?.*.?",
      pathRenamer: "Test $1 $2 $3 $4",
      expectedResult: "Test 1234 qwer aaaa zxcv",
    },
    {
      path: "asdf.1234.qwer.aaaa.zxcv",
      partialPathFilter: "asdf.?.*.?",
      pathRenamer: "Test $1 $2 $3",
      expectedResult: "Test 1234 qwer.aaaa zxcv",
    },
  ];

  for (let param of params) {
    const { path, partialPathFilter, pathRenamer, expectedResult } = param;
    expect(MatchingPaths.constructPathName(path, partialPathFilter, pathRenamer)).toEqual(expectedResult);
  };
});

