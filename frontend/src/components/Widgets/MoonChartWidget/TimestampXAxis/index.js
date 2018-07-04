import React from 'react';
import styled from 'styled-components';
import moment from 'moment';

import XAxisTick from './xaxistick';

const _x2ts = (x, scale) => { return x / scale; }
const _ts2x = (ts, scale) => { return ts * scale; }

const Line = styled.line`
  shape-rendering: crispEdges;
  stroke: #999999;
  stroke-width: 1;
`
Line.displayName = "Line"

export default class TimestampXAxis extends React.Component {

  /*
    We wish to display sensible X axis labels depending on time range selected. For example, this looks
    quite OK, except that we want to zoom in to minute detail:
    https://www.highcharts.com/demo/line-boost/dark-unica
  */

  _getXTicksPositions(panX, scale, width) {

    // depending on scale, we use different label formatting, spacing,... to display ticks. First set
    // the vars for every possible scale:
    let minorTickDurationUnit, isMajorTickCallback, tickLabelCallback;  // http://momentjs.com/docs/#/parsing/string-format/
    let minorTickDurationQuantity = 1;
    if (scale > 72.0) {
      minorTickDurationUnit = 'second'
      isMajorTickCallback = (m) => (true);
      tickLabelCallback = (m, isMajorTick) => (m.format("HH:mm:ss"));
    }
    else if (scale > 25.0) {
      minorTickDurationUnit = 'second'
      isMajorTickCallback = (m) => (m.second() % 5 === 0);
      tickLabelCallback = (m, isMajorTick) => ((isMajorTick) ? (m.format("HH:mm:ss")) : (null));
    }
    else if (scale > 7.4) {
      minorTickDurationUnit = 'second'
      isMajorTickCallback = (m) => (m.second() % 10 === 0);
      tickLabelCallback = (m, isMajorTick) => ((isMajorTick) ? (m.format("HH:mm:ss")) : (null));
    }
    else if (scale > 4.1) {
      minorTickDurationUnit = 'second'
      minorTickDurationQuantity = 10
      isMajorTickCallback = (m) => (m.second() % 30 === 0);
      tickLabelCallback = (m, isMajorTick) => ((isMajorTick) ? (m.format("HH:mm:ss")) : (null));
    }
    else if (scale > 0.9) {
      minorTickDurationUnit = 'second'
      minorTickDurationQuantity = 10
      isMajorTickCallback = (m) => ((m.second() === 0));
      tickLabelCallback = (m, isMajorTick) => ((isMajorTick) ? (m.format("HH:mm")) : (null));
    }
    else if (scale > 0.50) {
      minorTickDurationUnit = 'minute'
      isMajorTickCallback = (m) => (m.minute() % 2 === 0);
      tickLabelCallback = (m, isMajorTick) => ((isMajorTick) ? (m.format("HH:mm")) : (null));
    }
    else if (scale > 0.28) {
      minorTickDurationUnit = 'minute'
      isMajorTickCallback = (m) => (m.minute() % 5 === 0);
      tickLabelCallback = (m, isMajorTick) => ((isMajorTick) ? (m.format("HH:mm")) : (null));
    }
    else if (scale > 0.082) {
      minorTickDurationUnit = 'minute'
      isMajorTickCallback = (m) => (m.minute() % 10 === 0);
      tickLabelCallback = (m, isMajorTick) => ((isMajorTick) ? (m.format("HH:mm")) : (null));
    }
    else if (scale > 0.035) {
      minorTickDurationUnit = 'minute'
      minorTickDurationQuantity = 10
      isMajorTickCallback = (m) => (m.minute() % 30 === 0);
      tickLabelCallback = (m, isMajorTick) => ((isMajorTick) ? (m.format("HH:mm")) : (null));
    }
    else if (scale > 0.016) {
      minorTickDurationUnit = 'minute'
      minorTickDurationQuantity = 10
      isMajorTickCallback = (m) => (m.minute() === 0);
      tickLabelCallback = (m, isMajorTick) => ((isMajorTick) ? (m.format("HH:mm")) : (null));
    }
    else if (scale > 0.010) {
      minorTickDurationUnit = 'minute'
      minorTickDurationQuantity = 10
      isMajorTickCallback = (m) => (m.minute() === 0);
      tickLabelCallback = (m, isMajorTick) => ((isMajorTick && (m.hour() % 2 === 0)) ? (m.format("HH:mm")) : (null));
    }
    else if (scale > 0.0048) {
      minorTickDurationUnit = 'hour'
      isMajorTickCallback = (m) => (m.hour() % 4 === 0);
      tickLabelCallback = (m, isMajorTick) => ((isMajorTick) ? (m.format("HH:mm")) : (null));
    }
    else if (scale > 0.0027) {
      minorTickDurationUnit = 'hour'
      isMajorTickCallback = (m) => (m.hour() % 6 === 0);
      tickLabelCallback = (m, isMajorTick) => ((isMajorTick) ? (m.format("HH:mm")) : (null));
    }
    else if (scale > 0.00138) {
      minorTickDurationUnit = 'hour'
      isMajorTickCallback = (m) => (m.hour() % 12 === 0);
      tickLabelCallback = (m, isMajorTick) => ((isMajorTick) ? (m.format("HH:mm")) : (null));
    }
    else if (scale > 0.0008) {
      minorTickDurationUnit = 'hour'
      minorTickDurationQuantity = 12
      isMajorTickCallback = (m) => (m.hour() % 12 === 0);
      tickLabelCallback = (m, isMajorTick) => ((isMajorTick && m.hour() === 0) ? (m.format("D.M.")) : (null));
    }
    else if (scale > 0.0007) {
      minorTickDurationUnit = 'day'
      isMajorTickCallback = (m) => (true);
      tickLabelCallback = (m, isMajorTick) => (m.format("D.M."));
    }
    else if (scale > 0.00036) {
      minorTickDurationUnit = 'day'
      isMajorTickCallback = (m) => (m.date() % 2 === 1);
      tickLabelCallback = (m, isMajorTick) => ((isMajorTick) ? (m.format("D.M.")) : (null));
    }
    else if (scale > 0.00016) {
      minorTickDurationUnit = 'day'
      isMajorTickCallback = (m) => (m.date() % 4 === 1);
      tickLabelCallback = (m, isMajorTick) => ((isMajorTick) ? (m.format("D.M.")) : (null));
    }
    else if (scale > 0.00010) {
      minorTickDurationUnit = 'day'
      isMajorTickCallback = (m) => (m.date() % 8 === 1);
      tickLabelCallback = (m, isMajorTick) => ((isMajorTick) ? (m.format("D.M.")) : (null));
    }
    else if (scale > 0.00007) {
      minorTickDurationUnit = 'day'
      isMajorTickCallback = (m) => (m.date() === 1 || m.date() === 15);
      tickLabelCallback = (m, isMajorTick) => ((isMajorTick) ? (m.format("D.M.")) : (null));
    }
    else if (scale > 0.000049) {
      minorTickDurationUnit = 'day'
      isMajorTickCallback = (m) => (m.date() === 1);
      tickLabelCallback = (m, isMajorTick) => ((isMajorTick) ? (m.format("MMM YYYY")) : (null));
    }
    else if (scale > 0.000033) {
      minorTickDurationUnit = 'month'
      isMajorTickCallback = (m) => (true);
      tickLabelCallback = (m, isMajorTick) => ((isMajorTick) ? (m.format("MMM YYYY")) : (null));
    }
    else if (scale > 0.000015) {
      minorTickDurationUnit = 'month'
      isMajorTickCallback = (m) => (m.month() % 2 === 0);
      tickLabelCallback = (m, isMajorTick) => ((isMajorTick) ? (m.format("MMM YYYY")) : (null));
    }
    else if (scale > 0.0000089) {
      minorTickDurationUnit = 'month'
      isMajorTickCallback = (m) => (m.month() % 6 === 0);
      tickLabelCallback = (m, isMajorTick) => ((isMajorTick) ? (m.format("MMM YYYY")) : (null));
    }
    else if (scale > 0.0000028) {
      minorTickDurationUnit = 'month'
      isMajorTickCallback = (m) => (m.month() === 0);
      tickLabelCallback = (m, isMajorTick) => ((isMajorTick) ? (m.format("YYYY")) : (null));
    }
    else if (scale > 0.0000017) {
      minorTickDurationUnit = 'year'
      isMajorTickCallback = (m) => (true);
      tickLabelCallback = (m, isMajorTick) => ((isMajorTick) ? (m.format("YYYY")) : (null));
    }
    else if (scale > 0.00000074) {
      minorTickDurationUnit = 'year'
      isMajorTickCallback = (m) => (m.year() % 2 === 0);
      tickLabelCallback = (m, isMajorTick) => ((isMajorTick) ? (m.format("YYYY")) : (null));
    }
    else if (scale > 0.00000042) {
      minorTickDurationUnit = 'year'
      isMajorTickCallback = (m) => (m.year() % 4 === 0);
      tickLabelCallback = (m, isMajorTick) => ((isMajorTick) ? (m.format("YYYY")) : (null));
    }
    else if (scale > 0.0) {
      minorTickDurationUnit = 'year'
      isMajorTickCallback = (m) => (m.year() % 8 === 0);
      tickLabelCallback = (m, isMajorTick) => ((isMajorTick) ? (m.format("YYYY")) : (null));
    }
    else {
      return [];
    }

    // now that you know how, display the ticks and labels:
    let ret = []
    const tsMin = _x2ts(panX, scale);
    const tsMax = _x2ts(panX + width, scale);
    let minorTickDuration = moment.duration(minorTickDurationQuantity, minorTickDurationUnit + 's');  // not sure if 's' is needed - moment.js documentation indicates so: http://momentjs.com/docs/#/durations/
    // make sure that start is aligned with minorTickDurationQuantity times minorTickDurationUnit:
    const start = moment(tsMin*1000).startOf(minorTickDurationUnit);
    let maybeUnrounded = start.get(minorTickDurationUnit);
    start.set(minorTickDurationUnit, maybeUnrounded - (maybeUnrounded % minorTickDurationQuantity)).add(minorTickDuration);
    const end = moment(tsMax*1000).endOf(minorTickDurationUnit);
    for (let m = start; m.isBefore(end); m.add(minorTickDuration)) {
      let ts = m.unix();
      let _isMajorTick = isMajorTickCallback(m);
      ret.push({
        ts,
        x: _ts2x(ts, scale) - panX,
        isMajor: _isMajorTick,
        label: tickLabelCallback(m, _isMajorTick),
      })
    }
    return ret;
  }

  render() {
    const tickInfos = this._getXTicksPositions(this.props.panX, this.props.scale, this.props.width)
    return (
      <g>
        <rect x={0} y={0} width={this.props.width} height={this.props.height} fill="white" stroke="none" />
        <Line x1={0} y1={0} x2={this.props.width} y2={0} />

        {tickInfos.map((tickInfo) => (
          <XAxisTick key={tickInfo.ts} {...tickInfo} />
        ))}
      </g>
    );
  }
}

