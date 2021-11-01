import React from 'react';

import { CSSColor } from './utils';

interface GridProps {
  yTicks: number[];
  v2y: Function;
  width: number;
  color: CSSColor;
}

export default class Grid extends React.Component<GridProps> {
  render() {
    const { yTicks, v2y, width, color } = this.props;
    return (
      <g>
        {yTicks !== null &&
          yTicks.map(v => {
            const y = v2y(v);
            return (
              <line
                key={v}
                x1={0}
                y1={y}
                x2={width}
                y2={y}
                shapeRendering="crispEdges"
                stroke={color}
                strokeWidth="1"
              />
            );
          })}
      </g>
    );
  }
}
