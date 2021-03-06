import { doLogout } from '../../store/helpers';
import { getValidJwtToken } from '../auth';
import { ROOT_URL } from '../../store/actions';

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

export const fetchAuth = async (url, fetchOptions = {}, raiseForStatus = false) => {
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
  const response = await fetch(url, fetchOptionsWithAuth);
  if (raiseForStatus) {
    if (!response.ok) {
      const errorMsg = await response.text();
      throw new Error(`Error fetching: ${errorMsg}`);
    }
  }
  return response;
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

export const backendHostname = () => {
  let hostname;
  try {
    hostname = new URL(ROOT_URL).hostname;
  } catch (e) {
    hostname = window.location.hostname;
  }
  return hostname;
};
