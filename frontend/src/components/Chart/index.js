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

/*
props:
  - chart id
  - title (chart name)
  - x domain
  - paths (for legend)
  - data (must include all data for x domain, but is usually wider)
  - total data in aggr level 6 for ... navchart?
  - y domain (if not specified, y domain will be calculated by using max value in data and min(min value, 0))
*/


class Chart extends Component {

  _domainXTickProps(domainXFrom, domainXTo) {
    // returns appropriate formatter and tick values based on X domain
    // the goal is to provide an intelligent way of marking X axis
    return {
      tickFormat: timeTickFormatter,
//      tickValues: [1080000000, 1080003600, 1080007200, 1080010800, 1080014400, 1080018000, 1080021600, 1080025200],
      tickValues: [domainXFrom, domainXTo],
    }
  }

  render() {
    let domainXTickProps = this._domainXTickProps(1080000000, 1080025200)
    console.log(domainXTickProps)
    return (
        (!this.props.data) ? (
          <Loading />
        ) : (
          <VictoryChart
            //domain={this.props.domain}
            domain={{x: [1080000000, 1080025200], y: [0, 4500]}}
          >
            <VictoryAxis
              {...this._domainXTickProps(this.props.domain.x[0], this.props.domain.x[1])}
              //{...this._domainXTickProps(1080000000, 1080025200)}
              //{...domainXTickProps}
              //tickFormat={timeTickFormatter}
              //tickValues={[1080000000, 1080003600, 1080007200, 1080010800, 1080014400, 1080018000, 1080021600, 1080025200]}
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
