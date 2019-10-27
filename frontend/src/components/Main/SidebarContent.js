import React from 'react';
import { connect } from 'react-redux';
import { Link, withRouter, Switch, Route } from 'react-router-dom';

import { havePermission } from '../../utils/fetch';
import { PersistentFetcher } from '../../utils/fetch/PersistentFetcher';
import { doLogout } from '../../store/helpers';

import Button from '../Button';
import LinkButton from '../LinkButton/LinkButton';
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
          <LinkButton className="unselect-account" title="Home" to="/">
            <i className="fa fa-home" />
          </LinkButton>
          <Button className="logout" onClick={doLogout} title="Logout">
            <i className="fa fa-sign-out" />
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

        {user && havePermission('admin/persons', 'GET', user.permissions) && (
          <Link className="button green" to="/users" onClick={onSidebarLinkClick}>
            <i className="fa fa-users" /> Users
          </Link>
        )}
        <Link className="button green" to="/changelog">
          <i className="fa fa-list" /> Changelog
        </Link>
        <Link className="button green" to="/profile" onClick={onSidebarLinkClick}>
          <i className="fa fa-user" /> Profile
        </Link>
        <div className="bottom">
          <VersionInfo />
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

        <div className="account-name">{accountName}</div>

        {user && havePermission(`accounts/${accountId}/dashboards`, 'GET', user.permissions) && (
          <Link
            className="button green"
            to={`/accounts/${accountId}/dashboards`}
            onClick={onSidebarLinkClick}
          >
            <i className="fa fa-dashboard" /> Dashboards
          </Link>
        )}
        {user && havePermission(`accounts/${accountId}/entities`, 'GET', user.permissions) && (
          <Link className="button green" to={`/accounts/${accountId}/entities`} onClick={onSidebarLinkClick}>
            <i className="fa fa-cube" /> Monitored entities
          </Link>
        )}
        {user && havePermission(`accounts/${accountId}/bots`, 'GET', user.permissions) && (
          <Link className="button green" to={`/accounts/${accountId}/bots`} onClick={onSidebarLinkClick}>
            <i className="fa fa-robot" /> Bots
          </Link>
        )}
        {user && havePermission(`accounts/${accountId}/credentials`, 'GET', user.permissions) && (
          <Link
            className="button green"
            to={`/accounts/${accountId}/credentials`}
            onClick={onSidebarLinkClick}
          >
            <i className="fa fa-key" /> Credentials
          </Link>
        )}
        {user && havePermission(`accounts/${accountId}/sensors`, 'GET', user.permissions) && (
          <Link className="button green" to={`/accounts/${accountId}/sensors`} onClick={onSidebarLinkClick}>
            <i className="fa fa-thermometer" /> Sensors
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
        <i className="fa fa-dashboard" /> Accounts
      </Link>
    );
  }
}
