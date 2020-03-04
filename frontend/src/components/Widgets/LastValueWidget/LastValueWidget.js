import React from 'react';
import { withRouter } from 'react-router-dom';
import { evaluate } from 'mathjs';

import isWidget from '../isWidget';
import { PersistentFetcher } from '../../../utils/fetch/PersistentFetcher';
import When from '../../When';

import './LastValueWidget.scss';
import MatchingPaths from '../GLeanChartWidget/ChartForm/MatchingPaths';

class LastValueWidget extends React.Component {
  state = {
    loading: true,
    fetchingError: false,
    lastValue: null,
    lastValueTime: null,
  };

  onNotification = mqttPayload => {
    this.setState(prevState => {
      if (prevState.lastValueTime > mqttPayload.t) {
        return; // nothing to update, we have a more recent value already
      }
      return {
        lastValue: mqttPayload.v,
        lastValueTime: mqttPayload.t,
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
    const { sharedValues } = this.props;
    const { path } = this.props.content;
    const pathSubstituted = MatchingPaths.substituteSharedValues(path, sharedValues);
    if (!json.paths[pathSubstituted] || json.paths[pathSubstituted].data.length === 0) {
      this.setState({
        lastValue: null,
        lastValueTime: null,
        loading: false,
      });
    } else {
      this.setState({
        lastValue: json.paths[pathSubstituted].data[0].v,
        lastValueTime: json.paths[pathSubstituted].data[0].t,
        loading: false,
      });
    }
  };

  render() {
    const { lastValue, lastValueTime } = this.state;
    const { sharedValues } = this.props;
    const { selectedTime = null } = sharedValues;
    const { path, decimals = 3, unit = '', expression = '$1' } = this.props.content;

    const pathSubstituted = MatchingPaths.substituteSharedValues(path, sharedValues);
    if (pathSubstituted.includes('$')) {
      // not ready yet
      return null;
    }

    const queryParams = {
      a: 'no',
      sort: 'desc',
      limit: 1,
    };
    if (selectedTime !== null) {
      queryParams['t1'] = selectedTime;
    }
    const calculatedValue = lastValue !== null ? evaluate(expression, { $1: lastValue }) : null;
    return (
      <div className="last-value" key={pathSubstituted}>
        <PersistentFetcher
          key={selectedTime === null ? 'now' : `${selectedTime}`}
          resource={`accounts/${this.props.match.params.accountId}/values/${pathSubstituted}`}
          queryParams={queryParams}
          onNotification={this.onNotification}
          onUpdate={this.onUpdateData}
          onError={this.onFetchError}
        />
        {calculatedValue !== null ? (
          <>
            <span className="value">{calculatedValue.toFixed(decimals)}</span>
            <span className="unit">{unit} </span>
            <When t={lastValueTime} />
          </>
        ) : (
          <span>/</span>
        )}
      </div>
    );
  }
}

export default withRouter(isWidget(LastValueWidget));
