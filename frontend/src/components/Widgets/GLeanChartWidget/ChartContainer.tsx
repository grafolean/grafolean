import React from 'react';
import { compile } from 'mathjs';
import get from 'lodash/get';

import { getSuggestedAggrLevel } from './utils';
import { PersistentFetcher, PersistentFetcherListener } from '../../../utils/fetch/PersistentFetcher';

import ChartView, { ChartSerie, ChartViewProps, DataPoint, DataPointAggr } from './ChartView';

interface ChartContainerProps extends ChartViewProps {
  allChartSeries: ChartSerie[];
  accountId: number;
}

interface ChartContainerState {
  fetchedPathsValues: {
    [aggrLevel: number]: {
      [intervalId: string]: {
        fromTs: number;
        toTs: number;
        paths: any;
      };
    };
  };
  errorMsg: string | null;
  yAxesProperties: YAxesProperties;
  derivedFetchedIntervalsData: any;
  fetchingPerFetcher: any;
  aggrLevel: number | null;
}

interface YAxesPropertiesValue {
  minYValue: number;
  maxYValue: number;
  minYValueUserSet: number | null;
  maxYValueUserSet: number | null;
  derived: any;
}

interface YAxesProperties {
  [key: string]: YAxesPropertiesValue;
}

interface APIGetAccountValuesResponseBody {
  paths: {
    [path: string]: {
      next_data_point: number | null;
      data: DataPoint[];
    };
  };
}

export default class ChartContainer extends React.Component<ChartContainerProps, ChartContainerState> {
  public readonly state: Readonly<ChartContainerState> = {
    fetchedPathsValues: {},
    errorMsg: null,
    yAxesProperties: {},
    derivedFetchedIntervalsData: [], // optimization for faster rendering - derived from fetchedPathsValues
    fetchingPerFetcher: {},
    aggrLevel: null,
  };
  YAXIS_TOP_PADDING = 40;
  MAX_POINTS_PER_100PX = 5;

  componentDidMount(): void {
    this.updateAggrLevel();
  }

  componentDidUpdate(prevProps: ChartContainerProps): void {
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

  updateAggrLevel(): void {
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

  getFetchIntervals(): { fromTs: number; toTs: number }[] {
    /*
      We put multiple PersistentFetchers on the DOM so that each takes care of a smaller part of fetching. Their data
      is being held by us though, and we need to know which intervals should be fetched.
    */
    const { aggrLevel } = this.state;
    if (aggrLevel === null) {
      return [];
    }
    const { fromTs, toTs } = this.props;
    const intervalSizeTs = 360000 * 3 ** aggrLevel;
    const marginTs = Math.round((toTs - fromTs) / 4.0); // behave like the screen is bigger, to avoid fetching only when the data reaches the corner of the visible chart
    const fromTsWithMargin = fromTs - marginTs;
    const toTsWithMargin = toTs + marginTs;

    const result = [];
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

  _applyExpression(data: DataPoint[], expression: string): DataPoint[] {
    if (data.length === 0) {
      return [];
    }
    const mathExpression = compile(expression);
    if ('minv' in data[0]) {
      return data.map(d => ({
        t: d.t,
        v: mathExpression.evaluate({ $1: d.v }),
        minv: mathExpression.evaluate({ $1: (d as DataPointAggr).minv }),
        maxv: mathExpression.evaluate({ $1: (d as DataPointAggr).maxv }),
      }));
    } else {
      return data.map(d => ({
        t: d.t,
        v: mathExpression.evaluate({ $1: d.v }),
      }));
    }
  }

  updateYAxisProperties(): void {
    // update min/max value and similar:
    this.setState((prevState: any) => {
      const newYAxesProperties = { ...prevState.yAxesProperties };
      const { fetchedPathsValues, aggrLevel } = prevState;

      if (!fetchedPathsValues || !fetchedPathsValues[aggrLevel]) {
        return { yAxesProperties: prevState.yAxesProperties };
      }

      for (const cs of this.props.allChartSeries) {
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
          const lowestV = Math.min(
            ...data.map((d: DataPoint) => (prevState.aggrLevel < 0 ? d.v : (d as DataPointAggr).minv)),
          );
          const highestV = Math.max(
            ...data.map((d: DataPoint) => (prevState.aggrLevel < 0 ? d.v : (d as DataPointAggr).maxv)),
          );
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
  updateYAxisDerivedProperties(yAxesProperties: YAxesProperties): void {
    const { height, xAxisHeight } = this.props;
    const yAxisHeight = height - xAxisHeight - this.YAXIS_TOP_PADDING;
    for (const unit in yAxesProperties) {
      const minYValueEffective =
        yAxesProperties[unit].minYValueUserSet !== null
          ? yAxesProperties[unit].minYValueUserSet
          : yAxesProperties[unit].minYValue;
      const maxYValueEffective =
        yAxesProperties[unit].maxYValueUserSet !== null
          ? yAxesProperties[unit].maxYValueUserSet
          : yAxesProperties[unit].maxYValue;
      const ticks = ChartView.getYTicks(minYValueEffective, maxYValueEffective);
      if (ticks === null) {
        continue;
      }
      const minY = parseFloat(ticks[0]);
      const maxY = parseFloat(ticks[ticks.length - 1]);
      yAxesProperties[unit].derived = {
        minY: minY, // !!! misnomer: minYValue
        maxY: maxY,
        ticks: ticks,
        v2y: (v: number): number =>
          this.YAXIS_TOP_PADDING + yAxisHeight - ((v - minY) * yAxisHeight) / (maxY - minY),
        y2v: (y: number): number =>
          ((maxY - minY) * (yAxisHeight - y + this.YAXIS_TOP_PADDING)) / yAxisHeight + minY,
        dy2dv: (dy: number): number => (dy * (maxY - minY)) / yAxisHeight,
        dv2dy: (dv: number): number => (dv * yAxisHeight) / (maxY - minY),
      };
    }
  }

  getMinKnownTs(): number {
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
    const fetchedPathsValuesArray = Object.values(get(fetchedPathsValues, `${aggrLevel}`, {}));
    if (fetchedPathsValuesArray.length === 0) {
      return 0;
    }
    return (fetchedPathsValuesArray[0] as { fromTs: number }).fromTs;
  }

  onMinYChange = (unit: string, y: number | null): void => {
    this.setState(prevState => {
      const v = y === null ? null : prevState.yAxesProperties[unit].derived.y2v(y);
      const newYAxesProperties = { ...prevState.yAxesProperties };
      newYAxesProperties[unit].minYValueUserSet = v;
      this.updateYAxisDerivedProperties(newYAxesProperties);
      return {
        yAxesProperties: newYAxesProperties,
      };
    });
  };

  onMaxYChange = (unit: string, y: number | null): void => {
    this.setState(prevState => {
      const v = y === null ? null : prevState.yAxesProperties[unit].derived.y2v(y);
      const newYAxesProperties = { ...prevState.yAxesProperties };
      newYAxesProperties[unit].maxYValueUserSet = v;
      this.updateYAxisDerivedProperties(newYAxesProperties);
      return {
        yAxesProperties: newYAxesProperties,
      };
    });
  };

  onNotification = (mqttPayload: { t: number }, topic: string): boolean => {
    const { allChartSeries, accountId } = this.props;
    const fetchIntervals = this.getFetchIntervals();
    const interval = fetchIntervals.find(fi => fi.fromTs <= mqttPayload.t && fi.toTs > mqttPayload.t);
    if (!interval) {
      return false; // none of our intervals cares about this timestamp, ignore
    }
    const prefix = `accounts/${accountId}/values/`;
    if (topic.substring(0, prefix.length) !== prefix) {
      console.error('Oops, this should not happen - we received a notification we did not expect!');
      return false;
    }
    const path = topic.substring(prefix.length);
    if (!allChartSeries.find(cs => cs.path === path)) {
      return false; // unknown path, ignore
    }
    return true;
  };

  onFetchStart = (fetcherKey: string): void => {
    this.setState(prevState => ({
      // since we use multiple PersistentFetchers, we need to follow multiple states to display a loading indicator:
      fetchingPerFetcher: {
        ...prevState.fetchingPerFetcher,
        [fetcherKey]: true,
      },
    }));
  };

  onFetchError = (errorMsg: string, fetcherKey: string): void => {
    this.setState(prevState => ({
      fetchingPerFetcher: {
        ...prevState.fetchingPerFetcher,
        [fetcherKey]: false,
      },
      errorMsg: errorMsg,
    }));
    console.error(errorMsg);
  };

  onUpdateData = (
    json: APIGetAccountValuesResponseBody,
    listenerInfo: PersistentFetcherListener,
    fetcherKey: string,
  ): void => {
    this.setState(prevState => ({
      fetchingPerFetcher: {
        ...prevState.fetchingPerFetcher,
        [fetcherKey]: false,
      },
    }));
    const queryParams = JSON.parse(listenerInfo.fetchOptions.body as string);
    const fetchIntervals = this.getFetchIntervals();
    const interval = fetchIntervals.find(fi => fi.fromTs === queryParams.t0 && fi.toTs === queryParams.t1);
    if (!interval) {
      console.error(
        'Oops, this should not happen - interval not found, nowhere to write, ignoring fetched data',
      );
      return;
    }
    const intervalId = `${interval.fromTs}-${interval.toTs}`;
    this.setState((prevState: ChartContainerState) => {
      return {
        fetchedPathsValues: {
          ...prevState.fetchedPathsValues,
          [prevState.aggrLevel as number]: {
            ...get(prevState.fetchedPathsValues, prevState.aggrLevel as number, {}),
            [intervalId]: {
              fromTs: interval.fromTs,
              toTs: interval.toTs,
              paths: json.paths,
            },
          },
        },
      };
    }, this.updateDerivedFetchedIntervalsData);
  };

  updateDerivedFetchedIntervalsData(): void {
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

  getDataInFetchedIntervalsDataFormat = (
    fetchedPathsValues: { [k: number]: any },
    aggrLevel: number | null,
  ): { csData: any; fromTs: number; toTs: number }[] => {
    // this function converts our internal data to the format that ChartView expects
    const { allChartSeries } = this.props;

    if (aggrLevel === null) {
      return [];
    }

    const result = (Object.values(get(fetchedPathsValues, aggrLevel, {})) as {
      fromTs: number;
      toTs: number;
      paths: any;
    }[]).map(fetched => {
      const { fromTs, toTs, paths } = fetched;
      const csData: { [k: string]: any } = {};
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

  render(): React.ReactNode {
    const { allChartSeries, accountId } = this.props;
    const { aggrLevel, fetchingPerFetcher } = this.state;
    if (aggrLevel === null) {
      return null;
    }
    const allPaths = allChartSeries.map(cs => cs.path);
    const fetchIntervals = this.getFetchIntervals();
    const fetching = Object.values(fetchingPerFetcher).some(x => x);
    return (
      <>
        {allPaths.length > 0 &&
          fetchIntervals.map(fi => (
            <PersistentFetcher
              key={`${aggrLevel}-${fi.fromTs}`}
              resource={`accounts/${accountId}/${aggrLevel < 0 ? 'getvalues' : 'getaggrvalues'}`}
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
                  a: aggrLevel < 0 ? undefined : aggrLevel,
                }),
              }}
              onFetchStart={() => this.onFetchStart(`${aggrLevel}-${fi.fromTs}`)}
              onNotification={this.onNotification}
              onUpdate={(json: APIGetAccountValuesResponseBody, listenerInfo: PersistentFetcherListener) =>
                this.onUpdateData(json, listenerInfo, `${aggrLevel}-${fi.fromTs}`)
              }
              onError={(errMsg: string) => this.onFetchError(errMsg, `${aggrLevel}-${fi.fromTs}`)}
            />
          ))}
        <ChartView
          {...this.props}
          fetching={fetching}
          fetchedIntervalsData={this.state.derivedFetchedIntervalsData}
          errorMsg={this.state.errorMsg}
          isAggr={aggrLevel >= 0}
          aggrLevel={aggrLevel}
          // minKnownTs={this.getMinKnownTs()}
          yAxesProperties={this.state.yAxesProperties}
          onMinYChange={this.onMinYChange}
          onMaxYChange={this.onMaxYChange}
          isDarkMode={true}
        />
      </>
    );
  }
}
