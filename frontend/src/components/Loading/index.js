import React, { Component } from 'react';

import './loading.scss';

class Loading extends Component {
  static defaultProps = {
    wh: 64,
    overlayParent: false,
  };
  render() {
    return (
      <div className={`loading-component ${this.props.overlayParent ? 'overlay' : ''}`}>
        <i className="fa fa-circle-o-notch fa-spin" alt="Please wait, loading..." />
      </div>
    );
  }
}

export default Loading;
