import React, { Component } from 'react';
import styled from 'styled-components';


class Loading extends Component {
  defaultProps = {
    padding: '40px',
    wh: 64,
  }
  render() {
    return (
      <div style={{
        padding: (this.props.hasOwnProperty('padding')) ? (this.props.padding) : ('40px'),
      }}>
        <img src="/static/loading.gif" width={this.props.wh} height={this.props.wh} alt="Please wait, loading..." />
      </div>
    );
  }
}

export default Loading;
