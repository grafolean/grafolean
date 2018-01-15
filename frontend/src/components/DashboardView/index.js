import React, { Component } from 'react';

import store from '../../store'
import { fetchDashboardDetails, submitShowNewChartForm } from '../../store/actions';

import Loading from '../Loading';
import ChartAddForm from '../ChartAddForm';
import ChartContainer from '../../containers/ChartContainer';

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

        <div>
          {this.props.data.charts.map((v) => {
            return (
              <ChartContainer key={v.id} chartId={v.id} name={v.name} paths={v.paths}/>
            )
          })}
        </div>

        <ChartAddForm dashboardSlug={this.props.match.params.slug}/>
      </div>
    )
  }
};

