import React from 'react';
import { Route } from 'react-router-dom';

import BreadcrumbItem from './BreadcrumbItem';
import FetchedLabelBreadcrumbItem from './FetchedLabelBreadcrumbItem';

import './Breadcrumbs.scss';

class Breadcrumbs extends React.Component {
  render() {
    /*
      Route components match each part of the URL and return a BreadcrumbItem for it. The order is important,
      as is the fact that there is no Switch component (with Switch, only one of the Routes would match).
    */
    return (
      <div className="breadcrumbs">
        <Route
          path="/"
          render={props => (
            <BreadcrumbItem separator={false} label={<i className="fa fa-home" />} match={props.match} />
          )}
        />
        <Route
          path="/changelog"
          component={props => <BreadcrumbItem label="Changelog" match={props.match} />}
        />
        <Route path="/profile" component={props => <BreadcrumbItem label="Profile" match={props.match} />} />
        <Route
          path="/profile/change-password"
          component={props => <BreadcrumbItem label="Change password" match={props.match} />}
        />

        <Route
          path="/bots"
          render={props => <BreadcrumbItem label="Systemwide bots" match={props.match} />}
        />
        <Route
          path="/bots/:userId"
          render={props => (
            <FetchedLabelBreadcrumbItem
              recordId={props.match.params.userId}
              resource={`users/${props.match.params.userId}`}
              match={props.match}
              link={false}
            />
          )}
        />
        <Route
          path="/bots/:userId/permissions"
          render={props => <BreadcrumbItem label="Permissions" match={props.match} />}
        />
        <Route
          path="/bots/:userId/permissions/new"
          render={props => <BreadcrumbItem label="New" match={props.match} />}
        />

        <Route path="/users" render={props => <BreadcrumbItem label="Users" match={props.match} />} />
        <Route
          path="/users-new"
          render={props => <BreadcrumbItem label="Add new user" match={props.match} />}
        />
        <Route
          path="/users/:userId"
          render={props => (
            <FetchedLabelBreadcrumbItem
              recordId={props.match.params.userId}
              resource={`users/${props.match.params.userId}`}
              match={props.match}
              link={false}
            />
          )}
        />
        <Route
          path="/users/:userId/permissions"
          render={props => <BreadcrumbItem label="Permissions" match={props.match} />}
        />
        <Route
          path="/users/:userId/permissions/new"
          render={props => <BreadcrumbItem label="New" match={props.match} />}
        />

        <Route
          path="/accounts-new/"
          render={props => <BreadcrumbItem label="Add new account" match={props.match} />}
        />
        <Route
          path="/accounts/:accountId"
          render={props => (
            <FetchedLabelBreadcrumbItem
              recordId={props.match.params.accountId}
              resource={`accounts/${props.match.params.accountId}`}
              match={props.match}
            />
          )}
        />
        <Route
          path="/accounts/:accountId/bots"
          render={props => <BreadcrumbItem label="Bots" match={props.match} />}
        />
        <Route
          path="/accounts/:accountId/bots-new"
          render={props => <BreadcrumbItem label="Add new bot" match={props.match} />}
        />
        <Route
          path="/accounts/:accountId/bots/:botId/view"
          render={props => (
            <FetchedLabelBreadcrumbItem
              recordId={props.match.params.botId}
              resource={`accounts/${props.match.params.accountId}/bots/${props.match.params.botId}`}
              match={props.match}
            />
          )}
        />
        <Route
          path="/accounts/:accountId/entities"
          render={props => <BreadcrumbItem label="Entities" match={props.match} />}
        />
        <Route
          path="/accounts/:accountId/entities/new"
          render={props => <BreadcrumbItem label="Add monitored entity" match={props.match} />}
        />
        <Route
          path="/accounts/:accountId/entities/edit/:entityId"
          render={props => <BreadcrumbItem label="Edit monitored entity" match={props.match} />}
        />
        <Route
          path="/accounts/:accountId/entities/view/:entityId"
          render={props => (
            <FetchedLabelBreadcrumbItem
              recordId={props.match.params.entityId}
              resource={`accounts/${props.match.params.accountId}/entities/${props.match.params.entityId}`}
              match={props.match}
            />
          )}
        />
        <Route
          path="/accounts/:accountId/entities/view/:entityId/protocols"
          render={props => <BreadcrumbItem label="Settings" match={props.match} />}
        />
        <Route
          path="/accounts/:accountId/credentials"
          render={props => <BreadcrumbItem label="Credentials" match={props.match} />}
        />
        <Route
          path="/accounts/:accountId/credentials/new"
          render={props => <BreadcrumbItem label="Add new credential" match={props.match} />}
        />
        <Route
          path="/accounts/:accountId/credentials/edit/:credentialId"
          render={props => <BreadcrumbItem label="Edit credential" match={props.match} />}
        />
        <Route
          path="/accounts/:accountId/sensors"
          render={props => <BreadcrumbItem label="Sensors" match={props.match} />}
        />
        <Route
          path="/accounts/:accountId/sensors/new"
          render={props => <BreadcrumbItem label="Add new sensor" match={props.match} />}
        />
        <Route
          path="/accounts/:accountId/sensors/edit/:sensorId"
          render={props => <BreadcrumbItem label="Edit sensor" match={props.match} />}
        />

        <Route
          path="/accounts/:accountId/dashboards"
          render={props => <BreadcrumbItem label="Dashboards" match={props.match} />}
        />
        <Route
          path="/accounts/:accountId/dashboards/new"
          render={props => <BreadcrumbItem label="Add new dashboard" match={props.match} />}
        />
        <Route
          path="/accounts/:accountId/dashboards/view/:slug"
          render={props => (
            <FetchedLabelBreadcrumbItem
              resource={`accounts/${props.match.params.accountId}/dashboards/${props.match.params.slug}`}
              match={props.match}
            />
          )}
        />
        <Route
          path="/accounts/:accountId/dashboards/view/:slug/widget/:widgetId/edit"
          render={props => <BreadcrumbItem label="Edit widget" match={props.match} />}
        />
      </div>
    );
  }
}

export default Breadcrumbs;
