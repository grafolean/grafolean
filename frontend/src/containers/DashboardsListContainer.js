import { connect } from 'react-redux'
import DashboardsList from '../components/DashboardsList'

import store from '../store';
import { fetchDashboardsList } from '../store/actions';

const mapStateToProps = (state, ownProps) => {

  if (state.dashboards.list.refetch) {
    store.dispatch(fetchDashboardsList())
    return {...state.dashboards.list, fetching: true}
  }

  return state.dashboards.list
}

const DashboardsListContainer = connect(
  mapStateToProps,
)(DashboardsList)

export default DashboardsListContainer
