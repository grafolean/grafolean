import React, { Component } from 'react';
import { Switch, Route, Link } from 'react-router-dom'

import './Main.css';
// import Chart from '../Chart'
import ChartContainer from '../../containers/ChartContainer'
import store from '../../store'
import { fetchChartData } from '../../store/actions';
import Home from '../Home'
import About from '../About'
import Dashboard from '../Dashboard'
import DashboardsList from '../DashboardsList'

class Main extends Component {
  render() {
    return (
      <div className="App">
        <header className="App-header">
          <h1 className="App-title">MoonThor</h1>
        </header>

        <nav>
          <ul>
            <li><Link to='/'>Home</Link></li>
            <li><Link to='/dashboards'>List of dashboards</Link></li>
            <li><Link to='/dashboards/asdf'>Dashboard: asdf</Link></li>
            <li><Link to='/about'>About</Link></li>
          </ul>
        </nav>

        <Switch>
          <Route exact path='/' component={Home}/>
          <Route exact path='/dashboards' component={DashboardsList}/>
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
