import moment from 'moment';

import { ROOT_URL, handleFetchErrors, onLogout } from '../store/actions';
import store from '../store';
import { VERSION_INFO } from '../VERSION';

const MQTT_WS_HOSTNAME = process.env.REACT_APP_MQTT_WS_HOSTNAME || null;
const MQTT_WS_PORT = process.env.REACT_APP_MQTT_WS_PORT || 9883;

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

export class MQTTFetcher {
  /*
  This class allows fetching data from sources which might change over time. Instead of just requesting a
  resource (===topic), client also subscribes to the topic on MQTT broker via WebSockets.

  Example usage:

    import Fetcher from 'fetch.js';
    ...
      componentDidMount() {
        this.fetchId = Fetcher.start('account/123/dashboards', this.onDashboardsFetch, this.onDashboardsFetchError);
      }
      componentWillUnmount() {
        Fetcher.stop(this.fetchId);
      }
    ...
  */

  mqttClient = null;
  fetches = [];

  constructor() {
    if (MQTT_WS_HOSTNAME) {
      let notYetConnectedClient = new window.Paho.MQTT.Client(
        MQTT_WS_HOSTNAME,
        Number(MQTT_WS_PORT),
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
          // if there were some requests for subscribing that were not handled yet, handle them now:
          this.fetches.forEach((f, i) => {
            this._subscribe(i);
          });
        },
        onFailure: () => console.error('Error connecting to MQTT broker via WebSockets'),
        timeout: 5,
        reconnect: false, // not sure how to control reconnect, so let's just fail for now
        keepAliveInterval: 36000000,
        // userName: myJWTToken,
        // password: "not-used",
      });
    }
  }

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
      if (this.isConnected()) {
        // if not, we will subscribe when the connect succeeds
        this._subscribe(newFetchId);
      }
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
    this.fetches.forEach((f, fetchId) => {
      if (f.topic !== message.destinationName) {
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
    this.mqttClient.subscribe(topic, {
      onSuccess: () => console.log('Successfully subscribed to topic: ' + topic),
      onFailure: () => {
        console.error('Error subscribing to topic: ' + topic);
        onErrorCallback('Error subscribing to topic: ' + topic);
        //this.fetches.splice(fetchId, 1); // don't do this, other ids will change then...
      },
    });
  };

  stop = fetchId => {
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

/*
  We can use Grafolean without MQTT server, though the updating functionality works a bit differently then.
  Instead of being notified instantly, we poll REST API. This is of course not optimal idea, but I wonder
  if there might be cases when having an MQTT broker is not wanted?
*/
export const Fetcher = new MQTTFetcher();
