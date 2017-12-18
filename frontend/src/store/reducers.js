import { combineReducers } from 'redux'

import {
  ON_REQUEST_CHART_DATA,
  ON_REQUEST_CHART_DATA_SUCCESS,
  ON_REQUEST_CHART_DATA_FAILURE,
} from './actions'

function chartdata(state={}, action) {
  console.log(action);
  return state;

  // switch (action.type) {
  //   case ON_REQUEST_CHART_DATA:

  //     return {...state, loading: true}
  //   case ON_RECEIVE_CHART_DATA_SUCCESS:
  //     /* given the chart data in action, update state
  //     // state should look like this:
  //         chartdata: {
  //             "path.123": {
  //                 "-1": [
  //                     {
  //                         from: 1,
  //                         to: 2,
  //                         data: [
  //                             [123456789.123456, 100.0, false],
  //                             [123456789.123456, 100.0, false],
  //                             ...

  //                         ]
  //                     }
  //                 ]
  //             }
  //         }
  //       */
  //     let newState = {...state}
  //     //result[action.path]=...
  //     return newState;
  //   case ON_RECEIVE_CHART_DATA_SUCCESS:
  //     console.log(action);
  //     return state;
  //   default:
  //     return state;
  // }
}

const moonthorApp = combineReducers({
  chartdata,
})

export default moonthorApp
