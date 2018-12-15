import React from 'react';

export default class Grid extends React.Component {
  render() {
    return (
      <g>
        {this.props.yTicks !== null &&
          this.props.yTicks.map(v => {
            const y = this.props.v2y(v);
            return (
              <line
                key={v}
                x1={0}
                y1={y}
                x2={this.props.width}
                y2={y}
                shapeRendering="crispEdges"
                stroke={this.props.color}
                strokeWidth="1"
              />
            );
          })}
      </g>
    );
  }
}
