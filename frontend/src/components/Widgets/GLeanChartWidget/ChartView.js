import React from 'react';

import { generateGridColor } from './utils';

import TimestampXAxis from './TimestampXAxis';
import YAxis from './YAxis';
import { LineChartCanvases } from './LineChartCanvas';
import Grid from './Grid';
import Status from './Status';
import TooltipIndicator from './TooltipIndicator';
import ChartTooltipPopup from './ChartTooltipPopup';
import YAxisMinMaxAdjuster from './YAxisMinMaxAdjuster';

export default class ChartView extends React.Component {
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
    isAggr: false,
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
    this.props.setSharedValue('selectedTime', newClosest === null ? null : newClosest.point.t);
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
    if (diffValue === 0) {
      return [0, 1];
    }
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
        if (!interval.csData.hasOwnProperty(cs.chartSerieId)) {
          // do we have fetched data for this cs?
          continue;
        }
        if (!this.props.yAxesProperties[cs.unit]) {
          continue;
        }
        const helpers = this.props.yAxesProperties[cs.unit].derived;
        const v = helpers.y2v(y);
        const maxDistV = helpers.dy2dv(MAX_DIST_PX);
        for (let point of interval.csData[cs.chartSerieId]) {
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
    const { fetching, errorMsg, isDarkMode } = this.props;
    // with scale == 1, every second is one pixel exactly: (1 min == 60px, 1 h == 3600px, 1 day == 24*3600px,...)
    const xAxisTop = this.props.height - this.props.xAxisHeight;
    const yAxisHeight = xAxisTop;

    /*
      this.props.fetchedIntervalsData:
        [
          {
            "fromTs": 1516870170,
            "toTs": 1524922170,
            "csData": {
              "0-rebalancer.rqww2054.46Bk9z0r6c8K8C9du9XCW3tACqsWMlKj.rate.buying": [
                {
                  "minv": 650.65,
                  "v": 662.0042527615335,
                  "maxv": 668.02,
                  "t": 1518118200
                },
                // ...
              ],
              "0-rebalancer.rqww2054.46Bk9z0r6c8K8C9du9XCW3tACqsWMlKj.rate.selling": [
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
                v2y={this.props.yAxesProperties[unit].derived.v2y}
                yTicks={this.props.yAxesProperties[unit].derived.ticks}
                color={generateGridColor(i, isDarkMode)}
              />
            </g>
          ))}

          <g clipPath="url(#chartContentArea)">
            <g transform={`translate(${yAxesWidth} 0)`}>
              <LineChartCanvases
                key={`i-${this.props.aggrLevel}`}
                fromTs={this.props.fromTs}
                toTs={this.props.fromTs + (this.props.width - yAxesWidth) / this.props.scale}
                height={yAxisHeight}
                intervals={this.props.fetchedIntervalsData}
                scale={this.props.scale}
                isAggr={this.props.isAggr}
                aggrLevel={this.props.aggrLevel}
                drawnChartSeries={this.props.drawnChartSeries}
                yAxesProperties={this.props.yAxesProperties}
              />

              {closest && (
                <TooltipIndicator
                  {...closest}
                  x={this.dt2dx(closest.point.t - this.props.fromTs)}
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

          {drawnUnits.map((unit, i) => {
            const v2y = this.props.yAxesProperties[unit].derived.v2y;
            const minY = v2y(this.props.yAxesProperties[unit].derived.minY);
            const maxY = v2y(this.props.yAxesProperties[unit].derived.maxY);
            const shadowWidth = this.props.width - (i + 1) * this.props.yAxisWidth;
            return (
              <g key={`${i}`} transform={`translate(${this.props.yAxisWidth * i} 0)`}>
                <YAxisMinMaxAdjuster
                  startY={maxY}
                  x={this.props.yAxisWidth - 1}
                  shadowWidth={shadowWidth}
                  topLimit={maxY}
                  bottomLimit={minY - 10}
                  onChangeEnd={y => this.props.onMaxYChange(unit, y)}
                />
                <YAxisMinMaxAdjuster
                  startY={minY}
                  x={this.props.yAxisWidth - 1}
                  shadowWidth={shadowWidth}
                  topLimit={maxY + 10}
                  bottomLimit={minY}
                  onChangeEnd={y => this.props.onMinYChange(unit, y)}
                />
              </g>
            );
          })}
        </svg>

        {closest && (
          <ChartTooltipPopup
            left={this.t2x(closest.point.t) + yAxesWidth}
            top={this.props.yAxesProperties[closest.cs.unit].derived.v2y(closest.point.v)}
            closest={closest}
            // if tooltip was opened by a click, it should be on top so user can select text:
            onTop={this.state.overrideClosestPoint}
            nDecimals={this.props.nDecimals}
          />
        )}
      </div>
    );
  }
}
