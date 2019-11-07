import React from 'react';

export default class Button extends React.Component {
  render() {
    const { isLoading, children, disabled, ...rest } = this.props;
    return (
      <button className={`${disabled && 'disabled'}`} {...rest}>
        {isLoading ? <i className="fa fa-circle-o-notch fa-spin" /> : children}
      </button>
    );
  }
}
