import React from 'react';
import { connect } from 'react-redux';
import { BrowserRouter, Switch, Route, Link } from 'react-router-dom';
import Sidebar from 'react-sidebar';

import store from '../../store';
import {
  fetchBackendStatus,
  ROOT_URL,
  onReceiveDashboardsListSuccess,
  onReceiveAccountsListSuccess,
  onAccountUnselect,
  handleFetchErrors,
  onFailure,
} from '../../store/actions';
import PersistentFetcher, { havePermission, fetchAuth } from '../../utils/fetch';

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
import Persons from '../Persons/Persons';
import BotNewForm from '../BotNewForm';
import PersonNewForm from '../PersonNewForm/PersonNewForm';
import VersionInfo from './VersionInfo';
import Changelog from '../About/Changelog';
import WelcomePage from '../WelcomePage';
import UserPermissions from '../UserPermissions/UserPermissions';
import UserPermissionsNewForm from '../UserPermissionsNewForm/UserPermissionsNewForm';
import SelectAccountPage from './SelectAccountPage';
import { doLogout } from '../../store/helpers';
import EditableLabel from '../EditableLabel';

class Main extends React.Component {
  componentDidMount() {
    store.dispatch(fetchBackendStatus());
  }

  backendIsCrossOrigin() {
    const backendUrl = new URL(ROOT_URL, window.location); // if ROOT_URL is relative, use window.location as base url
    return backendUrl.origin !== window.location.origin;
  }

  handleAccountsUpdate = json => {
    store.dispatch(onReceiveAccountsListSuccess(json));
  };

  handleAccountsUpdateError = err => {
    console.err(err);
  };

  render() {
    const { backendStatus, loggedIn } = this.props;
    if (!backendStatus) {
      return <Loading overlayParent={true} message={`Trying to connect to backend at: ${ROOT_URL}`} />;
    }
    // We want to be nice and display a warning when we are reaching a backend that we do not have access to (due
    // to CORS). For this reason /api/status/info backend endpoint is accessible from anywhere, and we can check
    // if our domain is in the list of CORS allowed domains, before we even request any CORS-protected resource.
    // This of course applies only if backend really is on a different domain (which it is not, for example, if
    // backend and frontend are behind the same nginx reverse proxy).
    if (
      this.backendIsCrossOrigin() &&
      !backendStatus.cors_domains.includes(window.location.origin.toLowerCase())
    ) {
      return <CORSWarningPage />;
    }
    if (backendStatus.db_migration_needed === true) {
      return <AdminMigrateDB />;
    }
    if (backendStatus.user_exists === false) {
      return <AdminFirst />;
    }
    if (!loggedIn) {
      return <LoginPage />;
    }

    return (
      <>
        <PersistentFetcher
          resource="profile/accounts"
          onUpdate={this.handleAccountsUpdate}
          onError={this.handleAccountsUpdateError}
        />
        {!this.props.accounts.list ? (
          <Loading />
        ) : !this.props.accounts.selected ? (
          <SelectAccountPage />
        ) : (
          <LoggedInContent />
        )}
      </>
    );
  }
}
const mapBackendStatusToProps = store => ({
  backendStatus: store.backendStatus,
  loggedIn: Boolean(store.user),
  accounts: store.accounts,
});
export default connect(mapBackendStatusToProps)(Main);

class _LoggedInContent extends React.PureComponent {
  render() {
    return (
      <BrowserRouter>
        <Account />
      </BrowserRouter>
    );
  }
}
const mapAccountsToProps = store => ({
  accounts: store.accounts,
});
const LoggedInContent = connect(mapAccountsToProps)(_LoggedInContent);

// Our logged-in routes need to:
// - know about the content width that is available to them
// - be wrapped in a div with a suitable className so we can target pages with CSS selectors
const WrappedRoute = ({ component: Component, contentWidth, ...rest }) => (
  <Route
    {...rest}
    render={props => (
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
    )}
  />
);

class _SidebarContent extends React.Component {
  state = {
    accountName: this.props.accounts.selected.name,
  };

  onDashboardsListUpdate = json => {
    store.dispatch(onReceiveDashboardsListSuccess(json));
  };

  onAccountUpdate = json => {
    this.setState({
      accountName: json.name,
    });
  };

  onUnselectAccountClick = () => {
    store.dispatch(onAccountUnselect());
  };

  updateAccountName = newAccountName => {
    const { accounts } = this.props;
    const params = {
      name: newAccountName,
    };
    fetchAuth(`${ROOT_URL}/accounts/${accounts.selected.id}`, {
      headers: {
        'Content-Type': 'application/json',
      },
      method: 'PUT',
      body: JSON.stringify(params),
    })
      .then(handleFetchErrors)
      .catch(errorMsg => store.dispatch(onFailure(errorMsg.toString())));
  };

  render() {
    const {
      sidebarDocked,
      onSidebarXClick,
      onSidebarLinkClick,
      dashboards,
      fetching,
      valid,
      user,
      accounts,
    } = this.props;
    const { accountName } = this.state;
    return (
      <div className="navigation">
        <PersistentFetcher resource={`accounts/${accounts.selected.id}`} onUpdate={this.onAccountUpdate} />
        <PersistentFetcher
          resource={`accounts/${accounts.selected.id}/dashboards`}
          onUpdate={this.onDashboardsListUpdate}
        />

        {!sidebarDocked ? <button onClick={onSidebarXClick}>X</button> : ''}

        <div className="back-logout-buttons">
          <Button className="unselect-account" onClick={this.onUnselectAccountClick} title="Switch accounts">
            <i className="fa fa-arrow-up" />
          </Button>
          <Button className="logout" onClick={doLogout} title="Logout">
            <i className="fa fa-sign-out" />
          </Button>
        </div>
        <div className="account-name">
          <EditableLabel
            label={accountName}
            onChange={this.updateAccountName}
            isEditable={havePermission(`accounts/${accounts.selected.id}`, 'POST', user.permissions)}
          />
        </div>

        {fetching ? (
          <Loading />
        ) : !valid ? (
          <div>
            <i className="fa fa-exclamation-triangle" title="Error fetching dashboards" />
          </div>
        ) : (
          dashboards &&
          dashboards.map(dash => (
            <Link
              key={dash.slug}
              className="button blue"
              to={`/dashboards/view/${dash.slug}`}
              onClick={onSidebarLinkClick}
            >
              <i className="fa fa-dashboard" /> {dash.name}
            </Link>
          ))
        )}

        <Link className="button green" to="/dashboards/new" onClick={onSidebarLinkClick}>
          <i className="fa fa-plus" /> Add dashboard
        </Link>
        <div className="spacer" />
        {user && havePermission(`accounts/${accounts.selected.id}/bots`, 'GET', user.permissions) && (
          <Link className="button green" to="/settings/bots" onClick={onSidebarLinkClick}>
            <i className="fa fa-robot" /> Bots
          </Link>
        )}
        {user && havePermission('admin/persons', 'GET', user.permissions) && (
          <Link className="button green" to="/settings/users" onClick={onSidebarLinkClick}>
            <i className="fa fa-users" /> Users
          </Link>
        )}
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
  user: store.user,
  accounts: store.accounts,
});
const SidebarContent = connect(mapDashboardsListToProps)(_SidebarContent);

class Account extends React.Component {
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
            <WrappedRoute exact contentWidth={contentWidth} path="/settings/users" component={Persons} />
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
              path="/settings/users/new"
              component={PersonNewForm}
            />
            <WrappedRoute
              exact
              contentWidth={contentWidth}
              path="/settings/users/:userId/permissions"
              component={UserPermissions}
            />
            <WrappedRoute
              exact
              contentWidth={contentWidth}
              path="/settings/users/:userId/permissions/new"
              component={UserPermissionsNewForm}
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
