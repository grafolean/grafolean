import React from 'react';
import moment from 'moment';
import { stringify } from 'qs';

import { ROOT_URL, handleFetchErrors } from '../../store/actions';

import RePinchy from '../RePinchy';
import TimestampXAxis from './TimestampXAxis';
import YAxis from './yaxis';
import Legend from './legend';
import { getSuggestedAggrLevel, getMissingIntervals, generateSerieColor } from './utils';

import './index.css';

const WidgetTitle = (props) => (
  <div className="widget-title">
    <h1>{props.title} <i className="fa fa-pencil" /></h1>
    <a>
      <i className="fa fa-edit" />
    </a>
    <a>
      <i className="fa fa-trash" />
    </a>
    <a>
      <i className="fa fa-arrows-alt" />
    </a>
  </div>
)

export default class MoonChartWidget extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      drawnPaths: [ ...props.paths ],
    }
  }

  render() {
    const widgetWidth = this.props.width;
    const chartWidth = widgetWidth * 0.7;
    const chartHeight = this.props.height;
    const legendWidth = widgetWidth * 0.3;
    const yAxisWidth = Math.min(Math.round(chartWidth * 0.10), 100);  // 10% of chart width, max. 100px
    const xAxisHeight = Math.min(Math.round(chartHeight * 0.10), 50);  // 10% of chart height, max. 50px

    const toTs = moment().unix();
    const fromTs = moment().subtract(1, 'month').unix();
    const initialScale = chartWidth / (toTs - fromTs);
    const initialPanX = - fromTs * initialScale;
    return (
      <div className="moonchart-widget widget">
        <WidgetTitle
          title={this.props.title}
        />
        <div className="widget-content">
          <RePinchy
            width={widgetWidth}
            height={chartHeight}
            activeArea={{
              x: yAxisWidth,
              y: 0,
              w: chartWidth - yAxisWidth,
              h: chartHeight - xAxisHeight,
            }}
            initialState={{
              x: initialPanX,
              y: 0.0,
              scale: initialScale,
            }}
          >
            {(x, y, scale, zoomInProgress) => (
              <div className="repinchy-content">
                <ChartContainer
                  paths={this.props.paths}
                  drawnPaths={this.state.drawnPaths}
                  width={chartWidth}
                  height={chartHeight}
                  fromTs={Math.round(-x/scale)}
                  toTs={Math.round(-x/scale) + Math.round(chartWidth / scale)}
                  scale={scale}
                  zoomInProgress={zoomInProgress}
                  xAxisHeight={xAxisHeight}
                  yAxisWidth={yAxisWidth}
                />
                <div
                  className="legend"
                  style={{
                    width: legendWidth,
                    height: chartHeight,
                    float: 'right',
                  }}
                >
                  <Legend
                    paths={this.props.paths}
                    onDrawnPathsChange={(drawnPaths) => {
                      this.setState({
                        drawnPaths,
                      });
                    }}
                  />
                </div>
              </div>
            )}
          </RePinchy>
        </div>

      </div>
    )
  }
}

class ChartContainer extends React.Component {
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
      minYValue: null,
      maxYValue: null,
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

    // while you are saving data, update min/max value:
    let minYValue = 0;
    let maxYValue = Number.NEGATIVE_INFINITY;
    for (let path of this.paths) {
      minYValue = json.paths[path].data.reduce((prevValue, d) => (
        Math.min(prevValue, (aggrLevel < 0) ? (d.v) : (d.minv))
      ), minYValue);
      maxYValue = json.paths[path].data.reduce((prevValue, d) => (
        Math.max(prevValue, (aggrLevel < 0) ? (d.v) : (d.maxv))
      ), maxYValue);
    }

    this.setState(oldState => ({
      fetchedIntervalsData: this.fetchedData[aggrLevel],
      minYValue: (oldState.minYValue === null) ? (minYValue) : Math.floor(Math.min(oldState.minYValue, minYValue)),
      maxYValue: (oldState.maxYValue === null) ? (maxYValue) : Math.ceil(Math.max(oldState.maxYValue, maxYValue)),
    }));
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
      <ChartView
        {...this.props}
        fetching={this.state.fetching}
        fetchedIntervalsData={this.state.fetchedIntervalsData}
        errorMsg={this.state.errorMsg}
        aggrLevel={this.state.aggrLevel}
        minYValue={this.state.minYValue}
        maxYValue={this.state.maxYValue}
      />
    )
  }
}

class IntervalLineChart extends React.PureComponent {
  render() {
    const v2y = (v) => ((1 - v / this.props.maxYValue) * this.props.yAxisHeight);
    const ts2x = (ts) => ( ts * this.props.scale );
    return (
      <g>
        {/* draw every path: */}
        {Object.keys(this.props.interval.pathsData)
          .filter(path => this.props.drawnPaths.includes(path))
          .map((path, pathIndex) => {
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
            const serieColor = generateSerieColor(path);
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
          })
        }
      </g>
    );
  }
}

class Grid extends React.Component {
  render() {
    const v2y = (v) => ((1 - v / this.props.maxYValue) * this.props.height);
    return (
      <g>
        {this.props.yTicks !== null && this.props.yTicks.map(v => {
          const y = v2y(v);
          return (
            <line x1={0} y1={y} x2={this.props.width + 300} y2={y} shapeRendering="crispEdges" stroke="#f3f3f3" strokeWidth="1"/>
          )
        })}
      </g>
    );
  }
}

class ChartView extends React.Component {

  getYTicks() {
    if ((this.props.minYValue === null) || (this.props.maxYValue === null)) {
      return null;
    };
    return [0, 100, 200, 300, 400, 500, 600, 700];
  }

  render() {
    // with scale == 1, every second is one pixel exactly: (1 min == 60px, 1 h == 3600px, 1 day == 24*3600px,...)
    const xAxisTop = this.props.height - this.props.xAxisHeight;
    const yAxisHeight = xAxisTop;
    const yTicks = this.getYTicks();

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
          ...this.props.style,
        }}
      >
        <div className="chart"
          style={{
            width: this.props.width,
            height: this.props.height,
            backgroundColor: (this.props.zoomInProgress) ? ('yellow') : ('white'),
            position: 'relative',
            float: 'left',
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

          <svg width={this.props.width} height={this.props.height}>
          
            <g transform={`translate(${this.props.yAxisWidth} 0)`}>
              <Grid
                width={this.props.width - this.props.yAxisWidth}
                height={yAxisHeight}
                maxYValue={this.props.maxYValue}
                yTicks={yTicks}
              />
            </g>
            {/*
              Always draw all intervals which are available in your state. Each of intervals is its own element (with its identifying key) and is
              only transposed; this way there is no need to re-render interval unless the data has changed, we just move it around.
            */}
            <g transform={`translate(${this.props.yAxisWidth - 1 - this.props.fromTs * this.props.scale} 0)`}>
              {this.props.fetchedIntervalsData
                .map((interval, intervalIndex) => (
                  <IntervalLineChart
                    key={`i-${this.props.aggrLevel}-${intervalIndex}`}
                    interval={interval}
                    yAxisHeight={yAxisHeight}
                    minYValue={this.props.minYValue}
                    maxYValue={this.props.maxYValue}
                    scale={this.props.scale}
                    isAggr={this.props.aggrLevel >= 0}
                    drawnPaths={this.props.drawnPaths}
                  />
                ))
              }
            </g>

            <rect x={0} y={xAxisTop} width={this.props.yAxisWidth} height={this.props.xAxisHeight} fill="white" stroke="none" />
            <g transform={`translate(0 0)`}>
              <YAxis
                width={this.props.yAxisWidth}
                height={yAxisHeight}
                minYValue={this.props.minYValue}
                maxYValue={this.props.maxYValue}
                yTicks={yTicks}
                color="#999999"
              />
            </g>
            <g transform={`translate(${this.props.yAxisWidth - 1} ${xAxisTop})`}>
              <TimestampXAxis
                width={this.props.width - this.props.yAxisWidth}
                height={this.props.xAxisHeight}
                color="#999999"

                scale={this.props.scale}
                panX={
                  this.props.fromTs * this.props.scale // we should pass fromTs and toTs here
                }
              />
            </g>
          </svg>
        </div>
      </div>
    );
  }
}

