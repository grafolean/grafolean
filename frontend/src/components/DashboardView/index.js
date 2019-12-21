import React from 'react';
import { connect } from 'react-redux';

import store from '../../store';
import { ROOT_URL, handleFetchErrors, onFailure } from '../../store/actions';
import { fetchAuth, havePermission } from '../../utils/fetch';
import { PersistentFetcher } from '../../utils/fetch/PersistentFetcher';

import Button from '../Button';
import EditableLabel from '../EditableLabel';
import Loading from '../Loading';
import WidgetForm from '../WidgetForm';
import GLeanChartWidget from '../Widgets/GLeanChartWidget/GLeanChartWidget';
import LastValueWidget from '../Widgets/LastValueWidget/LastValueWidget';

import './DashboardView.scss';

class _DashboardView extends React.Component {
  state = {
    loading: true,
    name: '',
    widgets: [],
    newWidgetFormOpened: false,
    sortingEnabled: false,
    savingWidgetPositions: false,
  };
  widgetsBeforeReordering = null;

  onDashboardUpdate = json => {
    this.setState({
      name: json.name,
      widgets: json.widgets.map(w => ({
        id: w.id,
        type: w.type,
        title: w.title,
        content: JSON.parse(w.content),
      })),
      loading: false,
    });
  };

  handleShowNewWidgetForm = ev => {
    ev.preventDefault();
    this.setState({
      newWidgetFormOpened: true,
    });
  };

  handleHideNewWidgetForm = ev => {
    ev.preventDefault();
    this.setState({
      newWidgetFormOpened: false,
    });
  };

  handleWidgetUpdate = () => {
    this.setState({
      newWidgetFormOpened: false,
    });
  };

  setDashboardName = async name => {
    const dashboardSlug = this.props.match.params.slug;
    const accountId = this.props.match.params.accountId;
    const params = {
      name: name,
    };
    fetchAuth(`${ROOT_URL}/accounts/${accountId}/dashboards/${dashboardSlug}`, {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      method: 'PUT',
      body: JSON.stringify(params),
    }).then(handleFetchErrors);

    this.setState({
      name: name,
    });
  };

  startReordering = () => {
    this.setState(prevState => ({
      sortingEnabled: true,
    }));
    this.widgetsBeforeReordering = [...this.state.widgets];
  };

  cancelReordering = () => {
    this.setState(prevState => ({
      sortingEnabled: false,
      widgets: this.widgetsBeforeReordering,
    }));
  };

  onPositionChange = (oldPosition, newPosition) => {
    this.setState(prevState => {
      const { widgets } = prevState;
      if (newPosition < 0 || newPosition >= widgets.length) {
        return null;
      }
      const widgetsWithout = [...widgets];
      widgetsWithout.splice(oldPosition, 1);
      const newWidgets = [
        ...widgetsWithout.slice(0, newPosition),
        widgets[oldPosition],
        ...widgetsWithout.slice(newPosition),
      ];
      return { widgets: newWidgets };
    });
  };

  saveReorderingResult = async () => {
    this.setState(prevState => ({
      savingWidgetPositions: true,
    }));
    try {
      const { widgets } = this.state;
      const data = widgets.map((w, i) => ({
        widget_id: w.id,
        position: i,
      }));
      const dashboardSlug = this.props.match.params.slug;
      const url = `${ROOT_URL}/accounts/${this.props.match.params.accountId}/dashboards/${dashboardSlug}/widgets_positions`;
      const response = await fetchAuth(url, {
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        method: 'PUT',
        body: JSON.stringify(data),
      });
      handleFetchErrors(response);
    } catch (errorMsg) {
      store.dispatch(onFailure(errorMsg.toString()));
    }
    this.setState(prevState => ({
      savingWidgetPositions: false,
      sortingEnabled: false,
    }));
  };

  render() {
    const { user } = this.props;
    const { loading, widgets, sortingEnabled, savingWidgetPositions } = this.state;
    const dashboardSlug = this.props.match.params.slug;
    const accountId = this.props.match.params.accountId;

    const innerWidth = this.props.width - 2 * 21; // padding

    const dashboardUrl = `accounts/${accountId}/dashboards/${dashboardSlug}`;
    const canAddDashboard = havePermission(dashboardUrl, 'POST', user.permissions);
    const canEditDashboardTitle = havePermission(dashboardUrl, 'PUT', user.permissions);
    return (
      <div>
        <div className="frame">
          <div className="dashboard-info">
            <span>
              Dashboard:{' '}
              <EditableLabel
                label={this.state.name}
                onChange={this.setDashboardName}
                isEditable={canEditDashboardTitle}
              />
            </span>

            {loading && <Loading overlayParent={true} />}

            <div className="widget-sorting">
              {sortingEnabled ? (
                <>
                  {!savingWidgetPositions && (
                    <Button className="red" onClick={this.cancelReordering}>
                      <i className="fa fa-close" /> Cancel
                    </Button>
                  )}
                  <Button
                    isLoading={savingWidgetPositions}
                    className="green"
                    onClick={this.saveReorderingResult}
                  >
                    <i className="fa fa-save" /> Save widget positions
                  </Button>
                </>
              ) : (
                <Button className="green" onClick={this.startReordering}>
                  <i className="fa fa-crosshairs" /> Reorder widgets
                </Button>
              )}
            </div>
          </div>

          <PersistentFetcher resource={dashboardUrl} onUpdate={this.onDashboardUpdate} />

          {widgets.length > 0 &&
            widgets.map((widget, position) => {
              const additionalButtonsRender = sortingEnabled ? (
                <>
                  <span className={`widget-button ${position === 0 ? 'disabled' : ''}`}>
                    <i
                      className="fa fa-arrow-up"
                      onClick={() => this.onPositionChange(position, position - 1)}
                    />
                  </span>
                  <span className={`widget-button ${position === widgets.length - 1 ? 'disabled' : ''}`}>
                    <i
                      className="fa fa-arrow-down"
                      onClick={() => this.onPositionChange(position, position + 1)}
                    />
                  </span>
                </>
              ) : null;

              switch (widget.type) {
                case 'lastvalue':
                  return (
                    <LastValueWidget
                      key={widget.id}
                      width={innerWidth}
                      height={500}
                      widgetId={widget.id}
                      dashboardSlug={dashboardSlug}
                      title={widget.title}
                      content={widget.content}
                      additionalButtonsRender={additionalButtonsRender}
                    />
                  );
                case 'chart':
                  return (
                    <GLeanChartWidget
                      key={widget.id}
                      width={innerWidth}
                      height={500}
                      widgetId={widget.id}
                      dashboardSlug={dashboardSlug}
                      title={widget.title}
                      content={widget.content}
                      additionalButtonsRender={additionalButtonsRender}
                    />
                  );
                default:
                  return <div>Unknown widget type.</div>;
              }
            })}
        </div>

        {canAddDashboard && (
          <div className="frame" style={{ marginBottom: 300 }}>
            {!this.state.newWidgetFormOpened ? (
              <div>
                <Button onClick={this.handleShowNewWidgetForm}>
                  <i className="fa fa-plus" /> add widget
                </Button>
              </div>
            ) : (
              <div>
                <Button className="red" onClick={this.handleHideNewWidgetForm}>
                  <i className="fa fa-minus" /> cancel
                </Button>
                <WidgetForm dashboardSlug={dashboardSlug} onUpdate={this.handleWidgetUpdate} />
              </div>
            )}
          </div>
        )}
      </div>
    );
  }
}

const mapStoreToProps = store => ({
  user: store.user,
});
const DashboardView = connect(mapStoreToProps)(_DashboardView);

class DashboardViewRemountable extends React.Component {
  /*
    React Router doesn't re-mount the component when the params change; DashboardView however
    assumes it will be remounted. Solution is to put a component in between which will use
    key to remount DashboardView as necessary.
  */
  render() {
    const { match, ...rest } = this.props;
    return <DashboardView key={match ? match.params.slug : ''} match={match} {...rest} />;
  }
}

export default DashboardViewRemountable;
