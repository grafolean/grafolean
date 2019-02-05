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
        this.fetchId = Fetcher.start('account/123/dashboards', this.onDashboardsFetch, this.onDashboardsFetchError);
      }
      componentWillUnmount() {
        Fetcher.stop(this.fetchId);
      }
    ...
  */
  fetches = [];

  start(topic, onSuccessCallback, onErrorCallback) {
    const newFetchId = this.fetches.length;
    this.fetches.push({
      topic: topic,
      onSuccessCallback: onSuccessCallback,
      onErrorCallback: onErrorCallback,
      timeoutHandle: null,
      abortController: null,
    });
    this._doFetch(newFetchId);
    return newFetchId;
  }

  _doFetch = fetchId => {
    this.fetches[fetchId].timeoutHandle = null;
    const url = `${ROOT_URL}/${this.fetches[fetchId].topic}`;
    this.fetches[fetchId].abortController = new window.AbortController();
    fetchAuth(url, { signal: this.fetches[fetchId].abortController.signal })
      .then(handleFetchErrors)
      .then(response => response.json())
      .then(json => this.fetches[fetchId].onSuccessCallback(json))
      .catch(err => this.fetches[fetchId].onErrorCallback(err))
      .finally(() => {
        this.fetches[fetchId].timeoutHandle = setTimeout(() => this._doFetch(fetchId), 30000);
      });
  };

  stop(fetchId) {
    // stop triggering new fetches and abort any ongoing fetches:
    if (this.fetches[fetchId].abortController) {
      this.fetches[fetchId].abortController.abort();
    }
    if (this.fetches[fetchId].timeoutHandle) {
      clearTimeout(this.fetches[fetchId].timeoutHandle);
    }
    // now cut out the element at fetchId from the list:
    this.fetches.splice(fetchId, 1);
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
