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
      const { title, ...passThroughProps } = this.props;
      return (
        <div className="moonchart-widget widget">
          <WidgetTitleBar
            title={title}
            buttonRenders={this.state.buttonRenders}
            isFullscreen={this.state.isFullscreen}
            handleToggleFullscreen={this.toggleFullscreen}
          />

          <WrappedComponent
            widgetSetButtons={renders => this.widgetSetButtons(renders)}
            title={this.props.title}
            {...passThroughProps}
          />
        </div>
      )
    }
  }
}

export default isWidget;