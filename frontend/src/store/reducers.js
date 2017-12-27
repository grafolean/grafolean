import { combineReducers } from 'redux'

import {
  ON_REQUEST_CHART_DATA,
  ON_RECEIVE_CHART_DATA_SUCCESS,
  ON_RECEIVE_CHART_DATA_FAILURE,
} from './actions'

function chartdata(state={}, action) {
  console.log(action);

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
      console.log(action);
      return state;
    default:
      console.log(action);
      return state;
  }
}

const moonthorApp = combineReducers({
  chartdata,
})

export default moonthorApp
