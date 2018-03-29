import React, { Component } from 'react';

const DEFAULT_STYLE = {
  padding: '40px',
}
class Loading extends Component {
  static defaultProps = {
    wh: 64,
  }
  render() {
    return (
      <div style={{
        ...DEFAULT_STYLE,
        ...this.props.style,
      }}>
        <img src="/static/loading.gif" width={this.props.wh} height={this.props.wh} alt="Please wait, loading..." />
      </div>
    );
  }
}

export default Loading;
