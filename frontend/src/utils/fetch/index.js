import { doLogout } from '../../store/helpers';
import { getValidJwtToken } from '../auth';

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
