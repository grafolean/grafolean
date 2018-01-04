import React, { Component } from 'react';
import styled from 'styled-components';

import store from '../../store';
import { removeNotification } from '../../store/actions';

const NotificationsList = styled.ul`
  list-style-type: none;
`

const NotificationOuter = styled.li`
  padding: 20px 0px;
  margin: 10px 0px;


  &.error {
    background-color: #ffdddd;
  }
  &.warning {
    background-color: #ffeedd;
  }
  &.info {
    background-color: #ddffdd;
  }
`

class Notifications extends Component {

  constructor(props) {
    super(props);
    this.handleClickRemove = this.handleClickRemove.bind(this);
  }

  handleClickRemove(event, notificationId) {
    store.dispatch(removeNotification(notificationId));
    event.preventDefault();
  }

  render() {
    return (
      <NotificationsList>
        {this.props.notifications.map((v) => {
          return(
            <NotificationOuter className={v.type} key={v.id}>
              {v.message} <a href="#" onClick={(event) => this.handleClickRemove(event, v.id)}>x</a>
            </NotificationOuter>
          )
        })}
      </NotificationsList>
    );
  }
}

export default Notifications;