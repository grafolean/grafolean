import fetch from 'cross-fetch'

const ROOT_URL = 'https://localhost:3000/api'

export const ON_REQUEST_CHART_DATA = 'ON_REQUEST_CHART_DATA'
export function onRequestChartData(paths, fromTs, toTs) {
  return {
    type: ON_REQUEST_CHART_DATA,
    paths,  // should be pathsFilters really - backend should return all paths that match the filter and their data
    fromTs,
    toTs,
  }
}

export const ON_RECEIVE_CHART_DATA_SUCCESS = 'ON_RECEIVE_CHART_DATA_SUCCESS'
export function onReceiveChartDataSuccess(json) {
  return {
    type: ON_RECEIVE_CHART_DATA_SUCCESS,
    json,
  }
}

export const ON_RECEIVE_CHART_DATA_FAILURE = 'ON_RECEIVE_CHART_DATA_FAILURE'
export function onReceiveChartDataFailure(errMsg) {
  return {
    type: ON_RECEIVE_CHART_DATA_FAILURE,
    errMsg,
  }
}

// Only network errors and similar are failures for fetch(), so we must
// use this function to check for response status codes too:
//   " The Promise returned from fetch() won’t reject on HTTP error status even
//     if the response is an HTTP 404 or 500. Instead, it will resolve normally
//     (with ok status set to false), and it will only reject on network failure
//     or if anything prevented the request from completing. "
// https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch
function handleFetchErrors(response) {
  if (!response.ok) {
      throw Error(response.statusText);
  }
  return response;
}

export function fetchChartData(paths, fromTs, toTs) {
  // react-thunk - return function instead of object:
  return function (dispatch) {
    // update state:
    dispatch(onRequestChartData(paths, fromTs, toTs));
    // return function that will start the request from server:
    return fetch(`${ROOT_URL}/values`)
      .then(handleFetchErrors)
      .then(
        response => dispatch(onReceiveChartDataSuccess(response.json())),
        errorMsg => dispatch(onReceiveChartDataFailure(errorMsg))
      )
  }
}
