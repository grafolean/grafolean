import React from 'react';
import { withRouter } from 'react-router-dom';
import { evaluate } from 'mathjs';
import moment from 'moment-timezone';

import isWidget from '../isWidget';
import { PersistentFetcher } from '../../../utils/fetch/PersistentFetcher';
import MatchingPaths from '../GLeanChartWidget/ChartForm/MatchingPaths';
import When from '../../When';
import Loading from '../../Loading';
import LabelFromPath from '../../LabelFromPath/LabelFromPath';
import { generateSerieColor } from '../GLeanChartWidget/utils';

import './TopNWidget.scss';

class _TopNWidget extends React.Component {
  state = {
    loading: true,
    fetchingError: false,
    topList: null,
    topListTime: null,
    topListTotal: null,
  };

  pathFilterMatchesPath(pathFilter, path) {
    const regex = `^(${pathFilter
      .replace(/[.]/g, '[.]') // escape '.'
      .replace(/[*]/g, ')(.+)(') // escape '*'
      .replace(/[?]/g, ')([^.]+)(')})$` // escape '?'
      .replace(/[(][)]/g, ''); // get rid of empty parenthesis, if any
    return Boolean(path.match(new RegExp(regex)));
  }

  onNotification = (mqttPayload, changedTopic) => {
    // if we see that the changedTopic is one of those we are listening for, we return true
    // so that the fetch is triggerred:
    // changedTopic: "accounts/1405213660/values/entity.845020308.snmp.lmsensors.temp.3.Core-1"
    const { path_filter } = this.props.content;
    const { accountId } = this.props.match.params;
    const topicPrefix = `accounts/${accountId}/values/`;
    if (!changedTopic.startsWith(topicPrefix)) {
      return false;
    }
    const path = changedTopic.substr(topicPrefix.length);
    return this.pathFilterMatchesPath(path_filter, path);
  };

  onFetchStart = () => {
    this.setState({ loading: true });
  };

  onFetchError = errorMsg => {
    console.error(errorMsg);
    this.setState({
      fetchingError: true,
      loading: false,
    });
  };

  onUpdateData = json => {
    this.setState({
      topListTime: json.t,
      topListTotal: json.total,
      topList: json.list,
      loading: false,
    });
  };

  render() {
    const { topList, topListTime, topListTotal, loading } = this.state;
    const { sharedValues, display = 'list' } = this.props;
    const { selectedTime = null } = sharedValues;
    const { accountId } = this.props.match.params;
    const {
      path_filter,
      renaming = '',
      nentries = 5,
      decimals = 1,
      unit = '',
      calc_percent = true,
      expression = '$1',
      pie_chart = true,
    } = this.props.content;

    const calculatedTopList = topList
      ? topList.map(x => ({
          ...x,
          c: evaluate(expression, { $1: x.v }),
          percent: ((x.v / topListTotal) * 100).toFixed(2),
        }))
      : null;
    const totalThroughExpression =
      calc_percent && topList ? evaluate(expression, { $1: topListTotal }) : null;
    const topValuesQueryParams = {
      f: path_filter,
      n: nentries,
    };
    if (selectedTime !== null) {
      topValuesQueryParams['t'] = selectedTime;
    }
    return (
      <div className="top-n">
        <PersistentFetcher
          key={selectedTime === null ? 'now' : `${selectedTime}`}
          resource={`accounts/${accountId}/topvalues`}
          queryParams={topValuesQueryParams}
          mqttTopic={`accounts/${accountId}/values/+`}
          onFetchStart={this.onFetchStart}
          onNotification={this.onNotification}
          onUpdate={this.onUpdateData}
          onError={this.onFetchError}
        />
        {calculatedTopList && (
          <div>
            <div className="time">
              {moment(topListTime * 1000).format('YYYY-MM-DD HH:mm:ss z')} (<When t={topListTime} />)
            </div>
            {(calc_percent || pie_chart) && (
              <div className="total">
                Total: {totalThroughExpression.toFixed(decimals)} {unit}
              </div>
            )}

            {display === 'pie' ? (
              <div className="data display-pie">
                <div className="pie">
                  <PieChartSvg
                    values={calculatedTopList.map((x, i) => ({
                      color: generateSerieColor(x.p, i),
                      percent: parseFloat(x.percent),
                    }))}
                  />
                </div>
                <div className="list">
                  {calculatedTopList.map((x, i) => (
                    <div className="entry" key={x.p}>
                      <div>
                        <span
                          className="color"
                          style={{ backgroundColor: generateSerieColor(x.p, i) }}
                        ></span>
                        <span className="label">
                          <LabelFromPath
                            path={x.p}
                            filter={path_filter}
                            renaming={renaming}
                            sharedValues={sharedValues}
                          />
                          :
                        </span>
                        <span className="value">{x.c.toFixed(decimals)}</span>
                        <span className="unit">{unit} </span>
                        {calc_percent && <span className="percent">({x.percent}&nbsp;%)</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="data display-list">
                <div className="list">
                  {calculatedTopList.map((x, i) => (
                    <div className="entry" key={x.p}>
                      <div>
                        <span className="label">
                          <LabelFromPath
                            path={x.p}
                            filter={path_filter}
                            renaming={renaming}
                            sharedValues={sharedValues}
                          />
                          :
                        </span>
                        <span className="value">{x.c.toFixed(decimals)}</span>
                        <span className="unit">{unit} </span>
                      </div>
                      {calc_percent && <PercentBar percent={x.percent} />}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        {loading && (
          <div className="loading">
            <Loading />
          </div>
        )}
      </div>
    );
  }
}

const TopNWidget = withRouter(isWidget(_TopNWidget));

// We want to rerender the widget whenever one of the (applicable) sharedValues changes. The
// safest way to achieve this is to construct a key from the path_filter-s:
export default class TopNWidgetWithSubstitutedSharedValues extends React.Component {
  render() {
    const { content, sharedValues, ...rest } = this.props;
    const contentSubstituted = {
      ...content,
      path_filter: MatchingPaths.substituteSharedValues(content.path_filter, sharedValues),
    };

    const pathFiltersForKey = contentSubstituted.path_filter;

    const areSharedValuesSubstituted = !pathFiltersForKey.includes('$');
    if (!areSharedValuesSubstituted) {
      return <div>...waiting for navigation...</div>;
    }

    return (
      <TopNWidget
        key={pathFiltersForKey}
        {...rest}
        sharedValues={sharedValues}
        content={contentSubstituted}
      />
    );
  }
}

class PercentBar extends React.Component {
  render() {
    const { percent } = this.props;
    return (
      <div className="percent-bar">
        <div className="wrapper">
          <div className="bar" style={{ width: `${percent}%` }}></div>
          <div className="text-wrapper">
            <span className="text">{Number(percent).toFixed(1)} %</span>
          </div>
        </div>
      </div>
    );
  }
}

class PieChartSvg extends React.Component {
  // We are drawing a circle with a radius 0.5 and a stroke width 1, using strike-dasharray to paint
  // the parts of the circle in the stroke color.
  render() {
    const { width, height, values } = this.props;
    const v = [];
    let prevPercent = 0;
    for (let i = 0; i < values.length; i++) {
      v.push({
        ...values[i],
        prevPercent: prevPercent,
      });
      prevPercent += values[i].percent;
    }
    const r = 0.5;
    return (
      <svg width={width} height={height} viewBox="-1 -1 2 2" style={{ transform: 'rotate(-90deg)' }}>
        <circle r="1" cx="0" cy="0" fill="white" />
        {v.map(({ color, percent, prevPercent }, i) => (
          <circle
            r={r}
            cx="0"
            cy="0"
            key={i}
            fill="transparent"
            stroke={color}
            strokeWidth="1"
            strokeDasharray={`0 ${r * (prevPercent / 100) * Math.PI * 2} ${
              r * (percent / 100) * Math.PI * 2
            } ${r * Math.PI * 2}`}
          />
        ))}
        <circle r="0.6" cx="0" cy="0" fill="#191919" />
      </svg>
    );
  }
}
