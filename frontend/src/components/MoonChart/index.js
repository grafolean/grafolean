import React, { Component } from 'react';

export default class MoonChart extends Component {

  render() {
    return (
      <svg width={this.props.width} height={this.props.height}>
        <circle cx={this.props.width / 2} cy={this.props.height / 2} r={this.props.height / 2} fill="red" />
      </svg>
    );
  }
}

