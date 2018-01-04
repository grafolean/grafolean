import React, { Component } from 'react';

import store from '../../store'
import { fetchDashboardDetails, submitShowNewChartForm } from '../../store/actions';

import Loading from '../Loading';
import AddChart from '../AddChart';

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

        <AddChart dashboardSlug={this.props.match.params.slug}/>
      </div>
    )
  }
};

