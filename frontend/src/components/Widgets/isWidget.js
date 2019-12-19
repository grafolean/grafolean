import React from 'react';
import { connect } from 'react-redux';
import { Route } from 'react-router-dom';

import { fetchAuth } from '../../utils/fetch';
import store from '../../store';
import { ROOT_URL, handleFetchErrors, onFailure, setFullscreenDibs } from '../../store/actions';

import WidgetTitleBar from './WidgetTitleBar';

import './index.scss';

const mapStoreToProps = store => ({
  accounts: store.accounts,
});

const isWidget = WrappedComponent => {
  const wrappedComponent = class Widget extends React.Component {
    state = {
      buttonRenders: [],
      isFullscreen: false,
    };

    componentDidMount() {
      this.widgetSetButtons();
    }

    widgetSetButtons = () => {
      const deleteButton = (
        <i
          className="fa fa-trash"
          onClick={ev => {
            ev.preventDefault();
            if (window.confirm("Are you sure you want to delete this widget? This can't be undone!")) {
              this.deleteWidget();
            }
          }}
        />
      );
      const editButton = (
        <Route
          render={({ history }) => (
            <i
              className="fa fa-edit"
              onClick={() =>
                history.push(
                  `/accounts/${this.props.match.params.accountId}/dashboards/view/${
                    this.props.dashboardSlug
                  }/widget/${this.props.widgetId}/edit`,
                )
              }
            />
          )}
        />
      );

      this.setState({
        buttonRenders: [editButton, deleteButton],
      });
    };

    deleteWidget = () => {
      fetchAuth(
        `${ROOT_URL}/accounts/${this.props.match.params.accountId}/dashboards/${
          this.props.dashboardSlug
        }/widgets/${this.props.widgetId}`,
        { method: 'DELETE' },
      )
        .then(handleFetchErrors)
        .catch(errorMsg => store.dispatch(onFailure(errorMsg.toString())));
    };

    toggleFullscreen = shouldBeFullscreen => {
      store.dispatch(setFullscreenDibs(shouldBeFullscreen));
      this.setState({
        isFullscreen: shouldBeFullscreen,
      });
      if (shouldBeFullscreen) {
        window.addEventListener('keyup', this.handleEscKey, true);
      } else {
        window.removeEventListener('keyup', this.handleEscKey, true);
      }
    };

    handleEscKey = ev => {
      if (ev.keyCode === 27) {
        ev.preventDefault();
        this.toggleFullscreen(false);
      }
    };

    render() {
      const { title, width, height, onPositionChange, ...passThroughProps } = this.props;
      const outerWidth = this.state.isFullscreen ? window.innerWidth : width;
      const outerHeight = this.state.isFullscreen ? window.innerHeight : height;
      const contentWidth = outerWidth - 42; // minus padding & border
      const contentHeight = outerHeight - 37 - 31; // minus padding, border & title bar height
      return (
        <div className={`widget ${this.state.isFullscreen ? 'fullscreen' : ''}`}>
          <WidgetTitleBar
            title={title}
            buttonRenders={this.state.buttonRenders}
            isFullscreen={this.state.isFullscreen}
            onToggleFullscreen={this.toggleFullscreen}
            onPositionChange={onPositionChange}
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
      );
    }
  };
  return connect(mapStoreToProps)(wrappedComponent);
};

export default isWidget;
