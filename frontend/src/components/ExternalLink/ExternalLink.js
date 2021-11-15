import React from 'react';

export default class ExternalLink extends React.Component {
  render() {
    const { to, children } = this.props;
    return (
      <a href={to} rel="external nofollow noopener noreferrer" target="_blank">
        {children || to}
      </a>
    );
  }
}
