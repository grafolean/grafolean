import React from 'react';
import { connect } from 'react-redux';
import { withRouter } from 'react-router-dom';
import { stringify } from 'qs';
import { compile } from 'mathjs';

import { ROOT_URL, handleFetchErrors } from '../../../store/actions';
import { getSuggestedAggrLevel, getMissingIntervals } from './utils';
import { fetchAuth } from '../../../utils/fetch';

import ChartView from './ChartView';
import { PersistentFetcher } from '../../../utils/fetch/PersistentFetcher';

export class ChartContainer extends React.Component {
  state = {
    fetchedPathsValues: {},
    errorMsg: null,
    yAxesProperties: {},
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
        csData: {
          <csId0> : [
            { t:..., v:..., vmin:..., max:... },  // aggregation
            { t:..., v:... },  // no aggregation
          ],
        },
      },
       ...
    ]
    */
  };
  YAXIS_TOP_PADDING = 40;
  MAX_POINTS_PER_100PX = 5;

  componentDidMount() {
    this.ensureData();
  }

  componentDidUpdate(prevProps) {
    if (
      prevProps.allChartSeries !== this.props.allChartSeries ||
      prevProps.fromTs !== this.props.fromTs ||
      prevProps.toTs !== this.props.toTs
    ) {
      this.ensureData();
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

  ensureData() {
    const { fromTs, toTs, allChartSeries, width } = this.props;
    if (allChartSeries.length === 0) {
      return; // we didn't receive the list of paths that match our path filters yet
    }
    const maxPointsOnChart = (this.MAX_POINTS_PER_100PX * width) / 100;
    const aggrLevel = getSuggestedAggrLevel(fromTs, toTs, maxPointsOnChart, -1); // -1 for no aggregation
    this.setState({
      aggrLevel: aggrLevel,
      fetchedIntervalsData: this.fetchedData[aggrLevel] || [],
    });
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
    });
    // do we have everything we need, plus some more?
    if (wantedIntervals.length === 0) {
      return;
    }

    // fetch a bit more than we checked for, so that we don't fetch too often (and make
    // sure that the timestamps are aligned according to aggr. level)
    const alignedFromTs = this.alignTs(fromTs - diffTs, aggrLevel, Math.floor);
    const alignedToTs = this.alignTs(toTs + diffTs, aggrLevel, Math.ceil);
    const intervalsToBeFetched = getMissingIntervals(existingIntervals, {
      fromTs: alignedFromTs,
      toTs: alignedToTs,
    });
    for (let intervalToBeFetched of intervalsToBeFetched) {
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

  saveResponseData(fromTs, toTs, aggrLevel, json) {
    // make sure aggregation level exists:
    this.fetchedData[aggrLevel] = this.fetchedData[aggrLevel] || [];

    // find all existing intervals which are touching our interval so you can merge
    // them to a single block:
    const existingBlockBefore = this.fetchedData[aggrLevel].find(b => b.toTs === fromTs);
    const existingBlockAfter = this.fetchedData[aggrLevel].find(b => b.fromTs === toTs);
    // if there are any, merge them together:
    let csData = {};
    for (let cs of this.props.allChartSeries) {
      const { path, chartSerieId, expression = '$1' } = cs;
      const newData = this._applyExpression(json.paths[path].data, expression, aggrLevel >= 0);
      csData[chartSerieId] = [
        ...(existingBlockBefore ? existingBlockBefore.csData[chartSerieId] : []),
        ...newData,
        ...(existingBlockAfter ? existingBlockAfter.csData[chartSerieId] : []),
      ];
    }
    const mergedBlock = {
      fromTs: existingBlockBefore ? existingBlockBefore.fromTs : fromTs,
      toTs: existingBlockAfter ? existingBlockAfter.toTs : toTs,
      csData: csData,
    };

    // then construct new this.fetchedData from data blocks that came before, our merged block and those that are after:
    this.fetchedData[aggrLevel] = [
      ...this.fetchedData[aggrLevel].filter(b => b.toTs < mergedBlock.fromTs),
      mergedBlock,
      ...this.fetchedData[aggrLevel].filter(b => b.fromTs > mergedBlock.toTs),
    ];
    this.updateYAxisProperties(csData);
    this.setState({
      fetchedIntervalsData: this.fetchedData[aggrLevel],
    });
  }

  updateYAxisProperties(csData) {
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
        newYAxesProperties[cs.unit].minYValue = csData[cs.chartSerieId].reduce(
          (prevValue, d) => Math.min(prevValue, prevState.aggrLevel < 0 ? d.v : d.minv),
          newYAxesProperties[cs.unit].minYValue,
        );
        newYAxesProperties[cs.unit].maxYValue = csData[cs.chartSerieId].reduce(
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

    const allPaths = this.props.allChartSeries.map(cs => cs.path);
    fetchAuth(
      `${ROOT_URL}/accounts/${this.props.match.params.accountId}/values?${stringify({
        p: allPaths.join(','),
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
        {fetchIntervals.map(fi => (
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
