import React, { Component } from 'react';
import { connect } from 'react-redux';
import { Switch, Route, Link, Redirect } from 'react-router-dom';
import Sidebar from 'react-sidebar';
import styled from 'styled-components';

import './Main.css';
// import Chart from '../Chart'
import Button from '../Button'
import Home from '../Home'
import About from '../About'
import Login from '../Login'
import DashboardsListContainer from '../../containers/DashboardsListContainer'
import DashboardViewContainer from '../../containers/DashboardViewContainer'
import DashboardNewFormContainer from '../../containers/DashboardNewFormContainer'
import NotificationsContainer from '../../containers/NotificationsContainer'
import DashboardWidgetEdit from '../DashboardWidgetEdit';
import AdminFirst from '../AdminFirst';
import PageNotFound from '../PageNotFound';

const Navigation = styled.div`
  padding: 40px 40px;
  text-align: left;
`

const Header = styled.header`
  background-color: #eeffee;
  padding: 20px;
`

const Content = styled.div`
  background-color: #ffffff;
`

// Our routes need to:
// - know about users' logged-in state (from store)
// - know if they are publicly available or they need to redirect to login
// - know about the content width that is available to them
const mapLoggedInStateToProps = store => ({
  loggedIn: !!store.user,
});
const WrappedRoute = connect(mapLoggedInStateToProps)(
  ({ component: Component, isPublic, loggedIn, contentWidth, ...rest }) => (
  <Route
    {...rest}
    render={ props => (
      isPublic === true || loggedIn
      ? <Component
          {...props}
          width={contentWidth}
        />
      : <Redirect to={{
          pathname: '/login',
          state: { fromLocation: props.location }
        }} />
    )}
  />)
);

const SidebarContent = ({ sidebarDocked, onSidebarXClick, onSidebarLinkClick }) => (
  <Navigation>
    {(!sidebarDocked)?(
      <Button onClick={onSidebarXClick}>X</Button>
    ):('')}
    <Header>
      <h1 className="App-title">MoonThor</h1>
    </Header>
    <ul>
      <li><Link to='/' onClick={onSidebarLinkClick}>Home</Link></li>
      <li>
        <Link to='/dashboards' onClick={onSidebarLinkClick}>List of dashboards</Link><br />
        Favorites:
        <ul>
          <li><Link to='/dashboards/view/asdf' onClick={onSidebarLinkClick}>Dashboard: asdf</Link></li>
        </ul>
      </li>
      <li><Link to='/about' onClick={onSidebarLinkClick}>About</Link></li>
    </ul>
  </Navigation>
)

export default class Main extends Component {
  mql = window.matchMedia(`(min-width: 800px)`)

  constructor(props) {
    super(props);

    this.state = {
      sidebarDocked: false,
      sidebarOpen: false,
      windowWidth: 0,
      windowHeight: 0,
    }
  }

  onBurgerClick = (event) => {
    this.setState({sidebarOpen: true});
    event.preventDefault();
  }

  onSidebarXClick = (event) => {
    this.setState({sidebarOpen: false});
    event.preventDefault();
  }

  onSidebarLinkClick = (event) => {
    this.setState({sidebarOpen: false});
    // follow up the link (don't do event.preventDefault())
  }

  onSetSidebarOpen = (open) => {
    this.setState({sidebarOpen: open});
  }

  componentWillMount() {
    this.mql.addListener(this.mediaQueryChanged);
    this.setState({sidebarDocked: this.mql.matches});
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
    this.setState({ windowWidth: window.innerWidth, windowHeight: window.innerHeight });
  }

  mediaQueryChanged = () => {
    this.setState({sidebarDocked: this.mql.matches});
  }

  render() {
    const CONTENT_PADDING_LR = 30;
    const CONTENT_PADDING_TB = 20;
    const SCROLLBAR_WIDTH = 20;  // contrary to Internet wisdom, it seems that window.innerWidth and document.body.clientWidth returns width of whole window with scrollbars too... this is a (temporary?) workaround.
    const innerWindowWidth = this.state.windowWidth - 2 * CONTENT_PADDING_LR - SCROLLBAR_WIDTH;
    const sidebarWidth = Math.min(300, this.state.windowWidth - 40);  // always leave a bit of place (40px) to the right of menu
    const contentWidth = this.state.sidebarDocked ? innerWindowWidth - sidebarWidth: innerWindowWidth;
    return (
      <Sidebar
              sidebar={(
                <SidebarContent
                  sidebarDocked={this.state.sidebarDocked}
                  onSidebarXClick={this.onSidebarXClick}
                  onSidebarLinkClick={this.onSidebarLinkClick}
                />
              )}
              open={this.state.sidebarOpen}
              docked={this.state.sidebarDocked}
              onSetOpen={this.onSetSidebarOpen}
              shadow={false}
              styles={{
                sidebar: {
                  backgroundColor: (this.state.sidebarDocked)?('#dedede'):('white'),
                  width: sidebarWidth,
                },
              }}>
          {(!this.state.sidebarDocked)?(
            <Button onClick={this.onBurgerClick}>burger</Button>
          ):('')}

        <div>
          <div style={{
            display: 'flex',
          }}>
            <NotificationsContainer />
          </div>
          <div style={{
            display: 'flex',
            width: contentWidth,
            padding: `${CONTENT_PADDING_TB}px ${CONTENT_PADDING_LR}px`,
          }}>
            <Content>
              <Switch>
                <WrappedRoute exact isPublic={true} contentWidth={contentWidth} path='/' component={Home}/>
                <WrappedRoute exact isPublic={true} contentWidth={contentWidth} path='/about' component={About}/>
                <WrappedRoute exact isPublic={true} contentWidth={contentWidth} path='/admin/first' component={AdminFirst}/>
                <WrappedRoute exact isPublic={true} contentWidth={contentWidth} path='/login' component={Login}/>
                {/* <WrappedRoute exact contentWidth={contentWidth} path='/login' component={Logout}/> */}

                <WrappedRoute exact contentWidth={contentWidth} path='/dashboards' component={DashboardsListContainer}/>
                <WrappedRoute exact contentWidth={contentWidth} path='/dashboards/new' component={DashboardNewFormContainer}/>
                <WrappedRoute exact contentWidth={contentWidth} path='/dashboards/view/:slug' component={DashboardViewContainer}/>
                <WrappedRoute exact contentWidth={contentWidth} path='/dashboards/view/:slug/widget/:widgetId/edit' component={DashboardWidgetEdit}/>

                <WrappedRoute isPublic={true} contentWidth={contentWidth} component={PageNotFound} />
              </Switch>
            </Content>
          </div>
        </div>

      </Sidebar>
    );
  }
}

