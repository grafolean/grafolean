import React from 'react';
import { shallow } from 'enzyme';
import TimestampXAxis from '../index';

test('TimestampXAxis creates horizontal line', () => {
  const xaxis = shallow(
    <TimestampXAxis
      width={1000}
      height={100}
      color="#999999"

      scale={1.0}
      panX={0}

      minTimestamp={1234500000}
      maxTimestamp={1234500000 + 5 * 3600}
    />
  );

  //console.log(xaxis.debug())
  expect(xaxis.find('g').length).toEqual(1);
  expect(xaxis.find('g > Line').length).toEqual(1);
});

test('TimestampXAxis yearly ticks', () => {
  const xaxis = shallow(<TimestampXAxis />);

  console.log(xaxis.instance()._getXLabels(0, 100, 1.0))
});
