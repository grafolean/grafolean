import React from 'react';

export default class NotificationBadge extends React.Component {
  render() {
    return (
      <span className="fa-stack notif-red-dot">
        <i className="fa fa-circle fa-stack-1x icon-a" />
        <i className="fa fa-info-circle fa-stack-1x icon-b" />
      </span>
    );
  }
}
