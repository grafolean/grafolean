import React, { Component } from 'react';
import styled from 'styled-components';

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
  render() {
    return (
      <NotificationsList>
        {this.props.notifications.map((v) => {
          return(
            <NotificationOuter className={v.type}>
              {v.message}
            </NotificationOuter>
          )
        })}
      </NotificationsList>
    );
  }
}

export default Notifications;