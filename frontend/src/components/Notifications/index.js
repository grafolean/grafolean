import React from 'react';
import { connect } from 'react-redux';

import store from '../../store';
import { removeNotification } from '../../store/actions';

import Button from '../Button';

class Notifications extends React.Component {

  handleClickRemove = (event, notificationId) => {
    store.dispatch(removeNotification(notificationId));
    event.preventDefault();
  }

  render() {
    if (this.props.notifications.length === 0) {
      return null;
    }
    return (
      <div className="notifications">
      <ul>
        {this.props.notifications.map((v) => {
          return(
            <li className={v.type} key={v.id}>
              {v.message} <Button onClick={(event) => this.handleClickRemove(event, v.id)}>x</Button>
            </li>
          )
        })}
      </ul>
      </div>
    );
  }
}

const mapStoreToProps = (store) => ({
  notifications: store.notifications ? store.notifications : [],
});
export default connect(mapStoreToProps)(Notifications);