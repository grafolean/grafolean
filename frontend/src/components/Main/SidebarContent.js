import React from 'react';
import { connect } from 'react-redux';
import { Link, withRouter, Switch, Route } from 'react-router-dom';

import { havePermission } from '../../utils/fetch';
import { PersistentFetcher } from '../../utils/fetch/PersistentFetcher';
import { doLogout } from '../../store/helpers';
import { ROOT_URL } from '../../store/actions';

import Button from '../Button';
import VersionInfo from './VersionInfo';
import ColorSchemeSwitch from './ColorSchemeSwitch';

class PassPropsRoute extends React.Component {
  render() {
    const { component: Component, computedMatch, location, ...rest } = this.props;
    return <Route {...rest} render={props => <Component {...props} {...rest} />} />;
  }
}

class SidebarContent extends React.Component {
  render() {
    const { onSidebarLinkClick, user } = this.props;

    return (
      <div className="navigation">
        <div className="back-logout-buttons">
          <Button className="logout" onClick={doLogout} title="Logout">
            <i className="fa fa-power-off" />
          </Button>
        </div>

        <Switch>
          <PassPropsRoute
            path="/accounts/:accountId/"
            component={AccountSidebarContent}
            onSidebarLinkClick={onSidebarLinkClick}
          />
          <PassPropsRoute component={DefaultSidebarContent} onSidebarLinkClick={onSidebarLinkClick} />
        </Switch>

        <div className="spacer" />

        {user && havePermission('bots', 'GET', user.permissions) && (
          <Link className="button green" to="/bots" onClick={onSidebarLinkClick}>
            <i className="fa fa-fw fa-robot" /> Systemwide Bots
          </Link>
        )}
        {user && havePermission('persons', 'GET', user.permissions) && (
          <Link className="button green" to="/users" onClick={onSidebarLinkClick}>
            <i className="fa fa-fw fa-users" /> Users
          </Link>
        )}
        {user && havePermission('plugins/widgets', 'POST', user.permissions) && (
          <Link className="button green" to="/plugins/widgets" onClick={onSidebarLinkClick}>
            <i className="fa fa-fw fa-puzzle-piece" /> Widget Plugins
          </Link>
        )}
        <Link className="button green" to="/changelog">
          <i className="fa fa-fw fa-list" /> Changelog
        </Link>
        <Link className="button green" to="/profile" onClick={onSidebarLinkClick}>
          <i className="fa fa-fw fa-user" /> Profile
        </Link>
        <div className="bottom">
          <VersionInfo />
          <div className="api-doc">
            <a
              className="api-doc"
              href={`${ROOT_URL}/docs`}
              target="_blank"
              rel="external nofollow noopener noreferrer"
            >
              API docs
            </a>{' '}
            /{' '}
            <a
              className="api-doc"
              href={`${ROOT_URL}/redoc`}
              target="_blank"
              rel="external nofollow noopener noreferrer"
            >
              redoc
            </a>
          </div>
          <ColorSchemeSwitch />
        </div>
      </div>
    );
  }
}
const mapUserToProps = store => ({
  user: store.user,
});
export default withRouter(connect(mapUserToProps)(SidebarContent));

class _AccountSidebarContent extends React.Component {
  state = {
    accountName: this.props.accountName,
  };

  onAccountUpdate = json => {
    this.setState({
      accountName: json.name,
    });
  };

  render() {
    const { onSidebarLinkClick, user } = this.props;
    const { accountName } = this.state;

    const accountId = this.props.match.params.accountId;

    return (
      <>
        <PersistentFetcher resource={`accounts/${accountId}`} onUpdate={this.onAccountUpdate} />

        <Link className="account-name" to={`/accounts/${accountId}`} onClick={onSidebarLinkClick}>
          {accountName}
        </Link>

        {user && havePermission(`accounts/${accountId}/dashboards`, 'GET', user.permissions) && (
          <Link
            className="button green"
            to={`/accounts/${accountId}/dashboards`}
            onClick={onSidebarLinkClick}
          >
            <i className="fa fa-fw fa-bar-chart" /> Dashboards
          </Link>
        )}

        {user && havePermission(`accounts/${accountId}/entities`, 'GET', user.permissions) && (
          <Link
            className="button green space-before"
            to={`/accounts/${accountId}/entities`}
            onClick={onSidebarLinkClick}
          >
            <i className="fa fa-fw fa-cube" /> Monitored entities
          </Link>
        )}
        {user && havePermission(`accounts/${accountId}/bots`, 'GET', user.permissions) && (
          <Link className="button green" to={`/accounts/${accountId}/bots`} onClick={onSidebarLinkClick}>
            <i className="fa fa-fw fa-robot" /> Bots
          </Link>
        )}
        {user && havePermission(`accounts/${accountId}/credentials`, 'GET', user.permissions) && (
          <Link
            className="button green"
            to={`/accounts/${accountId}/credentials`}
            onClick={onSidebarLinkClick}
          >
            <i className="fa fa-fw fa-network-wired" /> Credentials
          </Link>
        )}
        {user && havePermission(`accounts/${accountId}/sensors`, 'GET', user.permissions) && (
          <Link className="button green" to={`/accounts/${accountId}/sensors`} onClick={onSidebarLinkClick}>
            <i className="fa fa-fw fa-thermometer" /> Sensors
          </Link>
        )}
      </>
    );
  }
}
const AccountSidebarContent = connect(mapUserToProps)(_AccountSidebarContent);

class DefaultSidebarContent extends React.Component {
  render() {
    const { onSidebarLinkClick } = this.props;
    return (
      <Link className="button green" to="/" onClick={onSidebarLinkClick}>
        <i className="fa fa-fw fa-user-circle" /> Accounts
      </Link>
    );
  }
}
