import React from 'react';
import { stringify } from 'qs';

import { ROOT_URL, handleFetchErrors } from '../../store/actions';

import TimestampXAxis from './TimestampXAxis'
import YAxis from './yaxis'
import { getSuggestedAggrLevel, getMissingIntervals } from './utils';

const randomColor = () => (`hsl(${Math.random() * 255}, 100%, 50%)`);

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
      fetchedIntervalsData: [],
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
    this.setState((oldState) => ({
      aggrLevel: aggrLevel,
      fetchedIntervalsData: this.fetchedData[aggrLevel] || [],
    }));
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
      fetchedIntervalsData: this.fetchedData[aggrLevel],
    });
  }

  startFetchRequest(fromTs, toTs, aggrLevel) {
    const requestInProgress = {  // prepare an object and remember its reference; you will need it when removing it from the list
      aggrLevel,
      fromTs,
      toTs,
    };
    this.requestsInProgress.push(requestInProgress);
    this.setState({
      fetching: true,
    })

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
          return null;
        }),
        errorMsg => {
          return errorMsg;
        }
      )
      .then(
        errorMsg => {
          // whatever happened, remove the info about this particular request:
          this.requestsInProgress = this.requestsInProgress.filter((r) => (r !== requestInProgress));
          this.setState({
            fetching: this.requestsInProgress.length > 0,
            errorMsg,
          });
        }
      )
  }

  render() {
    return (
      <MoonChartView
        {...this.props}
        fetching={this.state.fetching}
        fetchedIntervalsData={this.state.fetchedIntervalsData}
        errorMsg={this.state.errorMsg}
        aggrLevel={this.state.aggrLevel}
      />
    )
  }
}

class IntervalLineChart extends React.PureComponent {
  render() {
    const v2y = (v) => ((v / 1000.0) * this.props.yAxisHeight);
    const ts2x = (ts) => ( ts * this.props.scale );
    return (
      <g>
        {/* draw every path: */}
        {Object.keys(this.props.interval.pathsData).map((path, pathIndex) => {
          const pathPoints = this.props.interval.pathsData[path].map((p) => ({
            x: ts2x(p.t),
            y: v2y(p.v),
            minY: v2y(p.minv),
            maxY: v2y(p.maxv),
          }));
          pathPoints.sort((a, b) => (a.x < b.x) ? (-1) : (1));  // seems like the points weren't sorted by now... we should fix this properly
          const linePoints = pathPoints.map((p) => (`${p.x},${p.y}`));
          const areaMinPoints = pathPoints.map((p) => (`${p.x},${p.minY}`));
          const areaMaxPointsReversed = pathPoints.map((p) => (`${p.x},${p.maxY}`)).reverse();
          const serieColor = randomColor();
          return (
            <g key={`g-${pathIndex}`}>
              <path
                d={`M${areaMinPoints.join("L")}L${areaMaxPointsReversed}`}
                style={{
                  fill: serieColor,
                  opacity: 0.2,
                  stroke: 'none',
                }}
              />
              <path
                d={`M${linePoints.join("L")}`}
                style={{
                  fill: 'none',
                  stroke: serieColor,
                }}
              />
              {(!this.props.isAggr) ? (
                pathPoints.map((p, pi) => (
                  // points:
                  <circle key={`p-${pathIndex}-${pi}`} cx={p.x} cy={p.y} r={2} style={{
                    fill: serieColor,
                  }} />
                ))
              ) : (null)}
            </g>
          );
        })}
      </g>
    );
  }
}

class MoonChartView extends React.Component {

  render() {
    // with scale == 1, every second is one pixel exactly: (1 min == 60px, 1 h == 3600px, 1 day == 24*3600px,...)
    const yAxisWidth = Math.min(Math.round(this.props.portWidth * 0.1), 100);
    const xAxisHeight = Math.min(Math.round(this.props.portHeight * 0.1), 50);
    const xAxisTop = this.props.portHeight - xAxisHeight;
    const yAxisHeight = xAxisTop;
    /*
      this.props.fetchedIntervalsData:
        [
          {
            "fromTs": 1516870170,
            "toTs": 1524922170,
            "pathsData": {
              "rebalancer.rqww2054.46Bk9z0r6c8K8C9du9XCW3tACqsWMlKj.rate.buying": [
                {
                  "minv": 650.65,
                  "v": 662.0042527615335,
                  "maxv": 668.02,
                  "t": 1518118200
                },
                // ...
              ],
              "rebalancer.rqww2054.46Bk9z0r6c8K8C9du9XCW3tACqsWMlKj.rate.selling": [
                {
                  "minv": 650.6,
                  "v": 659.263127842755,
                  "maxv": 665.81,
                  "t": 1518118200
                },
                // ...
              ]
            }
          },
          //...
        ]
    */

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
            position: 'relative',
        }}
      >

        {(this.props.fetching || this.props.errorMsg) && (
          <div style={{
              position: 'absolute',
              right: 9,
              top: 9,
            }}
          >
            {(this.props.fetching) ? (
              <i className="fa fa-spinner fa-spin" style={{
                  color: '#666',
                  fontSize: 30,
                }}
              />
            ) : (
              <i className="fa fa-exclamation-triangle" style={{
                  color: '#660000',
                  margin: 5,
                  fontSize: 20,
                }}
                title={this.props.errorMsg}
              />
            )}
          </div>
        )}

        <svg width={this.props.portWidth} height={this.props.portHeight}>
          {/*
            Always draw all intervals which are available in your state. Each of intervals is its own element (with its identifying key) and is
            only transposed; this way there is no need to re-render interval unless the data has changed, we just move it around.
          */}
          <g transform={`translate(${yAxisWidth - 1 - this.props.fromTs * this.props.scale} 0)`}>
            {this.props.fetchedIntervalsData
              .map((interval, intervalIndex) => (
                <IntervalLineChart
                  key={`i-${this.props.aggrLevel}-${intervalIndex}`}
                  interval={interval}
                  yAxisHeight={yAxisHeight}
                  scale={this.props.scale}
                  isAggr={this.props.aggrLevel >= 0}
                />
              ))
            }
          </g>

          {/* {this.props.data.map((path) => {
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
              panX={
                this.props.fromTs * this.props.scale // we should pass fromTs and toTs here
              }
            />
          </g>
        </svg>
      </div>
    );
  }
}

