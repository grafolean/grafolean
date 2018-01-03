import { connect } from 'react-redux'

import store from '../store'
import { fetchDashboardDetails } from '../store/actions';

import DashboardView from '../components/DashboardView'

const mapStateToProps = (state, ownProps) => {
  // parameter 'slug' comes from React Router:
  let slug = ownProps.match.params.slug;

  let defaultProps = {
    slug: slug,
  }

  if ((!state.dashboards) || (!state.dashboards.details) || (!state.dashboards.details[slug])) {
    store.dispatch(fetchDashboardDetails(slug))
    return defaultProps;
  }

  return {
    ...defaultProps,
    ...state.dashboards.details[slug],
  }
}

const DashboardViewContainer = connect(
  mapStateToProps,
)(DashboardView)

export default DashboardViewContainer
