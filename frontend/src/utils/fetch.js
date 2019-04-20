import React from 'react';
import { connect } from 'react-redux';
import moment from 'moment';
import { stringify } from 'qs';

import { ROOT_URL, handleFetchErrors, onLogout, onFailure } from '../store/actions';
import store from '../store';

import { VERSION_INFO } from '../VERSION';

const _addAuthHeaderToParams = (fetchOptions, authHeader) => {
  if (!authHeader) {
    return fetchOptions;
  }
  const headers = fetchOptions.headers || {};
  headers['Authorization'] = authHeader;
  return {
    ...fetchOptions,
    headers: headers,
  };
};

export const fetchAuth = (url, fetchOptions = {}) => {
  const oldAuthHeader = 'Bearer ' + window.sessionStorage.getItem('grafolean_jwt_token');
  const fetchOptionsWithAuth = _addAuthHeaderToParams(fetchOptions, oldAuthHeader);
  return new Promise((resolve, reject) => {
    fetch(url, fetchOptionsWithAuth)
      .then(response => {
        // we handle 401 errors by issuing /api/refresh, refreshing a JWT token, and issuing another request
        if (response.status !== 401) {
          resolve(response);
          return;
        }
        // refresh jwt token:
        fetch(`${ROOT_URL}/auth/refresh`, {
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            Authorization: oldAuthHeader,
          },
          method: 'POST',
        })
          .then(handleFetchErrors)
          .then(response => {
            // now that you have refreshed jwt token, request resource again:
            const newAuthHeader = response.headers.get('X-JWT-Token');
            const jwtToken = newAuthHeader.substring('Bearer '.length);
            window.sessionStorage.setItem('grafolean_jwt_token', jwtToken);
            const fetchOptionsWithNewAuth = _addAuthHeaderToParams(fetchOptions, newAuthHeader);
            fetch(url, fetchOptionsWithNewAuth)
              .then(resp => resolve(resp))
              .catch(err => reject(err));
          })
          .catch(() => {
            window.sessionStorage.removeItem('grafolean_jwt_token');
            store.dispatch(onLogout());
            reject('Error refreshing session.');
          });
      })
      .catch(err => reject(err));
  });
};

class MQTTFetcher {
  /*
  This class allows fetching data from sources which might change over time. Instead of just requesting a
  resource (===topic), client also subscribes to the topic on MQTT broker via WebSockets.

  Example usage:

    import PersistentFetcher from 'fetch.js';
    ...
      componentDidMount() {
        this.fetchId = PersistentFetcher.start('account/123/dashboards', this.onDashboardsFetch, this.onDashboardsFetchError);
      }
      componentWillUnmount() {
        PersistentFetcher.stop(this.fetchId);
      }
    ...
  */

  mqttClient = null;
  fetches = [];

  connect = (hostname, port, isSSL, jwtToken) => {
    if (!hostname) {
      return null;
    }
    return new Promise((resolve, reject) => {
      let notYetConnectedClient = new window.Paho.MQTT.Client(
        hostname,
        Number(port),
        `grafolean-frontend-${VERSION_INFO.ciCommitTag || 'v?.?.?'}-${moment().format('x')}`,
      );
      notYetConnectedClient.onConnectionLost = responseObject => {
        if (responseObject.errorCode !== 0) {
          console.error('MQTT connection lost!'); // !!! handling?
        }
      };
      notYetConnectedClient.onMessageArrived = this.onMessageReceived;
      notYetConnectedClient.connect({
        onSuccess: () => {
          console.log('MQTT connected.');
          this.mqttClient = notYetConnectedClient;
          resolve();
        },
        onFailure: () => {
          console.error('Error connecting to MQTT broker via WebSockets');
          reject();
        },
        timeout: 5,
        reconnect: true, // not sure how to control reconnect?
        keepAliveInterval: 36000000,
        userName: jwtToken,
        password: 'can.be.empty',
        useSSL: isSSL,
      });
    });
  };

  isConnected = () => {
    return Boolean(this.mqttClient);
  };

  start = (topic, queryParams, onFetchCallback, onErrorCallback, onNotification) => {
    const newFetchId = this.fetches.length;
    this.fetches.push({
      topic: topic,
      queryParams: queryParams,
      onFetchCallback: onFetchCallback,
      onErrorCallback: onErrorCallback,
      onNotification: onNotification,
      abortController: null,
    });
    this._doFetchHttp(newFetchId).finally(() => {
      this._subscribe(newFetchId);
    });
    return newFetchId;
  };

  _doFetchHttp = async fetchId => {
    const paramsString = this.fetches[fetchId].queryParams
      ? `?${stringify(this.fetches[fetchId].queryParams)}`
      : '';
    const url = `${ROOT_URL}/${this.fetches[fetchId].topic}${paramsString}`;
    this.fetches[fetchId].abortController = new window.AbortController();
    await fetchAuth(url, { signal: this.fetches[fetchId].abortController.signal })
      .then(handleFetchErrors)
      .then(response => response.json())
      .then(json => this.fetches[fetchId].onFetchCallback(json))
      .catch(err => this.fetches[fetchId].onErrorCallback(err));
  };

  onMessageReceived = message => {
    console.log('Message received:', message.destinationName, message.topic, message.payloadString);
    if (!message.destinationName.startsWith('changed/')) {
      console.error('Message doesn\'t start with "changed/", how did we get it?');
      return;
    }
    const changedTopic = message.destinationName.substring('changed/'.length);
    this.fetches.forEach((f, fetchId) => {
      if (f.topic !== changedTopic) {
        return;
      }
      try {
        // We know that the resource has changed, but we still need to re-issue REST request - MQTT
        // mostly just  notifies us of the change.
        if (f.onNotification) {
          // But - for those topics that need parameters, MQTT gives us additional data that lets
          // us decide if we wish to fetch new data or not (for example, when observing values, we
          // could decide based on timestamp if we wish to refetch data or not)
          const shouldContinueWithFetch = f.onNotification(JSON.parse(message.payloadString));
          if (!shouldContinueWithFetch) {
            return;
          }
        }
        this._doFetchHttp(fetchId);
      } catch (e) {
        console.error('Error handling MQTT message', e);
      }
    });
  };

  _subscribe = fetchId => {
    const { topic, onErrorCallback } = this.fetches[fetchId];
    if (!this.isConnected()) {
      console.warn(`Not connected to MQTT, not subscribing to [${topic}]`);
      return;
    }
    this.mqttClient.subscribe(`changed/${topic}`, {
      onSuccess: () => console.log('Successfully subscribed to topic: ' + topic),
      onFailure: () => {
        console.error('Error subscribing to topic: ' + topic);
        onErrorCallback('Error subscribing to topic: ' + topic);
        //this.fetches.splice(fetchId, 1); // don't do this, other ids will change then...
      },
    });
  };

  stop = fetchId => {
    if (!this.fetches[fetchId]) {
      console.warn(`This fetch id does not exist, can't stop it: [${fetchId}]`);
      return;
    }
    const { topic } = this.fetches[fetchId];
    if (this.mqttClient) {
      // if client component stops listening before we even connected, this.mqttClient could be null
      this.mqttClient.unsubscribe(topic);
    }

    // stop triggering new fetches and abort any ongoing fetches:
    if (this.fetches[fetchId].abortController) {
      this.fetches[fetchId].abortController.abort();
    }
    // now cut out the element at fetchId from the list:
    //this.fetches.splice(fetchId, 1); // don't do this, other ids will change then...
  };

  disconnect = () => {
    this.mqttClient.disconnect();
    this.mqttClient = null;
    this.fetches = [];
  };
}

export const MQTTFetcherSingleton = new MQTTFetcher();

class PersistentFetcher extends React.PureComponent {
  fetchId = null;

  componentDidMount() {
    this.subscribe();
  }

  componentDidUpdate(prevProps) {
    // backendStatus or jwtToken might not be available when this component mounts, so we listen for change and subscribe when we get the data:
    if (
      (!prevProps.backendStatus && !!this.props.backendStatus) ||
      (!prevProps.jwtToken && !!this.props.jwtToken)
    ) {
      this.subscribe();
    }
  }

  subscribe = async () => {
    // make sure all the data you need to connect is here, otherwise return and we will try again later:
    if (!this.props.backendStatus || !this.props.jwtToken) {
      return;
    }
    if (!MQTTFetcherSingleton.isConnected()) {
      const { backendStatus, jwtToken } = this.props;
      // by default, mqtt websockets connection is proxied through nginx, so it is available under the same hostname and port as this frontend:
      const mqttWsHostname = backendStatus.mqtt_ws_hostname || window.location.hostname;
      const mqttWsSsl = window.location.protocol === 'https:'; // why not a separate setting? Because we would need numerous other settings too. It is much easier to just proxy mqtt through nginx and not set anything, if one wants wss.
      const mqttWsPort = backendStatus.mqtt_ws_port || window.location.port || (mqttWsSsl ? 443 : 80);
      await MQTTFetcherSingleton.connect(mqttWsHostname, mqttWsPort, mqttWsSsl, jwtToken);
    }

    this.fetchId = MQTTFetcherSingleton.start(
      this.props.resource,
      this.props.queryParams,
      this.props.onUpdate,
      errorMsg =>
        this.props.onError ? this.props.onError(errorMsg) : store.dispatch(onFailure(errorMsg.toString())),
      this.props.onNotification,
    );
  };

  componentWillUnmount() {
    if (this.fetchId !== null) {
      MQTTFetcherSingleton.stop(this.fetchId);
    }
  }

  render() {
    return null;
  }
}

const mapStoreToProps = store => ({
  backendStatus: store.backendStatus,
  jwtToken: store.user ? store.user.jwtToken : undefined,
});
export default connect(mapStoreToProps)(PersistentFetcher);
