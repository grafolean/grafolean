import React from 'react';
import GridLayout from 'react-grid-layout';

import TestWidget from './TestWidget';

import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

import './DashboardView.scss';

export default class MyFirstGrid extends React.Component {
  UNIT_X = 100;
  UNIT_Y = 50;
  N_COLS = 12;

  state = {
    layout: [
      { i: 'a', x: 0, y: 0, w: 1, h: 2 },
      { i: 'b', x: 1, y: 0, w: 3, h: 2, minW: 2, maxW: 4 },
      { i: 'c', x: 4, y: 0, w: 1, h: 2 },
    ],
  };

  handleLayoutChange = l => {
    console.log('New layout:', l);
    this.setState({
      layout: l,
    });
  };

  render() {
    const { layout } = this.state;
    const containerWidth = this.N_COLS * this.UNIT_X;
    return (
      <GridLayout
        className="layout"
        layout={layout}
        cols={this.N_COLS}
        rowHeight={this.UNIT_Y}
        width={containerWidth}
        style={{ width: containerWidth + 2 }}
        margin={[0, 0]}
        containerPadding={[0, 0]}
        onLayoutChange={this.handleLayoutChange}
      >
        <div key="a">
          <TestWidget
            key="a"
            width={layout[0].w * this.UNIT_X}
            height={layout[0].h * this.UNIT_Y}
            padding={10}
          />
        </div>
        <div key="b">
          <TestWidget
            key="b"
            width={layout[1].w * this.UNIT_X}
            height={layout[1].h * this.UNIT_Y}
            padding={10}
          />
        </div>
        <div key="c">
          <TestWidget
            key="c"
            width={layout[2].w * this.UNIT_X}
            height={layout[2].h * this.UNIT_Y}
            padding={10}
          />
        </div>
      </GridLayout>
    );
  }
}
