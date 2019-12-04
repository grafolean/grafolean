import React from 'react';
import { connect } from 'react-redux';
import { withRouter } from 'react-router-dom';
import { compile } from 'mathjs';
import get from 'lodash/get';

import { getSuggestedAggrLevel } from './utils';

import ChartView from './ChartView';
import { PersistentFetcher } from '../../../utils/fetch/PersistentFetcher';

export class ChartContainer extends React.Component {
  state = {
    fetchedPathsValues: {},
    errorMsg: null,
    yAxesProperties: {},
    derivedFetchedIntervalsData: [], // optimization for faster rendering - derived from fetchedPathsValues
  };
  YAXIS_TOP_PADDING = 40;
  MAX_POINTS_PER_100PX = 5;

  componentDidMount() {
    this.updateAggrLevel();
  }

  componentDidUpdate(prevProps) {
    if (prevProps.allChartSeries !== this.props.allChartSeries) {
      this.updateYAxisProperties();
    }

    // fullscreen:
    if (prevProps.height !== this.props.height) {
      this.updateYAxisProperties();
    }

    if (
      prevProps.allChartSeries !== this.props.allChartSeries ||
      prevProps.fromTs !== this.props.fromTs ||
      prevProps.toTs !== this.props.toTs
    ) {
      this.updateAggrLevel();
    }
  }

  updateAggrLevel() {
    const { fromTs, toTs, allChartSeries, width } = this.props;
    if (allChartSeries.length === 0) {
      return; // we didn't receive the list of paths that match our path filters yet
    }
    const maxPointsOnChart = (this.MAX_POINTS_PER_100PX * width) / 100;
    const aggrLevel = getSuggestedAggrLevel(fromTs, toTs, maxPointsOnChart, -1); // -1 for no aggregation
    this.setState({
      aggrLevel: aggrLevel,
    });
  }

  getFetchIntervals() {
    /*
      We put multiple PersistentFetchers on the DOM so that each takes care of a smaller part of fetching. Their data
      is being held by us though, and we need to know which intervals should be fetched.
    */
    const { fromTs, toTs } = this.props;
    const { aggrLevel } = this.state;
    const intervalSizeTs = 360000 * 3 ** aggrLevel;
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

  _applyExpression(data, expression) {
    if (data.length === 0) {
      return [];
    }
    const mathExpression = compile(expression);
    if (data[0].minv) {
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

  updateYAxisProperties() {
    // update min/max value and similar:
    this.setState(prevState => {
      const newYAxesProperties = { ...prevState.yAxesProperties };
      const { fetchedPathsValues, aggrLevel } = prevState;

      if (!fetchedPathsValues || !fetchedPathsValues[aggrLevel]) {
        return {};
      }

      for (let cs of this.props.allChartSeries) {
        if (!newYAxesProperties.hasOwnProperty(cs.unit)) {
          newYAxesProperties[cs.unit] = {
            minYValue: 0,
            maxYValue: Number.NEGATIVE_INFINITY,
          };
        }
        const mathExpression = compile(cs.expression);

        Object.keys(fetchedPathsValues[aggrLevel]).forEach(intervalId => {
          if (!fetchedPathsValues[aggrLevel][intervalId].paths[cs.path]) {
            return;
          }
          const data = fetchedPathsValues[aggrLevel][intervalId].paths[cs.path].data;
          const lowestV = Math.min(...data.map(d => (prevState.aggrLevel < 0 ? d.v : d.minv)));
          const highestV = Math.max(...data.map(d => (prevState.aggrLevel < 0 ? d.v : d.maxv)));
          const minYValue = mathExpression.evaluate({ $1: lowestV });
          const maxYValue = mathExpression.evaluate({ $1: highestV });
          newYAxesProperties[cs.unit].minYValue = Math.min(newYAxesProperties[cs.unit].minYValue, minYValue);
          newYAxesProperties[cs.unit].maxYValue = Math.max(newYAxesProperties[cs.unit].maxYValue, maxYValue);
        });
      }

      // clean up any entry that doesn't have any values:
      Object.keys(newYAxesProperties).forEach(unit => {
        if (newYAxesProperties[unit].maxYValue === Number.NEGATIVE_INFINITY) {
          delete newYAxesProperties[unit];
        }
      });

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
    const { fetchedPathsValues, aggrLevel } = this.state;
    const fetchedPathsValuesArray = Object.values(get(fetchedPathsValues, aggrLevel, {}));
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
    const { allChartSeries } = this.props;
    const fetchIntervals = this.getFetchIntervals();
    const interval = fetchIntervals.find(fi => fi.fromTs <= mqttPayload.t && fi.toTs > mqttPayload.t);
    if (!interval) {
      return false; // none of our intervals cares about this timestamp, ignore
    }
    const { accountId } = this.props.match.params;
    const prefix = `accounts/${accountId}/values/`;
    if (topic.substring(0, prefix.length) !== prefix) {
      console.error('Oops, this should not happen - we received a notification we did not expect!');
      return false;
    }
    const path = topic.substring(prefix.length);
    if (!allChartSeries.find(cs => cs.path === path)) {
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
    const queryParams = JSON.parse(listenerInfo.fetchOptions.body);
    const fetchIntervals = this.getFetchIntervals();
    const interval = fetchIntervals.find(fi => fi.fromTs === queryParams.t0 && fi.toTs === queryParams.t1);
    if (!interval) {
      console.error(
        'Oops, this should not happen - interval not found, nowhere to write, ignoring fetched data',
      );
      return;
    }
    const intervalId = `${interval.fromTs}-${interval.toTs}`;
    this.setState(
      prevState => ({
        fetchedPathsValues: {
          ...prevState.fetchedPathsValues,
          [prevState.aggrLevel]: {
            ...get(prevState.fetchedPathsValues, prevState.aggrLevel, {}),
            [intervalId]: {
              fromTs: interval.fromTs,
              toTs: interval.toTs,
              paths: json.paths,
            },
          },
        },
      }),
      this.updateDerivedFetchedIntervalsData,
    );
  };

  updateDerivedFetchedIntervalsData() {
    this.setState(prevState => {
      return {
        // Optimization: this is derived information (data in format which is understood by ChartView), but
        // if we calculate it in every render, the charts become very sluggish. The solution is to put it in state:
        derivedFetchedIntervalsData: this.getDataInFetchedIntervalsDataFormat(
          prevState.fetchedPathsValues,
          prevState.aggrLevel,
        ),
      };
    }, this.updateYAxisProperties);
  }

  getDataInFetchedIntervalsDataFormat = (fetchedPathsValues, aggrLevel) => {
    // this function converts our internal data to the format that ChartView expects
    const { allChartSeries } = this.props;

    const result = Object.values(get(fetchedPathsValues, aggrLevel, {})).map(fetched => {
      const { fromTs, toTs, paths } = fetched;
      const csData = {};
      allChartSeries.forEach(cs => {
        if (!paths[cs.path]) {
          return;
        }
        csData[cs.chartSerieId] = this._applyExpression(paths[cs.path].data, cs.expression);
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
    const { allChartSeries } = this.props;
    const { aggrLevel } = this.state;
    const { accountId } = this.props.match.params;
    const allPaths = allChartSeries.map(cs => cs.path);
    const fetchIntervals = this.getFetchIntervals();
    return (
      <>
        {allPaths.length > 0 &&
          fetchIntervals.map(fi => (
            <PersistentFetcher
              key={`${aggrLevel}-${fi.fromTs}`}
              resource={`accounts/${accountId}/getvalues`}
              mqttTopic={`accounts/${accountId}/values/+`}
              fetchOptions={{
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  p: allPaths.join(','),
                  t0: fi.fromTs,
                  t1: fi.toTs,
                  a: aggrLevel < 0 ? 'no' : aggrLevel,
                }),
              }}
              onNotification={this.onNotification}
              onUpdate={this.onUpdateData}
              onError={this.onFetchError}
            />
          ))}
        <ChartView
          {...this.props}
          fetching={this.state.fetching}
          fetchedIntervalsData={this.state.derivedFetchedIntervalsData}
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
