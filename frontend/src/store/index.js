import { createStore, applyMiddleware, compose } from 'redux'
import thunkMiddleware from 'redux-thunk'
import throttle from 'lodash/throttle';

import moonthorApp from './reducers'

// we are loading and saving user's authentication to sessionStorage:
const loadStoreState = () => {
  try {
    const serializedState = window.sessionStorage.getItem('state');
    if (serializedState === null) {
      return undefined;
    }
    return JSON.parse(serializedState);
  } catch (err) {
    return undefined;
  }
};
const saveStoreState = (state) => {
  try {
    const serializedState = JSON.stringify(state);
    window.sessionStorage.setItem('state', serializedState);
  } catch {
    // ignore write errors
  }
};

const composeWithDevTools = window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ || compose;
const persistedState = loadStoreState();
const store = createStore(
  moonthorApp,
  persistedState,
  composeWithDevTools(applyMiddleware(
    thunkMiddleware, // lets us dispatch() functions
  )),
);

store.subscribe(throttle(() => {
  saveStoreState({
    user: store.getState().user,
  });
}, 1000));

export default store;

