import { combineReducers } from 'redux'

import {
  ON_REQUEST_CHART_DATA,
  ON_RECEIVE_CHART_DATA_SUCCESS,
  ON_RECEIVE_CHART_DATA_FAILURE,
  ON_REQUEST_DASHBOARDS_LIST,
  ON_RECEIVE_DASHBOARDS_LIST_SUCCESS,
  ON_RECEIVE_DASHBOARDS_LIST_FAILURE,
  ON_SUBMIT_DASHBOARD,
  ON_SUBMIT_DASHBOARD_SUCCESS,
  ON_SUBMIT_DASHBOARD_FAILURE,
} from './actions'

function chartdata(state={}, action) {
  switch (action.type) {
    case ON_REQUEST_CHART_DATA:
      return state;

    //   return {...state, loading: true}
    case ON_RECEIVE_CHART_DATA_SUCCESS:
      /* given the chart data in action, update state
      // state should look like this:
          chartdata: {
              "path.123": {
                  "-1": [
                      {
                          from: 1,
                          to: 2,
                          data: [
                              [123456789.123456, 100.0, false],
                              [123456789.123456, 100.0, false],
                              ...

                          ]
                      }
                  ]
              }
          }
        */
      let newState = {...state}
      for (var path in action.json.data) {
        newState[path][`${action.json.aggregation_level}`] = action.json.data[path];  // actually, data should probably be merged or some better caching strategy should be devised... but it's good enough for now
      }
      return newState;
    case ON_RECEIVE_CHART_DATA_FAILURE:
      return state;
    default:
      return state;
  }
}

function dashboards(state=[], action) {
  switch (action.type) {
    case ON_REQUEST_DASHBOARDS_LIST:
      return state;
    case ON_RECEIVE_DASHBOARDS_LIST_FAILURE:
      return state;
    case ON_RECEIVE_DASHBOARDS_LIST_SUCCESS:
      return action.json.list;
    default:
      return state;
  }
}

function forms(state={}, action) {
  switch (action.type) {
    case ON_SUBMIT_DASHBOARD:
      return {...state, [action.formid]: {loading: true}};
    case ON_SUBMIT_DASHBOARD_SUCCESS:
    case ON_SUBMIT_DASHBOARD_FAILURE:
      return {...state, [action.formid]: {loading: false}};
    default:
      return state;
  }
}

const moonthorApp = combineReducers({
  chartdata,
  dashboards,
  forms,
})

export default moonthorApp
