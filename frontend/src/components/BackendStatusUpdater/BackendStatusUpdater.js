import React from 'react';
import { connect } from 'react-redux';

import store from '../../store';
import {
  onReceiveBackendStatusSuccess,
  onReceiveBackendStatusFailure,
  ROOT_URL,
  handleFetchErrors,
} from '../../store/actions';

class BackendStatusUpdater extends React.Component {
  componentDidMount() {
    this.requestBackendStatus();
  }

  componentDidUpdate(prevProps) {
    if (prevProps.numberUpdatesRequested !== this.props.numberUpdatesRequested) {
      this.requestBackendStatus();
    }
  }

  requestBackendStatus = () => {
    fetch(`${ROOT_URL}/status/info`)
      .then(handleFetchErrors)
      .then(response => response.json())
      .then(json => {
        store.dispatch(onReceiveBackendStatusSuccess(json));
      })
      .catch(errorMsg => {
        store.dispatch(onReceiveBackendStatusFailure(errorMsg.toString()));
      });
  };

  render() {
    return null;
  }
}

const mapStoreToProps = store => ({
  numberUpdatesRequested: store.backendStatus.numberUpdatesRequested,
});
export default connect(mapStoreToProps)(BackendStatusUpdater);
