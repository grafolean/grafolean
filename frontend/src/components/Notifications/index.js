import React from 'react';
import { connect } from 'react-redux';

import store from '../../store';
import { removeNotification } from '../../store/actions';

class Notifications extends React.Component {
  handleClickRemove = (event, notificationId) => {
    store.dispatch(removeNotification(notificationId));
    event.preventDefault();
  };

  render() {
    if (this.props.notifications.length === 0) {
      return null;
    }
    return (
      <div className="notifications">
        <ul>
          {this.props.notifications.map(v => {
            return (
              <li className={v.type} key={v.id}>
                {v.message} <i className="fa fa-close" onClick={ev => this.handleClickRemove(ev, v.id)} />
              </li>
            );
          })}
        </ul>
      </div>
    );
  }
}

const mapStoreToProps = store => ({
  notifications: store.notifications ? store.notifications : [],
});
export default connect(mapStoreToProps)(Notifications);
