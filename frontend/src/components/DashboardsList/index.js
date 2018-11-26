import React from 'react';
import { Link } from 'react-router-dom';
import { connect } from 'react-redux';

import store from '../../store';
import { fetchDashboardsList } from '../../store/actions';

import Loading from '../Loading';
import DashboardDeleteLink from '../DashboardDeleteLink';

class DashboardsList extends React.Component {
  componentDidMount() {
    store.dispatch(fetchDashboardsList());
  }

  render() {
    if (!this.props.valid && !this.props.fetching) {
      return <div>Could not fetch data - please try again.</div>;
    }

    return (
      <div>
        {this.props.fetching ? <Loading /> : ''}
        {this.props.valid ? (
          <div>
            <Link className="button blue" to="/dashboards/new">+ Add dashboard</Link>
            <ul>
              {this.props.dashboards.map(v => {
                return (
                  <li key={v.slug}>
                    <Link className="button" to={`/dashboards/view/${v.slug}`}>{v.name}</Link>(
                    <DashboardDeleteLink slug={v.slug} />)
                  </li>
                );
              })}
            </ul>
          </div>
        ) : (
          ''
        )}
      </div>
    );
  }
}

const mapStoreToProps = storeState => {
  const { data, valid, fetching } = storeState.dashboards.list;
  return {
    dashboards: data,
    valid: valid,
    fetching: fetching,
  };
};
export default connect(mapStoreToProps)(DashboardsList);
