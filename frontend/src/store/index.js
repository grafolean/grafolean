import { createStore, applyMiddleware } from 'redux'
import thunkMiddleware from 'redux-thunk'

import moonthorApp from './reducers'

const store = createStore(
    moonthorApp,
    applyMiddleware(
      thunkMiddleware, // lets us dispatch() functions
    )
  )

export default store

