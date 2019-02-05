import { ROOT_URL, handleFetchErrors, onLogout } from '../store/actions';
import store from '../store';

const _addAuthHeaderToParams = fetchOptions => {
  const headers = fetchOptions.headers || {};
  headers['Authorization'] = window.sessionStorage['grafolean_jwt_token'];
  return {
    ...fetchOptions,
    headers: headers,
  };
};

export const fetchAuth = (url, fetchOptions = {}) => {
  const fetchOptionsWithAuth = _addAuthHeaderToParams(fetchOptions);
  return new Promise((resolve, reject) => {
    fetch(url, fetchOptionsWithAuth)
      .then(response => {
        // we handle 401 errors by issuing /api/refresh, refreshing a JWT token, and issuing another request
        if (response.status !== 401) {
          resolve(response);
          return;
        }
        // refresh jwt token:
        const oldJwtToken = window.sessionStorage.getItem('grafolean_jwt_token');
        fetch(`${ROOT_URL}/auth/refresh`, {
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            Authorization: oldJwtToken,
          },
          method: 'POST',
        })
          .then(handleFetchErrors)
          .then(response => {
            // now that you have refreshed jwt token, request resource again:
            const newJwtToken = response.headers.get('X-JWT-Token');
            window.sessionStorage.setItem('grafolean_jwt_token', newJwtToken);
            fetch(url, fetchOptionsWithAuth)
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
