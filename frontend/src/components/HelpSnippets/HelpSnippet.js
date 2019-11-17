import React from 'react';

export default class HelpSnippet extends React.Component {
  state = {
    opened: this.props.initiallyOpened,
  };

  toggleOpened = () => {
    if (!this.props.foldable) {
      return;
    }
    this.setState(prevState => ({
      opened: !prevState.opened,
    }));
  };

  render() {
    const { title, className, foldable } = this.props;
    const { opened } = this.state;
    const icon = foldable
      ? opened
        ? 'fa-chevron-down'
        : 'fa-chevron-right'
      : this.props.icon
      ? this.props.icon
      : 'fa-info-circle';
    return (
      <div className={`help-snippet frame ${className || ''}`}>
        <h1 onClick={this.toggleOpened}>
          <i className={`fa ${icon} fa-fw`} /> {title}
        </h1>
        {(!foldable || opened) && this.props.children}
      </div>
    );
  }
}
