import React, { Component } from 'react';

import TimestampXAxis from './timestampxaxis'

export default class MoonChart extends Component {

  render() {
    // with scale == 1, every second is one pixel exactly: (1 min == 60px, 1 h == 3600px, 1 day == 24*3600px,...)
    const chartWidth = (this.props.scale * (this.props.maxX - this.props.minX));
    return (
      <div
        style={{
            width: this.props.portWidth,
            height: this.props.portHeight,
            marginLeft: this.props.panX,
            marginTop: 0,
            //transformOrigin: "top left",
            //transform: `scale(${this.props.scale}, 1)`,
            backgroundColor: (this.props.zoomInProgress) ? ('yellow') : ('white'),
        }}
      >
        {/* svg width depends on scale and x domain (minX and maxX) */}
        <svg width={chartWidth} height={this.props.portHeight}>
          <circle cx={this.props.portHeight / 2 * this.props.scale} cy={this.props.portHeight / 2} r={this.props.portHeight / 2 * this.props.scale} fill="red" />
        </svg>
      </div>
    );
  }
}

