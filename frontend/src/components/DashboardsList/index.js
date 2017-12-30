import React, { Component } from 'react';

import store from '../../store'
import { fetchDashboardsList } from '../../store/actions';

import Loading from '../Loading'

class DashboardsList extends React.Component {

  componentDidMount() {
    store.dispatch(fetchDashboardsList())
  }

  render() {
    return (
      <div>
        {((!this.props.list) || (this.props.list.length == 0)) ? (
          <Loading />
        ) : (
          <ul>
            {this.props.list.map((v) => {
              return (
                <li>{v.name} ({v.slug})</li>
              )}
            )}
          </ul>
          )}
      </div>
    )
  }
}

export default DashboardsList;
