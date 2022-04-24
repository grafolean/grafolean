import React from 'react';
import { connect } from 'react-redux';
import Sidebar from 'react-sidebar';

import store from '../../store';
import { setPersonData } from '../../store/actions';
import { PersistentFetcher } from '../../utils/fetch/PersistentFetcher';
import Button from '../Button';
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

  handlePersonUpdate = json => {
    store.dispatch(setPersonData(json));
  };

  render() {
    const { widthAllowsDocking, sidebarOpen, windowWidth } = this.state;
    const { isDarkMode, fullscreenDibs, user } = this.props;

    const innerWindowWidth = windowWidth - 2 * this.CONTENT_PADDING_LR - this.SCROLLBAR_WIDTH;
    const sidebarWidth = Math.min(this.SIDEBAR_MAX_WIDTH, windowWidth - 40); // always leave a bit of place (40px) to the right of menu
    const sidebarDocked = widthAllowsDocking && !fullscreenDibs;
    const contentWidth = sidebarDocked ? innerWindowWidth - sidebarWidth : innerWindowWidth;

    const loggedIn = Boolean(user);
    if (!loggedIn) {
      return <LoginPage />;
    }

    return (
      <>
        <PersistentFetcher resource={`persons/${user.user_id}`} onUpdate={this.handlePersonUpdate} />
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
      </>
    );
  }
}
const mapBackendStatusToProps = store => ({
  user: store.user,
  isDarkMode: store.preferences.colorScheme === 'dark',
  fullscreenDibs: store.fullscreenDibs,
});
export default connect(mapBackendStatusToProps)(Main);
