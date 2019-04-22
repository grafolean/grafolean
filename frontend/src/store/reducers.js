import { combineReducers } from 'redux';
import uniqueId from 'lodash/uniqueId';

import {
  ON_REQUEST_DASHBOARDS_LIST,
  ON_RECEIVE_DASHBOARDS_LIST_SUCCESS,
  ON_RECEIVE_DASHBOARDS_LIST_FAILURE,
  ON_REQUEST_BACKEND_STATUS,
  ON_RECEIVE_BACKEND_STATUS_SUCCESS,
  ON_RECEIVE_BACKEND_STATUS_FAILURE,
  ON_FAILURE,
  ON_SUCCESS,
  REMOVE_NOTIFICATION,
  ON_LOGIN_SUCCESS,
  ON_LOGOUT,
  CLEAR_NOTIFICATIONS,
} from './actions';

function dashboardsList(
  state = {
    fetching: false, // when true, fresh data is being fetched ("loading" sign can be shown)
    valid: false, // when true, data can be shown on screen
    data: [], // list of dashboards
  },
  action,
) {
  switch (action.type) {
    case ON_REQUEST_DASHBOARDS_LIST:
      return { ...state, fetching: true };
    case ON_RECEIVE_DASHBOARDS_LIST_FAILURE:
      return { ...state, fetching: false, data: [], valid: false }; // valid: data should be re-fetched (in response to some user action, not automatically!) before use
    case ON_RECEIVE_DASHBOARDS_LIST_SUCCESS:
      return { ...state, fetching: false, data: action.json.list, valid: true };
    default:
      return state;
  }
}

function notifications(state = [], action) {
  switch (action.type) {
    case ON_RECEIVE_DASHBOARDS_LIST_FAILURE:
      return [{ type: 'error', message: action.errMsg, id: uniqueId('notif-') }, ...state];

    case ON_FAILURE:
      return [{ type: 'error', message: action.msg, id: uniqueId('notif-') }, ...state];
    case ON_SUCCESS:
      return [{ type: 'info', message: action.msg, id: uniqueId('notif-') }, ...state];
    case REMOVE_NOTIFICATION:
      return state.filter(n => n.id !== action.notificationId);
    case CLEAR_NOTIFICATIONS:
      return [];
    default:
      return state;
  }
}

function user(state = null, action) {
  switch (action.type) {
    case ON_LOGIN_SUCCESS:
      return {
        ...action.userData,
        jwtToken: action.jwtToken,
      };
    case ON_LOGOUT:
      return null;
    default:
      return state;
  }
}

function backendStatus(state = null, action) {
  switch (action.type) {
    case ON_RECEIVE_BACKEND_STATUS_FAILURE:
      return null;
    case ON_RECEIVE_BACKEND_STATUS_SUCCESS:
      return action.json;
    case ON_REQUEST_BACKEND_STATUS:
    default:
      return state;
  }
}

const grafoleanApp = combineReducers({
  user,
  backendStatus,
  dashboards: combineReducers({
    list: dashboardsList,
  }),
  notifications,
});

export default grafoleanApp;
