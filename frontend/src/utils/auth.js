import moment from 'moment-timezone';

import { ROOT_URL, handleFetchErrors } from '../store/actions';

let tokenRefreshingPromise = null;

const getJwtPayload = token => JSON.parse(window.atob(token.split('.')[1]));

const tokenStillValid = token => {
  const payload = getJwtPayload(token);
  const exp = moment.utc(payload.exp * 1000);
  // token is valid if it expires at least one minute in the future:
  return exp.isAfter(moment.utc().add(1, 'minute'));
};

export const getValidJwtToken = async () => {
  const tokenFromStorage = window.sessionStorage.getItem('grafolean_jwt_token');

  if (tokenFromStorage === null) {
    // we don't have a token, nothing to do here - we can't even refresh it. Just throw an exception:
    throw new Error('No token available');
  }
  if (tokenStillValid(tokenFromStorage)) {
    return tokenFromStorage;
  }

  // If token is no longer valid, we can still try to refresh it, and if backend decides that this
  // was soon enough, we will get a new token. However only first request can refresh the token
  // (subsequent requests would fail), so we must ensure only a single request is triggered. This
  // is the reason for tokenRefreshingPromise:
  if (tokenRefreshingPromise === null) {
    // the refreshing request hasn't been started yet, let's start it now:
    tokenRefreshingPromise = new Promise((resolve, reject) => {
      const oldAuthHeader = 'Bearer ' + tokenFromStorage;
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
          resolve();
        })
        .catch(() => {
          reject('Error refreshing session.');
        });
    });
  }

  // whether we started the promise or someone else, we need to wait for it to finish:
  await tokenRefreshingPromise;
  // once the token was refreshed, we no longer need the reference to the promise:
  tokenRefreshingPromise = null;

  const refreshedToken = window.sessionStorage.getItem('grafolean_jwt_token');
  return refreshedToken;
};
