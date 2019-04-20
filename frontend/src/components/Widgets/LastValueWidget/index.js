import React from 'react';
import moment from 'moment';

import isWidget from '../isWidget';
import PersistentFetcher from '../../../utils/fetch';

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
    this.setState({
      lastValue: json.paths[this.props.content.path].data[0].v,
      lastValueTime: json.paths[this.props.content.path].data[0].t,
      loading: false,
    });
  };

  render() {
    const { path } = this.props.content;
    const queryParams = {
      a: 'no',
      sort: 'desc',
      limit: 1,
    };

    return (
      <div className="last-value">
        <PersistentFetcher
          resource={`accounts/1/values/${path}`}
          queryParams={queryParams}
          onNotification={this.onNotification}
          onUpdate={this.onUpdateData}
          onError={this.onFetchError}
        />
        {this.state.lastValue} (at {moment(this.state.lastValueTime * 1000).format('YYYY-MM-DD HH:mm:ss')})
      </div>
    );
  }
}

export default isWidget(LastValueWidget);
