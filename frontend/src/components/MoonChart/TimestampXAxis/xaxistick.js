import React, { Component } from 'react';
import styled from 'styled-components';

const Tick = styled.line`
  shape-rendering: crispEdges;
  stroke: #999999;
  stroke-width: 1;
`
Tick.displayName = "Tick"

const Label = styled.text`
  font-family: "Comic Sans MS", cursive, sans-serif;
  font-size: 12px;
  text-anchor: middle;
  fill: #333333;
  stroke: none;
`
Label.displayName = "Label"

export default class XAxisTick extends Component {

  render() {
    return (
      <g>
        <Tick x1={this.props.x} y1={0} x2={this.props.x} y2={3} />
        (this.props.label === null):(null)?(
          <Label x={this.props.x} y={15}>{this.props.label}</Label>
        )
      </g>
    );
  }
}

