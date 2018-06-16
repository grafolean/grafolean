import fetch from 'cross-fetch'
import { stringify } from 'qs'

export const ROOT_URL = 'http://192.168.123.11:5000/api'
//export const ROOT_URL = 'http://127.0.0.1:5000/api'

export const ON_REQUEST_CHART_DATA = 'ON_REQUEST_CHART_DATA'
export function onRequestChartData(paths, aggrLevel, fromTs, toTs) {
  return {
    type: ON_REQUEST_CHART_DATA,
    paths,  // should be pathsFilters really - backend should return all paths that match the filter and their data
    aggrLevel,
    fromTs,
    toTs,
  }
}

export const ON_RECEIVE_CHART_DATA_SUCCESS = 'ON_RECEIVE_CHART_DATA_SUCCESS'
export function onReceiveChartDataSuccess(paths, aggrLevel, fromTs, toTs, json) {
  return {
    type: ON_RECEIVE_CHART_DATA_SUCCESS,
    paths,
    aggrLevel,
    fromTs,
    toTs,
    json,
  }
}

export const ON_RECEIVE_CHART_DATA_FAILURE = 'ON_RECEIVE_CHART_DATA_FAILURE'
export function onReceiveChartDataFailure(paths, errMsg) {
  return {
    type: ON_RECEIVE_CHART_DATA_FAILURE,
    paths,
    errMsg,
  }
}

export const ON_REQUEST_DASHBOARDS_LIST = 'ON_REQUEST_DASHBOARDS_LIST'
export function onRequestDashboardsList() {
  return {
    type: ON_REQUEST_DASHBOARDS_LIST,
  }
}

export const ON_RECEIVE_DASHBOARDS_LIST_SUCCESS = 'ON_RECEIVE_DASHBOARDS_LIST_SUCCESS'
export function onReceiveDashboardsListSuccess(json) {
  return {
    type: ON_RECEIVE_DASHBOARDS_LIST_SUCCESS,
    json,
  }
}

export const ON_RECEIVE_DASHBOARDS_LIST_FAILURE = 'ON_RECEIVE_DASHBOARDS_LIST_FAILURE'
export function onReceiveDashboardsListFailure(errMsg) {
  return {
    type: ON_RECEIVE_DASHBOARDS_LIST_FAILURE,
    errMsg,
  }
}

export const ON_SUBMIT_DASHBOARD = 'ON_SUBMIT_DASHBOARD'
export function onSubmitDashboard(formid) {
  return {
    type: ON_SUBMIT_DASHBOARD,
    formid,
  }
}

export const ON_SUBMIT_DASHBOARD_SUCCESS = 'ON_SUBMIT_DASHBOARD_SUCCESS'
export function onSubmitDashboardSuccess(formid, json) {
  return {
    type: ON_SUBMIT_DASHBOARD_SUCCESS,
    formid,
    slug: json.slug,
  }
}

export const ON_SUBMIT_DASHBOARD_FAILURE = 'ON_SUBMIT_DASHBOARD_FAILURE'
export function onSubmitDashboardFailure(errMsg) {
  return {
    type: ON_SUBMIT_DASHBOARD_FAILURE,
    errMsg,
  }
}

export const ON_SUBMIT_DELETE_DASHBOARD = 'ON_SUBMIT_DELETE_DASHBOARD'
export function onSubmitDeleteDashboard(slug) {
  return {
    type: ON_SUBMIT_DELETE_DASHBOARD,
    slug,
  }
}

export const ON_SUBMIT_DELETE_DASHBOARD_SUCCESS = 'ON_SUBMIT_DELETE_DASHBOARD_SUCCESS'
export function onSubmitDeleteDashboardSuccess(slug) {
  return {
    type: ON_SUBMIT_DELETE_DASHBOARD_SUCCESS,
    slug,
  }
}

export const ON_SUBMIT_DELETE_DASHBOARD_FAILURE = 'ON_SUBMIT_DELETE_DASHBOARD_FAILURE'
export function onSubmitDeleteDashboardFailure(slug, errMsg) {
  return {
    type: ON_SUBMIT_DELETE_DASHBOARD_FAILURE,
    slug,
    errMsg,
  }
}

export const ON_FAILURE = 'ON_FAILURE'
export function onFailure(msg) {
  return {
    type: ON_FAILURE,
    msg,
  }
}

export const ON_SUCCESS = 'ON_SUCCESS'
export function onSuccess(msg) {
  return {
    type: ON_SUCCESS,
    msg,
  }
}

export const REMOVE_NOTIFICATION = 'REMOVE_NOTIFICATION'
export function removeNotification(notificationId) {
  return {
    type: REMOVE_NOTIFICATION,
    notificationId,
  }
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

export function fetchChartData(paths, aggrLevel,  fromTs, toTs) {
  // react-thunk - return function instead of object:
  return function (dispatch) {
    // update state:
    dispatch(onRequestChartData(paths, aggrLevel, fromTs, toTs));
    // return function that will start the request from server:
    let query_params = {
      p: paths.join(","),
      t0: fromTs,
      t1: toTs,
      a: aggrLevel,
    }
    return fetch(`${ROOT_URL}/values?${stringify(query_params)}`)
      .then(handleFetchErrors)
      .then(
        response => response.json().then(json => dispatch(onReceiveChartDataSuccess(paths, aggrLevel, fromTs, toTs, json))),
        errorMsg => dispatch(onReceiveChartDataFailure(paths, errorMsg.toString()))
      )
  }
}

export function fetchDashboardsList() {
  // react-thunk - return function instead of object:
  return function (dispatch) {
    dispatch(onRequestDashboardsList());
    // return function that will start the request from server:
    return fetch(`${ROOT_URL}/dashboards`)
      .then(handleFetchErrors)
      .then(
        response => response.json().then(json => dispatch(onReceiveDashboardsListSuccess(json))),
        errorMsg => dispatch(onReceiveDashboardsListFailure(errorMsg.toString()))
      )
  }
}

export function submitNewDashboard(formid, name) {
  return function (dispatch) {
    dispatch(onSubmitDashboard(formid));
    return fetch(`${ROOT_URL}/dashboards`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name,
      }),
    })
    .then(handleFetchErrors)
    .then(
      response => response.json().then(json => dispatch(onSubmitDashboardSuccess(formid, json))),
      errorMsg => dispatch(onSubmitDashboardFailure(errorMsg.toString()))
    )
  }
}

export function submitDeleteDashboard(slug) {
  return function (dispatch) {
    dispatch(onSubmitDeleteDashboard(slug));
    return fetch(`${ROOT_URL}/dashboards/${slug}`, {
      method: 'DELETE',
    })
    .then(handleFetchErrors)
    .then(
      response => dispatch(onSubmitDeleteDashboardSuccess(slug)),
      errorMsg => dispatch(onSubmitDeleteDashboardFailure(slug, errorMsg.toString()))
    )
  }
}

