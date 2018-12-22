import React from 'react';

import store from '../../store';
import { ROOT_URL, handleFetchErrors, onFailure } from '../../store/actions';

import Button from '../Button';
import Loading from '../Loading';
import WidgetForm from '../WidgetForm';
import GLeanChartWidget from '../Widgets/GLeanChartWidget';
import LastValueWidget from '../Widgets/LastValueWidget';
import { fetchAuth } from '../../utils/fetch';
import DashboardDeleteLink from '../DashboardDeleteLink';

class DashboardView extends React.Component {
  abortController = null;

  constructor(props) {
    super(props);
    this.state = {
      loading: false,
      valid: true,
      widgets: [],
      newChartFormOpened: false,
    };
  }

  componentDidMount() {
    this.fetchDashboardDetails();
  }

  componentWillUnmount() {
    if (this.abortController !== null) {
      this.abortController.abort();
    }
  }

  fetchDashboardDetails = () => {
    if (this.abortController !== null) {
      return; // fetching already in progress, abort
    }

    this.setState({
      loading: true,
    });
    this.abortController = new window.AbortController();
    fetchAuth(`${ROOT_URL}/accounts/1/dashboards/${this.props.match.params.slug}`, {
      signal: this.abortController.signal,
    })
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
          this.abortController = null;
        }),
      )
      .catch(errorMsg => {
        if (!errorMsg.name || errorMsg.name !== 'AbortError') {
          store.dispatch(onFailure(errorMsg.toString()));
          this.setState({
            valid: false,
            loading: false,
          });
          this.abortController = null;
        }
      });
  };

  handleShowNewChartForm = ev => {
    ev.preventDefault();
    this.setState({
      newChartFormOpened: true,
    });
  };

  handleHideNewChartForm = ev => {
    ev.preventDefault();
    this.setState({
      newChartFormOpened: false,
    });
  };

  render() {
    const { valid, loading } = this.state;
    const dashboardSlug = this.props.match.params.slug;

    const innerWidth = this.props.width - 2 * 21; // padding

    if (!valid) {
      if (loading) return <Loading />;
      else return <div>Could not fetch data - please try again.</div>;
    }

    return (
      <div>
        <div className="frame dashboard-info">
          Dashboard: {this.state.name}{' '}
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
                      widgetType={widget.type}
                      dashboardSlug={dashboardSlug}
                      title={widget.title}
                      content={widget.content}
                      refreshParent={this.fetchDashboardDetails}
                    />
                  );
                case 'chart':
                  return (
                    <GLeanChartWidget
                      key={widget.id}
                      width={innerWidth}
                      height={500}
                      widgetId={widget.id}
                      widgetType={widget.type}
                      dashboardSlug={dashboardSlug}
                      title={widget.title}
                      chartContent={widget.content}
                      refreshParent={this.fetchDashboardDetails}
                    />
                  );
                default:
                  return <div>Unknown widget type.</div>;
              }
            })}
          </div>
        )}

        <div className="frame">
          {!this.state.newChartFormOpened ? (
            <div>
              <Button onClick={this.handleShowNewChartForm}>+ add widget</Button>
            </div>
          ) : (
            <div>
              <Button onClick={this.handleHideNewChartForm}>- cancel</Button>
              <WidgetForm dashboardSlug={dashboardSlug} />
            </div>
          )}
        </div>
      </div>
    );
  }
}

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
