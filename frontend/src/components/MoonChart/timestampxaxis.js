import React, { Component } from 'react';
import styled from 'styled-components';

const XAxisLabel = styled.text`
  font-family: "Comic Sans MS", cursive, sans-serif;
  font-size: 12px;
  text-anchor: middle;
  fill: #333333;
  stroke: none;
`

export default class TimestampXAxis extends Component {

  /*
    We wish to display sensible X axis labels depending on time range selected. For example, this looks
    quite OK, except that we want to zoom in to minute detail:
    https://www.highcharts.com/demo/line-boost/dark-unica
  */

  _getXLabels(minTimestamp, maxTimestamp, chartWidth) {
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
        <line x1={0} y1={0} x2={this.props.width} y2={0} shapeRendering="crispEdges" stroke={this.props.color} strokeWidth="1"/>

        <line x1={20} y1={0} x2={20} y2={3} shapeRendering="crispEdges" stroke={this.props.color} strokeWidth="1"/>
        <XAxisLabel x={20} y={15}>1:00</XAxisLabel>

        <line x1={70} y1={0} x2={70} y2={3} shapeRendering="crispEdges" stroke={this.props.color} strokeWidth="1"/>
        <XAxisLabel x={70} y={15}>2:00</XAxisLabel>
      </g>
    );
  }
}

