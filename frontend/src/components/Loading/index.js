import React, { Component } from 'react';

import './loading.scss';

class Loading extends Component {
  static defaultProps = {
    overlayParent: false,
  };
  render() {
    const { overlayParent, message } = this.props;
    return (
      <div className={`loading-component ${overlayParent ? 'overlay' : ''}`}>
        <i className="fa fa-circle-o-notch fa-spin" alt="Please wait, loading..." />
        {message && <div className="message">{message}</div>}
      </div>
    );
  }
}

export default Loading;
