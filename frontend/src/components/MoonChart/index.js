import React, { Component } from 'react';

import TimestampXAxis from './TimestampXAxis'
import YAxis from './yaxis'

export default class MoonChart extends Component {

  render() {
    // with scale == 1, every second is one pixel exactly: (1 min == 60px, 1 h == 3600px, 1 day == 24*3600px,...)
    const chartWidth = Math.round(this.props.scale * (this.props.maxX - this.props.minX));
    const yAxisWidth = Math.min(Math.round(this.props.portWidth * 0.1), 100);
    const xAxisHeight = Math.min(Math.round(this.props.portHeight * 0.1), 50);
    const xAxisTop = this.props.portHeight - xAxisHeight;
    return (
      <div
        style={{
            width: this.props.portWidth,
            height: this.props.portHeight,
            //marginLeft: this.props.panX,
            //marginTop: 0,
            //transformOrigin: "top left",
            //transform: `scale(${this.props.scale}, 1)`,
            backgroundColor: (this.props.zoomInProgress) ? ('yellow') : ('white'),
        }}
      >
        {/* svg width depends on scale and x domain (minX and maxX) */}
        <svg width={this.props.portWidth} height={this.props.portHeight}>
          <circle cx={this.props.panX + this.props.portHeight / 2 * this.props.scale} cy={this.props.portHeight / 2} r={this.props.portHeight / 2 * this.props.scale} fill="red" />

          <rect x={0} y={xAxisTop} width={yAxisWidth} height={xAxisHeight} fill="white" stroke="none" />
          <g transform={`translate(0 0)`}>
            <YAxis
              width={yAxisWidth}
              height={xAxisTop}
              color="#999999"

              minY={this.props.minY}
              maxY={this.props.maxY}
            />
          </g>
          <g transform={`translate(${yAxisWidth - 1} ${xAxisTop})`}>
            <TimestampXAxis
              width={this.props.portWidth - yAxisWidth}
              height={xAxisHeight}
              color="#999999"

              scale={this.props.scale}
              panX={this.props.panX}

              minTimestamp={this.props.minTimestamp}
              maxTimestamp={this.props.maxTimestamp}
            />
          </g>
        </svg>
      </div>
    );
  }
}

