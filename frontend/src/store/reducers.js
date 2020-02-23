import { combineReducers } from 'redux';
import uniqueId from 'lodash/uniqueId';

import {
  DO_REQUEST_BACKEND_STATUS,
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
  SET_FULLSCREEN_DIBS,
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

function backendStatus(state = { status: null, numberUpdatesRequested: 0 }, action) {
  switch (action.type) {
    case ON_RECEIVE_BACKEND_STATUS_FAILURE:
      return {
        ...state,
        status: null,
      };
    case ON_RECEIVE_BACKEND_STATUS_SUCCESS:
      return {
        ...state,
        status: action.json,
      };
    case DO_REQUEST_BACKEND_STATUS:
      // This is a hack which allows us to get rid of redux-thunk without changing the existing code too much.
      // Some parts of the app assume they can trigger re-fetching of backend status... Ugly, but this action
      // enables that in collaboration with BackendStatusUpdater component:
      return {
        ...state,
        numberUpdatesRequested: state.numberUpdatesRequested + 1,
      };
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

function preferences(state = { colorScheme: 'dark' }, action) {
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

function fullscreenDibs(state = false, action) {
  switch (action.type) {
    case SET_FULLSCREEN_DIBS:
      return action.payload;
    default:
      return state;
  }
}

const grafoleanApp = combineReducers({
  user: user,
  backendStatus: backendStatus,
  accounts: accounts,
  preferences: preferences,
  notifications: notifications,
  fullscreenDibs: fullscreenDibs,
});

export default grafoleanApp;
