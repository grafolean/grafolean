import React, { Component } from 'react';
import { Switch, Route, Link } from 'react-router-dom'
import styled from 'styled-components';

import './Main.css';
// import Chart from '../Chart'
import ChartContainer from '../../containers/ChartContainer'
import store from '../../store'
import { fetchChartData } from '../../store/actions';
import Home from '../Home'
import About from '../About'
import Dashboard from '../Dashboard'
import DashboardsList from '../DashboardsList'
import DashboardsListContainer from '../../containers/DashboardsListContainer'

const Navigation = styled.div`
  padding: 40px 40px;
  background-color: #eeeeee;
  width: 400px;
  float: left;
  text-align: left;
`

class Main extends Component {
  render() {
    return (
      <div className="App">
        <header className="App-header">
          <h1 className="App-title">MoonThor</h1>
        </header>

        <Navigation>
          <ul>
            <li><Link to='/'>Home</Link></li>
            <li>
              <Link to='/dashboards'>List of dashboards</Link><br />
              Favorites:
              <ul>
                <li><Link to='/dashboards/asdf'>Dashboard: asdf</Link></li>
              </ul>
            </li>
            <li><Link to='/about'>About</Link></li>
          </ul>
        </Navigation>

        <Switch>
          <Route exact path='/' component={Home}/>
          <Route exact path='/dashboards' component={DashboardsListContainer}/>
          <Route exact path='/dashboards/:slug' component={Dashboard}/>
          <Route path='/about' component={About}/>
        </Switch>

        {/* <ChartContainer paths={["test.path.1", "test.path.2"]}/>
        <input type="button" value="Refresh" onClick={() => { store.dispatch(fetchChartData("test.kaggle.execute_values", 1325317920, 1327897860)) }} /> */}
      </div>
    );
  }
}

export default Main;
