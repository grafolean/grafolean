import React from 'react';

function Overlay({ left = 0, top = 0, width = '100%', height = '100%', msg = '...' }) {
  return [
    <div
      key="overlay-bg"
      style={{
        position: 'absolute',
        left: left,
        top: top,
        width: width,
        height: height,
        backgroundColor: '#000000',
        opacity: 0.2,
        pointerEvents: 'none', // do not catch mouse and touch events
        touchAction: 'none',
      }}
    />,
    <div
      key="overlay-text"
      style={{
        position: 'absolute',
        left: left,
        top: top,
        width: width,
        height: height,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#ffffff',
        fontSize: 20,
        pointerEvents: 'none', // do not catch mouse and touch events
        touchAction: 'none',
      }}
    >
      <span style={{ textAlign: 'center' }}>{msg}</span>
    </div>,
  ];
}

export default Overlay;
