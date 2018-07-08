import React from 'react';
import { Route } from 'react-router-dom';

import store from '../../store';
import { ROOT_URL, handleFetchErrors, onSuccess, onFailure } from '../../store/actions';

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

    componentDidMount() {
      this.widgetSetButtons();
    }

    widgetSetButtons = () => {
      const deleteButton = (
        <a onClick={(ev) => {
          ev.preventDefault();
          if (window.confirm("Are you sure you want to delete this widget? This can't be undone!")) {
            this.deleteWidget();
          };
        }}>
          <i className="fa fa-trash" />
        </a>
      );
      const editButton = (
        <Route
          render={({ history }) => (
            <a onClick={() => history.push(`/dashboards/view/${this.props.dashboardSlug}/widget/${this.props.widgetId}/edit`)}>
              <i className="fa fa-edit" />
            </a>
          )} />
      );

      this.setState({
        buttonRenders: [
          editButton,
          deleteButton,
        ],
      })
    }

    editWidget = () => {

    }

    deleteWidget = () => {
      fetch(`${ROOT_URL}/dashboards/${this.props.dashboardSlug}/widgets/${this.props.widgetId}`, { method: 'DELETE' })
        .then(handleFetchErrors)
        .then(() => {
          store.dispatch(onSuccess('Widget successfully removed.'));
          this.props.refreshParent();
        })
        .catch(errorMsg => store.dispatch(onFailure(errorMsg.toString())))
    }

    toggleFullscreen = (shouldBeFullscreen) => {
      this.setState({
        isFullscreen: shouldBeFullscreen,
      });
      if (shouldBeFullscreen) {
        window.addEventListener("keyup", this.handleEscKey, true);
      } else {
        window.removeEventListener("keyup", this.handleEscKey, true);
      }
    }

    handleEscKey = (ev) => {
      if (ev.keyCode === 27) {
        ev.preventDefault();
        this.toggleFullscreen(false);
      };
    }

    render() {
      const { title, width, height, ...passThroughProps } = this.props;
      const outerWidth = this.state.isFullscreen ? window.innerWidth : width;
      const outerHeight = this.state.isFullscreen ? window.innerHeight : height;
      const contentWidth = outerWidth - 42;  // minus padding & border
      const contentHeight = outerHeight - 37 - 31;  // minus padding, border & title bar height
      return (
        <div
          className={`widget ${this.state.isFullscreen ? 'fullscreen' : ''}`}
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