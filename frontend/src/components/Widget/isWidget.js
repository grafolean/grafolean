import React from 'react';

import './index.css';

import WidgetTitleBar from './WidgetTitleBar';

const isWidget = WrappedComponent => {
  return class Widget extends React.Component {

    constructor(props) {
      super(props);
      this.state = {
        buttonRenders: [],
      }
    }

    widgetSetButtons = (renders) => {
      this.setState({
        buttonRenders: renders,
      })
    }

    render() {
      const { title, ...passThroughProps } = this.props;
      return (
        <div className="moonchart-widget widget">
          <WidgetTitleBar
            title={title}
            buttonRenders={this.state.buttonRenders}
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