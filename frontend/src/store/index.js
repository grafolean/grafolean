import { createStore, applyMiddleware } from 'redux'
import thunkMiddleware from 'redux-thunk'

import moonthorApp from './reducers'

const store = createStore(
    moonthorApp,
    window.__REDUX_DEVTOOLS_EXTENSION__ && window.__REDUX_DEVTOOLS_EXTENSION__(),
    applyMiddleware(
      thunkMiddleware, // lets us dispatch() functions
    )
  )

export default store

