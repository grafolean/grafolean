import { connect } from 'react-redux'
import DashboardsList from '../components/DashboardsList'

const mapStateToProps = (state, ownProps) => {
  if (!state.dashboards) {
    return {}
  }

  return {
    list: state.dashboards,
  }
}

const DashboardsListContainer = connect(
  mapStateToProps,
)(DashboardsList)

export default DashboardsListContainer
