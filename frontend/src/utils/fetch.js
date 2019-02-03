import { ROOT_URL, handleFetchErrors, onLogout } from '../store/actions';
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

export class PeriodicFetcher {
  /*
  This class allows fetching data from sources which might change over time. Instead of just requesting a
  resource (===topic), client also either fetches data periodically (current implementation) or subscribes to
  the topic on MQTT broker via WebSockets.

  Example usage:

    import Fetcher from 'fetch.js';
    ...
      componentDidMount() {
        Fetcher.start('account/123/dashboards', this.onDashboardsFetch, this.onDashboardsFetchError);
      }
      componentWillUnmount() {
        Fetcher.stop('account/123/dashboards', this.onDashboardsFetch, this.onDashboardsFetchError);
      }
    ...

  Note: all the parameters to `stop()` should be the same as the ones for `start()`.
  */
  timeoutHandles = {};
  abortControllers = {};
  onSuccessCallbacks = {};
  onErrorCallbacks = {};

  start(topic, onSuccessCallback, onErrorCallback) {
    if (!this.onSuccessCallbacks[topic]) {
      this.onSuccessCallbacks[topic] = [];
      this.onErrorCallbacks[topic] = [];
    }
    this.onSuccessCallbacks[topic].push(onSuccessCallback);
    this.onErrorCallbacks[topic].push(onErrorCallback);
    this._doFetch(topic);
  }

  _doFetch = topic => {
    this.timeoutHandles[topic] = null;
    const url = `${ROOT_URL}/${topic}`;
    this.abortControllers[topic] = new window.AbortController();
    fetchAuth(url, { signal: this.abortControllers[topic].signal })
      .then(handleFetchErrors)
      .then(response => response.json())
      .then(json => this.onSuccessCallbacks[topic].forEach(cb => cb(json)))
      .catch(err => this.onErrorCallbacks[topic].forEach(cb => cb(err)))
      .finally(() => {
        this.timeoutHandles[topic] = setTimeout(() => this._doFetch(topic), 30000);
      });
  };

  stop(topic, onSuccessCallback, onErrorCallback) {
    // User needs to supply the same parameters as for start(), because multiple clients
    // could be subscribing to the same topic, and we need to know which one to unregister:
    this.onSuccessCallbacks[topic] = this.onSuccessCallbacks[topic].filter(cb => cb !== onSuccessCallback);
    this.onErrorCallbacks[topic] = this.onErrorCallbacks[topic].filter(cb => cb !== onErrorCallback);

    if (this.onSuccessCallbacks[topic].length === 0) {
      delete this.onSuccessCallbacks[topic];
      delete this.onErrorCallbacks[topic];

      // this was the last client, so stop triggering new fetches and abort any ongoing fetches:
      if (this.abortControllers[topic]) {
        this.abortControllers[topic].abort();
        delete this.abortControllers[topic];
      }
      if (this.timeoutHandles[topic]) {
        clearTimeout(this.timeoutHandles[topic]);
        this.timeoutHandles[topic] = null;
      }
    }
  }
}

export const Fetcher = new PeriodicFetcher();


export const fetchAuthMQTT = async (
  wsServer,
  wsPort,
  topic,
  fetchOptions,
  resultCallback,
  errorCallback,
) => {
  try {
    const url = `${ROOT_URL}/${topic}`;
    const resp = await fetchAuth(url, fetchOptions);
    const json = await resp.json();
    resultCallback(json);
  } catch (err) {
    console.error(err);
    errorCallback(err);
    return;
  }

  return new Promise((resolve, reject) => {
    const mqttClient = new window.Paho.MQTT.Client(
      wsServer,
      Number(wsPort),
      `grafolean-frontend-${VERSION_INFO.ciCommitTag || 'v?.?.?'}`,
    );
    mqttClient.onConnectionLost = responseObject => {
      if (responseObject.errorCode !== 0) {
        errorCallback(responseObject.errorMessage);
      }
      resolve();
    };
    mqttClient.onMessageArrived = messageObject => {
      resultCallback(messageObject.payloadString);
    };
    mqttClient.connect({
      onSuccess: () => {
        console.log('Ws connected.');
        mqttClient.subscribe(topic, {
          onSuccess: () => console.log('Successfully subscribed to topic: ' + topic),
          onFailure: () => {
            reject('Error subscribing to topic: ' + topic);
            mqttClient.disconnect();
          },
        });
      },
      onFailure: () => reject('Error connecting to MQTT broker via WebSockets'),
      timeout: 5,
      reconnect: false, // not sure how to controll reconnect, so let's just fail for now
      keepAliveInterval: 36000000,
      // userName: myJWTToken,
      // password: "not-used",
    });
  });
};

