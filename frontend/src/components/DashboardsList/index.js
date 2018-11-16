import React from 'react';
import { Link } from 'react-router-dom';
import { connect } from 'react-redux';

import store from '../../store';
import { fetchDashboardsList } from '../../store/actions';

import Loading from '../Loading';
import DashboardDeleteLink from '../DashboardDeleteLink';

class DashboardsList extends React.Component {
  render() {
    if (!this.props.valid && !this.props.fetching) {
      return <div>Could not fetch data - please try again.</div>;
    }

    return (
      <div>
        {this.props.fetching ? <Loading /> : ''}
        {this.props.valid ? (
          <div>
            <Link to="/dashboards/new">+ Add dashboard</Link>
            <ul>
              {this.props.data.map(v => {
                return (
                  <li key={v.slug}>
                    <Link to={`/dashboards/view/${v.slug}`}>{v.name}</Link>(
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
  if (storeState.dashboards.list.refetch) {
    store.dispatch(fetchDashboardsList());
    return { ...storeState.dashboards.list, fetching: true };
  }
  return storeState.dashboards.list;
};
export default connect(mapStoreToProps)(DashboardsList);
