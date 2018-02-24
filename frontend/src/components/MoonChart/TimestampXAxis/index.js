import React, { Component } from 'react';
import styled from 'styled-components';
import moment from 'moment';

import XAxisTick from './xaxistick';

const timeTickFormatter = (tick) => moment(tick * 1000).format('HH:mm')

const Line = styled.line`
  shape-rendering: crispEdges;
  stroke: #999999;
  stroke-width: 1;
`
Line.displayName = "Line"

export default class TimestampXAxis extends Component {

  /*
    We wish to display sensible X axis labels depending on time range selected. For example, this looks
    quite OK, except that we want to zoom in to minute detail:
    https://www.highcharts.com/demo/line-boost/dark-unica
  */

  _getXTicksPositions(panX, scale, width) {

    const _x2ts = (x, scale) => { return x / scale; }
    const _ts2x = (ts, scale) => { return ts * scale; }

    const ts0 = _x2ts(panX, scale);
    const ts1 = ts0 + _x2ts(width, scale);
    const tsSpacing = 120;  // the distance between two consecutive ticks

    const firstTs = (Math.floor(ts0 / tsSpacing) + 1) * tsSpacing;
    let ret = []
    for (let ts = firstTs; ts < ts1; ts += tsSpacing) {
      ret.push({ts: ts, x: _ts2x(ts, scale) - panX, l: timeTickFormatter(ts)})
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
          <XAxisTick key={tickInfo.ts} x={tickInfo.x} label={tickInfo.l} />
        ))}
      </g>
    );
  }
}

