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

export const DO_REQUEST_BACKEND_STATUS = 'DO_REQUEST_BACKEND_STATUS';
export function doRequestBackendStatus() {
  return {
    type: DO_REQUEST_BACKEND_STATUS,
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

export const ON_RECEIVE_ACCOUNTS_LIST_SUCCESS = 'ON_RECEIVE_ACCOUNTS_LIST_SUCCESS';
export function onReceiveAccountsListSuccess(json) {
  return {
    type: ON_RECEIVE_ACCOUNTS_LIST_SUCCESS,
    json,
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

export const SET_COLOR_SCHEME = 'SET_COLOR_SCHEME';
export function setColorScheme(colorScheme) {
  return {
    type: SET_COLOR_SCHEME,
    colorScheme: colorScheme,
  };
}

// When widget goes fullscreen, sidebar must be kind enough to hide itself, which means it
// must know that someone is trying to be fullscreen:
export const SET_FULLSCREEN_DIBS = 'SET_FULLSCREEN_DIBS';
export function setFullscreenDibs(isFullscreenReserved) {
  return {
    type: SET_FULLSCREEN_DIBS,
    payload: isFullscreenReserved,
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
