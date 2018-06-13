import React from 'react';
import { generateSerieColor } from './utils';

export default class TooltipIndicator extends React.Component {
  render() {
    const x = Math.round(this.props.x);
    const y = Math.round(this.props.y);
    const serieColor = generateSerieColor(this.props.cs.path, this.props.cs.index);
    return (
      <g>
        <line x1={x} y1={0} x2={x} y2={this.props.yAxisHeight} shapeRendering="crispEdges" stroke="#e3e3e3" strokeWidth="1"/>
        <circle cx={x} cy={y} r={4} fill={serieColor}/>
      </g>
    )
  }
}
