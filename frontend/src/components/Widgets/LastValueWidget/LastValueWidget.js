import React from 'react';
import { connect } from 'react-redux';
import moment from 'moment';
import { evaluate } from 'mathjs';

import isWidget from '../isWidget';
import PersistentFetcher from '../../../utils/fetch';

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
          resource={`accounts/${this.props.accounts.selected.id}/values/${path}`}
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
export default isWidget(connect(mapStoreToProps)(LastValueWidget));

class When extends React.PureComponent {
  static defaultProps = {
    limits: {
      5: '< 5 s',
      10: '< 10 s',
      20: '< 20 s',
      30: '< 30 s',
      60: '< 1 min',
      120: '< 2 min',
      180: '< 3 min',
      300: '< 5 min',
      600: '< 10 min',
      1200: '< 20 min',
      1800: '< 30 min',
      2700: '< 45 min',
      3600: '< 1 h',
      7200: '< 2 h',
      21600: '< 6 h',
      43200: '< 12 h',
      86400: '< 1 day',
      2592000: '< 30 days',
      5184000: '< 60 days',
      7776000: '< 90 days',
    },
  };
  timeoutHandle = null;

  componentWillUnmount() {
    if (this.timeoutHandle) {
      clearTimeout(this.timeoutHandle);
    }
  }

  registerUpdateTimeout = waitS => {
    if (this.timeoutHandle) {
      clearTimeout(this.timeoutHandle);
    }
    // when limit is reached, trigger a forced update:
    setTimeout(() => {
      this.forceUpdate();
      this.timeoutHandle = null;
    }, waitS * 1000);
  };

  render() {
    const { limits, t } = this.props;
    const now = moment.utc().unix();
    const diff = now - t;
    const limit = Object.keys(limits).find(l => l > diff);
    this.registerUpdateTimeout(limit - diff + 1);
    return (
      <span className="when">
        {limit ? `${limits[limit]} ago` : `at ${moment(t * 1000).format('YYYY-MM-DD HH:mm:ss')}`}
      </span>
    );
  }
}
