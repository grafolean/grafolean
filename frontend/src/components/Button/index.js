import React from 'react';

export default class Button extends React.Component {
  render() {
    const { isLoading, children, ...rest } = this.props;
    return <button {...rest}>{isLoading ? <i className="fa fa-circle-o-notch fa-spin" /> : children}</button>;
  }
}
