import React from 'react';

export default class WidgetTitleBar extends React.Component {
  static defaultProps = {
    title: 'Title',
    buttonRenders: [],
    handleToggleFullscreen: shouldBeFullscreen => {},
    isFullscreen: false,
  };

  render() {
    const { title, buttonRenders, isFullscreen, isOnTop, isOnBottom } = this.props;
    return (
      <div className="widget-title">
        <h1>{title}</h1>

        {buttonRenders.map((renderButton, i) => (
          <span key={i} className="widget-button">
            {renderButton}
          </span>
        ))}

        <span className={`widget-button ${isOnTop ? 'disabled' : ''}`}>
          <i className="fa fa-arrow-up" onClick={() => this.props.onPositionChange(-1)} />
        </span>
        <span className={`widget-button ${isOnBottom ? 'disabled' : ''}`}>
          <i className="fa fa-arrow-down" onClick={() => this.props.onPositionChange(1)} />
        </span>

        <span className="widget-button">
          <i
            className={`fullscreen fa ${isFullscreen ? 'fa-compress' : 'fa-expand'}`}
            onClick={() => this.props.handleToggleFullscreen(!isFullscreen)}
          />
        </span>
      </div>
    );
  }
}
