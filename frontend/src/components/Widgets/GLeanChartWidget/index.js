import React from 'react';
import moment from 'moment';
import { stringify } from 'qs';

import { ROOT_URL, handleFetchErrors } from '../../../store/actions';
import { getSuggestedAggrLevel, getMissingIntervals, generateGridColor } from './utils';

import RePinchy from '../../RePinchy';
import TimestampXAxis from './TimestampXAxis';
import YAxis from './YAxis';
import IntervalLineChart from './IntervalLineChart';
import Legend from './Legend';
import Grid from './Grid';
import Status from './Status';
import TooltipIndicator from './TooltipIndicator';
import TooltipPopup from '../../TooltipPopup';

import './index.scss';
import MatchingPaths from '../../ChartForm/MatchingPaths';
import isWidget from '../isWidget';
import { fetchAuth } from '../../../utils/fetch';

class GLeanChartWidget extends React.Component {
  state = {
    loading: true,
    drawnChartSeries: [],
    allChartSeries: [],
  };
  repinchyMouseMoveHandler = null;
  repinchyClickHandler = null;
  fetchPathsAbortController = null;

  componentDidMount() {
    this.fetchPaths();
  }

  componentWillUnmount() {
    if (this.fetchPathsAbortController !== null) {
      this.fetchPathsAbortController.abort();
    }
  }

  fetchPaths = () => {
    if (this.fetchPathsAbortController !== null) {
      return; // fetch is already in progress
    }
    this.fetchPathsAbortController = new window.AbortController();
    const query_params = {
      filter: this.props.chartContent.map(cc => cc.path_filter).join(','),
      limit: 1001,
      failover_trailing: 'false',
    };
    fetchAuth(`${ROOT_URL}/accounts/1/paths/?${stringify(query_params)}`, {
      signal: this.fetchPathsAbortController.signal,
    })
      .then(handleFetchErrors)
      .then(response => response.json())
      .then(json => {
        // construct a better representation of the data for display in the chart:
        const allChartSeries = this.props.chartContent.reduce((result, c, contentIndex) => {
          return result.concat(
            json.paths[c.path_filter].map(path => ({
              chartSeriesId: `${contentIndex}-${path}`,
              path: path,
              serieName: MatchingPaths.constructChartSerieName(path, c.path_filter, c.renaming),
              unit: c.unit,
            })),
          );
        }, []);
        const indexedAllChartSeries = allChartSeries.map((cs, i) => ({
          ...cs,
          index: i,
        }));

        this.setState({
          drawnChartSeries: indexedAllChartSeries,
          allChartSeries: indexedAllChartSeries,
        });
      })
      .catch(errorMsg => {
        this.setState({
          fetchingError: true,
        });
      })
      .then(() => {
        this.fetchPathsAbortController = null;
      });
  };

  // We need to do this weird dance around mousemove events because of performance
  // issues. RePinchy handles all of mouse events (because it needs them for its
  // own purposes too). If it doesn't need them, they are passed below to the
  // child(/ren) components. But if we would pass the mousemove values through props, we
  // would cause React rerendeings. Even with shouldComponentUpdate this is too
  // intensive.
  // So our solution is for the child component to register its mousemove handler
  // via call to `GLeanChartWidget.registerRepinchyMouseMoveHandler()`. On the other
  // hand, RePinchy gets our handler as its prop (and calls it), and we pass the
  // events to registered event handler. Easy, right? :)
  registerRePinchyMouseMoveHandler = handler => {
    this.repinchyMouseMoveHandler = handler;
  };
  handleRePinchyMouseMove = ev => {
    if (this.repinchyMouseMoveHandler === null) {
      return;
    }
    this.repinchyMouseMoveHandler(ev);
  };
  // and then we use the same principle with click, just to be consistent:
  registerRePinchyClickHandler = handler => {
    this.repinchyClickHandler = handler;
  };
  handleRePinchyClick = ev => {
    if (this.repinchyClickHandler === null) {
      return;
    }
    this.repinchyClickHandler(ev);
  };

  handleDrawnChartSeriesChange = drawnChartSeries => {
    this.setState({
      drawnChartSeries: drawnChartSeries,
    });
  };

  render() {
    const MAX_YAXIS_WIDTH = 70;
    let legendWidth, chartWidth, legendIsDockable, legendPositionStyle;
    if (this.props.width > 500) {
      legendWidth = Math.min(this.props.width * 0.3, 200);
      chartWidth = this.props.width - legendWidth;
      legendIsDockable = false;
      legendPositionStyle = {
        float: 'right',
      };
    } else {
      legendWidth = Math.min(this.props.width, 200);
      chartWidth = this.props.width;
      legendIsDockable = true;
      // if legend is dockable, it should be taken out of flow:
      legendPositionStyle = {
        position: 'absolute',
        right: 0,
        top: 0,
      };
    }
    const yAxisWidth = Math.min(Math.round(chartWidth * 0.1), MAX_YAXIS_WIDTH); // 10% of chart width, max. 100px
    const xAxisHeight = Math.min(Math.round(this.props.height * 0.1), 50); // 10% of chart height, max. 50px
    const yAxesCount = new Set(this.state.drawnChartSeries.map(cs => cs.unit)).size;
    const yAxesWidth = yAxesCount * yAxisWidth;

    const toTs = moment()
      .add(1, 'day')
      .unix();
    const fromTs = moment()
      .subtract(1, 'month')
      .unix();
    const initialScale = chartWidth / (toTs - fromTs);
    const initialPanX = -fromTs * initialScale;
    return (
      <div
        className="widget-dialog-container"
        style={{
          position: 'relative',
          minHeight: this.props.height,
          width: this.props.width,
        }}
      >
        <div>
          <RePinchy
            width={this.props.width}
            height={this.props.height}
            activeArea={{
              x: yAxesWidth,
              y: 0,
              w: chartWidth - yAxesWidth,
              h: this.props.height - xAxisHeight,
            }}
            kidnapScroll={this.props.isFullscreen}
            initialState={{
              x: initialPanX,
              y: 0.0,
              scale: initialScale,
            }}
            handleMouseMove={this.handleRePinchyMouseMove}
            handleClick={this.handleRePinchyClick}
          >
            {(x, y, scale, zoomInProgress, pointerPosition) => (
              <div className="repinchy-content">
                <ChartContainer
                  chartSeries={this.state.allChartSeries}
                  drawnChartSeries={this.state.drawnChartSeries}
                  width={chartWidth}
                  height={this.props.height}
                  fromTs={Math.round(-(x - yAxesWidth) / scale)}
                  toTs={Math.round(-(x - yAxesWidth) / scale) + Math.round(chartWidth / scale)}
                  scale={scale}
                  zoomInProgress={zoomInProgress}
                  xAxisHeight={xAxisHeight}
                  yAxisWidth={yAxisWidth}
                  registerMouseMoveHandler={this.registerRePinchyMouseMoveHandler}
                  registerClickHandler={this.registerRePinchyClickHandler}
                />
                <div style={legendPositionStyle}>
                  <Legend
                    dockingEnabled={legendIsDockable}
                    width={legendWidth}
                    height={this.props.height}
                    chartSeries={this.state.allChartSeries}
                    onDrawnChartSeriesChange={this.handleDrawnChartSeriesChange}
                  />
                </div>
              </div>
            )}
          </RePinchy>
        </div>
      </div>
    );
  }
}

export class ChartContainer extends React.Component {
  state = {
    fetchedIntervalsData: [],
    errorMsg: null,
  };
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
  yAxesProperties = {};
  YAXIS_TOP_PADDING = 40;
  MAX_POINTS_PER_100PX = 5;

  componentDidMount() {
    this.ensureData(this.props.fromTs, this.props.toTs);
  }

  componentDidUpdate(prevProps, prevState, snapshot) {
    if (
      prevProps.chartSeries !== this.props.chartSeries ||
      prevProps.fromTs !== this.props.fromTs ||
      prevProps.toTs !== this.props.toTs
    ) {
      this.paths = this.props.chartSeries.map(cs => cs.path);
      this.ensureData(this.props.fromTs, this.props.toTs);
    }
    this.updateYAxisDerivedProperties(this.props);
  }

  ensureData(fromTs, toTs) {
    if (this.paths === null) {
      return; // we didn't receive the list of paths yet, we only have path filters
    }
    const maxPointsOnChart = (this.MAX_POINTS_PER_100PX * this.props.width) / 100;
    const aggrLevel = getSuggestedAggrLevel(this.props.fromTs, this.props.toTs, maxPointsOnChart, -1); // -1 for no aggregation
    this.setState(oldState => ({
      aggrLevel: aggrLevel,
      fetchedIntervalsData: this.fetchedData[aggrLevel] || [],
    }));
    const existingIntervals = [
      // anything that we might have already fetched for this aggrLevel:
      ...(this.fetchedData[`${aggrLevel}`] || []),
      // and anything that is being fetched:
      ...this.requestsInProgress.filter(v => v.aggrLevel === aggrLevel),
    ];

    const diffTs = toTs - fromTs;
    const wantedIntervals = getMissingIntervals(existingIntervals, {
      fromTs: fromTs - diffTs / 2,
      toTs: toTs + diffTs / 2,
    }); // do we have everything we need, plus some more?
    if (wantedIntervals.length === 0) {
      return;
    }

    // fetch a bit more than we checked for, so that we don't fetch too often (and make
    // sure that the timestamps are aligned according to aggr. level)
    const alignedFromTs = this.alignTs(fromTs - diffTs, aggrLevel, Math.floor);
    const alignedToTs = this.alignTs(toTs + diffTs, aggrLevel, Math.ceil);
    const intervalsToFeFetched = getMissingIntervals(existingIntervals, {
      fromTs: alignedFromTs,
      toTs: alignedToTs,
    });
    for (let intervalToBeFetched of intervalsToFeFetched) {
      this.startFetchRequest(intervalToBeFetched.fromTs, intervalToBeFetched.toTs, aggrLevel); // take exactly what is needed, so you'll be able to merge intervals easily
    }
  }

  // API requests the timestamps to be aligned to correct times according to aggr. level:
  alignTs(originalTs, aggrLevel, floorCeilFunc) {
    if (aggrLevel === -1) {
      return originalTs; // no aggregation -> no alignment
    }
    const interval = 3600 * 3 ** aggrLevel;
    return floorCeilFunc(originalTs / interval) * interval;
  }

  saveResponseData(fromTs, toTs, aggrLevel, json) {
    // make sure aggregation level exists:
    this.fetchedData[aggrLevel] = this.fetchedData[aggrLevel] || [];

    // find all existing intervals which are touching our interval so you can merge
    // them to a single block:
    const existingBlockBefore = this.fetchedData[aggrLevel].find(b => b.toTs === fromTs);
    const existingBlockAfter = this.fetchedData[aggrLevel].find(b => b.fromTs === toTs);
    // if there are any, merge them together:
    let pathsData = {};
    for (let path of this.paths) {
      pathsData[path] = [
        ...(existingBlockBefore ? existingBlockBefore.pathsData[path] : []),
        ...json.paths[path].data,
        ...(existingBlockAfter ? existingBlockAfter.pathsData[path] : []),
      ];
    }
    const mergedBlock = {
      fromTs: existingBlockBefore ? existingBlockBefore.fromTs : fromTs,
      toTs: existingBlockAfter ? existingBlockAfter.toTs : toTs,
      pathsData: pathsData,
    };

    // then construct new this.fetchedData from data blocks that came before, our merged block and those that are after:
    this.fetchedData[aggrLevel] = [
      ...this.fetchedData[aggrLevel].filter(b => b.toTs < mergedBlock.fromTs),
      mergedBlock,
      ...this.fetchedData[aggrLevel].filter(b => b.fromTs > mergedBlock.toTs),
    ];

    // while you are saving data, update min/max value:
    for (let cs of this.props.chartSeries) {
      if (!this.yAxesProperties.hasOwnProperty(cs.unit)) {
        this.yAxesProperties[cs.unit] = {
          minYValue: 0,
          maxYValue: Number.NEGATIVE_INFINITY,
        };
      }
      this.yAxesProperties[cs.unit].minYValue = json.paths[cs.path].data.reduce(
        (prevValue, d) => Math.min(prevValue, aggrLevel < 0 ? d.v : d.minv),
        this.yAxesProperties[cs.unit].minYValue,
      );
      this.yAxesProperties[cs.unit].maxYValue = json.paths[cs.path].data.reduce(
        (prevValue, d) => Math.max(prevValue, aggrLevel < 0 ? d.v : d.maxv),
        this.yAxesProperties[cs.unit].maxYValue,
      );
    }

    // now that you have updated minYValue and maxYValue for each unit, prepare some of the data that you
    // will need often in cache - minY, maxY, ticks, v2y() and y2v():
    this.updateYAxisDerivedProperties(this.props);

    this.setState(oldState => ({
      fetchedIntervalsData: this.fetchedData[aggrLevel],
    }));
  }

  updateYAxisDerivedProperties = props => {
    const yAxisHeight = props.height - props.xAxisHeight - this.YAXIS_TOP_PADDING;
    for (let unit in this.yAxesProperties) {
      const ticks = ChartView.getYTicks(
        this.yAxesProperties[unit].minYValue,
        this.yAxesProperties[unit].maxYValue,
      );
      const minY = parseFloat(ticks[0]);
      const maxY = parseFloat(ticks[ticks.length - 1]);
      this.yAxesProperties[unit].derived = {
        minY: minY,
        maxY: maxY,
        ticks: ticks,
        v2y: v => this.YAXIS_TOP_PADDING + yAxisHeight - ((v - minY) * yAxisHeight) / (maxY - minY),
        y2v: y => ((maxY - minY) * (yAxisHeight - y + this.YAXIS_TOP_PADDING)) / yAxisHeight + minY,
        dy2dv: dy => (dy * (maxY - minY)) / yAxisHeight,
        dv2dy: dv => (dv * yAxisHeight) / (maxY - minY),
      };
    }
  };

  startFetchRequest(fromTs, toTs, aggrLevel) {
    const requestInProgress = {
      // prepare an object and remember its reference; you will need it when removing it from the list
      aggrLevel,
      fromTs,
      toTs,
    };
    this.requestsInProgress.push(requestInProgress);
    this.setState({
      fetching: true,
    });

    fetchAuth(
      `${ROOT_URL}/accounts/1/values?${stringify({
        p: this.paths.join(','),
        t0: fromTs,
        t1: toTs,
        a: aggrLevel < 0 ? 'no' : aggrLevel,
      })}`,
    )
      .then(handleFetchErrors)
      .then(
        response =>
          response.json().then(json => {
            this.saveResponseData(fromTs, toTs, aggrLevel, json);
            return null;
          }),
        errorMsg => {
          return errorMsg;
        },
      )
      .then(errorMsg => {
        // whatever happened, remove the info about this particular request:
        this.requestsInProgress = this.requestsInProgress.filter(r => r !== requestInProgress);
        this.setState({
          fetching: this.requestsInProgress.length > 0,
          errorMsg,
        });
      });
  }

  getMinKnownTs() {
    /*
      Fun fact: did you know the coordinate system in SVG is limited (by implementation)? It turns out that the circle in the
      folowing SVG will not be displayed: (in Firefox at least)

        <svg width="100" height="100">
          <g transform="translate(1234567890, 0)">
            <circle cx="-1234567890" cy="50" r="3" />
          </g>
        </svg>

      More details here: https://oreillymedia.github.io/Using_SVG/extras/ch08-precision.html

      How is this important? We were drawing with coordinate system translated by fromTs * scale. That simplified maths but
      lead to largish numbers being used, so the points weren't being displayed.
    */
    if (!this.fetchedData[this.state.aggrLevel] || this.fetchedData[this.state.aggrLevel].length === 0) {
      return 0;
    }
    return this.fetchedData[this.state.aggrLevel][0].fromTs;
  }

  render() {
    return (
      <ChartView
        {...this.props}
        fetching={this.state.fetching}
        fetchedIntervalsData={this.state.fetchedIntervalsData}
        errorMsg={this.state.errorMsg}
        aggrLevel={this.state.aggrLevel}
        minKnownTs={this.getMinKnownTs()}
        yAxesProperties={this.yAxesProperties}
      />
    );
  }
}

export class ChartView extends React.Component {
  static defaultProps = {
    width: 500,
    height: 300,
    fromTs: 0,
    toTs: 0,
    yAxisWidth: 50,
    xAxisHeight: 50,
    nDecimals: 2,
    scale: 1,
    zoomInProgress: false,
    aggrLevel: null,
    registerMouseMoveHandler: handler => {},
    registerClickHandler: handler => {},
    fetchedIntervalsData: [],
    drawnChartSeries: [],
    yAxesProperties: {},
  };
  state = {
    closestPoint: null,
    overrideClosestPoint: null, // when tooltip is open, this is set
  };
  oldClosest = null;

  componentDidMount() {
    // we want to receive mousemove events from RePinchy:
    this.props.registerMouseMoveHandler(this.handleMouseMove);
    this.props.registerClickHandler(this.handleClick);
  }

  // functions for converting x <-> t:
  dx2dt = dx => dx / this.props.scale;
  dt2dx = dt => dt * this.props.scale;
  x2t = x => this.props.fromTs + x / this.props.scale;
  t2x = t => (t - this.props.fromTs) * this.props.scale;

  _getClosestPointFromEvent = ev => {
    // this will get called from RePinchy when there is a mousemove event:
    let rect = ev.currentTarget.getBoundingClientRect();
    const ts = this.x2t(ev.clientX - rect.left);
    const y = ev.clientY - rect.top;
    const newClosest = this.getClosestValue(ts, y);
    return newClosest;
  };

  _hasClosestPointChanged = newClosest => {
    // if both are null, no change:
    if (this.oldClosest === null && newClosest === null) {
      return false;
    }
    // one is null, there was change:
    if (this.oldClosest === null || newClosest === null) {
      return true;
    }
    // otherwise compare their content:
    if (
      this.oldClosest.cs === newClosest.cs &&
      this.oldClosest.point.t === newClosest.point.t &&
      this.oldClosest.point.v === newClosest.point.v
    ) {
      return false;
    } else {
      return true;
    }
  };

  handleClick = ev => {
    const newClosest = this._getClosestPointFromEvent(ev);
    this.oldClosest = newClosest;
    this.setState({
      closestPoint: newClosest,
      overrideClosestPoint: newClosest,
    });
  };

  handleMouseMove = ev => {
    const newClosest = this._getClosestPointFromEvent(ev);
    if (!this._hasClosestPointChanged(newClosest)) {
      return;
    }
    // closestPoint has changed, save to both state (to rerender) and to this: (for comparison)
    this.oldClosest = newClosest;
    this.setState({
      closestPoint: newClosest,
    });
  };

  static getYTicks(minYValue, maxYValue) {
    // returns an array of strings - values of Y ticks
    if (minYValue === null || maxYValue === null) {
      return null;
    }
    // - normalize values to interval 10.0 - 99.9
    // - determine the appropriate interval I (10, 5 or 2)
    // - return the smallest list of ticks so that ticks[0] <= minYValue, ticks[n+1] = ticks[n] + 1, ticks[last] >= maxYValue

    // interval:
    const diffValue = maxYValue - minYValue;
    const power10 = Math.floor(Math.log10(diffValue)) - 1;
    const normalizedDiff = Math.floor(diffValue / Math.pow(10, power10));
    let normalizedInterval;
    if (normalizedDiff >= 50) {
      normalizedInterval = 10;
    } else if (normalizedDiff >= 20) {
      normalizedInterval = 5;
    } else {
      normalizedInterval = 2;
    }

    const interval = normalizedInterval * Math.pow(10, power10);
    const minValueLimit = Math.floor(minYValue / interval) * interval;
    let ret = [];
    let i;
    const numberOfDecimals = Math.max(0, -power10 - (normalizedInterval === 10 ? 1 : 0));
    for (i = minValueLimit; i < maxYValue; i += interval) {
      ret.push(i.toFixed(numberOfDecimals));
    }
    ret.push(i.toFixed(numberOfDecimals));
    return ret;
  }

  getClosestValue(ts, y) {
    const MAX_DIST_PX = 10;
    const maxDistTs = this.dx2dt(MAX_DIST_PX);

    // brute-force search:
    const applicableIntervals = this.props.fetchedIntervalsData.filter(
      fid => !(fid.toTs < ts - maxDistTs || fid.fromTs > ts + maxDistTs),
    ); // only intervals which are close enough to our ts

    let closest = null;
    for (let interval of applicableIntervals) {
      for (let cs of this.props.drawnChartSeries) {
        if (!interval.pathsData.hasOwnProperty(cs.path)) {
          // do we have fetched data for this cs?
          continue;
        }
        const helpers = this.props.yAxesProperties[cs.unit].derived;
        const v = helpers.y2v(y);
        const maxDistV = helpers.dy2dv(MAX_DIST_PX);
        for (let point of interval.pathsData[cs.path]) {
          const distV = Math.abs(point.v - v);
          const distTs = Math.abs(point.t - ts);
          if (distTs > maxDistTs || distV > maxDistV) continue;
          // when we are searching for closest match, we want it to be in x/y space, not ts/v:
          const distX = this.dt2dx(distTs);
          const distY = helpers.dv2dy(distV);
          const dist = Math.sqrt(distX * distX + distY * distY);

          if (closest === null || dist < closest.dist) {
            closest = {
              cs,
              point,
              dist,
            };
          }
        }
      }
    }
    return closest;
  }

  render() {
    const { fetching, errorMsg } = this.props;
    // with scale == 1, every second is one pixel exactly: (1 min == 60px, 1 h == 3600px, 1 day == 24*3600px,...)
    const xAxisTop = this.props.height - this.props.xAxisHeight;
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

    const closest = this.state.overrideClosestPoint || this.state.closestPoint;

    const drawnUnits = Object.keys(this.props.yAxesProperties).filter(
      unit => !!this.props.drawnChartSeries.find(cs => cs.unit === unit),
    );

    const yAxesCount = drawnUnits.length;
    const yAxesWidth = this.props.yAxisWidth * yAxesCount;

    return (
      <div
        className="chart"
        style={{
          width: this.props.width,
          height: this.props.height,
        }}
      >
        <Status fetching={fetching} errorMsg={errorMsg} />

        <svg width={this.props.width} height={this.props.height}>
          <defs>
            <clipPath id="chartContentArea">
              <rect x={yAxesWidth} y="0" width={this.props.width - yAxesWidth} height={yAxisHeight} />
            </clipPath>
          </defs>

          {drawnUnits.map((unit, i) => (
            <g key={i} transform={`translate(${this.props.yAxisWidth * (i + 1)} 0)`}>
              <Grid
                width={this.props.width - this.props.yAxisWidth * (i + 1)}
                height={yAxisHeight}
                minYValue={this.props.yAxesProperties[unit].minYValue}
                maxYValue={this.props.yAxesProperties[unit].maxYValue}
                v2y={this.props.yAxesProperties[unit].derived.v2y}
                yTicks={this.props.yAxesProperties[unit].derived.ticks}
                color={generateGridColor(i)}
              />
            </g>
          ))}

          <g clipPath="url(#chartContentArea)">
            {/*
              Always draw all intervals which are available in your state. Each of intervals is its own element (with its identifying key) and is
              only transposed; this way there is no need to re-render interval unless the data has changed, we just move it around.
            */}
            <g
              transform={`translate(${yAxesWidth -
                1 -
                (this.props.fromTs - this.props.minKnownTs) * this.props.scale} 0)`}
            >
              {this.props.fetchedIntervalsData.map((interval, intervalIndex) => (
                <IntervalLineChart
                  key={`i-${this.props.aggrLevel}-${intervalIndex}`}
                  interval={interval}
                  yAxisHeight={yAxisHeight}
                  scale={this.props.scale}
                  minKnownTs={this.props.minKnownTs}
                  isAggr={this.props.aggrLevel >= 0}
                  drawnChartSeries={this.props.drawnChartSeries}
                  // dict of v2y() functions per unit:
                  v2y={Object.keys(this.props.yAxesProperties).reduce((result, unit) => {
                    result[unit] = this.props.yAxesProperties[unit].derived.v2y;
                    return result;
                  }, {})}
                />
              ))}
              {closest && (
                <TooltipIndicator
                  {...closest}
                  x={this.dt2dx(closest.point.t - this.props.minKnownTs)}
                  y={this.props.yAxesProperties[closest.cs.unit].derived.v2y(closest.point.v)}
                  r={this.state.overrideClosestPoint ? 5 : 4}
                  yAxisHeight={yAxisHeight}
                />
              )}
            </g>
          </g>

          {drawnUnits.map((unit, i) => (
            <g key={`${i}`} transform={`translate(${this.props.yAxisWidth * i} 0)`}>
              <YAxis
                width={this.props.yAxisWidth}
                height={yAxisHeight}
                unit={unit}
                v2y={this.props.yAxesProperties[unit].derived.v2y}
                yTicks={this.props.yAxesProperties[unit].derived.ticks}
                color="#999999"
              />
            </g>
          ))}

          <g transform={`translate(${yAxesWidth - 1} ${xAxisTop})`}>
            <TimestampXAxis
              width={this.props.width - yAxesWidth}
              height={this.props.xAxisHeight}
              color="#999999"
              scale={this.props.scale}
              panX={
                this.props.fromTs * this.props.scale // we should pass fromTs and toTs here
              }
            />
          </g>
        </svg>

        {closest && (
          <div
            style={{
              position: 'absolute',
              left: this.t2x(closest.point.t) + yAxesWidth,
              top: this.props.yAxesProperties[closest.cs.unit].derived.v2y(closest.point.v),
            }}
          >
            <TooltipPopup
              // if tooltip was opened by a click, it should be on top so user can select text:
              zIndex={this.state.overrideClosestPoint ? 999999 : 1}
            >
              <div>
                <p>{closest.cs.serieName}</p>
                <p>{closest.cs.path}</p>
                {closest.point.minv ? (
                  <p>
                    {closest.point.minv.toFixed(this.props.nDecimals)} {closest.cs.unit} -{' '}
                    {closest.point.maxv.toFixed(this.props.nDecimals)} {closest.cs.unit} (Ø{' '}
                    {closest.point.v.toFixed(this.props.nDecimals)} {closest.cs.unit})
                  </p>
                ) : (
                  <p>
                    Value: {closest.point.v.toFixed(this.props.nDecimals)} {closest.cs.unit}
                  </p>
                )}
                <p>At: {moment(closest.point.t * 1000).format('YYYY-MM-DD HH:mm:ss')}</p>
              </div>
            </TooltipPopup>
          </div>
        )}
      </div>
    );
  }
}

export default isWidget(GLeanChartWidget);
