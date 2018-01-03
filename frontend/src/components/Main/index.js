import React, { Component } from 'react';
import { Switch, Route, Link } from 'react-router-dom'
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
  background-color: #eeeeee;
  width: 400px;
  text-align: left;
`

const App = styled.div`
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

class Main extends Component {
  render() {
    return (
      <App>
        <Header>
          <h1 className="App-title">MoonThor</h1>
        </Header>

        <Flex>

          <Navigation>
            <ul>
              <li><Link to='/'>Home</Link></li>
              <li>
                <Link to='/dashboards'>List of dashboards</Link><br />
                Favorites:
                <ul>
                  <li><Link to='/dashboards/view/asdf'>Dashboard: asdf</Link></li>
                </ul>
              </li>
              <li><Link to='/about'>About</Link></li>
            </ul>
          </Navigation>

          <NotificationsContainer />

          <Content>
            <Switch>
              <Route exact path='/' component={Home}/>
              <Route exact path='/dashboards' component={DashboardsListContainer}/>
              <Route exact path='/dashboards/new' component={DashboardNewFormContainer} formid={uniqueId("form-")}/>
              <Route exact path='/dashboards/view/:slug' component={DashboardViewContainer}/>
              <Route path='/about' component={About}/>
            </Switch>
          </Content>

        </Flex>

        {/* <ChartContainer paths={["test.path.1", "test.path.2"]}/>
        <input type="button" value="Refresh" onClick={() => { store.dispatch(fetchChartData("test.kaggle.execute_values", 1325317920, 1327897860)) }} /> */}
      </App>
    );
  }
}

export default Main;
