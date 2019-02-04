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

export class Fetcher {
  timeoutHandle = null;
  abortController = null;
  onSuccessCallback = () => {};
  onErrorCallback = () => {};

  constructor(resource, fetchOptions, onSuccessCallback, onErrorCallback) {
    this.url = `${ROOT_URL}/${resource}`;
    this.fetchOptions = fetchOptions;
    this.onSuccessCallback = onSuccessCallback;
    this.onErrorCallback = onErrorCallback;

    this._doFetch();
  }

  _doFetch = () => {
    this.timeoutHandle = null;
    const abortController = new window.AbortController();
    const fetchOptionsWithAbortSignal = {
      ...this.fetchOptions,
      signal: abortController.signal,
    };
    fetchAuth(this.url, fetchOptionsWithAbortSignal)
      .then(response => response.json())
      .then(json => this.onSuccessCallback(json))
      .catch(err => this.onErrorCallback(err))
      .finally(() => {
        this.timeoutHandle = setTimeout(this._doFetch, 30000);
      });
  };

  stop = () => {
    // stop triggering new fetches and abort any ongoing fetches:
    if (this.abortController) {
      this.abortController.abort();
    }
    if (this.timeoutHandle) {
      clearTimeout(this.timeoutHandle);
    }
  };
}
