import React, { Component } from 'react';

import RePinchy from '../RePinchy';

const Home = () => {
  let width = 1920, height = 1080;
  return (
    <div>
      Home.
      <RePinchy
        wdth={200}
        height={300}
        renderSub={
          (x, y, scale) => (
            <img
              src={`http://lorempixel.com/600/400/nature/`}
              style={{
                pointerEvents: scale === 1 ? 'auto' : 'none',
                transform: `translate3d(${x}px, ${y}px, 0) scale(${scale})`,
                transformOrigin: '0 0',
              }} />
          )} />

    </div>
  )
}

export default Home;
