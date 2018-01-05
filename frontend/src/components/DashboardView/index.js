import React, { Component } from 'react';

import store from '../../store'
import { fetchDashboardDetails, submitShowNewChartForm } from '../../store/actions';

import Loading from '../Loading';
import ChartAddForm from '../ChartAddForm';

export default class DashboardView extends React.Component {

  componentWillMount() {
    store.dispatch(fetchDashboardDetails(this.props.match.params.slug))
  }

  render() {

    if (!this.props.valid) {
      if (this.props.fetching)
        return <Loading />
      else
        return (
          <div>
            Could not fetch data - please try again.
          </div>
        )
    }

    return (
      <div>
        Dashboard:
        <hr />
        {(this.props.fetching)?(
          <Loading />
        ):('')}
        {this.props.data.name}

        <ul>
          {this.props.data.charts.map((v) => {
            return (
              <li key={v.id}>Chart: {v.name}</li>
            )
          })}
        </ul>

        <ChartAddForm dashboardSlug={this.props.match.params.slug}/>
      </div>
    )
  }
};

