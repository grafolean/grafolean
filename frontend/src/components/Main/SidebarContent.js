import React from 'react';
import { connect } from 'react-redux';
import { Link, withRouter, Switch, Route } from 'react-router-dom';

import store from '../../store';
import { ROOT_URL, onReceiveDashboardsListSuccess, handleFetchErrors, onFailure } from '../../store/actions';
import PersistentFetcher, { havePermission, fetchAuth } from '../../utils/fetch';
import { doLogout } from '../../store/helpers';

import Button from '../Button';
import EditableLabel from '../EditableLabel';
import LinkButton from '../LinkButton/LinkButton';
import Loading from '../Loading';
import VersionInfo from './VersionInfo';
import ColorSchemeSwitch from './ColorSchemeSwitch';
import SelectAccount from './SelectAccount';

class SidebarContent extends React.Component {
  render() {
    const { sidebarDocked, onSidebarXClick, onSidebarLinkClick, user } = this.props;

    return (
      <div className="navigation">
        {!sidebarDocked ? <button onClick={onSidebarXClick}>X</button> : ''}

        <div className="back-logout-buttons">
          <LinkButton className="unselect-account" title="Home" to="/">
            <i className="fa fa-home" />
          </LinkButton>
          <Button className="logout" onClick={doLogout} title="Logout">
            <i className="fa fa-sign-out" />
          </Button>
        </div>

        <Switch>
          <Route path="/accounts/:accountId/" component={AccountSidebarContent} />
          <Route component={DefaultSidebarContent} />
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

  onDashboardsListUpdate = json => {
    store.dispatch(onReceiveDashboardsListSuccess(json));
  };

  onAccountUpdate = json => {
    this.setState({
      accountName: json.name,
    });
  };

  updateAccountName = newAccountName => {
    const accountId = this.props.match.params.accountId;
    const params = {
      name: newAccountName,
    };
    fetchAuth(`${ROOT_URL}/accounts/${accountId}`, {
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
    const { onSidebarLinkClick, dashboards, fetching, valid, user } = this.props;
    const { accountName } = this.state;

    const accountId = this.props.match.params.accountId;

    return (
      <>
        <PersistentFetcher resource={`accounts/${accountId}`} onUpdate={this.onAccountUpdate} />
        <PersistentFetcher
          resource={`accounts/${accountId}/dashboards`}
          onUpdate={this.onDashboardsListUpdate}
        />

        <div className="account-name">
          <EditableLabel
            label={accountName}
            onChange={this.updateAccountName}
            isEditable={havePermission(`accounts/${accountId}`, 'POST', user.permissions)}
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
              to={`/accounts/${accountId}/dashboards/view/${dash.slug}`}
              onClick={onSidebarLinkClick}
            >
              <i className="fa fa-dashboard" /> {dash.name}
            </Link>
          ))
        )}

        <Link
          className="button green"
          to={`/accounts/${accountId}/dashboards/new`}
          onClick={onSidebarLinkClick}
        >
          <i className="fa fa-plus" /> Add dashboard
        </Link>
        {user && havePermission(`accounts/${accountId}/bots`, 'GET', user.permissions) && (
          <Link className="button green" to={`/accounts/${accountId}/bots`} onClick={onSidebarLinkClick}>
            <i className="fa fa-robot" /> Bots
          </Link>
        )}
      </>
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
const AccountSidebarContent = connect(mapDashboardsListToProps)(_AccountSidebarContent);

class DefaultSidebarContent extends React.Component {
  render() {
    return <SelectAccount />;
  }
}
