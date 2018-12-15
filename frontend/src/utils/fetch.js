import { ROOT_URL, handleFetchErrors, onLogout } from '../store/actions';
import store from '../store';

const _addAuthHeaderToParams = init => {
  const headers = init.headers || {};
  headers['Authorization'] = window.sessionStorage['grafolean_jwt_token'];
  return {
    ...init,
    headers: headers,
  };
};

export const fetchAuth = (input, init = {}) => {
  const initWithAuth = _addAuthHeaderToParams(init);
  return new Promise((resolve, reject) => {
    fetch(input, initWithAuth)
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
            const newInit = _addAuthHeaderToParams(init);
            fetch(input, newInit)
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
