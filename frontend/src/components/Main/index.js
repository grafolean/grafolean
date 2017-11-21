import React, { Component } from 'react';
import './Main.css';
import Chart from '../../components/Chart'

class Main extends Component {
  render() {
    return (
      <div className="App">
        <header className="App-header">
          <h1 className="App-title">MoonThor</h1>
        </header>
        <p className="App-intro">
          <Chart />
        </p>
      </div>
    );
  }
}

export default Main;
