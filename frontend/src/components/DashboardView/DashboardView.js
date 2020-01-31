import React from 'react';
import { connect } from 'react-redux';
import GridLayout from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

import store from '../../store';
import { ROOT_URL, handleFetchErrors, onFailure } from '../../store/actions';
import { fetchAuth, havePermission } from '../../utils/fetch';
import { PersistentFetcher } from '../../utils/fetch/PersistentFetcher';

import EditableLabel from '../EditableLabel';
import Button from '../Button';
import Loading from '../Loading';
import WidgetForm from '../WidgetForm/WidgetForm';
import GLeanChartWidget from '../Widgets/GLeanChartWidget/GLeanChartWidget';
import LastValueWidget from '../Widgets/LastValueWidget/LastValueWidget';
import TopNWidget from '../Widgets/TopNWidget/TopNWidget';

import './DashboardView.scss';

const KNOWN_WIDGETS = {
  lastvalue: LastValueWidget,
  topn: TopNWidget,
  chart: GLeanChartWidget,
};

class DashboardView extends React.Component {
  state = {
    sortingEnabled: false,
    layout: [
      { i: 'a', x: 0, y: 0, w: 6, h: 8 },
      { i: 'b', x: 6, y: 0, w: 6, h: 8 },
      { i: 'c', x: 0, y: 8, w: 6, h: 8 },
      { i: 'd', x: 0, y: 16, w: 6, h: 8 },
      { i: 'e', x: 0, y: 24, w: 6, h: 8 },
    ],
    name: null,
    loading: true,
    widgets: [],
  };

  UNIT_X = 100;
  UNIT_Y = 50;
  N_COLS = 12;

  handleLayoutChange = l => {
    console.log('New layout:', l);
    this.setState({
      layout: l,
    });
  };

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

  renderWidget(widget, index) {
    const { layout, sortingEnabled } = this.state;
    const dashboardSlug = this.props.match.params.slug;

    if (!KNOWN_WIDGETS[widget.type]) {
      return <div key={widget.id}>Unknown widget type.</div>;
    }

    const WidgetComponent = KNOWN_WIDGETS[widget.type];
    return (
      <div key={layout[index].i}>
        <WidgetComponent
          key={widget.id}
          width={layout[index].w * this.UNIT_X - 10}
          height={layout[index].h * this.UNIT_Y - 10}
          widgetId={widget.id}
          dashboardSlug={dashboardSlug}
          title={widget.title}
          content={widget.content}
          additionalButtonsRender={null}
        />
      </div>
    );
  }

  render() {
    const { user } = this.props;
    const { loading, widgets, sortingEnabled, savingWidgetPositions, layout } = this.state;
    const dashboardSlug = this.props.match.params.slug;
    const accountId = this.props.match.params.accountId;

    const containerWidth = this.N_COLS * this.UNIT_X;

    const dashboardUrl = `accounts/${accountId}/dashboards/${dashboardSlug}`;
    const canAddDashboard = havePermission(dashboardUrl, 'POST', user.permissions);
    const canEditDashboardTitle = havePermission(dashboardUrl, 'PUT', user.permissions);

    return (
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

        {widgets.length > 0 && (
          <GridLayout
            className="layout"
            layout={layout}
            cols={this.N_COLS}
            rowHeight={this.UNIT_Y}
            width={containerWidth}
            style={{ width: containerWidth + 2 }}
            margin={[0, 0]}
            containerPadding={[0, 0]}
            onLayoutChange={this.handleLayoutChange}
            useCSSTransforms={false} // fix fixed positioning (needed by fullscreen)
            isDraggable={sortingEnabled}
            isResizable={sortingEnabled}
          >
            {/* CAREFUL! Adding a ternary operator here might make GridLayout ignore its layout prop. */}
            {widgets.map((widget, index) => this.renderWidget(widget, index))}
          </GridLayout>
        )}

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
                <WidgetForm
                  resource={`accounts/${accountId}/dashboards/${dashboardSlug}/widgets`}
                  editing={false}
                  lockWidgetType={false}
                  afterSubmit={this.handleWidgetUpdate}
                />
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
export default connect(mapStoreToProps)(DashboardView);
