import React, { Component } from 'react';

import MoonChart from '../MoonChart';
import RePinchy from '../RePinchy';

const Home = () => {
  let width = 1920, height = 1080;
  return (
    <div>
      Home.
      <RePinchy
        width={200}
        height={300}
        renderSub={
          (w, h, x, y, scale, zoomInProgress) => (
            <div
              style={{
                  width: w,
                  height: h,
                  marginLeft: x,
                  marginTop: 0,
                  transformOrigin: "top left",
                  transform: `scale(${scale}, 1)`,
                  backgroundColor: (zoomInProgress) ? ('yellow') : ('white'),
              }}>
              <MoonChart
                width={200}
                height={100}
              />
            </div>
          )} />

    </div>
  )
}

export default Home;
