import React from 'react';
import { connect } from 'react-redux';
import moment from 'moment';

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
  const oldAuthHeader = window.sessionStorage.getItem('grafolean_jwt_token');
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
            window.sessionStorage.setItem('grafolean_jwt_token', newAuthHeader);
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

  connect = (hostname, port, isSSL) => {
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
      const jwtToken = window.sessionStorage.getItem('grafolean_jwt_token');
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
        userName: jwtToken ? jwtToken.substring('Bearer '.length) : '',
        password: 'can.be.empty',
        useSSL: isSSL,
      });
    });
  };

  isConnected = () => {
    return Boolean(this.mqttClient);
  };

  start = (topic, onSuccessCallback, onErrorCallback) => {
    const newFetchId = this.fetches.length;
    this.fetches.push({
      topic: topic,
      onSuccessCallback: onSuccessCallback,
      onErrorCallback: onErrorCallback,
      abortController: null,
    });
    this._doFetchHttp(newFetchId).finally(() => {
      this._subscribe(newFetchId);
    });
    return newFetchId;
  };

  _doFetchHttp = async fetchId => {
    const url = `${ROOT_URL}/${this.fetches[fetchId].topic}`;
    this.fetches[fetchId].abortController = new window.AbortController();
    await fetchAuth(url, { signal: this.fetches[fetchId].abortController.signal })
      .then(handleFetchErrors)
      .then(response => response.json())
      .then(json => this.fetches[fetchId].onSuccessCallback(json))
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
        // only notifies us of the change, we don't get any content through it.
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

  destroy = () => {
    this.mqttClient.disconnect();
  };
}

const MQTTFetcherSingleton = new MQTTFetcher();

class PersistentFetcher extends React.PureComponent {
  componentDidMount() {
    this.subscribe();
  }

  subscribe = async () => {
    if (!MQTTFetcherSingleton.isConnected()) {
      const { mqtt_ws_hostname, mqtt_ws_port, mqtt_ws_ssl } = this.props.backendStatus;
      await MQTTFetcherSingleton.connect(mqtt_ws_hostname, mqtt_ws_port, mqtt_ws_ssl);
    }

    this.fetchId = MQTTFetcherSingleton.start(
      this.props.resource,
      json => this.props.onUpdate(json),
      errorMsg =>
        this.props.onError ? this.props.onError(errorMsg) : store.dispatch(onFailure(errorMsg.toString())),
    );
  };

  componentWillUnmount() {
    MQTTFetcherSingleton.stop(this.fetchId);
  }

  render() {
    return null;
  }
}

const mapBackendStatusToProps = store => ({
  backendStatus: store.backendStatus,
});
export default connect(mapBackendStatusToProps)(PersistentFetcher);
