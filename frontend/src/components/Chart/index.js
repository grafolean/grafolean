import React, { Component } from 'react';
import {
  VictoryChart,
  VictoryLine,
  VictoryAxis,
//  VictoryZoomContainer,
  VictorySelectionContainer,
} from 'victory';
import Loading from '../Loading'
import moment from 'moment';

const data = [
  {t: 1080001800, uv: 4000, pv: 2430, amt: [2400,2500]},
  {t: 1080005400, uv: 3000, pv: 1398, amt: [1210,1600]},
  {t: 1080009000, uv: 2000, pv: 2340, amt: [2290,2550]},
  {t: 1080012600, uv: 2780, pv: 2108, amt: [2000,2200]},
  {t: 1080016200, uv: 1890, pv: 2200, amt: [2181,2300]},
  {t: 1080019800, uv: 2390, pv: 2600, amt: [2500,2700]},
  {t: 1080023400, uv: 3490, pv: 2120, amt: [2100,2150]},
];

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
            <VictoryLine
            data={data}
            x="t"
            y="uv"
            style={{
              data: { stroke: "#c43a31" },
              parent: { border: "1px solid #ccc"},
            }}
          />
        </VictoryChart>
      )


    );
  }
}

export default Chart;
