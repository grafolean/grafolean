import React from 'react';
import { connect } from 'react-redux';
import { BrowserRouter, Switch, Route, Link, Redirect } from 'react-router-dom';
import Sidebar from 'react-sidebar';

import './Main.scss';
import Button from '../Button';
import LoginPage from '../LoginPage';
import DashboardNewForm from '../DashboardNewForm';
import DashboardsList from '../DashboardsList';
import DashboardView from '../DashboardView';
import Notifications from '../Notifications';
import DashboardWidgetEdit from '../DashboardWidgetEdit';
import AdminFirst from '../AdminFirst';
import PageNotFound from '../PageNotFound';
import User from '../User';

export default class Main extends React.Component {
  render() {
    return (
      <BrowserRouter>
        <Switch>
          <Route exact path="/login" component={LoginPage} />
          <Route exact component={LoggedInContent} />
        </Switch>
      </BrowserRouter>
    );
  }
}

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
          <Component {...props} width={contentWidth} />
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

const SidebarContentWithoutDashboards = ({ sidebarDocked, onSidebarXClick, onSidebarLinkClick, dashboards }) => (
  <div className="navigation">
    {!sidebarDocked ? <button onClick={onSidebarXClick}>X</button> : ''}

    <Link className="button action" to="/dashboards" onClick={onSidebarLinkClick}>
      Dashboards
    </Link>
    {dashboards && dashboards.map(dash => (
      <Link key={dash.slug} className="button action" to={`/dashboards/view/${dash.slug}`} onClick={onSidebarLinkClick}>
        {dash.name}
      </Link>
    ))}
    <Link className="button action" to="/user" onClick={onSidebarLinkClick}>
      User
    </Link>

  </div>
);
const mapDashboardsListToProps = store => ({
  dashboards: store.dashboards.list.data,
});
const SidebarContent = connect(mapDashboardsListToProps)(SidebarContentWithoutDashboards);

class LoggedInContent extends React.Component {
  CONTENT_PADDING_LR = 30;
  SCROLLBAR_WIDTH = 20; // contrary to Internet wisdom, it seems that window.innerWidth and document.body.clientWidth returns width of whole window with scrollbars too... this is a (temporary?) workaround.
  SIDEBAR_MAX_WIDTH = 250;
  state = {
    sidebarDocked: false,
    sidebarOpen: false,
    windowWidth: 0,
    windowHeight: 0,
  };
  mql = window.matchMedia(`(min-width: 800px)`);

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

  render() {
    const { sidebarDocked, sidebarOpen, windowWidth } = this.state;
    const innerWindowWidth = windowWidth - 2 * this.CONTENT_PADDING_LR - this.SCROLLBAR_WIDTH;
    const sidebarWidth = Math.min(this.SIDEBAR_MAX_WIDTH, windowWidth - 40); // always leave a bit of place (40px) to the right of menu
    const contentWidth = sidebarDocked ? innerWindowWidth - sidebarWidth : innerWindowWidth;

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
            backgroundColor: '#f3f3f3',
            width: sidebarWidth,
            borderRight: '1px solid #d8d8d8',
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
            <WrappedRoute
              exact
              contentWidth={contentWidth}
              path="/admin/first"
              component={AdminFirst}
            />
            <WrappedRoute exact contentWidth={contentWidth} path="/user" component={User} />

            <WrappedRoute exact contentWidth={contentWidth} path="/dashboards" component={DashboardsList} />
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
