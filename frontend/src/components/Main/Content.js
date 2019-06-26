import React from 'react';
import { Switch, Route, withRouter } from 'react-router-dom';

import BotNewForm from '../BotNewForm';
import Bots from '../Bots';
import Changelog from '../About/Changelog';
import DashboardNewForm from '../DashboardNewForm';
import DashboardWidgetEdit from '../DashboardWidgetEdit';
import DashboardView from '../DashboardView';
import PageNotFound from '../PageNotFound';
import PersonNewForm from '../PersonNewForm/PersonNewForm';
import Persons from '../Persons/Persons';
import Profile from '../Profile';
import UserPermissions from '../UserPermissions/UserPermissions';
import UserPermissionsNewForm from '../UserPermissionsNewForm/UserPermissionsNewForm';
import WelcomePage from '../WelcomePage';

// Our logged-in routes need to:
// - know about the content width that is available to them
// - be wrapped in a div with a suitable className so we can target pages with CSS selectors
class WrappedRoute extends React.Component {
  render() {
    const { component: Component, contentWidth, ...rest } = this.props;
    return (
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
  }
}

class Content extends React.PureComponent {
  render() {
    const { windowWidth } = this.props;
    const innerWindowWidth = windowWidth - 2 * this.CONTENT_PADDING_LR - this.SCROLLBAR_WIDTH;
    const sidebarWidth = Math.min(this.SIDEBAR_MAX_WIDTH, windowWidth - 40); // always leave a bit of place (40px) to the right of menu
    const contentWidth = innerWindowWidth - sidebarWidth;

    return (
      <div className="content centered">
        <Switch>
          <WrappedRoute
            exact
            contentWidth={contentWidth}
            path="/accounts/:accountId/"
            component={WelcomePage}
          />
          <WrappedRoute
            exact
            contentWidth={contentWidth}
            path="/accounts/:accountId/settings/bots"
            component={Bots}
          />
          <WrappedRoute exact contentWidth={contentWidth} path="/users" component={Persons} />
          <WrappedRoute exact contentWidth={contentWidth} path="/changelog" component={Changelog} />
          <WrappedRoute exact contentWidth={contentWidth} path="/profile" component={Profile} />
          <WrappedRoute
            exact
            contentWidth={contentWidth}
            path="/accounts/:accountId/settings/bots/new"
            component={BotNewForm}
          />
          <WrappedRoute exact contentWidth={contentWidth} path="/users/new" component={PersonNewForm} />
          <WrappedRoute
            exact
            contentWidth={contentWidth}
            path="/users/:userId/permissions"
            component={UserPermissions}
          />
          <WrappedRoute
            exact
            contentWidth={contentWidth}
            path="/users/:userId/permissions/new"
            component={UserPermissionsNewForm}
          />

          <WrappedRoute
            exact
            contentWidth={contentWidth}
            path="/accounts/:accountId/dashboards/new"
            component={DashboardNewForm}
          />
          <WrappedRoute
            exact
            contentWidth={contentWidth}
            path="/accounts/:accountId/dashboards/view/:slug"
            component={DashboardView}
          />
          <WrappedRoute
            exact
            contentWidth={contentWidth}
            path="/accounts/:accountId/dashboards/view/:slug/widget/:widgetId/edit"
            component={DashboardWidgetEdit}
          />

          <Route component={PageNotFound} />
        </Switch>
      </div>
    );
  }
}

export default withRouter(Content);
