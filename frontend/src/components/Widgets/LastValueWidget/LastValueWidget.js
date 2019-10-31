import React from 'react';
import { connect } from 'react-redux';
import { withRouter } from 'react-router-dom';
import { evaluate } from 'mathjs';

import isWidget from '../isWidget';
import { PersistentFetcher } from '../../../utils/fetch/PersistentFetcher';
import When from '../../When';

import './LastValueWidget.scss';

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
    const { path } = this.props.content;
    this.setState({
      lastValue: json.paths[path].data[0].v,
      lastValueTime: json.paths[path].data[0].t,
      loading: false,
    });
  };

  render() {
    const { lastValue, lastValueTime } = this.state;
    const { path, decimals = 3, unit = '', expression = '$1' } = this.props.content;
    const queryParams = {
      a: 'no',
      sort: 'desc',
      limit: 1,
    };
    const calculatedValue = lastValue ? evaluate(expression, { $1: lastValue }) : null;
    return (
      <div className="last-value">
        <PersistentFetcher
          resource={`accounts/${this.props.match.params.accountId}/values/${path}`}
          queryParams={queryParams}
          onNotification={this.onNotification}
          onUpdate={this.onUpdateData}
          onError={this.onFetchError}
        />
        {calculatedValue ? (
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

const mapStoreToProps = store => ({
  accounts: store.accounts,
});
export default withRouter(isWidget(connect(mapStoreToProps)(LastValueWidget)));
