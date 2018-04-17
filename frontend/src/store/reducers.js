import { combineReducers } from 'redux'
import uniqueId from 'lodash/uniqueId';

import {
  ON_REQUEST_CHART_DATA,
  ON_RECEIVE_CHART_DATA_SUCCESS,
  ON_RECEIVE_CHART_DATA_FAILURE,
  ON_REQUEST_DASHBOARDS_LIST,
  ON_RECEIVE_DASHBOARDS_LIST_SUCCESS,
  ON_RECEIVE_DASHBOARDS_LIST_FAILURE,
  ON_REQUEST_DASHBOARD_DETAILS,
  ON_RECEIVE_DASHBOARD_DETAILS_SUCCESS,
  ON_RECEIVE_DASHBOARD_DETAILS_FAILURE,
  ON_SUBMIT_DASHBOARD,
  ON_SUBMIT_DASHBOARD_SUCCESS,
  ON_SUBMIT_DASHBOARD_FAILURE,
  ON_SUBMIT_DELETE_DASHBOARD,
  ON_SUBMIT_DELETE_DASHBOARD_SUCCESS,
  ON_SUBMIT_DELETE_DASHBOARD_FAILURE,
  ON_FAILURE,
  ON_SUCCESS,
  REMOVE_NOTIFICATION,
} from './actions'

function chartData(state={}, action) {
  let newState = {...state}
  switch (action.type) {
    case ON_REQUEST_CHART_DATA:
      // for each of the requested paths, mark them as `fetching: true`
      for (let path of action.paths) {
        newState[path] = {
          fetching: true,
        };
      };
      return newState;

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
      for (let path of action.paths) {
        newState[path] = {
          data: action.json.paths[path].data,  // actually, data should probably be merged or some better caching strategy should be devised... but it's good enough for now
          fetching: false,
        }
      };
      return newState;
    case ON_RECEIVE_CHART_DATA_FAILURE:
      for (let path of action.paths) {
        newState[path] = {
          fetching: false,
        }
      };
      return newState;
    default:
      return state;
  }
}

function dashboardsList(
  state={
    fetching: false,  // when true, fresh data is being fetched ("loading" sign can be shown)
    valid: false,     // when true, data can be shown on screen
    refetch: true,    // a signal to start fetching as soon as convenient
    data: [],         // list of dashboards
  }, action) {

  switch (action.type) {
    case ON_REQUEST_DASHBOARDS_LIST:
      return {...state, fetching: true, refetch: false};
    case ON_RECEIVE_DASHBOARDS_LIST_FAILURE:
      return {...state, fetching: false, data: [], valid: false};  // valid: data should be re-fetched (in response to some user action, not automatically!) before use
    case ON_RECEIVE_DASHBOARDS_LIST_SUCCESS:
      return {...state, fetching: false, data: action.json.list, valid: true};

    case ON_SUBMIT_DELETE_DASHBOARD_FAILURE:
    case ON_SUBMIT_DELETE_DASHBOARD_SUCCESS:
    case ON_SUBMIT_DASHBOARD_FAILURE:
    case ON_SUBMIT_DASHBOARD_SUCCESS:
      // it might be good if we marked data as stale, but we re-fetch it on each componentWillMount anyway...
      return {...state, refetch: true};
    default:
      return state;
  }
}

function dashboardDetails(state={}, action) {
  if (!action.slug)
    return state;
  // each action is really concerned only with the part of the state that is determined by the slug:
  let slugState = dashboardDetailsPerSlug(state[action.slug], action);
  if (slugState === false)  // unknown action
    return state;
  return {...state, [action.slug]: slugState};
}
function dashboardDetailsPerSlug(slugState={
    fetching: false,  // data is being fetched from server
    deleting: false,  // dashboard is being deleted
    valid: false,     // data can be displayed
    data: {},         // dashboard data
  }, action) {

  switch (action.type) {
    case ON_REQUEST_DASHBOARD_DETAILS:
      return {...slugState, fetching: true};
    case ON_RECEIVE_DASHBOARD_DETAILS_FAILURE:
      return {...slugState, fetching: false, valid: false};
    case ON_RECEIVE_DASHBOARD_DETAILS_SUCCESS:
      return {...slugState, fetching: false, data: action.json, valid: true};

    case ON_SUBMIT_DELETE_DASHBOARD:
      return {...slugState, deleting: true, valid: false};
    case ON_SUBMIT_DELETE_DASHBOARD_FAILURE:
      return undefined;  // deleting failed, we have no idea what happened - refetch data if you need it
    case ON_SUBMIT_DELETE_DASHBOARD_SUCCESS:
      return undefined;  // remove the details for this dashboard
    default:
      return false;
  }
}

function forms(state={}, action) {
  switch (action.type) {
    case ON_SUBMIT_DASHBOARD:
      return {...state, [action.formid]: {loading: true, submitted: false}};
    case ON_SUBMIT_DASHBOARD_SUCCESS:
      return {...state, [action.formid]: {loading: false, submitted: true, slug: action.slug}};
    case ON_SUBMIT_DASHBOARD_FAILURE:
      return {...state, [action.formid]: {loading: false, submitted: false}};
    default:
      return state;
  }
}

function notifications(state=[],action) {
  switch (action.type) {
    case ON_RECEIVE_CHART_DATA_FAILURE:
    case ON_RECEIVE_DASHBOARDS_LIST_FAILURE:
    case ON_RECEIVE_DASHBOARD_DETAILS_FAILURE:
    case ON_SUBMIT_DASHBOARD_FAILURE:
    case ON_SUBMIT_DELETE_DASHBOARD_FAILURE:
      return [{type: 'error', message: action.errMsg, id: uniqueId('notif-')}, ...state]
    case ON_SUBMIT_DELETE_DASHBOARD_SUCCESS:
      return [{type: 'info', message: "Successfully removed dashboard", id: uniqueId('notif-')}, ...state]

    case ON_FAILURE:
      return [{type: 'error', message: action.msg, id: uniqueId('notif-')}, ...state]
    case ON_SUCCESS:
      return [{type: 'info', message: action.msg, id: uniqueId('notif-')}, ...state]
    case REMOVE_NOTIFICATION:
      return state.filter(n => n.id !== action.notificationId);
    default:
      return state;
  }
}

const moonthorApp = combineReducers({
  chartData,
  dashboards: combineReducers({
    list: dashboardsList,
    details: dashboardDetails,
  }),
  forms,
  notifications,
})

export default moonthorApp
