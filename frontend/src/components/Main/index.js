import React from 'react';
import { connect } from 'react-redux';
import { BrowserRouter, Switch, Route, Link, Redirect } from 'react-router-dom';
import Sidebar from 'react-sidebar';

import store from '../../store';
import {
  fetchBackendStatus,
  ROOT_URL,
  onReceiveDashboardsListSuccess,
  onReceiveDashboardsListFailure,
} from '../../store/actions';

import './Main.scss';
import AdminFirst from '../AdminFirst';
import AdminMigrateDB from '../AdminMigrateDB';
import Button from '../Button';
import Loading from '../Loading';
import LoginPage from '../LoginPage';
import DashboardNewForm from '../DashboardNewForm';
import DashboardView from '../DashboardView';
import Notifications from '../Notifications';
import DashboardWidgetEdit from '../DashboardWidgetEdit';
import PageNotFound from '../PageNotFound';
import Profile from '../Profile';
import CORSWarningPage from '../CORSWarningPage';
import Bots from '../Bots';
import BotNewForm from '../BotNewForm';
import VersionInfo from './VersionInfo';
import Changelog from '../About/Changelog';
import WelcomePage from '../WelcomePage';
import { Fetcher } from '../../utils/fetch';

class Main extends React.Component {
  componentDidMount() {
    store.dispatch(fetchBackendStatus());
  }
  render() {
    const { backendStatus } = this.props;
    if (!backendStatus) {
      return <Loading overlayParent={true} message={`Trying to connect to backend at: ${ROOT_URL}`} />;
    }
    if (!backendStatus.cors_domains.includes(window.location.origin.toLowerCase())) {
      return <CORSWarningPage />;
    }
    if (backendStatus.db_migration_needed === true) {
      return <AdminMigrateDB />;
    }
    if (backendStatus.user_exists === false) {
      return <AdminFirst />;
    }
    return (
      <BrowserRouter>
        <Switch>
          <Route exact path="/login" component={LoginPage} />
          <Route component={LoggedInContent} />
        </Switch>
      </BrowserRouter>
    );
  }
}
const mapBackendStatusToProps = store => ({
  backendStatus: store.backendStatus,
});
export default connect(mapBackendStatusToProps)(Main);

// Our logged-in routes need to:
// - know about users' logged-in state (from store)
// - know about the content width that is available to them
const mapLoggedInStateToProps = store => ({
  loggedIn: !!store.user,
});
const WrappedRoute = connect(mapLoggedInStateToProps)(
  ({ component: Component, loggedIn, contentWidth, ...rest }) => (
    <Route
      {...rest}
      render={props =>
        loggedIn ? (
          // We need some className that will allow us to write CSS rules for specific pages if needed. In theory
          // we could use `Component.name` here, but when we build for production, names are obfuscated
          <div
            className={`page ${rest.path
              .replace(/[^a-z0-9A-Z]+/g, ' ')
              .trim()
              .replace(/[ ]/g, '-')}`}
          >
            <Component {...props} width={contentWidth} />
          </div>
        ) : (
          <Redirect
            to={{
              pathname: '/login',
              state: { fromLocation: props.location },
            }}
          />
        )
      }
    />
  ),
);

class SidebarContentNoStore extends React.Component {
  componentDidMount() {
    this.fetchId = Fetcher.start(
      'accounts/1/dashboards',
      json => store.dispatch(onReceiveDashboardsListSuccess(json)),
      errorMsg => store.dispatch(onReceiveDashboardsListFailure(errorMsg.toString())),
    );
  }

  componentWillUnmount() {
    Fetcher.stop(this.fetchId);
  }

  render() {
    const { sidebarDocked, onSidebarXClick, onSidebarLinkClick, dashboards, fetching, valid } = this.props;
    if (fetching) {
      return <Loading />;
    }
    if (!valid) {
      return (
        <div>
          <i className="fa fa-exclamation-triangle" />
        </div>
      );
    }

    return (
      <div className="navigation">
        {!sidebarDocked ? <button onClick={onSidebarXClick}>X</button> : ''}

        {dashboards &&
          dashboards.map(dash => (
            <Link
              key={dash.slug}
              className="button blue"
              to={`/dashboards/view/${dash.slug}`}
              onClick={onSidebarLinkClick}
            >
              <i className="fa fa-dashboard" /> {dash.name}
            </Link>
          ))}
        <Link className="button green" to="/dashboards/new" onClick={onSidebarLinkClick}>
          <i className="fa fa-plus" /> Add dashboard
        </Link>
        <div className="spacer" />
        <Link className="button green" to="/settings/bots" onClick={onSidebarLinkClick}>
          <i className="fa fa-user-secret" /> Bots
        </Link>
        <Link className="button green" to="/about/changelog" onClick={onSidebarLinkClick}>
          <i className="fa fa-list" /> Changelog
        </Link>
        <Link className="button green" to="/profile" onClick={onSidebarLinkClick}>
          <i className="fa fa-user" /> Profile
        </Link>
        <VersionInfo />
      </div>
    );
  }
}
const mapDashboardsListToProps = store => ({
  dashboards: store.dashboards.list.data,
  fetching: store.dashboards.list.fetching,
  valid: store.dashboards.list.valid,
});
const SidebarContent = connect(mapDashboardsListToProps)(SidebarContentNoStore);

class LoggedInContent extends React.Component {
  CONTENT_PADDING_LR = 20;
  SCROLLBAR_WIDTH = 20; // contrary to Internet wisdom, it seems that window.innerWidth and document.body.clientWidth returns width of whole window with scrollbars too... this is a (temporary?) workaround.
  SIDEBAR_MAX_WIDTH = 250;
  state = {
    sidebarDocked: false,
    sidebarOpen: false,
    windowWidth: 0,
    windowHeight: 0,
  };
  mql = window.matchMedia(`(min-width: 800px)`);

  componentWillMount() {
    this.mql.addListener(this.mediaQueryChanged);
    this.setState({ sidebarDocked: this.mql.matches });
  }

  componentDidMount() {
    this.updateWindowDimensions();
    window.addEventListener('resize', this.updateWindowDimensions);
  }

  componentWillUnmount() {
    this.mql.removeListener(this.mediaQueryChanged);
    window.removeEventListener('resize', this.updateWindowDimensions);
  }

  updateWindowDimensions = () => {
    this.setState({
      windowWidth: window.innerWidth,
      windowHeight: window.innerHeight,
    });
  };

  mediaQueryChanged = () => {
    this.setState({ sidebarDocked: this.mql.matches });
  };

  onBurgerClick = event => {
    this.setState({ sidebarOpen: true });
    event.preventDefault();
  };

  onSidebarXClick = event => {
    this.setState({ sidebarOpen: false });
    event.preventDefault();
  };

  onSidebarLinkClick = event => {
    this.setState({ sidebarOpen: false });
    // follow up the link (don't do event.preventDefault())
  };

  onSetSidebarOpen = open => {
    this.setState({ sidebarOpen: open });
  };

  render() {
    const { sidebarDocked, sidebarOpen, windowWidth } = this.state;
    const innerWindowWidth = windowWidth - 2 * this.CONTENT_PADDING_LR - this.SCROLLBAR_WIDTH;
    const sidebarWidth = Math.min(this.SIDEBAR_MAX_WIDTH, windowWidth - 40); // always leave a bit of place (40px) to the right of menu
    const contentWidth = innerWindowWidth - sidebarWidth;

    return (
      <Sidebar
        sidebar={
          <SidebarContent
            sidebarDocked={sidebarDocked}
            onSidebarXClick={this.onSidebarXClick}
            onSidebarLinkClick={this.onSidebarLinkClick}
          />
        }
        open={sidebarOpen}
        docked={sidebarDocked}
        onSetOpen={this.onSetSidebarOpen}
        shadow={false}
        styles={{
          sidebar: {
            backgroundColor: '#f5f5f5',
            width: sidebarWidth,
            borderRight: '1px solid #e3e3e3',
          },
          content: {
            backgroundColor: '#fafafa',
            display: 'flex',
            flexDirection: 'column',
          },
        }}
      >
        {!sidebarDocked && <Button onClick={this.onBurgerClick}>burger</Button>}

        <Notifications />

        <div className="content centered">
          <Switch>
            <WrappedRoute exact contentWidth={contentWidth} path="/" component={WelcomePage} />
            <WrappedRoute exact contentWidth={contentWidth} path="/profile" component={Profile} />
            <WrappedRoute exact contentWidth={contentWidth} path="/settings/bots" component={Bots} />
            <WrappedRoute exact contentWidth={contentWidth} path="/about/changelog" component={Changelog} />
            <WrappedRoute
              exact
              contentWidth={contentWidth}
              path="/settings/bots/new"
              component={BotNewForm}
            />

            <WrappedRoute
              exact
              contentWidth={contentWidth}
              path="/dashboards/new"
              component={DashboardNewForm}
            />
            <WrappedRoute
              exact
              contentWidth={contentWidth}
              path="/dashboards/view/:slug"
              component={DashboardView}
            />
            <WrappedRoute
              exact
              contentWidth={contentWidth}
              path="/dashboards/view/:slug/widget/:widgetId/edit"
              component={DashboardWidgetEdit}
            />

            <WrappedRoute contentWidth={contentWidth} component={PageNotFound} />
          </Switch>
        </div>
      </Sidebar>
    );
  }
}
