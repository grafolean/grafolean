import React from 'react';

import { MQTTFetcherSingleton } from './MQTTFetcherSingleton';
import withMqttConnected from './withMqttConnected';

export interface PersistentFetcherListener {
  listenerId: string;
  topic: string;
  queryParams: {
    [key: string]: any;
  };
  onFetchCallback: (json: { [k: string]: any }, listener: PersistentFetcherListener) => void;
  onErrorCallback: (errMsg: string, isTerminalError: boolean) => void;
  onNotification: (json: { [k: string]: any }, changedTopic: string) => boolean; // result: shouldContinueWithFetch
  onFetchStart: () => void;
  mqttTopicOverride: string | null;
  abortController: AbortController | null;
  // When we want do debounce HTTP calls (for example if we receive many MQTT messages because many values
  // got updated, but they all affect the same listener - like for charts' autoupdating), we can't just use
  // debounce directly, because multiple listeners might want to trigger the fetching at approximately the
  // same time, and debounce would only trigger one of them. The solution is to have a debouncedFetch function
  // for each listener:
  debouncedDoFetchHttp: any;
  // fetch() init parameter:
  //  https://developer.mozilla.org/en-US/docs/Web/API/WindowOrWorkerGlobalScope/fetch
  fetchOptions: RequestInit;
}

interface PersistentFetcherProps {
  debugDelaySeconds: number;
  resource: string;
  queryParams: {
    [key: string]: any;
  };
  onUpdate: (json: { [k: string]: any }, listener: PersistentFetcherListener) => void;
  onError?: (errMsg: string, isTerminalError: boolean) => void;
  onNotification: (json: { [k: string]: any }, changedTopic: string) => boolean;
  onFetchStart: () => void;
  mqttTopic: string;
  fetchOptions: RequestInit;
}

class _PersistentFetcher extends React.Component<PersistentFetcherProps> {
  listenerId: string | null = null;

  async componentDidMount() {
    if (this.props.debugDelaySeconds) {
      await new Promise((resolve, reject) => setTimeout(resolve, this.props.debugDelaySeconds * 1000));
    }
    this.listenerId = await MQTTFetcherSingleton.addListener(
      this.props.resource,
      this.props.queryParams,
      this.props.onUpdate,
      (errorMsg: string, isTerminalError: boolean) =>
        this.props.onError
          ? this.props.onError(errorMsg, isTerminalError)
          : console.error(isTerminalError ? 'Terminal error:' : 'Error:', errorMsg.toString()),
      this.props.onNotification,
      this.props.onFetchStart,
      this.props.mqttTopic ? this.props.mqttTopic : null,
      this.props.fetchOptions ? this.props.fetchOptions : {},
    );
  }

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
