import React, { Component } from 'react';

import Loading from '../Loading';

import store from '../../store'
import { fetchDashboardDetails } from '../../store/actions';

export default class DashboardView extends React.Component {

  componentWillMount() {
    store.dispatch(fetchDashboardDetails(this.props.match.params.slug))
  }

  render() {

    if ((!this.props.valid) && (!this.props.fetching)) {
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
          {(this.props.valid)?(
            this.props.data.name
          ):('')}

      </div>
    )
  }
};

