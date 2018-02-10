import React, { Component } from 'react';

export default class TimestampXAxis extends Component {

  constructor(props) {
    props = {
      width: 400,
      height: 20,
      minTs: 1234567890,
      maxTs: 1234567890 + 12 * 3600,
    }
    super(props);
  }

  render() {
    return (
        <circle cx={this.props.width / 2} cy={this.props.height / 2} r={this.props.height / 2} fill="red" />
    );
  }
}

