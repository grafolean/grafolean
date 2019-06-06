import React from 'react';
import moment from 'moment';

import './TimestampXAxis.scss';

const _x2ts = (x, scale) => {
  return x / scale;
};
const _ts2x = (ts, scale) => {
  return ts * scale;
};

class XAxisTick extends React.Component {
  render() {
    const { isMajor, x, label, isInterval } = this.props;
    const tickSize = isMajor ? (isInterval ? 10 : 5) : 3;
    return (
      <g>
        <line className={`${isMajor ? 'major' : 'minor'}-tick`} x1={x} y1={0} x2={x} y2={tickSize} />
        {label && (
          <text className={`label ${isInterval ? 'interval' : 'point'}`} x={isInterval ? x + 5 : x} y={18}>
            {label}
          </text>
        )}
      </g>
    );
  }
}

class XAxisSecondaryInterval extends React.Component {
  render() {
    const { label, fromX, toX, isFirst } = this.props;
    const diffX = toX - fromX;
    return (
      <g>
        {isFirst ? (
          <>
            {diffX > 150 && (
              <text className="label secondary-interval left" x={fromX + 5} y={40}>
                {label}
              </text>
            )}
            <text className="label secondary-interval right" x={toX - 5} y={40}>
              {label}
            </text>
          </>
        ) : (
          <>
            <line className="secondary-tick" x1={fromX} y1={22} x2={fromX} y2={40} />

            <text className="label secondary-interval left" x={fromX + 5} y={40}>
              {label}
            </text>
            {diffX > 150 && (
              <text className="label secondary-interval right" x={toX - 5} y={40}>
                {label}
              </text>
            )}
          </>
        )}
      </g>
    );
  }
}

export default class TimestampXAxis extends React.Component {
  /*
    We wish to display sensible X axis labels depending on time range selected. For example, this looks
    quite OK, except that we want to zoom in to minute detail:
    https://www.highcharts.com/demo/line-boost/dark-unica
  */

  getXTicksPositions() {
    const { panX, scale, width } = this.props;
    // depending on scale, we use different label formatting, spacing,... to display ticks. First set
    // the vars for every possible scale:
    let minorTickDurationUnit, isMajorTickCallback, tickLabelCallback; // http://momentjs.com/docs/#/parsing/string-format/
    let minorTickDurationQuantity = 1;
    if (scale > 72.0) {
      minorTickDurationUnit = 'second';
      isMajorTickCallback = m => true;
      tickLabelCallback = (m, isMajorTick) => m.format('HH:mm:ss');
    } else if (scale > 25.0) {
      minorTickDurationUnit = 'second';
      isMajorTickCallback = m => m.second() % 5 === 0;
      tickLabelCallback = (m, isMajorTick) => (isMajorTick ? m.format('HH:mm:ss') : null);
    } else if (scale > 7.4) {
      minorTickDurationUnit = 'second';
      isMajorTickCallback = m => m.second() % 10 === 0;
      tickLabelCallback = (m, isMajorTick) => (isMajorTick ? m.format('HH:mm:ss') : null);
    } else if (scale > 4.1) {
      minorTickDurationUnit = 'second';
      minorTickDurationQuantity = 10;
      isMajorTickCallback = m => m.second() % 30 === 0;
      tickLabelCallback = (m, isMajorTick) => (isMajorTick ? m.format('HH:mm:ss') : null);
    } else if (scale > 0.9) {
      minorTickDurationUnit = 'second';
      minorTickDurationQuantity = 10;
      isMajorTickCallback = m => m.second() === 0;
      tickLabelCallback = (m, isMajorTick) => (isMajorTick ? m.format('HH:mm') : null);
    } else if (scale > 0.5) {
      minorTickDurationUnit = 'minute';
      isMajorTickCallback = m => m.minute() % 2 === 0;
      tickLabelCallback = (m, isMajorTick) => (isMajorTick ? m.format('HH:mm') : null);
    } else if (scale > 0.28) {
      minorTickDurationUnit = 'minute';
      isMajorTickCallback = m => m.minute() % 5 === 0;
      tickLabelCallback = (m, isMajorTick) => (isMajorTick ? m.format('HH:mm') : null);
    } else if (scale > 0.082) {
      minorTickDurationUnit = 'minute';
      isMajorTickCallback = m => m.minute() % 10 === 0;
      tickLabelCallback = (m, isMajorTick) => (isMajorTick ? m.format('HH:mm') : null);
    } else if (scale > 0.035) {
      minorTickDurationUnit = 'minute';
      minorTickDurationQuantity = 10;
      isMajorTickCallback = m => m.minute() % 30 === 0;
      tickLabelCallback = (m, isMajorTick) => (isMajorTick ? m.format('HH:mm') : null);
    } else if (scale > 0.016) {
      minorTickDurationUnit = 'minute';
      minorTickDurationQuantity = 10;
      isMajorTickCallback = m => m.minute() === 0;
      tickLabelCallback = (m, isMajorTick) => (isMajorTick ? m.format('HH:mm') : null);
    } else if (scale > 0.01) {
      minorTickDurationUnit = 'minute';
      minorTickDurationQuantity = 10;
      isMajorTickCallback = m => m.minute() === 0;
      tickLabelCallback = (m, isMajorTick) => (isMajorTick && m.hour() % 2 === 0 ? m.format('HH:mm') : null);
    } else if (scale > 0.0048) {
      minorTickDurationUnit = 'hour';
      isMajorTickCallback = m => m.hour() % 4 === 0;
      tickLabelCallback = (m, isMajorTick) => (isMajorTick ? m.format('HH:mm') : null);
    } else if (scale > 0.0027) {
      minorTickDurationUnit = 'hour';
      isMajorTickCallback = m => m.hour() % 6 === 0;
      tickLabelCallback = (m, isMajorTick) => (isMajorTick ? m.format('HH:mm') : null);
    } else if (scale > 0.00138) {
      minorTickDurationUnit = 'hour';
      isMajorTickCallback = m => m.hour() % 12 === 0;
      tickLabelCallback = (m, isMajorTick) => (isMajorTick ? m.format('HH:mm') : null);
    } else if (scale > 0.0008) {
      minorTickDurationUnit = 'hour';
      minorTickDurationQuantity = 12;
      isMajorTickCallback = m => m.hour() % 12 === 0;
      tickLabelCallback = (m, isMajorTick) => (isMajorTick && m.hour() === 0 ? m.format('D.M.') : null);
    } else if (scale > 0.0007) {
      minorTickDurationUnit = 'day';
      isMajorTickCallback = m => true;
      tickLabelCallback = (m, isMajorTick) => m.format('D.M.');
    } else if (scale > 0.00036) {
      minorTickDurationUnit = 'day';
      isMajorTickCallback = m => m.date() % 2 === 1;
      tickLabelCallback = (m, isMajorTick) => (isMajorTick ? m.format('D.M.') : null);
    } else if (scale > 0.00016) {
      minorTickDurationUnit = 'day';
      isMajorTickCallback = m => m.date() % 4 === 1;
      tickLabelCallback = (m, isMajorTick) => (isMajorTick ? m.format('D.M.') : null);
    } else if (scale > 0.0001) {
      minorTickDurationUnit = 'day';
      isMajorTickCallback = m => m.date() % 8 === 1;
      tickLabelCallback = (m, isMajorTick) => (isMajorTick ? m.format('D.M.') : null);
    } else if (scale > 0.00007) {
      minorTickDurationUnit = 'day';
      isMajorTickCallback = m => m.date() === 1 || m.date() === 15;
      tickLabelCallback = (m, isMajorTick) => (isMajorTick ? m.format('D.M.') : null);
    } else if (scale > 0.000049) {
      minorTickDurationUnit = 'day';
      isMajorTickCallback = m => m.date() === 1;
      tickLabelCallback = (m, isMajorTick) => (isMajorTick ? m.format('MMM') : null);
    } else if (scale > 0.000033) {
      minorTickDurationUnit = 'month';
      isMajorTickCallback = m => true;
      tickLabelCallback = (m, isMajorTick) => (isMajorTick ? m.format('MMM') : null);
    } else if (scale > 0.000015) {
      minorTickDurationUnit = 'month';
      isMajorTickCallback = m => m.month() % 2 === 0;
      tickLabelCallback = (m, isMajorTick) => (isMajorTick ? m.format('MMM') : null);
    } else if (scale > 0.0000089) {
      minorTickDurationUnit = 'month';
      isMajorTickCallback = m => m.month() % 6 === 0;
      tickLabelCallback = (m, isMajorTick) => (isMajorTick ? m.format('MMM') : null);
    } else if (scale > 0.0000028) {
      minorTickDurationUnit = 'month';
      isMajorTickCallback = m => m.month() === 0;
      tickLabelCallback = (m, isMajorTick) => (isMajorTick ? m.format('YYYY') : null);
    } else if (scale > 0.0000017) {
      minorTickDurationUnit = 'year';
      isMajorTickCallback = m => true;
      tickLabelCallback = (m, isMajorTick) => (isMajorTick ? m.format('YYYY') : null);
    } else if (scale > 0.00000074) {
      minorTickDurationUnit = 'year';
      isMajorTickCallback = m => m.year() % 2 === 0;
      tickLabelCallback = (m, isMajorTick) => (isMajorTick ? m.format('YYYY') : null);
    } else if (scale > 0.00000042) {
      minorTickDurationUnit = 'year';
      isMajorTickCallback = m => m.year() % 4 === 0;
      tickLabelCallback = (m, isMajorTick) => (isMajorTick ? m.format('YYYY') : null);
    } else if (scale > 0.0) {
      minorTickDurationUnit = 'year';
      isMajorTickCallback = m => m.year() % 8 === 0;
      tickLabelCallback = (m, isMajorTick) => (isMajorTick ? m.format('YYYY') : null);
    } else {
      return [];
    }

    // now that you know how, display the ticks and labels:
    let ticks = [];
    const tsMin = _x2ts(panX, scale);
    const tsMax = _x2ts(panX + width, scale);
    let minorTickDuration = moment.duration(minorTickDurationQuantity, minorTickDurationUnit);
    // make sure that start is aligned with minorTickDurationQuantity times minorTickDurationUnit:
    const start = moment(tsMin * 1000).startOf(minorTickDurationUnit);
    let maybeUnrounded = start.get(minorTickDurationUnit);
    start
      .set(minorTickDurationUnit, maybeUnrounded - (maybeUnrounded % minorTickDurationQuantity))
      .add(minorTickDuration);
    const end = moment(tsMax * 1000).endOf(minorTickDurationUnit);
    for (let m = start.clone(); m.isBefore(end); m.add(minorTickDuration)) {
      const ts = m.unix();
      const isMajorTick = isMajorTickCallback(m);
      ticks.push({
        ts: ts,
        x: _ts2x(ts, scale) - panX,
        isMajor: isMajorTick,
        label: tickLabelCallback(m, isMajorTick),
        isInterval: scale > 0.00138 ? false : true, // days, months and years are drawn a bit to the side, because they are intervals, not points in time
      });
    }

    // sometimes it makes sense to display the larger interval in the second line (when
    // there are only hours displayed, show they day; with only days, show the year)
    let secondaryIntervalDurationUnit;
    let secondaryIntervalLabelFormat;
    if (scale > 0.00138) {
      secondaryIntervalDurationUnit = 'day';
      secondaryIntervalLabelFormat = 'D.M.YY';
    } else if (scale > 0.0000089) {
      secondaryIntervalDurationUnit = 'year';
      secondaryIntervalLabelFormat = 'YYYY';
    } else {
      secondaryIntervalDurationUnit = null;
    }
    let secondaryIntervals = [];
    const endRight = moment(tsMax * 1000);
    if (secondaryIntervalDurationUnit) {
      // first interval is special in that it needs to reach the end of whatever unit is used:
      const unalignedStart = moment(tsMin * 1000);
      const nextStart = unalignedStart
        .clone()
        .add(1, secondaryIntervalDurationUnit)
        .startOf(secondaryIntervalDurationUnit);
      secondaryIntervals.push({
        label: unalignedStart.format(secondaryIntervalLabelFormat),
        fromX: _ts2x(unalignedStart.unix(), scale) - panX,
        toX: _ts2x(moment.min(nextStart, endRight).unix(), scale) - panX,
      });
      for (let m = nextStart; m.isBefore(endRight); m.add(1, secondaryIntervalDurationUnit)) {
        secondaryIntervals.push({
          label: m.format(secondaryIntervalLabelFormat),
          fromX: _ts2x(m.unix(), scale) - panX,
          toX:
            _ts2x(moment.min(m.clone().add(1, secondaryIntervalDurationUnit), endRight).unix(), scale) - panX,
        });
      }
    }

    return {
      ticks: ticks,
      secondaryIntervals: secondaryIntervals,
    };
  }

  render() {
    const { ticks, secondaryIntervals } = this.getXTicksPositions();
    return (
      <g className="timestamp-x-axis">
        <rect x={0} y={0} width={this.props.width} height={this.props.height} stroke="none" />
        <line x1={0} y1={0} x2={this.props.width} y2={0} />

        {ticks.map(tickInfo => (
          <XAxisTick key={tickInfo.ts} {...tickInfo} />
        ))}

        {secondaryIntervals.map((interval, i) => (
          <XAxisSecondaryInterval key={`${interval.label}`} isFirst={i === 0} {...interval} />
        ))}
      </g>
    );
  }
}
