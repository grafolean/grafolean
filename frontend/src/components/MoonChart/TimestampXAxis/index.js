import React, { Component } from 'react';
import styled from 'styled-components';

import XAxisTick from './xaxistick';

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

  _getXLabels(minTimestamp, maxTimestamp, scale) {
    return [
      {x: 20, l: "01:00"},
      {x: 70, l: "02:00"},
      {x: 120, l: "03:00"},
      {x: 170, l: "04:00"},
    ]
  }

  render() {
    const xLabels = this._getXLabels(this.props.minTimestamp, this.props.maxTimestamp, this.props.scale)
    return (
      <g>
        <rect x={0} y={0} width={this.props.width} height={this.props.height} fill="white" stroke="none" />
        <Line x1={0} y1={0} x2={this.props.width} y2={0} />

        <XAxisTick x={20} label="1:00" />

        <XAxisTick x={70} label="2:00" />
      </g>
    );
  }
}

