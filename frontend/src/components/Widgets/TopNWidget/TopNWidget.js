import React from 'react';
import { withRouter } from 'react-router-dom';
import { evaluate } from 'mathjs';

import isWidget from '../isWidget';
import { PersistentFetcher } from '../../../utils/fetch/PersistentFetcher';
import When from '../../When';

import './TopNWidget.scss';
import MatchingPaths from '../GLeanChartWidget/ChartForm/MatchingPaths';

class TopNWidget extends React.Component {
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
    const { topList, topListTime, topListTotal } = this.state;
    const { accountId } = this.props.match.params;
    const {
      path_filter,
      renaming = '',
      nentries = 5,
      decimals = 1,
      unit = '',
      calc_percent = true,
      expression = '$1',
    } = this.props.content;

    const calculatedTopList = topList
      ? topList.map(x => ({
          ...x,
          c: evaluate(expression, { $1: x.v }),
          name: MatchingPaths.constructChartSerieName(x.p, path_filter, renaming),
          percent: ((x.v / topListTotal) * 100).toFixed(2),
        }))
      : null;
    const totalThroughExpression =
      calc_percent && topList ? evaluate(expression, { $1: topListTotal }) : null;
    return (
      <div className="top-n">
        <PersistentFetcher
          resource={`accounts/${accountId}/topvalues`}
          queryParams={{
            f: path_filter,
            n: nentries,
          }}
          mqttTopic={`accounts/${accountId}/values/+`}
          onNotification={this.onNotification}
          onUpdate={this.onUpdateData}
          onError={this.onFetchError}
        />
        {calculatedTopList ? (
          <div>
            {calc_percent && (
              <div className="total">
                Total: {totalThroughExpression.toFixed(decimals)} {unit}
              </div>
            )}
            {calculatedTopList.map(x => (
              <div key={x.p}>
                <span className="label">{x.name}:</span>
                <span className="value">{x.c.toFixed(decimals)}</span>
                <span className="unit">{unit} </span>
                {calc_percent && <span className="percent">({x.percent} %)</span>}
              </div>
            ))}
            <div className="time">
              <When t={topListTime} />
            </div>
          </div>
        ) : (
          <span>/</span>
        )}
      </div>
    );
  }
}

export default withRouter(isWidget(TopNWidget));
