import { connect } from 'react-redux'
import Chart from '../components/Chart'

const mapStateToProps = (state, ownProps) => {
  const defaultProps = {
    chartId: ownProps.chartId,
    name: ownProps.name,
    paths: ownProps.paths,
    domain: {
      x: [
        Math.floor(Date.now() / 1000) - 3600*24*30,  // last 30 days by default
        Math.floor(Date.now() / 1000),
      ],
      y: null,  // [ 0, 4500 ]
    },
    isAggregated: false,
    data: [
      //{t: 1080001800, y: 3413},  // if isAggregated is false
      //{t: 1080001800, y: 3413, ymin: 3400, ymax: 3500},  // if isAggregated is true
    ],
  }

    console.log("STATE", state);
    return {
      ...defaultProps,
      data: [
        {t: 1080001800, y: 3413, ymin: 3400, ymax: 3500},
        {t: 1080005400, y: 1398, ymin: 1210, ymax: 1600},
        {t: 1080009000, y: 2340, ymin: 2290, ymax: 2550},
        {t: 1080012600, y: 2108, ymin: 2000, ymax: 2200},
        {t: 1080016200, y: 2200, ymin: 2181, ymax: 2300},
        {t: 1080019800, y: 2600, ymin: 2500, ymax: 2700},
        {t: 1080023400, y: 2120, ymin: 2100, ymax: 2150},
      ],
    }
  }

  const ChartContainer = connect(
    mapStateToProps,
  )(Chart)

  export default ChartContainer
