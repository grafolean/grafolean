import React from 'react';

import { MQTTFetcherSingleton } from './MQTTFetcherSingleton';
import withMqttConnected from './withMqttConnected';

class _PersistentFetcher extends React.Component {
  listenerId = null;

  componentDidMount = async () => {
    this.listenerId = await MQTTFetcherSingleton.addListener(
      this.props.resource,
      this.props.queryParams,
      this.props.onUpdate,
      errorMsg => (this.props.onError ? this.props.onError(errorMsg) : console.error(errorMsg.toString())),
      this.props.onNotification,
      this.props.onFetchStart,
      this.props.mqttTopic ? this.props.mqttTopic : null,
      this.props.fetchOptions ? this.props.fetchOptions : {},
    );
  };

  componentWillUnmount() {
    if (this.listenerId !== null) {
      MQTTFetcherSingleton.removeListener(this.listenerId);
    }
  }

  render() {
    return null;
  }
}

export const PersistentFetcher = withMqttConnected(_PersistentFetcher);
