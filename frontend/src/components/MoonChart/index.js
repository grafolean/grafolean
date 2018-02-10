import React, { Component } from 'react';

import TimestampXAxis from './timestampxaxis'

export default class MoonChart extends Component {

  render() {
    // with scale == 1, every hour is one pixel exactly: (1 day == 24px, 1 month ~== 750px)
    // with scale == 3600, every second is one pixel exactly: (1 min == 60px, 1 h == 3600px)
    const chartWidth = (this.props.scale * (this.props.maxX - this.props.minX)) / 3600.0;
    return (
      <div style={{
        width: chartWidth,
        height: this.props.portHeight,
        //paddingLeft: -this.props.panX,
      }}>
        {/* svg width depends on scale and x domain (minX and maxX) */}
        <svg width={chartWidth} height={this.props.portHeight}>
          <circle cx={this.props.portHeight / 2} cy={this.props.portHeight / 2} r={this.props.portHeight / 2} fill="red" />
        </svg>
      </div>
    );
  }
}

