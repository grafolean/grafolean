import React from 'react';
import { generateSerieColor } from './utils';

export default class TooltipIndicator extends React.Component {
  render() {
    const x = Math.round(this.props.x);
    const y = Math.round(this.props.y);
    const serieColor = generateSerieColor(this.props.cs.path, this.props.cs.index);
    return (
      <g className="tooltip-indicator">
        <line x1={x} y1={0} x2={x} y2={this.props.yAxisHeight} />
        <circle cx={x} cy={y} r={this.props.r || 4} fill={serieColor} />
      </g>
    );
  }
}
