import { connect } from 'react-redux'
import DashboardsList from '../components/DashboardsList'

const mapStateToProps = (state, ownProps) => {
  if ((!state.dashboards) || (!state.dashboards.list)) {
    return {}
  }

  return {
    list: state.dashboards.list,
  }
}

const DashboardsListContainer = connect(
  mapStateToProps,
)(DashboardsList)

export default DashboardsListContainer
