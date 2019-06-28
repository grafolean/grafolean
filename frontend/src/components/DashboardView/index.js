import React from 'react';
import { connect } from 'react-redux';

import store from '../../store';
import { ROOT_URL, handleFetchErrors, onFailure } from '../../store/actions';

import Button from '../Button';
import EditableLabel from '../EditableLabel';
import Loading from '../Loading';
import WidgetForm from '../WidgetForm';
import GLeanChartWidget from '../Widgets/GLeanChartWidget';
import LastValueWidget from '../Widgets/LastValueWidget/LastValueWidget';
import { fetchAuth, havePermission } from '../../utils/fetch';
import DashboardDeleteLink from '../DashboardDeleteLink';

class _DashboardView extends React.Component {
  state = {
    loading: false,
    valid: true,
    name: '',
    widgets: [],
    newWidgetFormOpened: false,
  };
  abortController = new window.AbortController();

  componentDidMount() {
    this.fetchDashboardDetails();
  }

  componentWillUnmount() {
    this.abortController.abort();
  }

  fetchDashboardDetails = () => {
    if (this.state.loading) {
      return; // fetching already in progress, abort
    }

    this.setState({
      loading: true,
    });
    fetchAuth(
      `${ROOT_URL}/accounts/${this.props.match.params.accountId}/dashboards/${this.props.match.params.slug}`,
      {
        signal: this.abortController.signal,
      },
    )
      .then(handleFetchErrors)
      .then(response =>
        response.json().then(json => {
          this.setState({
            name: json.name,
            widgets: json.widgets.map(w => ({
              id: w.id,
              type: w.type,
              title: w.title,
              content: JSON.parse(w.content),
            })),
            valid: true,
            loading: false,
          });
        }),
      )
      .catch(errorMsg => {
        if (errorMsg.name && errorMsg.name === 'AbortError') {
          return;
        }
        store.dispatch(onFailure(errorMsg.toString()));
        this.setState({
          valid: false,
          loading: false,
        });
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
    this.fetchDashboardDetails();
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
    const { valid, loading } = this.state;
    const dashboardSlug = this.props.match.params.slug;
    const accountId = this.props.match.params.accountId;

    const innerWidth = this.props.width - 2 * 21; // padding

    if (!valid) {
      if (loading) return <Loading />;
      else return <div>Could not fetch data - please try again.</div>;
    }

    return (
      <div>
        <div className="frame dashboard-info">
          <span>
            Dashboard: <EditableLabel label={this.state.name} onChange={this.setDashboardName} />
          </span>
          {loading ? <Loading overlayParent={true} /> : <DashboardDeleteLink slug={dashboardSlug} />}
        </div>

        {this.state.widgets.length > 0 && (
          <div className="frame">
            {this.state.widgets.map(widget => {
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
                      onWidgetDelete={this.fetchDashboardDetails}
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
                      onWidgetDelete={this.fetchDashboardDetails}
                    />
                  );
                default:
                  return <div>Unknown widget type.</div>;
              }
            })}
          </div>
        )}

        {havePermission(`accounts/${accountId}/dashboards/${dashboardSlug}`, 'POST', user.permissions) && (
          <div className="frame">
            {!this.state.newWidgetFormOpened ? (
              <div>
                <Button onClick={this.handleShowNewWidgetForm}>
                  <i className="fa fa-plus" /> add widget
                </Button>
              </div>
            ) : (
              <div>
                <Button onClick={this.handleHideNewWidgetForm}>
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
