import React from 'react';
import styled from 'styled-components';

const YAxisLabel = styled.text`
  font-family: "Comic Sans MS", cursive, sans-serif;
  font-size: 13px;
  text-anchor: end;
  fill: #333333;
  stroke: none;

  &.bold {
    font-weight: bold;
  }
`
YAxisLabel.displayName = 'YAxisLabel'

export default class YAxis extends React.Component {

  render() {
    return (
      <g>
        <line x1={this.props.width - 1} y1={15} x2={this.props.width - 1} y2={this.props.height} shapeRendering="crispEdges" stroke={this.props.color} strokeWidth="1"/>
        <YAxisLabel className="bold" x={this.props.width - 7} y={10}>{this.props.unit}</YAxisLabel>

        {this.props.yTicks !== null && this.props.yTicks.map(v => {
          const y = this.props.v2y(v);
          return (
            <g key={v}>
              <YAxisLabel x={this.props.width - 7} y={y + 5}>{v}</YAxisLabel>
              <line x1={this.props.width - 4} y1={y} x2={this.props.width} y2={y} shapeRendering="crispEdges" stroke={this.props.color} strokeWidth="1"/>
            </g>
          )
        })}
      </g>
    );
  }
}

