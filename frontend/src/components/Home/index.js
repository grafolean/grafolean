import React, { Component } from 'react';

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
          (w, h, x, y, scale) => (
            <div
              style={{
                  width: w,
                  height: h,
                  marginLeft: x,
                  marginTop: 0,
                  transformOrigin: "top left",
                  transform: `scale(${scale})`,
                  position: 'relative',
              }}>
              <img src="/static/nature.jpeg" style={{
                position: 'absolute',
              }}/>
              <input type="submit" onClick={console.log("YEAH, clicked!")} style={{
                position: 'absolute',
              }}/>
            </div>
          )} />

    </div>
  )
}

export default Home;
