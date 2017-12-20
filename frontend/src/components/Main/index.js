import React, { Component } from 'react';
import './Main.css';
import Chart from '../Chart'
import store from '../../store'
import { fetchChartData } from '../../store/actions';

class Main extends Component {
  render() {
    return (
      <div className="App">
        <header className="App-header">
          <h1 className="App-title">MoonThor</h1>
        </header>
        <Chart />
        <input type="button" value="Refresh" onClick={() => { store.dispatch(fetchChartData("test.kaggle.execute_values", 1325317920, 1327897860)) }} />
      </div>
    );
  }
}

export default Main;
