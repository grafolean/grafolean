import React, { Component } from 'react';
import styled from 'styled-components';

const MinorTick = styled.line`
  shape-rendering: crispEdges;
  stroke: #999999;
  stroke-width: 1;
`;
MinorTick.displayName = 'MinorTick';

const MajorTick = styled.line`
  shape-rendering: crispEdges;
  stroke: #999999;
  stroke-width: 1;
`;
MajorTick.displayName = 'MajorTick';

const Label = styled.text`
  font-family: 'Comic Sans MS', cursive, sans-serif;
  font-size: 12px;
  text-anchor: middle;
  fill: #333333;
  stroke: none;
`;
Label.displayName = 'Label';

export default class XAxisTick extends Component {
  render() {
    return (
      <g>
        {this.props.isMajor ? (
          <MajorTick x1={this.props.x} y1={0} x2={this.props.x} y2={5} />
        ) : (
          <MinorTick x1={this.props.x} y1={0} x2={this.props.x} y2={3} />
        )}
        {this.props.label === null ? null : (
          <Label x={this.props.x} y={18}>
            {this.props.label}
          </Label>
        )}
      </g>
    );
  }
}
