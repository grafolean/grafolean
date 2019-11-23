import React from 'react';

export default class Button extends React.Component {
  render() {
    const { isLoading, children, disabled = false, ...rest } = this.props;
    // if the button is disabled, we should never listen to onClick event:
    if (disabled) {
      delete rest['onClick'];
    }
    return (
      <button className={`${disabled && 'disabled'}`} disabled={disabled} {...rest}>
        {isLoading ? <i className="fa fa-circle-o-notch fa-spin" /> : children}
      </button>
    );
  }
}
