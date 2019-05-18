import React from 'react';
import { connect } from 'react-redux';

import { doLogout } from '../../store/helpers';

import Button from '../Button';

class Profile extends React.Component {
  render() {
    return (
      <div>
        <p>User ID: {this.props.userData.user_id}</p>
        <Button onClick={doLogout}>Logout</Button>
      </div>
    );
  }
}

const mapStoreToProps = store => ({
  userData: store.user,
});
export default connect(mapStoreToProps)(Profile);
