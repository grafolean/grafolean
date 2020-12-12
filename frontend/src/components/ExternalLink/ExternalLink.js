import React from 'react';

export default class ExternalLink extends React.Component {
  render() {
    const { to, label } = this.props;
    return (
      <a href={to} rel="external nofollow noopener noreferrer" target="_blank">
        {label || to}
      </a>
    );
  }
}
