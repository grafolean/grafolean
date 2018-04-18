import React, { Component } from 'react';

const DEFAULT_STYLE = {
  padding: '40px',
}

const OVERLAY_PARENT_STYLE = {
  position: 'absolute',
  left: 0,
  right: 0,
  top: 0,
  bottom: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.1)',
  zIndex: 99999999,
  textAlign: 'center',
  paddingTop: 100,
}

class Loading extends Component {
  static defaultProps = {
    wh: 64,
    overlayParent: false,
  }
  render() {
    const style = this.props.overlayParent ? OVERLAY_PARENT_STYLE : DEFAULT_STYLE;
    return (
      <div style={{
        ...style,
        ...this.props.style,
      }}>
        <i
          className="fa fa-spinner fa-spin"
          style={{
            fontSize: this.props.wh,
          }}
          alt="Please wait, loading..."
        />
      </div>
    );
  }
}

export default Loading;
