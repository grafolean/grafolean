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
      <foreignObject className="y-axis-unit" {...rest}>
        <div>
          <button>{label}</button>
        </div>
      </foreignObject>
    );
  }
}
export default class YAxis extends React.Component {
  render() {
    return (
      <g>
        <line
          x1={this.props.width - 1}
          y1={15}
          x2={this.props.width - 1}
          y2={this.props.height}
          shapeRendering="crispEdges"
          stroke={this.props.color}
          strokeWidth="1"
        />
        <YAxisUnit x={7} y={0} width={this.props.width - 9} height={30} label={this.props.unit} />

        {this.props.yTicks !== null &&
          this.props.yTicks.map(v => {
            const y = this.props.v2y(v);
            return (
              <g key={v}>
                <YAxisTickLabel x={this.props.width - 7} y={y + 5} label={v} />
                <line
                  x1={this.props.width - 4}
                  y1={y}
                  x2={this.props.width}
                  y2={y}
                  shapeRendering="crispEdges"
                  stroke={this.props.color}
                  strokeWidth="1"
                />
              </g>
            );
          })}
      </g>
    );
  }
}
