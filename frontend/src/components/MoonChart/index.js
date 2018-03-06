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
    // returns -1 for no aggregation, aggr. level otherwise
    let nHours = Math.ceil((toTs - fromTs) / 3600.0);
    for (let l=-1; l<MAX_AGGR_LEVEL; l++) {
      if (maxPoints >= nHours / (3**l)) {
        return l;
      };
    };
    return MAX_AGGR_LEVEL;
  }

  componentDidMount() {
    const aggrLevel = this._getSuggestedAggrLevel(this.props.fromTs, this.props.toTs);  // -1 for no aggregation
    let query_params = {
      p: this.props.paths.join(","),
      t0: this.props.fromTs,
      t1: this.props.toTs,
      a: (aggrLevel < 0) ? ('no') : (aggrLevel),
    };
    fetch(`${ROOT_URL}/values?${stringify(query_params)}`)
      .then(handleFetchErrors)
      .then(
        response => response.json().then(json => {
          this.setState({
            fetching: false,
            data: json.paths,
            aggrLevel,
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
    if (this.state.fetching) {
      return (
        <Loading />
      )
    }

    if (this.state.errorMsg) {
      return (
        <div>{this.state.errorMsg}</div>
      )
    }

    // with scale == 1, every second is one pixel exactly: (1 min == 60px, 1 h == 3600px, 1 day == 24*3600px,...)
    const yAxisWidth = Math.min(Math.round(this.props.portWidth * 0.1), 100);
    const xAxisHeight = Math.min(Math.round(this.props.portHeight * 0.1), 50);
    const xAxisTop = this.props.portHeight - xAxisHeight;
    const yAxisHeight = xAxisTop
    const _v2y = (this.state.aggrLevel < 0) ?
      ((v) => ((v / 1000.0) * yAxisHeight)) :
      ((v) => ((v[0] / 1000.0) * yAxisHeight));
    const _ts2x = (ts) => ( (ts - this.props.fromTs) * this.props.scale );

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

          {this.props.paths.map((path) => {
            const visiblePoints = this.state.data[path].data.filter( (p) => ((p.t >= this.props.fromTs) && (p.t <= this.props.toTs)) );
            return (
              <g transform={`translate(${yAxisWidth - 1} 0)`}>
                {visiblePoints.map((p) => (
                  <circle cx={_ts2x(p.t, this.props.scale)} cy={_v2y(p.v)} r={2} />
                ))}
              </g>
            )
          })}

          <rect x={0} y={xAxisTop} width={yAxisWidth} height={xAxisHeight} fill="white" stroke="none" />
          <g transform={`translate(0 0)`}>
            <YAxis
              width={yAxisWidth}
              height={yAxisHeight}
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

            />
          </g>
        </svg>
      </div>
    );
  }
}

