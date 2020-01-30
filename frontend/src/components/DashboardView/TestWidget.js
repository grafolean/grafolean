import React from 'react';

export default class TestWidget extends React.Component {
  render() {
    const { width = 100, height = 100, padding = 10 } = this.props;
    return (
      <div
        style={{
          width: width - padding - 2,
          height: height - padding - 2,
          border: '1px solid #ff6600',
          backgroundColor: '#334455',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <span className="draggly">
          {width - padding}x{height - padding}
        </span>
      </div>
    );
  }
}
