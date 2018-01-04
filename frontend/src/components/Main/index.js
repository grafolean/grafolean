import React, { Component } from 'react';
import { Switch, Route, Link } from 'react-router-dom'
import Sidebar from 'react-sidebar';
import styled from 'styled-components';
import uniqueId from 'lodash/uniqueId';

import './Main.css';
// import Chart from '../Chart'
import ChartContainer from '../../containers/ChartContainer'
import store from '../../store'
import { fetchChartData } from '../../store/actions';
import Home from '../Home'
import About from '../About'
import DashboardsList from '../DashboardsList'
import DashboardsListContainer from '../../containers/DashboardsListContainer'
import DashboardViewContainer from '../../containers/DashboardViewContainer'
import DashboardNewFormContainer from '../../containers/DashboardNewFormContainer'
import NotificationsContainer from '../../containers/NotificationsContainer'

const Navigation = styled.div`
  padding: 40px 40px;
  width: 400px;
  text-align: left;
`

const Flex = styled.div`
  display: flex;
`

const Header = styled.header`
  background-color: #eeffee;
  padding: 20px;
  width: 100%;
`

const Content = styled.div`
  background-color: #ffffcc;
`

const mql = window.matchMedia(`(min-width: 800px)`);

export default class Main extends Component {

  constructor(props) {
    super(props);

    this.state = {
      mql: mql,
      sidebarDocked: props.docked,
      sidebarOpen: props.open,
    }

    this.mediaQueryChanged = this.mediaQueryChanged.bind(this);
    this.onSetSidebarOpen = this.onSetSidebarOpen.bind(this);
    this.onBurgerClick = this.onBurgerClick.bind(this);
    this.onSidebarXClick = this.onSidebarXClick.bind(this);
    this.onSidebarLinkClick = this.onSidebarLinkClick.bind(this);
  }

  onBurgerClick(event) {
    this.setState({sidebarOpen: true});
    event.preventDefault();
  }

  onSidebarXClick(event) {
    this.setState({sidebarOpen: false});
    event.preventDefault();
  }

  onSidebarLinkClick(event) {
    this.setState({sidebarOpen: false});
    // follow up the link (don't do event.preventDefault())
  }

  onSetSidebarOpen(open) {
    this.setState({sidebarOpen: open});
  }

  componentWillMount() {
    this.state.mql.addListener(this.mediaQueryChanged);
    this.setState({mql: this.state.mql, sidebarDocked: this.state.mql.matches});
  }

  componentWillUnmount() {
    this.state.mql.removeListener(this.mediaQueryChanged);
  }

  mediaQueryChanged() {
    this.setState({sidebarDocked: this.state.mql.matches});
  }

  render() {
    let sidebarContent = (
      <Navigation>
        {(!this.state.sidebarDocked)?(
          <div>
            <h1 className="App-title">MoonThor</h1>
            <a href="#" onClick={this.onSidebarXClick}>X</a>
          </div>
        ):('')}
        <ul>
          <li><Link to='/' onClick={this.onSidebarLinkClick}>Home</Link></li>
          <li>
            <Link to='/dashboards' onClick={this.onSidebarLinkClick}>List of dashboards</Link><br />
            Favorites:
            <ul>
              <li><Link to='/dashboards/view/asdf' onClick={this.onSidebarLinkClick}>Dashboard: asdf</Link></li>
            </ul>
          </li>
          <li><Link to='/about' onClick={this.onSidebarLinkClick}>About</Link></li>
        </ul>
      </Navigation>
    )

    return (
      <Sidebar sidebar={sidebarContent}
              open={this.state.sidebarOpen}
              docked={this.state.sidebarDocked}
              onSetOpen={this.onSetSidebarOpen}
              shadow={false}
              styles={{
                sidebar: {
                  backgroundColor: 'white',
                }
              }}>
          {(this.state.sidebarDocked)?(
            <Header>
              <h1 className="App-title">MoonThor</h1>
            </Header>
          ):(
            <a href="#" onClick={this.onBurgerClick}>burger</a>
          )}

        <Flex>

          <NotificationsContainer />

          <Content>
            <Switch>
              <Route exact path='/' component={Home}/>
              <Route exact path='/dashboards' component={DashboardsListContainer}/>
              <Route exact path='/dashboards/new' component={DashboardNewFormContainer} formid={uniqueId("form-")}/>
              <Route exact path='/dashboards/view/:slug' component={DashboardViewContainer}/>
              <Route exact path='/about' component={About}/>
            </Switch>
          </Content>

        </Flex>

        {/* <ChartContainer paths={["test.path.1", "test.path.2"]}/>
        <input type="button" value="Refresh" onClick={() => { store.dispatch(fetchChartData("test.kaggle.execute_values", 1325317920, 1327897860)) }} /> */}
      </Sidebar>
    );
  }
}

