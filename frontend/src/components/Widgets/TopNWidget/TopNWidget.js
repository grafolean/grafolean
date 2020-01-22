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
  };

  onNotification = mqttPayload => {
    this.setState(prevState => {
      if (prevState.topListTime > mqttPayload.t) {
        return; // nothing to update, we have a more recent value already
      }
      return {
        topList: mqttPayload.v,
        topListTime: mqttPayload.t,
      };
    });
    // do not trigger fetch, we got all the information we need:
    return false;
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
      topList: json.list,
      loading: false,
    });
  };

  render() {
    const { topList, topListTime } = this.state;
    const {
      path_filter,
      renaming = '',
      nentries = 5,
      decimals = 1,
      unit = '',
      expression = '$1',
    } = this.props.content;

    const calculatedTopList = topList
      ? topList.map(x => ({
          ...x,
          c: evaluate(expression, { $1: x.v }),
          name: MatchingPaths.constructChartSerieName(x.p, path_filter, renaming),
        }))
      : null;
    return (
      <div className="top-n">
        <PersistentFetcher
          resource={`accounts/${this.props.match.params.accountId}/topvalues`}
          queryParams={{
            f: path_filter,
            n: nentries,
          }}
          onNotification={this.onNotification}
          onUpdate={this.onUpdateData}
          onError={this.onFetchError}
        />
        {calculatedTopList ? (
          <div>
            {calculatedTopList.map(x => (
              <div key={x.p}>
                <span className="label">{x.name}:</span>
                <span className="value">{x.c.toFixed(decimals)}</span>
                <span className="unit">{unit} </span>
              </div>
            ))}
            <When t={topListTime} />
          </div>
        ) : (
          <span>/</span>
        )}
      </div>
    );
  }
}

export default withRouter(isWidget(TopNWidget));
