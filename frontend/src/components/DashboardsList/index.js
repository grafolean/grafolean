import React, { Component } from 'react';
import { Link } from 'react-router-dom';

import Loading from '../Loading';
import DashboardDeleteLinkContainer from '../../containers/DashboardDeleteLinkContainer';

export default class DashboardsList extends React.Component {

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
        {(this.props.fetching)?(
          <Loading />
        ):('')}
        {this.props.valid?(
          <div>
            <Link to="/dashboards/new">+ Add dashboard</Link>
            <ul>
              {this.props.data.map((v) => {
                return (
                  <li key={v.slug}>
                    <Link to={`/dashboards/view/${v.slug}`}>{v.name}</Link>
                    (<DashboardDeleteLinkContainer slug={v.slug} />)
                  </li>
                )}
              )}
            </ul>
          </div>
        ):('')}
      </div>
    )
  }
}

