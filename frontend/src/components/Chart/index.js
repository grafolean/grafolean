import React, { Component } from 'react';
import {
  VictoryChart,
  VictoryLine,
  VictoryArea,
  VictoryAxis,
//  VictoryZoomContainer,
  VictorySelectionContainer,
} from 'victory';
import Loading from '../Loading'
import moment from 'moment';

const timeTickFormatter = (tick) => moment(tick * 1000).format('HH:mm')

class Chart extends Component {
  static defaultProps = {
    domain: null,
    data: null,
  }
  render() {
    return (
        (!this.props.data) ? (
          <Loading />
        ) : (
          <VictoryChart
            containerComponent={
  //            <VictoryZoomContainer />
              <VictorySelectionContainer
                selectionDimension="x"
                selectionStyle={{stroke: "transparent", fill: "yellow", fillOpacity: 0.2}}
                onSelection={(selected_points, selection_bounds, props) => {
                  console.log("SELECTED POINTS", selected_points);
                  console.log("BOUNDS", selection_bounds);
                  console.log("PROPS", props)
                }}
              />
            }
            domain={{x: [1080000000, 1080025200], y: [0, 4500]}}
          >
            <VictoryAxis
              tickFormat={timeTickFormatter}
              tickValues={[1080000000, 1080003600, 1080007200, 1080010800, 1080014400, 1080018000, 1080021600, 1080025200]}
            />
            <VictoryAxis
              dependentAxis
              tickFormat={(tick) => `$${Math.round(tick)}M`}
            />
            <VictoryArea
              data={this.props.data}
              x="t"
              y="ymin"
              y0="ymax"
              style={{
                data: {
                  fill: "#c43a31", fillOpacity: 0.2, strokeWidth: 0
                },
              }}
            />
            <VictoryLine
              data={this.props.data}
              x="t"
              y="y"
              style={{
                data: { stroke: "#c43a31", strokeWidth: 1 },
                parent: { border: "1px solid #ccc"},
              }}
            />
        </VictoryChart>
      )


    );
  }
}

export default Chart;
