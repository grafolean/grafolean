import { connect } from 'react-redux'
import Chart from '../components/Chart'

const mapStateToProps = (state, ownProps) => {

  const exampleProps = {
    chartId: 1,
    name: "This is chart title",
    domain: {
      x: [
        // Math.floor(Date.now() / 1000) - 3600*24*30,  // last 30 days by default
        // Math.floor(Date.now() / 1000),
        1080000000, 1080024000
      ],
      y: [ 0, 4500 ],
    },
    isAggregated: true,
    loading: false,
    series: {
      "aaa.bbb.ccc.111": {
        visible: true,
        name: "Path 1",
        data: [
          {t: 1080001800, y: 3413, ymin: 3400, ymax: 3500},
          {t: 1080005400, y: 1398, ymin: 1210, ymax: 1600},
          {t: 1080009000, y: 2340, ymin: 2290, ymax: 2550},
          {t: 1080012600, y: 2108, ymin: 2000, ymax: 2200},
          {t: 1080016200, y: 2200, ymin: 2181, ymax: 2300},
          {t: 1080019800, y: 2600, ymin: 2500, ymax: 2700},
          {t: 1080023400, y: 2120, ymin: 2100, ymax: 2150},
        ],
      },
      "aaa.bbb.ccc.222": {
        visible: false,
        name: "Path 2",
        data: [
          {t: 1080001800, y: 2413, ymin: 2413, ymax: 2413},
          {t: 1080005400, y: 3398, ymin: 3398, ymax: 3398},
          {t: 1080009000, y: 2240, ymin: 2240, ymax: 2240},
          {t: 1080012600, y: 2308, ymin: 2308, ymax: 2308},
          {t: 1080016200, y: 1500, ymin: 1500, ymax: 1500},
          {t: 1080019800, y: 2200, ymin: 2200, ymax: 2200},
          {t: 1080023400, y: 1720, ymin: 1720, ymax: 1720},
        ],
      },
    },
  }

  return exampleProps;
}

const ChartContainer = connect(
  mapStateToProps,
)(Chart)

export default ChartContainer
