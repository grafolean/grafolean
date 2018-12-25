import React from 'react';

export default class Button extends React.Component {
  render() {
    const { isLoading, children, ...rest } = this.props;
    return isLoading ? (
      <button>
        <i className="fa fa-circle-o-notch fa-spin" />
      </button>
    ) : (
      <button {...rest}>{children}</button>
    );
  }
}
