import React from 'react';
import { connect } from 'react-redux';
import { withRouter } from 'react-router-dom';
import Sidebar from 'react-sidebar';

import store from '../../store';
import { fetchBackendStatus, ROOT_URL, setColorScheme } from '../../store/actions';

import AdminFirst from '../AdminFirst';
import AdminMigrateDB from '../AdminMigrateDB';
import Button from '../Button';
import CORSWarningPage from '../CORSWarningPage';
import Loading from '../Loading';
import LoginPage from '../LoginPage';
import Notifications from '../Notifications';
import SidebarContent from './SidebarContent';
import Content from './Content';

import './Main.scss';

class Main extends React.Component {
  CONTENT_PADDING_LR = 20;
  SCROLLBAR_WIDTH = 20; // contrary to Internet wisdom, it seems that window.innerWidth and document.body.clientWidth returns width of whole window with scrollbars too... this is a (temporary?) workaround.
  SIDEBAR_MAX_WIDTH = 250;
  state = {
    sidebarDocked: false,
    sidebarOpen: false,
    windowWidth: 0,
    windowHeight: 0,
  };
  mqlWidthOver800px = window.matchMedia('(min-width: 800px)');
  mqlPrefersDarkMode = window.matchMedia('(prefers-color-scheme: dark)');

  componentDidMount() {
    this.mqlWidthOver800px.addListener(this.mqlWidthOver800pxChanged);
    this.mqlWidthOver800pxChanged();

    this.mqlPrefersDarkMode.addListener(this.mqlPrefersDarkModeChanged);
    this.mqlPrefersDarkModeChanged();

    this.updateWindowDimensions();
    window.addEventListener('resize', this.updateWindowDimensions);
    store.dispatch(fetchBackendStatus());
  }

  componentWillUnmount() {
    this.mqlWidthOver800px.removeListener(this.mqlWidthOver800pxChanged);
    window.removeEventListener('resize', this.updateWindowDimensions);
  }

  updateWindowDimensions = () => {
    this.setState({
      windowWidth: window.innerWidth,
      windowHeight: window.innerHeight,
    });
  };

  mqlWidthOver800pxChanged = () => {
    this.setState({ sidebarDocked: this.mqlWidthOver800px.matches });
  };
  mqlPrefersDarkModeChanged = () => {
    store.dispatch(setColorScheme(this.mqlPrefersDarkMode.matches ? 'dark' : 'light'));
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

  backendIsCrossOrigin() {
    const backendUrl = new URL(ROOT_URL, window.location); // if ROOT_URL is relative, use window.location as base url
    return backendUrl.origin !== window.location.origin;
  }

  render() {
    const { backendStatus, loggedIn } = this.props;

    // When we enter the main part of the page, we need to check a set of conditions that should be met:
    // (like having connection to backend, being logged in and similar)

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

    const { sidebarDocked, sidebarOpen, windowWidth } = this.state;
    const { isDarkMode } = this.props;
    const sidebarWidth = Math.min(this.SIDEBAR_MAX_WIDTH, windowWidth - 40); // always leave a bit of place (40px) to the right of menu

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
        rootClassName={isDarkMode ? 'dark-mode' : ''}
        styles={{
          sidebar: {
            backgroundColor: isDarkMode ? '#202020' : '#f5f5f5',
            width: sidebarWidth,
            borderRight: `1px solid ${isDarkMode ? '#151515' : '#e3e3e3'}`,
          },
          content: {
            backgroundColor: isDarkMode ? '#131313' : '#fafafa',
            display: 'flex',
            flexDirection: 'column',
          },
        }}
      >
        {!sidebarDocked && <Button onClick={this.onBurgerClick}>burger</Button>}

        <Notifications />

        <Content windowWidth={windowWidth} />
      </Sidebar>
    );
  }
}
const mapBackendStatusToProps = store => ({
  backendStatus: store.backendStatus,
  loggedIn: Boolean(store.user),
  isDarkMode: store.preferences.colorScheme === 'dark',
});
// withRouter is needed to force re-rendering of this component when URL changes:
export default withRouter(connect(mapBackendStatusToProps)(Main));
