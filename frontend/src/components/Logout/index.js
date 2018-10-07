import React from 'react';

import { onLogout } from '../../store/actions';
import store from '../../store';
import Button from '../Button';

class Logout extends React.Component {
  onLogoutClick = () => {
    window.sessionStorage.removeItem('moonthor_jwt_token');
    store.dispatch(onLogout());
  }

  render() {
    return (
      <div>
        <Button onClick={this.onLogoutClick}>Logout</Button>
      </div>
    );
  }
}

export default Logout;
