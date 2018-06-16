import React, { Component } from 'react';
import styled from 'styled-components';

import store from '../../store';
import { removeNotification } from '../../store/actions';

import Button from '../Button';

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

  handleClickRemove = (event, notificationId) => {
    store.dispatch(removeNotification(notificationId));
    event.preventDefault();
  }

  render() {
    if (this.props.notifications.length === 0) {
      return null;
    }
    return (
      <NotificationsList>
        {this.props.notifications.map((v) => {
          return(
            <NotificationOuter className={v.type} key={v.id}>
              {v.message} <Button onClick={(event) => this.handleClickRemove(event, v.id)}>x</Button>
            </NotificationOuter>
          )
        })}
      </NotificationsList>
    );
  }
}

export default Notifications;