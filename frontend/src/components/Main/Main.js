import React from 'react';
import { connect } from 'react-redux';
import Sidebar from 'react-sidebar';

import store from '../../store';
import { fetchBackendStatus, ROOT_URL } from '../../store/actions';

import AdminFirst from '../AdminFirst';
import AdminMigrateDB from '../AdminMigrateDB';
import Button from '../Button';
import CORSWarningPage from '../WarningPages/CORSWarningPage';
import HostnameWarningPage from '../WarningPages/HostnameWarningPage';
import Loading from '../Loading';
import LoginPage from '../LoginPage';
import Notifications from '../Notifications';
import SidebarContent from './SidebarContent';
import Content from './Content';
import Breadcrumbs from '../Breadcrumbs/Breadcrumbs';

import './Main.scss';

class Main extends React.Component {
  CONTENT_PADDING_LR = 20;
  SCROLLBAR_WIDTH = 20; // contrary to Internet wisdom, it seems that window.innerWidth and document.body.clientWidth returns width of whole window with scrollbars too... this is a (temporary?) workaround.
  SIDEBAR_MAX_WIDTH = 250;
  state = {
    widthAllowsDocking: false,
    sidebarOpen: false,
    windowWidth: 0,
    windowHeight: 0,
  };
  mqlWidthOver800px = window.matchMedia('(min-width: 800px)');

  componentDidMount() {
    this.mqlWidthOver800px.addListener(this.mqlWidthOver800pxChanged);
    this.mqlWidthOver800pxChanged();

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
    this.setState({ widthAllowsDocking: this.mqlWidthOver800px.matches });
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
    // backend and frontend are behind the same nginx reverse proxy) - so this can't happen in default install.
    if (
      this.backendIsCrossOrigin() &&
      !backendStatus.cors_domains.includes(window.location.origin.toLowerCase())
    ) {
      return <CORSWarningPage />;
    }
    // If user has misconfigured "EXTERNAL_HOSTNAME" setting, we can detect this by comparing it to the domain in
    // URL. Otherwise MQTT connection would fail and user would be immediately logged out.
    if (backendStatus.mqtt_ws_hostname !== window.location.hostname) {
      return <HostnameWarningPage />;
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

    const { widthAllowsDocking, sidebarOpen, windowWidth } = this.state;
    const { isDarkMode, fullscreenDibs } = this.props;
    const innerWindowWidth = windowWidth - 2 * this.CONTENT_PADDING_LR - this.SCROLLBAR_WIDTH;
    const sidebarWidth = Math.min(this.SIDEBAR_MAX_WIDTH, windowWidth - 40); // always leave a bit of place (40px) to the right of menu
    const sidebarDocked = widthAllowsDocking && !fullscreenDibs;
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
        rootClassName={`${isDarkMode ? 'dark-mode with-bg-image' : ''} ${
          fullscreenDibs ? 'fullscreen-dibs' : ''
        }`}
        contentClassName={'content-root'}
        styles={{
          sidebar: {
            backgroundColor: isDarkMode ? '#202020' : '#f5f5f5',
            width: sidebarWidth,
            borderRight: `1px solid ${isDarkMode ? '#151515' : '#e3e3e3'}`,
            zIndex: 88008800,
            opacity: 0.95,
          },
          content: {
            display: 'flex',
            flexDirection: 'column',
          },
          overlay: {
            zIndex: 88008800 - 1,
          },
        }}
      >
        {!sidebarDocked && (
          <Button className="burger" onClick={this.onBurgerClick}>
            <i className="fa fa-bars" />
          </Button>
        )}

        <Breadcrumbs />

        <Notifications />

        <Content contentWidth={contentWidth} />
      </Sidebar>
    );
  }
}
const mapBackendStatusToProps = store => ({
  backendStatus: store.backendStatus,
  loggedIn: Boolean(store.user),
  isDarkMode: store.preferences.colorScheme === 'dark',
  fullscreenDibs: store.fullscreenDibs,
});
export default connect(mapBackendStatusToProps)(Main);
