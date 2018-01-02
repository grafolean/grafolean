import { connect } from 'react-redux'
import DashboardView from '../components/DashboardView'

const mapStateToProps = (state, ownProps) => {
  // parameter 'slug' comes from React Router:
  let slug = ownProps.match.params.slug;

  let defaultProps = {
    slug: slug,
    loading: true,
  }

  if (!state.dashboards) {
    return defaultProps;
  }

  let dashboardData = state.dashboards.filter((value) => {return (value.slug == slug)});
  if (dashboardData.length == 0) {
    return defaultProps;
  }

  return {
    ...defaultProps,
    ...dashboardData[0],
    loading: false,
  }
}

const DashboardViewContainer = connect(
  mapStateToProps,
)(DashboardView)

export default DashboardViewContainer
