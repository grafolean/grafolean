import { fetchAuth } from '../utils/fetch';

export const ROOT_URL = process.env.REACT_APP_BACKEND_ROOT_URL;

export const ON_LOGIN_SUCCESS = 'ON_LOGIN_SUCCESS';
export function onLoginSuccess(userData) {
  return {
    type: ON_LOGIN_SUCCESS,
    userData,
  };
}

export const ON_LOGOUT = 'ON_LOGOUT';
export function onLogout() {
  return {
    type: ON_LOGOUT,
  };
}

export const ON_REQUEST_DASHBOARDS_LIST = 'ON_REQUEST_DASHBOARDS_LIST';
export function onRequestDashboardsList() {
  return {
    type: ON_REQUEST_DASHBOARDS_LIST,
  };
}

export const ON_RECEIVE_DASHBOARDS_LIST_SUCCESS = 'ON_RECEIVE_DASHBOARDS_LIST_SUCCESS';
export function onReceiveDashboardsListSuccess(json) {
  return {
    type: ON_RECEIVE_DASHBOARDS_LIST_SUCCESS,
    json,
  };
}

export const ON_RECEIVE_DASHBOARDS_LIST_FAILURE = 'ON_RECEIVE_DASHBOARDS_LIST_FAILURE';
export function onReceiveDashboardsListFailure(errMsg) {
  return {
    type: ON_RECEIVE_DASHBOARDS_LIST_FAILURE,
    errMsg,
  };
}

export const ON_SUBMIT_DASHBOARD = 'ON_SUBMIT_DASHBOARD';
export function onSubmitDashboard(formid) {
  return {
    type: ON_SUBMIT_DASHBOARD,
    formid,
  };
}

export const ON_SUBMIT_DASHBOARD_SUCCESS = 'ON_SUBMIT_DASHBOARD_SUCCESS';
export function onSubmitDashboardSuccess(formid, json) {
  return {
    type: ON_SUBMIT_DASHBOARD_SUCCESS,
    formid,
    slug: json.slug,
  };
}

export const ON_SUBMIT_DASHBOARD_FAILURE = 'ON_SUBMIT_DASHBOARD_FAILURE';
export function onSubmitDashboardFailure(errMsg) {
  return {
    type: ON_SUBMIT_DASHBOARD_FAILURE,
    errMsg,
  };
}

export const ON_SUBMIT_DELETE_DASHBOARD = 'ON_SUBMIT_DELETE_DASHBOARD';
export function onSubmitDeleteDashboard(slug) {
  return {
    type: ON_SUBMIT_DELETE_DASHBOARD,
    slug,
  };
}

export const ON_SUBMIT_DELETE_DASHBOARD_SUCCESS = 'ON_SUBMIT_DELETE_DASHBOARD_SUCCESS';
export function onSubmitDeleteDashboardSuccess(slug) {
  return {
    type: ON_SUBMIT_DELETE_DASHBOARD_SUCCESS,
    slug,
  };
}

export const ON_SUBMIT_DELETE_DASHBOARD_FAILURE = 'ON_SUBMIT_DELETE_DASHBOARD_FAILURE';
export function onSubmitDeleteDashboardFailure(slug, errMsg) {
  return {
    type: ON_SUBMIT_DELETE_DASHBOARD_FAILURE,
    slug,
    errMsg,
  };
}

export const ON_FAILURE = 'ON_FAILURE';
export function onFailure(msg) {
  return {
    type: ON_FAILURE,
    msg,
  };
}

export const ON_SUCCESS = 'ON_SUCCESS';
export function onSuccess(msg) {
  return {
    type: ON_SUCCESS,
    msg,
  };
}

export const REMOVE_NOTIFICATION = 'REMOVE_NOTIFICATION';
export function removeNotification(notificationId) {
  return {
    type: REMOVE_NOTIFICATION,
    notificationId,
  };
}

// Only network errors and similar are failures for fetch(), so we must
// use this function to check for response status codes too:
//   " The Promise returned from fetch() won’t reject on HTTP error status even
//     if the response is an HTTP 404 or 500. Instead, it will resolve normally
//     (with ok status set to false), and it will only reject on network failure
//     or if anything prevented the request from completing. "
// https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch
export function handleFetchErrors(response) {
  if (!response.ok) {
    throw Error(response.statusText);
  }
  return response;
}

export function fetchDashboardsList() {
  // react-thunk - return function instead of object:
  return function(dispatch) {
    dispatch(onRequestDashboardsList());
    // return function that will start the request from server:
    return fetchAuth(`${ROOT_URL}/accounts/1/dashboards`)
      .then(handleFetchErrors)
      .then(
        response => response.json().then(json => dispatch(onReceiveDashboardsListSuccess(json))),
        errorMsg => dispatch(onReceiveDashboardsListFailure(errorMsg.toString())),
      );
  };
}

export function submitNewDashboard(formid, name) {
  return function(dispatch) {
    dispatch(onSubmitDashboard(formid));
    return fetchAuth(`${ROOT_URL}/accounts/1/dashboards`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name,
      }),
    })
      .then(handleFetchErrors)
      .then(
        response => response.json().then(json => dispatch(onSubmitDashboardSuccess(formid, json))),
        errorMsg => dispatch(onSubmitDashboardFailure(errorMsg.toString())),
      );
  };
}

export function submitDeleteDashboard(slug) {
  return function(dispatch) {
    dispatch(onSubmitDeleteDashboard(slug));
    return fetchAuth(`${ROOT_URL}/accounts/1/dashboards/${slug}`, {
      method: 'DELETE',
    })
      .then(handleFetchErrors)
      .then(
        response => dispatch(onSubmitDeleteDashboardSuccess(slug)),
        errorMsg => dispatch(onSubmitDeleteDashboardFailure(slug, errorMsg.toString())),
      );
  };
}
