import React from 'react';
import { connect } from 'react-redux';

import { onLogout, clearNotifications } from '../../store/actions';
import store from '../../store';
import Button from '../Button';
import { MQTTFetcherSingleton } from '../../utils/fetch';

class Profile extends React.Component {
  onLogoutClick = () => {
    window.sessionStorage.removeItem('grafolean_jwt_token');
    MQTTFetcherSingleton.disconnect();
    store.dispatch(clearNotifications());
    store.dispatch(onLogout());
  };

  render() {
    return (
      <div>
        <p>User ID: {this.props.userData.user_id}</p>
        <Button onClick={this.onLogoutClick}>Logout</Button>
      </div>
    );
  }
}

const mapStoreToProps = store => ({
  userData: store.user,
});
export default connect(mapStoreToProps)(Profile);
