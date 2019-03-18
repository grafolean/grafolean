import React from 'react';

class YAxisTickLabel extends React.PureComponent {
  render() {
    const { label, ...rest } = this.props;
    return (
      <text className="y-axis-label" {...rest}>
        {label}
      </text>
    );
  }
}

class YAxisUnit extends React.PureComponent {
  render() {
    const { label, ...rest } = this.props;
    return (
      <text className="y-axis-unit" {...rest}>
        {label}
      </text>
    );
  }
}
export default class YAxis extends React.Component {
  render() {
    const { width, height, color, unit, yTicks, v2y } = this.props;
    return (
      <g>
        <line
          x1={width - 1}
          y1={15}
          x2={width - 1}
          y2={height}
          shapeRendering="crispEdges"
          stroke={color}
          strokeWidth="1"
        />

        <YAxisUnit x={width - 7} y={10} label={unit} />

        {yTicks !== null &&
          yTicks.map(v => {
            const y = v2y(v);
            return (
              <g key={v}>
                <YAxisTickLabel x={width - 7} y={y + 5} label={v} />
                <line
                  x1={width - 4}
                  y1={y}
                  x2={width}
                  y2={y}
                  shapeRendering="crispEdges"
                  stroke={color}
                  strokeWidth="1"
                />
              </g>
            );
          })}
      </g>
    );
  }
}
