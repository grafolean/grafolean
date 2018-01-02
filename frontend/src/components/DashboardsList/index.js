import React, { Component } from 'react';
import { Link } from 'react-router-dom';

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
          <div>
            <Link to="/dashboards/new">+ Add dashboard</Link>
            <ul>
              {this.props.list.map((v) => {
                return (
                  <li>
                    <Link to={`/dashboards/view/${v.slug}`}>{v.name}</Link>
                  </li>
                )}
              )}
            </ul>
          </div>
          )}
      </div>
    )
  }
}

export default DashboardsList;
