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
    const ts1 = panX + (width / scale);
    const firstTs = (Math.floor(panX / 60.0) + 1) * 60.0;
    let ret = []
    for (let ts = firstTs; ts < ts1; ts += 60) {
      ret.push({x: ts - panX, l: timeTickFormatter(ts)})
    }
    return ret;
    if (scale == 1.0) {
      return [
        {x: 20, l: "01:00"},
        {x: 70, l: "02:00"},
        {x: 120, l: "03:00"},
        {x: 170, l: "04:00"},
      ]
    }
  }

  render() {
    const tickInfos = this._getXTicksPositions(this.props.panX, this.props.scale, this.props.width)
    return (
      <g>
        <rect x={0} y={0} width={this.props.width} height={this.props.height} fill="white" stroke="none" />
        <Line x1={0} y1={0} x2={this.props.width} y2={0} />

        {tickInfos.map((tickInfo) => (
          <XAxisTick x={tickInfo.x} label={tickInfo.l} />
        ))}
      </g>
    );
  }
}

