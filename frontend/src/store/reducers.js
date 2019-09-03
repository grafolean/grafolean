import { combineReducers } from 'redux';
import uniqueId from 'lodash/uniqueId';

import {
  ON_REQUEST_BACKEND_STATUS,
  ON_RECEIVE_BACKEND_STATUS_SUCCESS,
  ON_RECEIVE_BACKEND_STATUS_FAILURE,
  ON_FAILURE,
  ON_SUCCESS,
  REMOVE_NOTIFICATION,
  ON_LOGIN_SUCCESS,
  ON_LOGOUT,
  CLEAR_NOTIFICATIONS,
  ON_RECEIVE_ACCOUNTS_LIST_SUCCESS,
  SET_COLOR_SCHEME,
} from './actions';

function notifications(state = [], action) {
  switch (action.type) {
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

function accounts(state = {}, action) {
  switch (action.type) {
    case ON_RECEIVE_ACCOUNTS_LIST_SUCCESS:
      let newState = {
        ...state,
        list: action.json.list,
      };
      return newState;
    default:
      return state;
  }
}

function preferences(state = {}, action) {
  switch (action.type) {
    case SET_COLOR_SCHEME:
      return {
        ...state,
        colorScheme: action.colorScheme,
      };
    default:
      return state;
  }
}

const grafoleanApp = combineReducers({
  user,
  backendStatus,
  accounts,
  preferences,
  notifications,
});

export default grafoleanApp;
