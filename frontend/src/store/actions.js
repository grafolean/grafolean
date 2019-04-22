import { fetchAuth } from '../utils/fetch';

export const ROOT_URL = process.env.REACT_APP_BACKEND_ROOT_URL || `${window.location.origin}/api`;

export const ON_LOGIN_SUCCESS = 'ON_LOGIN_SUCCESS';
export function onLoginSuccess(userData, jwtToken) {
  return {
    type: ON_LOGIN_SUCCESS,
    userData,
    jwtToken,
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

export const ON_REQUEST_BACKEND_STATUS = 'ON_REQUEST_BACKEND_STATUS';
export function onRequestBackendStatus() {
  return {
    type: ON_REQUEST_BACKEND_STATUS,
  };
}

export const ON_RECEIVE_BACKEND_STATUS_SUCCESS = 'ON_RECEIVE_BACKEND_STATUS_SUCCESS';
export function onReceiveBackendStatusSuccess(json) {
  return {
    type: ON_RECEIVE_BACKEND_STATUS_SUCCESS,
    json,
  };
}

export const ON_RECEIVE_BACKEND_STATUS_FAILURE = 'ON_RECEIVE_BACKEND_STATUS_FAILURE';
export function onReceiveBackendStatusFailure(errMsg) {
  return {
    type: ON_RECEIVE_BACKEND_STATUS_FAILURE,
    errMsg,
  };
}

export const ON_RECEIVE_PROFILE_PERMISSIONS_SUCCESS = 'ON_RECEIVE_PROFILE_PERMISSIONS_SUCCESS';
export function onReceiveProfilePermissionsSuccess(json) {
  return {
    type: ON_RECEIVE_PROFILE_PERMISSIONS_SUCCESS,
    json: json,
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

export const CLEAR_NOTIFICATIONS = 'CLEAR_NOTIFICATIONS';
export function clearNotifications() {
  return {
    type: CLEAR_NOTIFICATIONS,
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

export function fetchBackendStatus() {
  // react-thunk - return function instead of object:
  return function(dispatch) {
    dispatch(onRequestBackendStatus());
    // return function that will start the request from server:
    return fetchAuth(`${ROOT_URL}/status/info`)
      .then(handleFetchErrors)
      .then(response => response.json())
      .then(json => {
        dispatch(onReceiveBackendStatusSuccess(json));
      })
      .catch(errorMsg => {
        dispatch(onReceiveBackendStatusFailure(errorMsg.toString()));
      });
  };
}
