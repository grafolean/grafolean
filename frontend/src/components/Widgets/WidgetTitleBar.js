import React from 'react';

export default class WidgetTitleBar extends React.Component {
  static defaultProps = {
    title: 'Title',
    buttonRenders: [],
    handleToggleFullscreen: shouldBeFullscreen => {},
    isFullscreen: false,
  };

  render() {
    return (
      <div className="widget-title">
        <h1>{this.props.title}</h1>

        {this.props.buttonRenders.map((renderButton, i) => (
          <span key={i} className="widget-button">
            {renderButton}
          </span>
        ))}

        <span className="widget-button">
          <i className="fa fa-arrow-up" onClick={() => this.props.onPositionChange(-1)} />
        </span>
        <span className="widget-button">
          <i className="fa fa-arrow-down" onClick={() => this.props.onPositionChange(1)} />
        </span>

        <span className="widget-button">
          <i
            className={`fullscreen fa ${this.props.isFullscreen ? 'fa-compress' : 'fa-expand'}`}
            onClick={ev => this.props.handleToggleFullscreen(!this.props.isFullscreen)}
          />
        </span>
      </div>
    );
  }
}
