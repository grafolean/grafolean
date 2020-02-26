import React from 'react';
import { connect } from 'react-redux';
import GridLayout from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import groupBy from 'lodash/groupBy';

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
import NetFlowNavigationWidget from '../Widgets/NetFlowNavigationWidget/NetFlowNavigationWidget';

import './DashboardView.scss';

const KNOWN_WIDGETS = {
  lastvalue: LastValueWidget,
  topn: TopNWidget,
  chart: GLeanChartWidget,
  netflownavigation: NetFlowNavigationWidget,
};

class DashboardView extends React.Component {
  state = {
    sortingEnabled: false,
    layoutPerPage: { default: [] },
    name: null,
    loading: true,
    widgets: [],
    headerWidgets: [],
    page: 'default', // dashboard can have multiple pages on which widgets are put
  };

  UNIT_Y = 50;
  N_COLS = 12;

  handleLayoutChange = l => {
    this.setState(prevState => ({
      layoutPerPage: {
        ...prevState.layoutPerPage,
        [prevState.page]: l,
      },
    }));
  };

  onDashboardUpdate = json => {
    const allLayouts = json.widgets
      .filter(w => w.p !== 'header')
      .map(w => ({
        i: '' + w.id,
        x: w.x,
        y: w.y,
        w: w.w,
        h: w.h,
        p: w.p,
      }));
    const layoutPerPage = groupBy(allLayouts, 'p');
    this.setState({
      name: json.name,
      widgets: json.widgets.map(w => ({
        id: w.id,
        type: w.type,
        title: w.title,
        content: JSON.parse(w.content),
      })),
      headerWidgets: json.widgets.filter(w => w.p === 'header'),
      layoutPerPage: layoutPerPage,
      loading: false,
    });
  };

  setPage = newPage => {
    this.setState(prevState => {
      const result = {
        page: newPage,
      };
      if (prevState.layoutPerPage[newPage] === undefined) {
        result.layoutPerPage = {
          ...prevState.layoutPerPage,
          [newPage]: [],
        };
      }
      return result;
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

  saveReorderingResult = async () => {
    this.setState(prevState => ({
      savingWidgetPositions: true,
    }));
    try {
      const { layoutPerPage } = this.state;
      let data = [];
      for (let page in layoutPerPage) {
        const dataForPage = layoutPerPage[page].map(l => ({
          widget_id: parseInt(l.i),
          x: l.x,
          y: l.y,
          w: l.w,
          h: l.h,
          p: page,
        }));
        data = data.concat(dataForPage);
      }
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

  renderWidget(widget, unitX) {
    const { layoutPerPage, page, sortingEnabled } = this.state;
    const dashboardSlug = this.props.match.params.slug;

    if (!KNOWN_WIDGETS[widget.type]) {
      return <div key={widget.id}>Unknown widget type.</div>;
    }

    const WidgetComponent = KNOWN_WIDGETS[widget.type];
    const widget_layout = layoutPerPage[page].find(l => l.i === '' + widget.id);
    const width = widget_layout.w * unitX - 10;
    const height = widget_layout.h * this.UNIT_Y - 10;
    return (
      <div key={widget.id} style={{ position: 'relative' }}>
        <WidgetComponent
          key={widget.id}
          width={width}
          height={height}
          widgetId={widget.id}
          dashboardSlug={dashboardSlug}
          title={widget.title}
          content={widget.content}
          additionalButtonsRender={null}
          setPage={this.setPage}
        />
        {sortingEnabled && (
          <div
            className="sorting-overlay"
            style={{
              width: width,
              height: height,
            }}
          ></div>
        )}
      </div>
    );
  }

  renderHeaderWidget(widget, containerWidth) {
    const dashboardSlug = this.props.match.params.slug;
    const WidgetComponent = KNOWN_WIDGETS[widget.type];
    return (
      <WidgetComponent
        key={widget.id}
        width={containerWidth}
        height={null}
        widgetId={widget.id}
        dashboardSlug={dashboardSlug}
        title={widget.title}
        content={widget.content}
        additionalButtonsRender={null}
        setPage={this.setPage}
      />
    );
  }

  render() {
    const { user } = this.props;
    const {
      loading,
      widgets,
      sortingEnabled,
      savingWidgetPositions,
      layoutPerPage,
      page,
      headerWidgets,
    } = this.state;
    const dashboardSlug = this.props.match.params.slug;
    const accountId = this.props.match.params.accountId;

    const innerWidth = this.props.width - 2 * 21; // padding
    const unitX = Math.floor(innerWidth / this.N_COLS);
    const containerWidth = this.N_COLS * unitX;

    const dashboardUrl = `accounts/${accountId}/dashboards/${dashboardSlug}`;
    const canAddDashboard = havePermission(dashboardUrl, 'POST', user.permissions);
    const canEditDashboardTitle = havePermission(dashboardUrl, 'PUT', user.permissions);

    const widgetIdsOnThisPage = layoutPerPage[page].map(l => parseInt(l.i));
    const shownWidgets = widgets.filter(w => widgetIdsOnThisPage.includes(w.id));

    return (
      <div className="frame dashboard-view">
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

        {headerWidgets.length > 0 && (
          <div className="header-widgets">{headerWidgets.map(widget => this.renderHeaderWidget(widget))}</div>
        )}

        {shownWidgets.length > 0 && (
          <GridLayout
            className="layout"
            layout={layoutPerPage[page]}
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
            {shownWidgets.map(widget => this.renderWidget(widget, unitX))}
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
                  page={page}
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
