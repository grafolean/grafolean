import React from 'react';
import { stringify } from 'qs';

import { ROOT_URL, handleFetchErrors } from '../../store/actions';

import Loading from '../Loading'
import TimestampXAxis from './TimestampXAxis'
import YAxis from './yaxis'
import { getSuggestedAggrLevel, getMissingIntervals } from './utils';

export default class MoonChartContainer extends React.Component {
  requestsInProgress = [
    // {
    //   aggrLevel: ...
    //   fromTs: ...,
    //   toTs: ...,
    // },
  ];
  fetchedData = {
    /*
    aggrLevel: [
      {
        fromTs,
        toTs,
        pathsData: {
          <path0> : [
            { t:..., v:..., vmin:..., max:... },  // aggregation
            { t:..., v:... },  // no aggregation
          ],
        },
      },
       ...
    ]
    */
  };
  paths = null;

  constructor(props) {
    super(props);
    this.state = {
      data: null,
      errorMsg: null,
    }
    // make sure paths never change - if they do, there should be no effect:
    // (because data fetching logic can't deal with changing paths)
    this.paths = props.paths;
  }

  componentDidMount() {
    this.ensureData(this.props.fromTs, this.props.toTs);
  }

  componentWillReceiveProps(nextProps) {
    this.ensureData(nextProps.fromTs, nextProps.toTs);
  }

  ensureData(fromTs, toTs) {
    const aggrLevel = getSuggestedAggrLevel(this.props.fromTs, this.props.toTs);  // -1 for no aggregation
    const existingIntervals = [
      // anything that we might have already fetched for this aggrLevel:
      ...(this.fetchedData[`${aggrLevel}`] || []),
      // and anything that is being fetched:
      ...this.requestsInProgress.filter((v) => (v.aggrLevel === aggrLevel)),
    ];

    const diffTs = toTs - fromTs;
    const wantedIntervals = getMissingIntervals(existingIntervals, { fromTs: fromTs - diffTs/2, toTs: toTs + diffTs/2 });  // do we have everything we need, plus some more?
    if (wantedIntervals.length === 0) {
      return;
    }

    const intervalsToFeFetched = getMissingIntervals(existingIntervals, { fromTs: fromTs - diffTs, toTs: toTs + diffTs });  // fetch a bit more than we checked for, we don't want to fetch too often
    for (let intervalToBeFetched of intervalsToFeFetched) {
      this.startFetchRequest(intervalToBeFetched.fromTs, intervalToBeFetched.toTs, aggrLevel);  // take exactly what is needed, so you'll be able to merge intervals easily
    };
  }

  saveResponseData(fromTs, toTs, aggrLevel, json) {
    // make sure aggregation level exists:
    this.fetchedData[aggrLevel] = this.fetchedData[aggrLevel] || [];

    // find all existing intervals which are touching our interval so you can merge
    // them to a single block:
    const existingBlockBefore = this.fetchedData[aggrLevel].find((b) => (b.toTs === fromTs));
    const existingBlockAfter = this.fetchedData[aggrLevel].find((b) => (b.fromTs === toTs));
    // if there are any, merge them together:
    let pathsData = {};
    for (let path of this.paths) {
      pathsData[path] = [
        ...(existingBlockBefore ? existingBlockBefore.pathsData[path] : []),
        ...json.paths[path].data,
        ...(existingBlockAfter ? existingBlockAfter.pathsData[path] : []),
      ]
    };
    const mergedBlock = {
      fromTs: (existingBlockBefore) ? (existingBlockBefore.fromTs) : (fromTs),
      toTs: (existingBlockAfter) ? (existingBlockAfter.toTs) : (toTs),
      pathsData: pathsData,
    }

    // then construct new this.fetchedData from data blocks that came before, our merged block and those that are after:
    this.fetchedData[aggrLevel] = [
      ...this.fetchedData[aggrLevel].filter((b) => (b.toTs < mergedBlock.fromTs)),
      mergedBlock,
      ...this.fetchedData[aggrLevel].filter((b) => (b.fromTs > mergedBlock.toTs)),
    ];

    this.setState({
      data: this.fetchedData[aggrLevel],
    });
  }

  startFetchRequest(fromTs, toTs, aggrLevel) {
    const requestInProgress = {  // prepare an object and remember its reference; you will need it when removing it from the list
      aggrLevel,
      fromTs,
      toTs,
    };
    this.requestsInProgress.push(requestInProgress);

    fetch(`${ROOT_URL}/values?${stringify({
      p: this.paths.join(","),
      t0: fromTs,
      t1: toTs,
      a: (aggrLevel < 0) ? ('no') : (aggrLevel),
    })}`)
      .then(handleFetchErrors)
      .then(
        response => response.json().then(json => {
          this.saveResponseData(fromTs, toTs, aggrLevel, json);
          // remove the info about this particular request:
          this.requestsInProgress = this.requestsInProgress.filter((r) => (r !== requestInProgress));
        }),
        errorMsg => {
          this.setState({
            errorMsg,
          })
        }
      )
  }

  render() {
    return (
      <MoonChartView
        {...this.props}
        data={this.state.data}
        errorMsg={this.state.errorMsg}
      />
    )
  }
}

class MoonChartView extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      errorMsg: null,
    };
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
    // const _v2y = (this.state.aggrLevel < 0) ?
    //   ((v) => ((v / 1000.0) * yAxisHeight)) :
    //   ((v) => ((v[0] / 1000.0) * yAxisHeight));
    // const _ts2x = (ts) => ( (ts - this.props.fromTs) * this.props.scale );

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

          {/* {this.props.paths.map((path) => {
            const visiblePoints = (this.props.data) ? (this.props.data[path].filter( (p) => ((p.t >= this.props.fromTs) && (p.t <= this.props.toTs)) ) ) : ([]);
            return (
              <g transform={`translate(${yAxisWidth - 1} 0)`}>
                {visiblePoints.map((p) => (
                  <circle cx={_ts2x(p.t, this.props.scale)} cy={_v2y(p.v)} r={2} />
                ))}
              </g>
            )
          })} */}

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

