import React from 'react';

import './index.css';

import WidgetTitleBar from './WidgetTitleBar';

const isWidget = WrappedComponent => {
  return class Widget extends React.Component {

    constructor(props) {
      super(props);
      this.state = {
        buttonRenders: [],
        isFullscreen: false,
      }
    }

    widgetSetButtons = (renders) => {
      this.setState({
        buttonRenders: renders,
      })
    }

    toggleFullscreen = (shouldBeFullscreen) => {
      this.setState({
        isFullscreen: shouldBeFullscreen,
      })
    }

    render() {
      const { title, width, height, ...passThroughProps } = this.props;
      const outerWidth = this.state.isFullscreen ? window.innerWidth : width;
      const outerHeight = this.state.isFullscreen ? window.innerHeight : height;
      const contentWidth = outerWidth - 42;  // minus padding & border
      const contentHeight = outerHeight - 37 - 31;  // minus padding, border & title bar height
      return (
        <div
          className={`moonchart-widget widget ${this.state.isFullscreen ? 'fullscreen' : ''}`}
        >
          <WidgetTitleBar
            title={title}
            buttonRenders={this.state.buttonRenders}
            isFullscreen={this.state.isFullscreen}
            handleToggleFullscreen={this.toggleFullscreen}
          />

          <div className="widget-content">
            <WrappedComponent
              widgetSetButtons={renders => this.widgetSetButtons(renders)}
              title={this.props.title}
              width={contentWidth}
              height={contentHeight}
              isFullscreen={this.state.isFullscreen}
              {...passThroughProps}
            />
          </div>
        </div>
      )
    }
  }
}

export default isWidget;