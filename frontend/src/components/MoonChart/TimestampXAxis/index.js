import React from 'react';
import styled from 'styled-components';
import moment from 'moment';

import XAxisTick from './xaxistick';

const secondsTickFormatter = (ts) => moment(ts * 1000).format('HH:mm:ss');
const minutesTickFormatter = (ts) => moment(ts * 1000).format('HH:mm');
const hoursTickFormatter = (ts) => moment(ts * 1000).format('HH');
const _x2ts = (x, scale) => { return x / scale; }
const _ts2x = (ts, scale) => { return ts * scale; }

const Line = styled.line`
  shape-rendering: crispEdges;
  stroke: #999999;
  stroke-width: 1;
`
Line.displayName = "Line"

export default class TimestampXAxis extends React.Component {

  /*
    We wish to display sensible X axis labels depending on time range selected. For example, this looks
    quite OK, except that we want to zoom in to minute detail:
    https://www.highcharts.com/demo/line-boost/dark-unica
  */

  _getXTicksPositions(panX, scale, width) {
    console.log(scale)

    let minorTicksSpacing, majorTicksSpacing, labelSpacing;  // make sure every one of these is divisible by minorTicksSpacing
    let tickFormatter = minutesTickFormatter;
    if (scale > 72.0) {
      [minorTicksSpacing, majorTicksSpacing, labelSpacing, tickFormatter] = [1, 1, 1, secondsTickFormatter];
      tickFormatter = secondsTickFormatter;
    }
    else if (scale > 25.0) {
      [minorTicksSpacing, majorTicksSpacing, labelSpacing, tickFormatter] = [1, 5, 5, secondsTickFormatter];
      tickFormatter = secondsTickFormatter;
    }
    else if (scale > 7.4) {
      [minorTicksSpacing, majorTicksSpacing, labelSpacing, tickFormatter] = [1, 10, 10, secondsTickFormatter];
      tickFormatter = secondsTickFormatter;
    }
    else if (scale > 4.1) {
      [minorTicksSpacing, majorTicksSpacing, labelSpacing, tickFormatter] = [1, 10, 30, secondsTickFormatter];
      tickFormatter = secondsTickFormatter;
    }
    else if (scale > 3.0) {
      [minorTicksSpacing, majorTicksSpacing, labelSpacing, tickFormatter] = [1, 10, 60, secondsTickFormatter];
      tickFormatter = secondsTickFormatter;
    }
    else if (scale > 0.9) {
      [minorTicksSpacing, majorTicksSpacing, labelSpacing, tickFormatter] = [10, 60, 60, minutesTickFormatter];
    }
    else if (scale > 0.23) {
      [minorTicksSpacing, majorTicksSpacing, labelSpacing, tickFormatter] = [60, 300, 300, minutesTickFormatter];
    }
    else if (scale > 0.082) {
      [minorTicksSpacing, majorTicksSpacing, labelSpacing, tickFormatter] = [60, 600, 600, minutesTickFormatter];
    }
    else if (scale > 0.035) {
      [minorTicksSpacing, majorTicksSpacing, labelSpacing, tickFormatter] = [600, 1800, 1800, minutesTickFormatter];
    }
    else {
      [minorTicksSpacing, majorTicksSpacing, labelSpacing, tickFormatter] = [600, 3600, 3600, minutesTickFormatter];
    }

    let ret = []
    const tsMin = _x2ts(panX, scale);
    const tsMax = _x2ts(panX + width, scale);
    const firstTs = (Math.floor(tsMin / minorTicksSpacing) + 1) * minorTicksSpacing;
    for (let ts = firstTs; ts < tsMax; ts += minorTicksSpacing) {
      ret.push({
        ts,
        x: _ts2x(ts, scale) - panX,
        isMajor: (ts % majorTicksSpacing === 0) ? (true) : (false),
        label: (ts % labelSpacing === 0) ? (tickFormatter(ts)) : (null),
      })
    }
    return ret;
  }

  render() {
    const tickInfos = this._getXTicksPositions(this.props.panX, this.props.scale, this.props.width)
    return (
      <g>
        <rect x={0} y={0} width={this.props.width} height={this.props.height} fill="white" stroke="none" />
        <Line x1={0} y1={0} x2={this.props.width} y2={0} />

        {tickInfos.map((tickInfo) => (
          <XAxisTick key={tickInfo.ts} {...tickInfo} />
        ))}
      </g>
    );
  }
}

