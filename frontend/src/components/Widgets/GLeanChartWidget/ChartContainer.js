import React from 'react';
import { connect } from 'react-redux';
import { withRouter } from 'react-router-dom';
import { compile } from 'mathjs';

import ChartView from './ChartView';
import { PersistentFetcher } from '../../../utils/fetch/PersistentFetcher';

export class ChartContainer extends React.Component {
  state = {
    fetchedPathsValues: {},
    errorMsg: null,
    yAxesProperties: {},
  };
  YAXIS_TOP_PADDING = 40;
  MAX_POINTS_PER_100PX = 5;

  componentDidUpdate(prevProps) {
    if (prevProps.allChartSeries !== this.props.allChartSeries) {
      this.updateYAxisProperties({});
    }
  }

  getFetchIntervals() {
    /*
      We put multiple PersistentFetchers on the DOM so that each takes care of a smaller part of fetching. Their data
      is being held by us though, and we need to know which intervals should be fetched.
    */
    const { fromTs, toTs } = this.props;
    const intervalSizeTs = Math.round((toTs - fromTs) * 1.5); // chunk size - it could (and will) still happen that we are showing two chunks
    const marginTs = Math.round((toTs - fromTs) / 4.0); // behave like the screen is bigger, to avoid fetching only when the data reaches the corner of the visible chart
    const fromTsWithMargin = fromTs - marginTs;
    const toTsWithMargin = toTs + marginTs;

    let result = [];
    for (
      let i = Math.floor(fromTsWithMargin / intervalSizeTs);
      i < Math.ceil(toTsWithMargin / intervalSizeTs);
      i++
    ) {
      const fromTsInterval = i * intervalSizeTs;
      const toTsInterval = (i + 1) * intervalSizeTs;
      result.push({ fromTs: fromTsInterval, toTs: toTsInterval });
    }
    return result;
  }

  // API requests the timestamps to be aligned to correct times according to aggr. level:
  alignTs(originalTs, aggrLevel, floorCeilFunc) {
    if (aggrLevel === -1) {
      return originalTs; // no aggregation -> no alignment
    }
    const interval = 3600 * 3 ** aggrLevel;
    return floorCeilFunc(originalTs / interval) * interval;
  }

  _applyExpression(data, expression, isAggr) {
    const mathExpression = compile(expression);
    if (isAggr) {
      return data.map(d => ({
        t: d.t,
        v: mathExpression.evaluate({ $1: d.v }),
        minv: mathExpression.evaluate({ $1: d.minv }),
        maxv: mathExpression.evaluate({ $1: d.maxv }),
      }));
    } else {
      return data.map(d => ({
        t: d.t,
        v: mathExpression.evaluate({ $1: d.v }),
      }));
    }
  }

  updateYAxisProperties(pathsValues) {
    // while you are saving data, update min/max value:
    this.setState(prevState => {
      const newYAxesProperties = { ...prevState.yAxesProperties };

      for (let cs of this.props.allChartSeries) {
        if (!newYAxesProperties.hasOwnProperty(cs.unit)) {
          newYAxesProperties[cs.unit] = {
            minYValue: 0,
            maxYValue: Number.NEGATIVE_INFINITY,
          };
        }
        if (!pathsValues[cs.path]) {
          continue;
        }
        newYAxesProperties[cs.unit].minYValue = pathsValues[cs.path].data.reduce(
          (prevValue, d) => Math.min(prevValue, prevState.aggrLevel < 0 ? d.v : d.minv),
          newYAxesProperties[cs.unit].minYValue,
        );
        newYAxesProperties[cs.unit].maxYValue = pathsValues[cs.path].data.reduce(
          (prevValue, d) => Math.max(prevValue, prevState.aggrLevel < 0 ? d.v : d.maxv),
          newYAxesProperties[cs.unit].maxYValue,
        );
      }

      // now that you have updated minYValue and maxYValue for each unit, prepare some of the derived data that you
      // will need often - minY, maxY, ticks, v2y(), y2v(), ticks and similar:
      this.updateYAxisDerivedProperties(newYAxesProperties);
      return {
        yAxesProperties: newYAxesProperties,
      };
    });
  }

  // in-place updates yAxesProperties derived properties (v2y and similar)
  updateYAxisDerivedProperties = yAxesProperties => {
    const { height, xAxisHeight } = this.props;
    const yAxisHeight = height - xAxisHeight - this.YAXIS_TOP_PADDING;
    for (let unit in yAxesProperties) {
      const minYValueEffective =
        yAxesProperties[unit].minYValueUserSet !== undefined
          ? yAxesProperties[unit].minYValueUserSet
          : yAxesProperties[unit].minYValue;
      const maxYValueEffective =
        yAxesProperties[unit].maxYValueUserSet !== undefined
          ? yAxesProperties[unit].maxYValueUserSet
          : yAxesProperties[unit].maxYValue;
      const ticks = ChartView.getYTicks(minYValueEffective, maxYValueEffective);
      const minY = parseFloat(ticks[0]);
      const maxY = parseFloat(ticks[ticks.length - 1]);
      yAxesProperties[unit].derived = {
        minY: minY, // !!! misnomer: minYValue
        maxY: maxY,
        ticks: ticks,
        v2y: v => this.YAXIS_TOP_PADDING + yAxisHeight - ((v - minY) * yAxisHeight) / (maxY - minY),
        y2v: y => ((maxY - minY) * (yAxisHeight - y + this.YAXIS_TOP_PADDING)) / yAxisHeight + minY,
        dy2dv: dy => (dy * (maxY - minY)) / yAxisHeight,
        dv2dy: dv => (dv * yAxisHeight) / (maxY - minY),
      };
    }
  };

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
      lead to largish numbers being used, so the points weren't being displayed. Instead we now need to find minKnownTs,
      which is then our point of reference.
    */
    const { fetchedPathsValues } = this.state;
    const fetchedPathsValuesArray = Object.values(fetchedPathsValues);
    if (fetchedPathsValuesArray.length === 0) {
      return 0;
    }
    return fetchedPathsValuesArray[0].fromTs;
  }

  onMinYChange = (unit, y) => {
    this.setState(prevState => {
      const v = y === undefined ? undefined : prevState.yAxesProperties[unit].derived.y2v(y);
      const newYAxesProperties = { ...prevState.yAxesProperties };
      newYAxesProperties[unit].minYValueUserSet = v;
      this.updateYAxisDerivedProperties(newYAxesProperties);
      return {
        yAxesProperties: newYAxesProperties,
      };
    });
  };

  onMaxYChange = (unit, y) => {
    this.setState(prevState => {
      const v = y === undefined ? undefined : prevState.yAxesProperties[unit].derived.y2v(y);
      const newYAxesProperties = { ...prevState.yAxesProperties };
      newYAxesProperties[unit].maxYValueUserSet = v;
      this.updateYAxisDerivedProperties(newYAxesProperties);
      return {
        yAxesProperties: newYAxesProperties,
      };
    });
  };

  onNotification = (mqttPayload, topic) => {
    const { drawnChartSeries } = this.props;
    const fetchIntervals = this.getFetchIntervals();
    const interval = fetchIntervals.find(fi => fi.fromTs <= mqttPayload.t && fi.toTs > mqttPayload.t);
    if (!interval) {
      return false; // none of our intervals cares about this timestamp, ignore
    }
    const path = topic.substring('accounts/1/values/'.length);
    if (!drawnChartSeries.find(cs => cs.path === path)) {
      return false; // unknown path, ignore
    }
    this.setState({ fetching: true });
    return true;
  };
  onFetchError = errorMsg => {
    this.setState({
      fetching: false,
      errorMsg: errorMsg,
    });
    console.error(errorMsg);
  };
  onUpdateData = (json, listenerInfo) => {
    this.setState({ fetching: false });
    const queryParams = listenerInfo.queryParams;
    const fetchIntervals = this.getFetchIntervals();
    const interval = fetchIntervals.find(fi => fi.fromTs === queryParams.t0 && fi.toTs === queryParams.t1);
    if (!interval) {
      console.error(
        'Oops, this should not happen - interval not found, nowhere to write, ignoring fetched data',
      );
      return;
    }
    const intervalId = `${interval.fromTs}-${interval.toTs}`;
    this.setState(prevState => ({
      fetchedPathsValues: {
        ...prevState.fetchedPathsValues,
        [intervalId]: {
          fromTs: interval.fromTs,
          toTs: interval.toTs,
          paths: json.paths,
        },
      },
    }));
    this.updateYAxisProperties(json.paths);
  };

  getDataInFetchedIntervalsDataFormat = () => {
    // this function converts our internal data to the format that ChartView expects
    const { drawnChartSeries } = this.props;
    const { aggrLevel, fetchedPathsValues } = this.state;

    const result = Object.values(fetchedPathsValues).map(fetched => {
      const { fromTs, toTs, paths } = fetched;
      const csData = {};
      drawnChartSeries.forEach(cs => {
        if (!paths[cs.path]) {
          return;
        }
        csData[cs.chartSerieId] = this._applyExpression(paths[cs.path].data, cs.expression, aggrLevel >= 0);
      });

      return {
        csData: csData,
        fromTs: fromTs,
        toTs: toTs,
      };
    });
    return result;
  };

  render() {
    const { drawnChartSeries } = this.props;
    const { aggrLevel } = this.state;
    const allPaths = drawnChartSeries.map(cs => cs.path);
    const fetchIntervals = this.getFetchIntervals();
    return (
      <>
        {allPaths.length > 0 &&
          fetchIntervals.map(fi => (
            <PersistentFetcher
              key={fi.fromTs}
              resource={`accounts/${this.props.match.params.accountId}/values`}
              mqttTopic={`accounts/${this.props.match.params.accountId}/values/+`}
              queryParams={{
                p: allPaths.join(','),
                t0: fi.fromTs,
                t1: fi.toTs,
                a: aggrLevel < 0 ? 'no' : aggrLevel,
              }}
              onNotification={this.onNotification}
              onUpdate={this.onUpdateData}
              onError={this.onFetchError}
            />
          ))}
        <ChartView
          {...this.props}
          fetching={this.state.fetching}
          fetchedIntervalsData={this.getDataInFetchedIntervalsDataFormat()}
          errorMsg={this.state.errorMsg}
          isAggr={this.state.aggrLevel >= 0}
          aggrLevel={this.state.aggrLevel}
          minKnownTs={this.getMinKnownTs()}
          yAxesProperties={this.state.yAxesProperties}
          onMinYChange={this.onMinYChange}
          onMaxYChange={this.onMaxYChange}
        />
      </>
    );
  }
}

const mapStoreToPropsChartContainer = store => ({
  accounts: store.accounts,
  isDarkMode: store.preferences.colorScheme === 'dark',
});
export default withRouter(connect(mapStoreToPropsChartContainer)(ChartContainer));
