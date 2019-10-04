import React from 'react';
import { connect } from 'react-redux';
import moment from 'moment';
import { stringify } from 'qs';

import { ROOT_URL, handleFetchErrors, onFailure } from '../store/actions';
import store from '../store';

import { VERSION_INFO } from '../VERSION';
import { doLogout } from '../store/helpers';
import { getValidJwtToken } from './auth';

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

export const fetchAuth = async (url, fetchOptions = {}) => {
  // get the JWT token (it is not expired - if it were, it would have been refreshed) and
  // handle possible errors:
  let token;
  try {
    token = await getValidJwtToken();
  } catch (ex) {
    console.log(ex);
    doLogout();
    return Promise.reject(ex);
  }

  // return normal fetch promise, except that we add the auth header:
  const authHeader = 'Bearer ' + token;
  const fetchOptionsWithAuth = _addAuthHeaderToParams(fetchOptions, authHeader);
  return fetch(url, fetchOptionsWithAuth);
};

export const havePermission = (resource, method, permissions) => {
  for (let p of permissions) {
    if (
      (p.resource_prefix === null ||
        resource === p.resource_prefix ||
        resource.startsWith(p.resource_prefix + '/')) &&
      (p.methods === null || p.methods.includes(method))
    ) {
      return true;
    }
  }
  return false;
};

class MQTTFetcher {
  /*
  This class allows fetching data from sources which might change over time. Instead of just requesting a
  resource (===topic), client also subscribes to the topic on MQTT broker via WebSockets.

  Example usage:

    import { PersistentFetcher } from 'fetch.js';
    ...
      componentDidMount() {
        this.fetchId = PersistentFetcher.start('account/123/dashboards', this.onDashboardsFetch, this.onDashboardsFetchError);
      }
      componentWillUnmount() {
        PersistentFetcher.stop(this.fetchId);
      }
    ...
  */

  connectingToMqtt = null;
  mqttClient = null;
  fetches = {};
  nextFetchId = 0;

  connect = (hostname, port, isSSL, jwtToken) => {
    if (!hostname) {
      return null;
    }
    // there might be multiple requests to connection in parallel (before the first one succeeds), so we
    // must make sure that only one connection is requested. We do this by caching the promise:
    if (this.connectingToMqtt === null) {
      this.connectingToMqtt = new Promise((resolve, reject) => {
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
    }

    return this.connectingToMqtt;
  };

  isConnected = () => {
    return Boolean(this.mqttClient);
  };

  start = (topic, queryParams, onFetchCallback, onErrorCallback, onNotification) => {
    const newFetchId = '' + this.nextFetchId;
    this.nextFetchId += 1;
    this.fetches[newFetchId] = {
      topic: topic,
      queryParams: queryParams,
      onFetchCallback: onFetchCallback,
      onErrorCallback: onErrorCallback,
      onNotification: onNotification,
      abortController: null,
    };
    this._doFetchHttp(newFetchId)
      .then(() => {
        this._subscribe(newFetchId);
      })
      .catch(err => {
        console.debug('Start failed for fetchId ' + newFetchId);
      });
    //
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
      .catch(err => {
        if (err.name !== 'AbortError') {
          this.fetches[fetchId].onErrorCallback(err);
        }
        throw err;
      });
  };

  onMessageReceived = message => {
    // Note that unsubscribe is async so it might happen that some messages come *after* the unsubscribe:
    //   https://www.eclipse.org/paho/files/jsdoc/Paho.MQTT.Client.html
    // Since we can't rush the unsubscribing process, we simply ignore such messages (they match no known topic).
    console.debug('Message received:', message.destinationName, message.topic, message.payloadString);
    if (!message.destinationName.startsWith('changed/')) {
      console.error('Message doesn\'t start with "changed/", how did we get it?');
      return;
    }
    const changedTopic = message.destinationName.substring('changed/'.length);
    Object.keys(this.fetches).forEach(fetchId => {
      const f = this.fetches[fetchId];
      if (f === undefined || f.topic !== changedTopic) {
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
    if (!this.isConnected()) {
      console.warn(`Not connected to MQTT, not subscribing`);
      return;
    }
    if (!this.fetches[fetchId]) {
      console.warn('Not subscribing, fetchId not there: ' + fetchId);
      return;
    }
    const { topic, onErrorCallback } = this.fetches[fetchId];
    this.mqttClient.subscribe(`changed/${topic}`, {
      onSuccess: () => console.debug('Successfully subscribed to topic: ' + topic),
      onFailure: () => {
        console.error('Error subscribing to topic: ' + topic);
        onErrorCallback('Error subscribing to topic: ' + topic);
        delete this.fetches[fetchId];
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
      console.debug('Unsubscribed from topic: ' + topic);
      this.mqttClient.unsubscribe(topic);
    }

    // stop triggering new fetches and abort any ongoing fetches:
    if (this.fetches[fetchId].abortController) {
      this.fetches[fetchId].abortController.abort();
    }
    delete this.fetches[fetchId];
  };

  disconnect = () => {
    const allFetchIds = Object.keys(this.fetches);
    allFetchIds.forEach(fetchId => this.stop(fetchId));
    if (this.mqttClient) {
      this.mqttClient.disconnect();
    }
    this.connectingToMqtt = null;
    this.mqttClient = null;
    this.fetches = {};
  };
}

export const MQTTFetcherSingleton = new MQTTFetcher();

class _PersistentFetcher extends React.PureComponent {
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

  componentWillUnmount() {
    if (this.fetchId !== null) {
      MQTTFetcherSingleton.stop(this.fetchId);
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
      try {
        await MQTTFetcherSingleton.connect(mqttWsHostname, mqttWsPort, mqttWsSsl, jwtToken);
      } catch (ex) {
        console.error('Could not connect to MQTT', ex);
        doLogout();
        return;
      }
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

  render() {
    return null;
  }
}

const mapStoreToProps = store => ({
  backendStatus: store.backendStatus,
  jwtToken: store.user ? store.user.jwtToken : undefined,
});
export const PersistentFetcher = connect(mapStoreToProps)(_PersistentFetcher);
