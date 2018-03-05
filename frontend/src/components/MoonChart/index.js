import React from 'react';
import { stringify } from 'qs'

import { ROOT_URL, handleFetchErrors } from '../../store/actions';

import Loading from '../Loading'
import TimestampXAxis from './TimestampXAxis'
import YAxis from './yaxis'

const MAX_AGGR_LEVEL = 6

export default class MoonChart extends React.Component {
  state = {
    fetching: true,
  }


  _getSuggestedAggrLevel(fromTs, toTs, maxPoints=100) {
    let aggrLevel = this._getAggrLevel(maxPoints, Math.ceil((toTs - fromTs)/3600.0));
    if (aggrLevel < 0)
        return "no";
    else
        return aggrLevel;
  }

  _getAggrLevel(maxPoints, nHours) {
    for (let l=-1; l<MAX_AGGR_LEVEL; l++) {
      if (maxPoints >= nHours / (3**l))
        return l
    };
    return MAX_AGGR_LEVEL
  }

  componentDidMount() {
    const aggrLevel = this._getSuggestedAggrLevel(this.props.fromTs, this.props.toTs);
    let query_params = {
      p: this.props.paths.join(","),
      t0: this.props.fromTs,
      t1: this.props.toTs,
      a: aggrLevel,
    }
    fetch(`${ROOT_URL}/values?${stringify(query_params)}`)
      .then(handleFetchErrors)
      .then(
        response => response.json().then(json => {
          this.setState({
            fetching: false,
            data: json.paths,
          })
        }),
        errorMsg => {
          this.setState({
            fetching: false,
            errorMsg,
          })
        }
      )
  }

  render() {
    if (this.props.fetching) {
      return (
        <Loading />
      )
    }

    if (this.props.errorMsg) {
      return (
        <div>{this.props.errorMsg}</div>
      )
    }

    // with scale == 1, every second is one pixel exactly: (1 min == 60px, 1 h == 3600px, 1 day == 24*3600px,...)
    const yAxisWidth = Math.min(Math.round(this.props.portWidth * 0.1), 100);
    const xAxisHeight = Math.min(Math.round(this.props.portHeight * 0.1), 50);
    const xAxisTop = this.props.portHeight - xAxisHeight;
    return (
      <div
        style={{
            width: this.props.portWidth,
            height: this.props.portHeight,
            //marginLeft: this.props.panX,
            //marginTop: 0,
            //transformOrigin: "top left",
            //transform: `scale(${this.props.scale}, 1)`,
            backgroundColor: (this.props.zoomInProgress) ? ('yellow') : ('white'),
        }}
      >
        {/* svg width depends on scale and x domain (minX and maxX) */}
        <svg width={this.props.portWidth} height={this.props.portHeight}>

          <rect x={0} y={xAxisTop} width={yAxisWidth} height={xAxisHeight} fill="white" stroke="none" />
          <g transform={`translate(0 0)`}>
            <YAxis
              width={yAxisWidth}
              height={xAxisTop}
              color="#999999"

              minY={this.props.minY}
              maxY={this.props.maxY}
            />
          </g>
          <g transform={`translate(${yAxisWidth - 1} ${xAxisTop})`}>
            <TimestampXAxis
              width={this.props.portWidth - yAxisWidth}
              height={xAxisHeight}
              color="#999999"

              scale={this.props.scale}
              panX={this.props.fromTs * this.props.scale /* we should pass fromTs and toTs here */}

              minTimestamp={this.props.minTimestamp}
              maxTimestamp={this.props.maxTimestamp}
            />
          </g>
        </svg>
      </div>
    );
  }
}

