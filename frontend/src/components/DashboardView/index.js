import React from 'react';
import { connect } from 'react-redux';

import { ROOT_URL, handleFetchErrors } from '../../store/actions';

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
  };

  onDashboardUpdate = json => {
    this.setState({
      name: json.name,
      widgets: json.widgets.map(w => ({
        id: w.id,
        type: w.type,
        title: w.title,
        position: w.position,
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

  render() {
    const { user } = this.props;
    const { loading } = this.state;
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
          </div>

          <PersistentFetcher resource={dashboardUrl} onUpdate={this.onDashboardUpdate} />

          {this.state.widgets.length > 0 &&
            this.state.widgets.map(widget => {
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
                      position={widget.position}
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
                      position={widget.position}
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
